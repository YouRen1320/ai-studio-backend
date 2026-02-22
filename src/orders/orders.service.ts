import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 创建订单（使用事务，保证原子性）
  async createOrder(userId: number) {
    // 1. 先查购物车（事务外查询，因为这一步只是读取，不涉及写入风险）
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
    });
    if (!cartItems.length)
      throw new BadRequestException('购物车是空的，无法下单');

    // 2. 计算总价并检查库存
    let totalPrice = 0;
    for (const item of cartItems) {
      if (item.product.stock < item.quantity) {
        throw new BadRequestException(`商品 ${item.product.name} 库存不足`);
      }
      totalPrice += Number(item.product.price) * item.quantity;
    }

    // 3. 🔒 开启事务：创建订单 + 清空购物车 + 扣减库存
    const newOrder = await this.prisma.$transaction(async (tx) => {
      // 3a. 在事务中创建订单（默认状态为 PENDING）
      const order = await tx.order.create({
        data: {
          totalPrice: totalPrice,
          userId: userId,
          items: {
            create: cartItems.map((item) => ({
              product: { connect: { id: item.productId } },
              quantity: item.quantity,
              price: Number(item.product.price),
            })),
          },
        },
      });

      // 3b. 扣减商品库存
      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // 3c. 在事务中清空购物车
      await tx.cartItem.deleteMany({
        where: { userId: userId },
      });

      // 返回创建好的订单
      return order;
    });

    return {
      message: '下单成功，请在 15 分钟内支付！',
      orderId: newOrder.id,
      totalPrice: newOrder.totalPrice,
      status: newOrder.status,
    };
  }

  // 查看当前用户的所有订单
  async findAll(userId: number) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 🤖 机器人巡逻：每分钟执行一次
  @Cron(CronExpression.EVERY_MINUTE)
  async cancelUnpaidOrders() {
    this.logger.log('🕵️‍♂️ 开始巡逻：检查是否有超时未支付的订单...');

    // 1. 计算 15 分钟前的时间节点
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // 2. 找到所有 状态为 PENDING 且 创建时间在 15分钟前 的订单
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          lt: fifteenMinutesAgo, // less than (早于15分钟前)
        },
      },
      include: {
        items: true, // 必须携带订单明细，因为我们要依靠明细来归还库存
      },
    });

    if (expiredOrders.length === 0) {
      this.logger.log('✅ 巡逻完毕：当前没有超时订单。');
      return;
    }

    this.logger.warn(
      `⚠️ 发现 ${expiredOrders.length} 个超时订单，准备执行取消和库存归还...`,
    );

    // 3. 使用事务：安全地更新这些订单的状态并归还库存
    for (const order of expiredOrders) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // a. 把订单状态改成 CANCELLED
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'CANCELLED' },
          });

          // b. 遍历订单明细，把里面的每一个商品数量加回它的 stock 中！
          for (const item of order.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: { increment: item.quantity }, // increment 原子自增
              },
            });
          }
        });
        this.logger.log(`❌ 订单 #${order.id} 超时已取消，库存已归还。`);
      } catch (error) {
        this.logger.error(
          `❌ 取消订单 #${order.id} 失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
