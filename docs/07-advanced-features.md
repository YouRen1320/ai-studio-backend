# 七、进阶功能（分页 + 软删除 + 文件上传）

> 本篇涵盖分页与条件查询、商品软删除（下架/上架），以及 Multer 文件上传与静态文件服务。

---

## 1. 分页与条件查询 (Pagination)

当商品有 **10 万个**时，一次性返回所有数据，前端页面会直接卡死，数据库也会被压垮。**分页查询**就像翻书一样，每次只翻一页。

### 创建分页查询 DTO（`src/products/dto/query-product.dto.ts`）

```typescript
import { IsOptional, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QueryProductDto {
  @ApiProperty({ description: '页码', example: 1, required: false })
  @IsOptional()
  @Type(() => Number) // Query 参数默认是字符串，要转成数字
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码最小为1' })
  page?: number = 1;

  @ApiProperty({ description: '每页数量', example: 10, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量最小为1' })
  limit?: number = 10;

  @ApiProperty({
    description: '搜索关键词（按商品名模糊搜索）',
    example: 'iPhone',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '关键词必须是字符串' })
  keyword?: string;
}
```

**关键点：**

| 概念                  | 说明                                                      |
| --------------------- | --------------------------------------------------------- |
| `@IsOptional()`       | 这个字段是可选的，不传也没关系                            |
| `@Type(() => Number)` | URL 查询参数都是字符串，`@Type` 自动把 `"1"` 转成数字 `1` |
| `page = 1`            | 默认值，如果前端不传 `page`，就默认查第一页               |
| `limit = 10`          | 默认每页 10 条                                            |
| `keyword`             | 可选的搜索关键词，前端不传就查全部                        |

> ⚠️ **重要**：`@Type` 装饰器需要在 `main.ts` 的 `ValidationPipe` 中开启 `transform: true` 才能生效：
>
> ```typescript
> app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
> ```

### Service 层

```typescript
async getAllProducts(query: QueryProductDto) {
  const { page = 1, limit = 10, keyword } = query;

  // 构建查询条件：只查在架商品 + 可选的关键词搜索
  const where = {
    isActive: true,
    ...(keyword && {
      name: {
        contains: keyword,
        mode: 'insensitive' as const, // 不区分大小写
      },
    }),
  };

  // 同时查数据和总数（并行查询，性能更好）
  const [items, total] = await Promise.all([
    this.prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.product.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
```

**Prisma 分页核心参数：**

| 参数                  | 说明                       | 示例                             |
| --------------------- | -------------------------- | -------------------------------- |
| `skip`                | 跳过前面多少条记录         | 第 2 页、每页 10 条 → `skip: 10` |
| `take`                | 取多少条记录               | 每页 10 条 → `take: 10`          |
| `contains`            | 模糊搜索（包含某个字符串） | 类似 SQL 的 `LIKE '%keyword%'`   |
| `mode: 'insensitive'` | 不区分大小写搜索           | `iphone` 和 `iPhone` 都能搜到    |

### Controller 层

```typescript
@Get()
findAll(@Query() query: QueryProductDto) {
  return this.productsService.getAllProducts(query);
}
```

> 💡 `@Query()` 从 URL 查询字符串中提取参数。比如 `/products?page=2&limit=5&keyword=iPhone`。

### 测试

```bash
# 查第 1 页，每页 10 条（默认）
curl http://localhost:3000/products

# 查第 2 页，每页 5 条
curl "http://localhost:3000/products?page=2&limit=5"

# 搜索包含 "iPhone" 的商品，每页 3 条
curl "http://localhost:3000/products?keyword=iPhone&limit=3"
```

**返回格式：**

```json
{
  "code": 200,
  "message": "请求成功",
  "data": {
    "items": [
      { "id": 1, "name": "iPhone 16", "price": "5999", "isActive": true }
    ],
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

## 2. 软删除 (Soft Delete)

在电商系统中，**绝对不能真的把商品从数据库里删掉**！

- 历史订单里关联着这个商品（外键约束），删了商品，订单数据就"断链"了
- 运营可能只是临时下架，过段时间还要重新上架
- 公司需要保留历史数据做分析

**软删除的思路**：给商品加一个"开关"（`isActive` 字段），`true` = 在架，`false` = 已下架。

### 修改数据库 Schema

```prisma
model Product {
  // ... 原有字段保持不变
  isActive    Boolean     @default(true) // 是否上架（软删除标记）
}
```

```bash
npx prisma migrate dev --name add-product-soft-delete-and-image
```

> 💡 `@default(true)` 表示新商品默认是上架状态。已有的商品在迁移后也会自动设为 `true`。

### 下架方法（Service）

```typescript
async deactivateProduct(id: number) {
  const product = await this.prisma.product.findUnique({ where: { id } });

  if (!product) throw new NotFoundException('商品不存在');
  if (!product.isActive) return { message: '该商品已经是下架状态' };

  await this.prisma.product.update({
    where: { id },
    data: { isActive: false },
  });

  return { message: `商品「${product.name}」已下架` };
}
```

### 下架接口（Controller）

```typescript
@Patch(':id/deactivate')
deactivate(@Param('id', ParseIntPipe) id: number) {
  return this.productsService.deactivateProduct(id);
}
```

> 💡 为什么用 `PATCH` 而不是 `DELETE`？因为我们没有真的删除资源，只是"修改"了它的状态。`PATCH` 更符合 RESTful 语义。

### 购物车配合检查

在 `cart.service.ts` 的 `addToCart()` 中：

```typescript
if (!productExists.isActive) {
  throw new BadRequestException('该商品已下架，无法添加到购物车');
}
```

### 测试

```bash
# 下架商品 ID=1
curl -X PATCH http://localhost:3000/products/1/deactivate
# 返回: { "message": "商品「iPhone 16」已下架" }

# 再查商品列表，ID=1 不见了
curl http://localhost:3000/products

# 尝试把下架商品加到购物车 → 被拒绝
curl -X POST http://localhost:3000/cart \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"productId": 1, "quantity": 1}'
# 返回: { "code": 400, "message": "该商品已下架，无法添加到购物车" }

# 但之前的订单仍然能正常查看 ✅
curl http://localhost:3000/orders -H "Authorization: Bearer <token>"
```

**软删除 vs 硬删除对比：**

| 方式                    | 操作                       | 数据还在？ | 订单会报错？ | 能恢复？ |
| ----------------------- | -------------------------- | ---------- | ------------ | -------- |
| 硬删除 `delete()`       | 物理删除数据库记录         | ❌ 没了    | ❌ 外键报错  | ❌ 不能  |
| 软删除 `isActive=false` | 改个标记，数据还在数据库里 | ✅ 还在    | ✅ 不影响    | ✅ 可以  |

---

## 3. 文件上传 (Multer)

之前商品只有名称和价格，没有图片。现在我们给商品加上图片上传功能。

NestJS 底层使用 Express，文件上传用的是 **Multer** 中间件。NestJS 已经内置了封装。

### 修改数据库 Schema

```prisma
model Product {
  // ... 原有字段保持不变
  imageUrl    String?     // 商品图片地址（可选）
}
```

> 💡 `imageUrl` 是可选字段（`?`），因为创建商品时可能还没有图片。

### 安装类型声明

```bash
pnpm add -D @types/multer
```

### 上传接口（Controller）

```typescript
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Post(':id/upload-image')
@UseInterceptors(
  FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
        cb(null, uniqueName);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
        cb(new Error('只允许上传图片文件！'), false);
      } else {
        cb(null, true);
      }
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 最大 5MB
  }),
)
async uploadImage(
  @Param('id', ParseIntPipe) id: number,
  @UploadedFile() file: Express.Multer.File,
) {
  const imageUrl = `/uploads/${file.filename}`;
  const product = await this.productsService.updateImage(id, imageUrl);
  return {
    message: '图片上传成功！',
    imageUrl: product.imageUrl,
  };
}
```

**关键概念：**

| 概念                      | 说明                             |
| ------------------------- | -------------------------------- |
| `FileInterceptor('file')` | 拦截表单中 `file` 字段的文件     |
| `diskStorage`             | 将文件存到磁盘                   |
| `destination`             | 文件保存的目录                   |
| `filename`                | 自定义文件名规则（避免重名覆盖） |
| `fileFilter`              | 过滤文件类型，只允许图片         |
| `limits.fileSize`         | 限制文件大小（5MB）              |
| `@UploadedFile()`         | 从请求中获取上传的文件对象       |

### Service 层

```typescript
async updateImage(id: number, imageUrl: string) {
  const product = await this.prisma.product.findUnique({ where: { id } });
  if (!product) throw new NotFoundException('商品不存在');

  return this.prisma.product.update({
    where: { id },
    data: { imageUrl },
  });
}
```

### 配置静态文件服务（`main.ts`）

```typescript
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // ... 其他配置
}
```

配置完成后，上传到 `uploads/xxx.jpg` 的图片，前端可以通过 `http://localhost:3000/uploads/xxx.jpg` 直接访问。

> ⚠️ **注意**：`NestFactory.create` 需要加泛型 `<NestExpressApplication>` 才能使用 `useStaticAssets` 方法。

### Swagger 文档配置

文件上传接口需要用 `multipart/form-data` 格式：

```typescript
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'binary', description: '商品图片文件' },
    },
  },
})
```

### 文件上传完整流程

```
前端选择图片
  ↓
POST /products/:id/upload-image（FormData 格式）
  ↓
FileInterceptor 拦截文件
  ↓
fileFilter 校验文件类型（只允许图片）
  ↓
diskStorage 将文件写入 ./uploads 目录
  ↓
Controller 拿到 file 对象，生成访问 URL
  ↓
Service 把 imageUrl 存入数据库
  ↓
返回 { message: "图片上传成功！", imageUrl: "/uploads/xxx.jpg" }
```

### 测试

```bash
# 给商品 ID=2 上传图片
curl -X POST http://localhost:3000/products/2/upload-image \
  -F "file=@/path/to/your/image.jpg"

# 在浏览器中直接访问图片
# http://localhost:3000/uploads/1708901234567-123456789.jpg
```

> 💡 **生产环境提示**：实际项目中，图片通常不存在服务器本地，而是上传到**云存储**（如阿里云 OSS、腾讯云 COS、AWS S3），数据库只存远程 URL。本地存储仅适合学习和开发环境。
