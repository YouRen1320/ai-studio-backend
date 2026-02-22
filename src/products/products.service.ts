import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { QueryProductDto } from './dto/query-product.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache, // 注入缓存管理器
  ) {}

  // 获取商品列表（支持分页 + 关键词搜索 + Redis 缓存）
  async getAllProducts(query: QueryProductDto) {
    const { page = 1, limit = 10, keyword } = query;

    // 1. 生成缓存 Key（不同的查询条件对应不同的缓存）
    const cacheKey = `products:page=${page}:limit=${limit}:keyword=${keyword || ''}`;

    // 2. 先从 Redis 缓存中查找
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached; // 🚀 命中缓存！直接返回，不查数据库
    }

    // 3. 缓存未命中，查数据库
    const where = {
      isActive: true,
      ...(keyword && {
        name: {
          contains: keyword,
          mode: 'insensitive' as const,
        },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    const result = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    // 4. 把查询结果写入 Redis 缓存（TTL 60 秒）
    await this.cacheManager.set(cacheKey, result, 60 * 1000);

    return result;
  }

  // 根据商品id寻找某个商品
  findOne(id: number) {
    return this.prisma.product.findUnique({
      where: { id: id },
    });
  }

  // 上架新的商品（写操作后清除缓存）
  async createProduct(name: string, price: number) {
    const product = await this.prisma.product.create({
      data: { name, price },
    });

    // 商品数据变了，清除所有商品列表缓存
    await this.clearProductListCache();

    return product;
  }

  // 下架商品（软删除 + 清缓存）
  async deactivateProduct(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    if (!product.isActive) {
      return { message: '该商品已经是下架状态' };
    }

    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    // 商品状态变了，清除缓存
    await this.clearProductListCache();

    return { message: `商品「${product.name}」已下架` };
  }

  // 更新商品图片（写操作 + 清缓存）
  async updateImage(id: number, imageUrl: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { imageUrl },
    });

    // 商品数据变了，清除缓存
    await this.clearProductListCache();

    return updated;
  }

  // 辅助方法：清除所有商品列表缓存
  // 使用 Redis 的 keys 命令找到所有 products: 开头的缓存并删除
  private async clearProductListCache() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const client = (this.cacheManager as any)?.store?.client;
    if (client) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const keys: string[] = await client.keys('products:*');
      if (keys.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await client.del(keys);
      }
    }
  }
}
