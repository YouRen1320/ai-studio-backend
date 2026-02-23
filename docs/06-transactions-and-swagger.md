# 六、数据库事务与接口文档

> 本篇涵盖 Prisma 事务（`$transaction`）的原子操作，以及 Swagger 自动生成接口文档。

---

## 1. 数据库事务 (Transaction)

### 为什么需要事务？（灾难场景重现）

看看改造前的下单逻辑：

1. 算好总价，创建订单（写入 Order 表） ✅
2. 调用 `clearCart()` 清空购物车（删除 CartItem 表的数据） ❌ 突然断网了！

**结果**：用户的钱扣了（订单生成了），但购物车里的东西还在！用户一刷新，又点了一次结账，系统又生成了一个重复订单。这就是灾难。

**事务 (Transaction)** 能把多步操作"绑定"在一起：**要么全成功，要么全失败（回滚 Rollback）**。哪怕第 2 步报错了，数据库也会自动把第 1 步的订单撤销掉，当做什么都没发生过。这就是数据库的 **ACID 特性**。

### 改造下单逻辑，引入 `$transaction`

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(userId: number) {
    // 1. 先查购物车（只读操作，放在事务外没问题）
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
      // 3a. 在事务中创建订单（⚠️ 用 tx 而不是 this.prisma）
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

      // 3b. 在事务中清空购物车（⚠️ 用 tx 而不是 this.prisma）
      await tx.cartItem.deleteMany({
        where: { userId: userId },
      });

      return order;
    });

    return {
      message: '下单成功！',
      orderId: newOrder.id,
      totalPrice: newOrder.totalPrice,
    };
  }
}
```

### 关键变化解读

| 改造前                               | 改造后                                |
| ------------------------------------ | ------------------------------------- |
| `this.prisma.order.create(...)`      | `tx.order.create(...)`                |
| `this.cartService.clearCart(userId)` | `tx.cartItem.deleteMany(...)`         |
| 两步操作各自独立，可能只成功一半     | 包在 `$transaction` 里，原子性保证    |
| 依赖 CartService（跨模块调用）       | 直接在事务中操作，不再需要 CartModule |

**最核心的一点**：事务回调里的 `tx` 参数，就是 Prisma 给你的"事务专用客户端"。回调里所有数据库操作都必须用 `tx`，不能用 `this.prisma`。只有用 `tx` 执行的操作才会被事务管理。

> 💡 **为什么不在事务里调用 `CartService.clearCart()`？** 因为 `clearCart()` 用的是 `this.prisma`（普通客户端），不是事务客户端 `tx`。通过 service 调用的操作不在事务管控范围内，回滚时不会被撤销。

### Prisma 事务方法速查

```typescript
// 方式一：交互式事务（推荐，适合复杂逻辑）
await this.prisma.$transaction(async (tx) => {
  const a = await tx.order.create({ ... });
  await tx.cartItem.deleteMany({ ... });
  return a;
});

// 方式二：批量事务（适合简单的多条独立操作）
await this.prisma.$transaction([
  this.prisma.order.create({ ... }),
  this.prisma.cartItem.deleteMany({ ... }),
]);
```

| 方式           | 适用场景                       | 特点                 |
| -------------- | ------------------------------ | -------------------- |
| 交互式（回调） | 有逻辑判断、需要用前一步的结果 | 灵活，可以写 if/else |
| 批量（数组）   | 多条独立操作，不需要互相依赖   | 简洁，但不能有逻辑   |

---

## 2. 自动生成接口文档 (Swagger)

做完了后端所有接口，终于到了一个灵魂拷问：**前端同事怎么知道你写了哪些接口？每个接口要传什么参数？返回什么数据？**

**Swagger（OpenAPI）** 能**自动扫描你的代码**，生成一个漂亮的网页版接口文档，前端打开浏览器就能看，还能直接在网页上测试接口！

### 第一步：安装

```bash
pnpm add @nestjs/swagger
```

> 💡 NestJS 11 的 `@nestjs/swagger` 已经内置了 `swagger-ui-express`，不需要像老版本那样额外安装。

### 第二步：配置（`main.ts`）

```typescript
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ... 之前的 CORS、管道、拦截器、过滤器配置保持不变 ...

  const config = new DocumentBuilder()
    .setTitle('购物城 API')
    .setDescription('仿京东购物城后端接口文档')
    .setVersion('1.0')
    .addBearerAuth() // 添加 Bearer Token 认证
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document); // 挂载到 /api-docs

  await app.listen(process.env.PORT ?? 3000);
}
```

| 方法               | 说明                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| `DocumentBuilder`  | 链式调用，配置文档的标题、描述、版本等元信息                                         |
| `.addBearerAuth()` | 告诉 Swagger 这个项目使用 Bearer Token 认证，会在页面右上角显示一个 `Authorize` 按钮 |
| `createDocument()` | 扫描所有 Controller 和 DTO，生成 OpenAPI 规范的 JSON                                 |
| `setup()`          | 把生成的文档挂载到指定路径，启动后访问 `/api-docs` 即可看到                          |

### 第三步：给 DTO 添加描述（`@ApiProperty`）

**用户 DTO：**

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: '用户名', example: 'zhangsan', minLength: 3 })
  @IsString()
  @MinLength(3, { message: '用户名至少3个字符' })
  username: string;

  @ApiProperty({ description: '密码', example: '123456', minLength: 6 })
  @IsString()
  @MinLength(6, { message: '密码至少6个字符' })
  password: string;
}
```

**商品 DTO：**

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ description: '商品名称', example: 'iPhone 16' })
  @IsString({ message: '商品名称必须是字符串' })
  @IsNotEmpty({ message: '商品名称不能为空' })
  name: string;

  @ApiProperty({ description: '商品价格', example: 5999, minimum: 0.01 })
  @IsNumber({}, { message: '价格必须为数字' })
  @Min(0.01, { message: '价格不能小于0.01' })
  price: number;
}
```

**购物车 DTO（隐藏自动获取的 userId）：**

```typescript
import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';

export class createCartDto {
  @ApiHideProperty() // userId 从 Token 自动获取，不在文档中展示
  @IsInt({ message: '用户id必须是整数' })
  userId: number;

  @ApiProperty({ description: '商品ID', example: 1 })
  @IsInt({ message: '商品id必须是整数' })
  productId: number;

  @ApiProperty({ description: '购买数量', example: 2, minimum: 1 })
  @IsInt({ message: '商品数量必须是整数' })
  @Min(1, { message: '商品数量最小为1' })
  quantity: number;
}
```

**常用 `@ApiProperty` 参数速查：**

| 参数          | 说明           | 示例                                   |
| ------------- | -------------- | -------------------------------------- |
| `description` | 字段的文字说明 | `'商品名称'`                           |
| `example`     | 示例值         | `'iPhone 16'`、`5999`                  |
| `minimum`     | 最小值         | `0.01`                                 |
| `minLength`   | 最小长度       | `3`                                    |
| `required`    | 是否必填       | `true`（默认就是 true）                |
| `type`        | 字段类型       | `'string'`、`'number'`（通常自动推断） |

### 第四步：给 Controller 添加分组和说明

用 `@ApiTags()` 给每个 Controller 分组，用 `@ApiOperation()` 描述每个接口的用途，需要认证的加 `@ApiBearerAuth()`：

```typescript
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('购物车')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('cart')
export class CartController {
  @ApiOperation({ summary: '添加商品到购物车' })
  @Post()
  add(@Body() body: createCartDto, @Request() req) { ... }

  @ApiOperation({ summary: '查看当前用户的购物车' })
  @Get()
  findAll(@Request() req) { ... }
}
```

**所有 Controller 的装饰器汇总：**

| Controller           | @ApiTags   | @ApiBearerAuth | 方法说明                                |
| -------------------- | ---------- | -------------- | --------------------------------------- |
| `ProductsController` | `'商品'`   | ❌ 不需要      | 获取所有商品列表 / 上架新商品           |
| `CartController`     | `'购物车'` | ✅ 需要        | 添加商品到购物车 / 查看当前用户的购物车 |
| `OrdersController`   | `'订单'`   | ✅ 需要        | 提交订单（购物车结算） / 查看历史订单   |
| `UsersController`    | `'用户'`   | ❌ 不需要      | 用户注册                                |
| `AuthController`     | `'认证'`   | ❌ 不需要      | 用户登录（获取 Token）                  |

> 💡 **规律**：不需要登录就能访问的接口（注册、登录、查商品），不加 `@ApiBearerAuth()`。需要登录的接口（购物车、订单），必须加。

### 第五步：访问文档

```bash
pnpm start:dev
```

打开浏览器，访问 **http://localhost:3000/api-docs**，你会看到一个漂亮的接口文档页面！

### 第六步：在 Swagger UI 中测试需要 Token 的接口

1. 先展开 **认证** 分组，点击 **POST /auth/login**
2. 点击 **Try it out**，填入用户名和密码，点击 **Execute**
3. 从返回结果中复制 `access_token` 的值
4. 点击页面右上角的 **Authorize** 按钮
5. 在弹出框中输入 `Bearer 你复制的token`（注意 Bearer 和 token 之间有空格）
6. 点击 **Authorize** 确认
7. 现在你就可以直接测试购物车和订单接口了！

### 装饰器速查表

| 装饰器               | 用在哪里        | 作用                                        |
| -------------------- | --------------- | ------------------------------------------- |
| `@ApiTags()`         | Controller 类   | 给接口分组，方便前端按模块查看              |
| `@ApiOperation()`    | Controller 方法 | 给单个接口写简短说明                        |
| `@ApiProperty()`     | DTO 字段        | 描述请求体中每个字段的含义、类型、示例值    |
| `@ApiHideProperty()` | DTO 字段        | 在文档中隐藏某个字段（如自动获取的 userId） |
| `@ApiBearerAuth()`   | Controller 类   | 标记这组接口需要 Bearer Token 认证          |

> 💡 **前端福利**：有了 Swagger，前端再也不用问后端"这个接口传什么参数"了。打开 `/api-docs`，所有信息一目了然，还能直接在线调试！
