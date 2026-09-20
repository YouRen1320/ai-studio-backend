import { Test } from '@nestjs/testing';
import { ProductsService } from './products.service';
// 使用依赖注入替身隔离持久化与外部服务，执行实际业务方法。
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '../prisma.service';
describe('ProductsService 缓存与分页', () => {
  let service: ProductsService;
  const prisma = { product: { findMany: jest.fn(), count: jest.fn() } };
  const cache = { get: jest.fn(), set: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();
    service = module.get(ProductsService);
  });
  it('命中缓存时不读取数据库', async () => {
    const result = { items: [{ id: 1 }], total: 1 };
    cache.get.mockResolvedValue(result);
    await expect(service.getAllProducts({})).resolves.toEqual(result);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
    expect(prisma.product.count).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });
  it('未命中时按关键词分页并缓存完整结果', async () => {
    prisma.product.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.product.count.mockResolvedValue(11);
    const result = {
      items: [{ id: 1 }],
      total: 11,
      page: 2,
      limit: 5,
      totalPages: 3,
    };
    await expect(
      service.getAllProducts({ page: 2, limit: 5, keyword: '书' }),
    ).resolves.toEqual(result);
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { isActive: true, name: { contains: '书', mode: 'insensitive' } },
      skip: 5,
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    expect(cache.set).toHaveBeenCalledWith(
      'products:page=2:limit=5:keyword=书',
      result,
      60000,
    );
  });
});
