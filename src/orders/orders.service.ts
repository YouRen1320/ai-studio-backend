import { BadRequestException, Injectable } from '@nestjs/common';
// import * as fs from 'fs';
// import * as path from 'path';
import { CartService } from 'src/cart/cart.service';
// import { OrdersDto } from './dto/orders.dto';
import { PrismaService } from 'src/prisma.service'; // 1. 引入 Prisma

@Injectable()
export class OrdersService {
  // 订单也需要存文件
  // private readonly filePath = path.join(process.cwd(), 'orders.json');
  // 注入购物车数据
  constructor(
    private readonly cartService: CartService,
    private readonly prisma: PrismaService, // 2. 注入 Prisma
  ) {}

  // 创建订单
  async createOrder(userId: number) {
    // 1.去数据库里面把购物车当前的条目和对应的商品信息全拿出来
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId }, // 只查这个用户的购物车
      include: { product: true },
    });
    if (!cartItems.length)
      throw new BadRequestException('购物车是空的，无法下单');

    // 2.计算这笔订单总价
    const totalPrice = cartItems.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0,
    );

    // 3.在数据库中创建订单（prisma的嵌套写入）
    // 它会同时在Order表和OrderItem表里插入数据，保证数据的一致性
    const newOrder = await this.prisma.order.create({
      data: {
        totalPrice: totalPrice,
        userId: userId, // 关联到用户
        // 直接在创建订单的同时，创建明细
        items: {
          create: cartItems.map((item) => ({
            product: { connect: { id: item.productId } }, // 关联到已有商品
            quantity: item.quantity,
            price: Number(item.product.price), // 记录下这一刻的单价
          })),
        },
      },
    });

    // 4. 订单生成成功，清空购物车表
    await this.cartService.clearCart();

    return {
      message: '下单成功！',
      orderId: newOrder.id,
      totalPrice: newOrder.totalPrice,
    };

    // // 1.从当前购物车获取当前商品和总价（getCart 是异步的，需要 await）
    // const cartData = await this.cartService.getCart();
    // // 如果购物车是空的，禁止用户创建订单
    // if (cartData.items.length === 0) {
    //   return { message: '购物车是空的，无法下单' };
    // }
    // // 2.否则生成一个新的订单对象
    // const newOrder: OrdersDto = {
    //   id: Date.now(), // 用时间戳随机模拟一个订单号
    //   date: new Date().toISOString(), //下单时间
    //   items: cartData.items, //商品列表
    //   totalPrice: cartData.totalPrice, //订单总价
    // };
    // // 3.如果有旧订单的话，把新订单追加进去
    // let orders: OrdersDto[] = [];
    // if (fs.existsSync(this.filePath)) {
    //   orders = JSON.parse(
    //     fs.readFileSync(this.filePath, 'utf-8'),
    //   ) as OrdersDto[];
    // }
    // orders.push(newOrder);
    // // 4.保存订单文件
    // fs.writeFileSync(this.filePath, JSON.stringify(orders, null, 2));
    // // 5.下单成功以后，清空购物车
    // this.cartService.clearCart();
    // return {
    //   message: '下单成功！',
    //   orderId: newOrder.id,
    // };
  }

  // 查看所有订单
  async findAll() {
    // if (fs.existsSync(this.filePath)) {
    //   return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as OrdersDto[];
    // }
    // return [];

    // 连表查询：查处订单 -> 包含订单明细 -> 包含具体商品信息
    return this.prisma.order.findMany({
      include: {
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' }, // 按时间倒序排列 (最新的订单在最上面)
    });
  }
}
