import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { QueryProductDto } from './dto/query-product.dto';

@Injectable()
export class ProductsService {
  // 注入prisma
  constructor(private prisma: PrismaService) {}

  // 获取商品列表（支持分页 + 关键词搜索 + 排除已下架）
  async getAllProducts(query: QueryProductDto) {
    const { page = 1, limit = 10, keyword } = query;

    // 构建查询条件：只查在架商品 + 可选的关键词搜索
    const where = {
      isActive: true, // 只查在架商品
      ...(keyword && {
        name: {
          contains: keyword, // 模糊搜索（包含关键词）
          mode: 'insensitive' as const, // 不区分大小写
        },
      }),
    };

    // 同时查数据和总数（并行查询，性能更好）
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit, // 跳过前面的记录
        take: limit, // 只取 limit 条
        orderBy: { createdAt: 'desc' }, // 按创建时间倒序
      }),
      this.prisma.product.count({ where }), // 查总数
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit), // 总页数
    };
  }

  // 根据商品id寻找某个商品
  findOne(id: number) {
    return this.prisma.product.findUnique({
      where: { id: id },
    });
  }

  // 上架新的商品
  createProduct(name: string, price: number) {
    return this.prisma.product.create({
      data: {
        name,
        price,
      },
    });
  }

  // 下架商品（软删除：不物理删除数据，只把 isActive 设为 false）
  async deactivateProduct(id: number) {
    // 先检查商品是否存在
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

    return { message: `商品「${product.name}」已下架` };
  }

  // 更新商品图片
  async updateImage(id: number, imageUrl: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    return this.prisma.product.update({
      where: { id },
      data: { imageUrl },
    });
  }
}
