import { Test } from '@nestjs/testing';
import { OrdersService } from './orders.service';
// 使用依赖注入替身隔离持久化与外部服务，执行实际业务方法。
import { PrismaService } from '../prisma.service';
describe('OrdersService 下单边界', () => {
  let service: OrdersService;
  const tx = {
    order: { create: jest.fn() },
    product: { update: jest.fn() },
    cartItem: { deleteMany: jest.fn() },
  };
  const prisma = { cartItem: { findMany: jest.fn() }, $transaction: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks();
    // 执行真实服务事务回调，但所有数据库操作都由内存替身接收。
    prisma.$transaction.mockImplementation(
      (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    );
    const module = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(OrdersService);
  });
  it('空购物车不创建事务', async () => {
    prisma.cartItem.findMany.mockResolvedValue([]);
    await expect(service.createOrder(7)).rejects.toThrow('购物车是空的');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('库存不足不写入订单', async () => {
    prisma.cartItem.findMany.mockResolvedValue([
      {
        productId: 3,
        quantity: 2,
        product: { name: '书', stock: 1, price: '12.50' },
      },
    ]);
    await expect(service.createOrder(7)).rejects.toThrow('库存不足');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('计算金额并在事务内扣库存、清空当前用户购物车', async () => {
    prisma.cartItem.findMany.mockResolvedValue([
      {
        productId: 3,
        quantity: 2,
        product: { name: '书', stock: 5, price: '12.50' },
      },
    ]);
    tx.order.create.mockResolvedValue({
      id: 8,
      totalPrice: 25,
      status: 'PENDING',
    });
    await expect(service.createOrder(7)).resolves.toMatchObject({
      orderId: 8,
      totalPrice: 25,
      status: 'PENDING',
    });
    expect(prisma.cartItem.findMany).toHaveBeenCalledWith({
      where: { userId: 7 },
      include: { product: true },
    });
    expect(tx.order.create).toHaveBeenCalledWith({
      data: {
        totalPrice: 25,
        userId: 7,
        items: {
          create: [
            { product: { connect: { id: 3 } }, quantity: 2, price: 12.5 },
          ],
        },
      },
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { stock: { decrement: 2 } },
    });
    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { userId: 7 },
    });
  });
});
