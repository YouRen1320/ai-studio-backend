import { Test } from '@nestjs/testing';
import { CartService } from './cart.service';
// 使用依赖注入替身隔离持久化与外部服务，执行实际业务方法。
import { PrismaService } from '../prisma.service';
describe('CartService 用户范围与金额', () => {
  let service: CartService;
  const prisma = {
    product: { findUnique: jest.fn() },
    cartItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [CartService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(CartService);
  });
  it.each([null, { isActive: false }])(
    '不存在或下架的商品拒绝加入购物车',
    async (product) => {
      prisma.product.findUnique.mockResolvedValue(product);
      await expect(
        service.addToCart({ productId: 3, quantity: 2 }, 7),
      ).rejects.toThrow();
      expect(prisma.cartItem.create).not.toHaveBeenCalled();
      expect(prisma.cartItem.update).not.toHaveBeenCalled();
    },
  );
  it('已有商品累加数量且查询限定当前用户', async () => {
    prisma.product.findUnique.mockResolvedValue({ isActive: true });
    prisma.cartItem.findFirst.mockResolvedValue({ id: 9, quantity: 3 });
    await service.addToCart({ productId: 3, quantity: 2 }, 7);
    expect(prisma.cartItem.findFirst).toHaveBeenCalledWith({
      where: { productId: 3, userId: 7 },
    });
    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { quantity: 5 },
    });
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
  });
  it('将数据库金额转换为数值并计算小计与总计', async () => {
    prisma.cartItem.findMany.mockResolvedValue([
      { id: 9, quantity: 2, product: { name: '书', price: '12.50' } },
    ]);
    await expect(service.getCart(7)).resolves.toEqual({
      items: [
        {
          cartItemId: 9,
          productName: '书',
          price: 12.5,
          quantity: 2,
          subtotal: 25,
        },
      ],
      totalPrice: 25,
    });
    expect(prisma.cartItem.findMany).toHaveBeenCalledWith({
      where: { userId: 7 },
      include: { product: true },
    });
  });
});
