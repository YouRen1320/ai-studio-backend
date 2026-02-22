import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class OrdersService {
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

    // 2. 计算总价
    const totalPrice = cartItems.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0,
    );

    // 3. 🔒 开启事务：创建订单 + 清空购物车，要么全成功，要么全回滚
    const newOrder = await this.prisma.$transaction(async (tx) => {
      // 3a. 在事务中创建订单（用 tx 而不是 this.prisma）
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

      // 3b. 在事务中清空购物车（用 tx 而不是 this.prisma）
      await tx.cartItem.deleteMany({
        where: { userId: userId },
      });

      // 返回创建好的订单
      return order;
    });

    return {
      message: '下单成功！',
      orderId: newOrder.id,
      totalPrice: newOrder.totalPrice,
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
}
