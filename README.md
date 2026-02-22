# 🛒 购物城后端 —— 仿京东

> 使用 **NestJS + PostgreSQL + Prisma 7 + Docker** 构建的购物商城后端 API

## 技术栈

| 技术            | 用途                     |
| --------------- | ------------------------ |
| NestJS          | 后端框架（基于 Express） |
| PostgreSQL 15   | 关系型数据库             |
| Prisma 7        | ORM（操作数据库的工具）  |
| Docker          | 容器化运行 PostgreSQL    |
| class-validator | 数据验证管道             |

## 项目结构

```
src/
├── main.ts                 # 入口文件，启动应用、设置全局管道
├── app.module.ts           # 根模块，组织所有子模块
├── app.controller.ts       # 根控制器（首页路由 /）
├── app.service.ts          # 根服务
├── prisma.service.ts       # Prisma 数据库服务（全局）
├── prisma.module.ts        # Prisma 模块（注册为全局模块）
├── products/               # 📦 商品模块
│   ├── products.module.ts
│   ├── products.controller.ts   # 路由：/products
│   ├── products.service.ts      # 商品业务逻辑（Prisma 操作数据库）
│   └── dto/
│       └── create-product.dto.ts  # 创建商品的数据格式定义
├── cart/                   # 🛒 购物车模块
│   ├── cart.module.ts
│   ├── cart.controller.ts       # 路由：/cart
│   ├── cart.service.ts          # 购物车业务逻辑（文件存储）
│   └── dto/
│       └── create-cart.dto.ts     # 添加购物车的数据格式定义
└── orders/                 # 📋 订单模块
    ├── orders.module.ts
    ├── orders.controller.ts     # 路由：/orders
    ├── orders.service.ts        # 订单业务逻辑（文件存储）
    └── dto/
        └── orders.dto.ts          # 订单和购物车项的数据格式定义
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动 Docker（PostgreSQL 数据库）

```bash
docker compose up -d
```

### 3. 配置环境变量

项目根目录创建 `.env` 文件：

```
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/shopping_cart"
```

### 4. 数据库迁移（创建数据表）

```bash
npx prisma migrate dev --name init
```

### 5. 启动开发服务器

```bash
pnpm start:dev
```

服务运行在 `http://localhost:3000`

---

## API 接口

### 📦 商品 `/products`

| 方法 | 路径        | 说明         | 请求体                             |
| ---- | ----------- | ------------ | ---------------------------------- |
| GET  | `/products` | 获取所有商品 | —                                  |
| POST | `/products` | 上架新商品   | `{ "name": "苹果", "price": 100 }` |

### 🛒 购物车 `/cart`

| 方法 | 路径    | 说明             | 请求体                              |
| ---- | ------- | ---------------- | ----------------------------------- |
| GET  | `/cart` | 查看购物车       | —                                   |
| POST | `/cart` | 添加商品到购物车 | `{ "productId": 1, "quantity": 2 }` |

### 📋 订单 `/orders`

| 方法 | 路径      | 说明                   | 请求体 |
| ---- | --------- | ---------------------- | ------ |
| GET  | `/orders` | 查看所有历史订单       | —      |
| POST | `/orders` | 提交订单（基于购物车） | —      |

---

## 学习笔记

### 一、NestJS 核心三件套

1. **Controller（控制器）**：只负责接收请求和发出响应，本身不做逻辑处理
2. **Service（服务）**：处理业务逻辑，比如计算价格、操作数据库
3. **Module（模块）**：把控制器和服务组织在一起，是 NestJS 的组织单元

使用 CLI 快速创建模块结构：

```bash
nest g resource products  # 创建商品模块
nest g resource cart      # 创建购物车模块
```

终端会问你：1. 使用什么传输层？选 REST API 2. 是否生成增删改查模板？选 n

NestJS 会自动把新模块注册到 `app.module.ts` 中。

### 二、依赖注入

NestJS 最强大的地方就是**依赖注入**。你不需要手动 `new` 一个服务实例，只要在 `constructor` 里声明类型，NestJS 自动帮你创建并传入：

```typescript
constructor(private prisma: PrismaService) {}
// 之后就可以用 this.prisma 操作数据库
```

### 三、DTO（数据传输对象）

DTO 是用来定义"用户需要传给接口什么数据"的类，配合 `class-validator` 实现数据验证：

```typescript
export class CreateProductDto {
  @IsString({ message: '商品名称必须是字符串' })
  @IsNotEmpty({ message: '商品名称不能为空' })
  name: string;

  @IsNumber({}, { message: '价格必须为数字' })
  @Min(0.01, { message: '价格不能小于0.01' })
  price: number;
}
```

需要在 `main.ts` 中开启全局验证管道，所有接口都会先经过验证：

```typescript
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
// whitelist: true → 自动剔除 DTO 中没定义的属性，防止恶意数据注入
```

### 四、数据库配置（Docker + PostgreSQL + Prisma 7）

#### 启动数据库

`docker-compose.yml` 配置了 PostgreSQL 容器：

```yaml
services:
  db:
    image: postgres:15-alpine
    ports: ['5432:5432']
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
      POSTGRES_DB: shopping_cart
```

```bash
docker compose up -d  # 后台启动
```

#### 安装 Prisma 依赖

```bash
pnpm add -D prisma @types/pg
pnpm add @prisma/client @prisma/adapter-pg pg
```

| 包名                 | 用途                               |
| -------------------- | ---------------------------------- |
| `prisma`             | Prisma CLI 工具（迁移、生成等）    |
| `@prisma/client`     | Prisma 客户端（代码中操作数据库）  |
| `@prisma/adapter-pg` | PostgreSQL 适配器（Prisma 7 必须） |
| `pg`                 | Node.js PostgreSQL 驱动            |
| `@types/pg`          | pg 的 TypeScript 类型定义          |

#### 初始化与迁移

```bash
npx prisma init          # 初始化，生成 prisma/ 文件夹
npx prisma migrate dev --name init  # 把 schema 同步到数据库
npx prisma generate      # 重新生成 Prisma Client
```

> **注意**：Prisma 7 不再自动生成 `.env` 文件，需要手动创建。
> `prisma.config.ts` 中配置 `datasource` 的 `url`，不在 `schema.prisma` 中配置。

#### Prisma 7 的关键变化：Driver Adapter

Prisma 7 不再支持直连数据库，必须通过 **Driver Adapter** 连接：

```typescript
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);

// 在 PrismaService 的 constructor 中
super({ adapter });
```

封装好后注册为全局模块（`prisma.module.ts`），其他模块通过依赖注入直接使用。

### 五、Prisma 常用方法速查

```typescript
// 增
this.prisma.product.create({ data: { name: '苹果', price: 5.5 } })
this.prisma.product.createMany({ data: [...] })

// 删
this.prisma.product.delete({ where: { id: 1 } })
this.prisma.product.deleteMany({ where: { description: null } })

// 改
this.prisma.product.update({ where: { id: 1 }, data: { price: 9.9 } })
this.prisma.product.updateMany({ where: { price: { lt: 5 } }, data: { price: 5 } })

// 查
this.prisma.product.findMany()                              // 查所有
this.prisma.product.findUnique({ where: { id: 1 } })       // 按主键查一个
this.prisma.product.findFirst({ where: { name: '苹果' } })  // 按条件查第一个
this.prisma.product.count()                                  // 计数
```

**高级查询选项：**

```typescript
this.prisma.product.findMany({
  where: { price: { gt: 100 } }, // 条件过滤
  orderBy: { price: 'asc' }, // 排序（asc 升序 / desc 降序）
  skip: 5,
  take: 10, // 分页
  select: { name: true, price: true }, // 只返回部分字段
});
```

**where 条件运算符：**

| 写法                             | 含义     | SQL 等价               |
| -------------------------------- | -------- | ---------------------- |
| `{ price: 10 }`                  | 等于     | `price = 10`           |
| `{ price: { gt: 10 } }`          | 大于     | `price > 10`           |
| `{ price: { gte: 10 } }`         | 大于等于 | `price >= 10`          |
| `{ price: { lt: 10 } }`          | 小于     | `price < 10`           |
| `{ price: { lte: 10 } }`         | 小于等于 | `price <= 10`          |
| `{ name: { contains: '苹' } }`   | 包含     | `name LIKE '%苹%'`     |
| `{ name: { startsWith: '苹' } }` | 开头     | `name LIKE '苹%'`      |
| `{ price: { in: [5, 10, 15] } }` | 在列表中 | `price IN (5, 10, 15)` |
| `{ description: null }`          | 为空     | `IS NULL`              |
| `{ NOT: { price: 10 } }`         | 不等于   | `price != 10`          |
| `{ OR: [{...}, {...}] }`         | 或       | `... OR ...`           |

> 💡 **记忆口诀**：增用 `create`，删用 `delete`，改用 `update`，查用 `find`。操作多条加 `Many`，条件写在 `where` 里，数据写在 `data` 里。

### 六、Prisma Studio —— 可视化查看数据库

Prisma 自带了一个网页版数据库管理工具，可以直接在浏览器里查看和编辑数据：

```bash
npx prisma studio
```

运行后会自动打开 `http://localhost:5555`，你可以在里面看到所有表和数据，非常方便调试。

### 七、购物车模块接入数据库

最初购物车数据是存在本地 JSON 文件中的，后来改为使用 Prisma 操作 PostgreSQL 数据库。

#### 1. 在 `schema.prisma` 中添加购物车表

```prisma
model CartItem {
  id        Int     @id @default(autoincrement())
  quantity  Int     // 购买数量
  productId Int     // 外键，关联商品
  product   Product @relation(fields: [productId], references: [id])
}
```

同时在 `Product` 模型中添加反向关系字段：

```prisma
model Product {
  // ... 原有字段
  cartItems  CartItem[]  // 一个商品可以出现在多个购物车条目中
}
```

#### 2. 执行数据库迁移

```bash
npx prisma migrate dev --name add_cart_item
```

这条命令会做三件事：

1. 对比 `schema.prisma` 和当前数据库的差异
2. 生成 SQL 迁移文件（保存在 `prisma/migrations/` 目录下）
3. 自动运行 `prisma generate` 重新生成 Prisma Client

#### 3. 改造购物车 Service

从文件读写改为 Prisma 数据库操作，核心变化：

```typescript
// 注入 PrismaService（不再需要 fs、path）
constructor(private prisma: PrismaService) {}

// 添加商品到购物车
async addToCart(item: createCartDto) {
  // 先检查商品是否存在
  const productExists = await this.prisma.product.findUnique({
    where: { id: item.productId },
  });
  if (!productExists) throw new BadRequestException('商品不存在');

  // 检查购物车是否已有该商品
  const existingItem = await this.prisma.cartItem.findFirst({
    where: { productId: item.productId },
  });

  if (existingItem) {
    // 有则更新数量
    await this.prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: existingItem.quantity + item.quantity },
    });
  } else {
    // 没有则新增
    await this.prisma.cartItem.create({
      data: { productId: item.productId, quantity: item.quantity },
    });
  }
}

// 查看购物车（include 关联查询，把商品信息一起带出来）
async getCart() {
  const cartItems = await this.prisma.cartItem.findMany({
    include: { product: true }, // 关键：自动 JOIN 商品表
  });

  const items = cartItems.map((item) => ({
    cartItemId: item.id,
    productName: item.product.name,
    price: Number(item.product.price),
    quantity: item.quantity,
    subtotal: Number(item.product.price) * item.quantity,
  }));

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  return { items, totalPrice: total };
}

// 清空购物车
async clearCart() {
  await this.prisma.cartItem.deleteMany(); // 一句话清空整张表
}
```

> 💡 **`include: { product: true }`** 是 Prisma 的关联查询，相当于 SQL 的 `JOIN`。它会自动根据 `@relation` 定义去关联 Product 表，把商品信息一起查出来。

### 八、数据库表关系设计

本项目涉及 4 张表，它们之间的关系如下：

```
Product（商品表）
  │
  ├── 1:N ──→ CartItem（购物车条目表）
  │            一个商品可以被多个购物车条目引用
  │
  └── 1:N ──→ OrderItem（订单明细表）
               一个商品可以出现在多个订单明细中

Order（订单主表）
  │
  └── 1:N ──→ OrderItem（订单明细表）
               一个订单包含多个订单明细
```

**关系总结：**

| 关系                | 类型   | 说明                         |
| ------------------- | ------ | ---------------------------- |
| Product → CartItem  | 一对多 | 一个商品可以在多个购物车中   |
| Product → OrderItem | 一对多 | 一个商品可以出现在多个订单中 |
| Order → OrderItem   | 一对多 | 一个订单包含多个商品明细     |

**为什么订单要拆成两张表？**

- `Order` 只存订单级别的信息（总价、下单时间）
- `OrderItem` 存每个商品的快照（单价、数量），**记录的是下单那一刻的价格**
- 这样即使商品后来涨价了，历史订单里的价格不会变

### 九、订单模块接入数据库

#### 1. 在 `schema.prisma` 中添加订单相关表

```prisma
// 订单主表
model Order {
  id         Int         @id @default(autoincrement())
  totalPrice Float       // 订单总金额
  createdAt  DateTime    @default(now())
  items      OrderItem[] // 一个订单包含多个明细
}

// 订单明细表
model OrderItem {
  id        Int     @id @default(autoincrement())
  quantity  Int     // 买了几个
  price     Float   // 下单那一刻的单价（历史快照）
  orderId   Int
  order     Order   @relation(fields: [orderId], references: [id])
  productId Int
  product   Product @relation(fields: [productId], references: [id])
}
```

同时在 `Product` 模型中添加反向关系：

```prisma
model Product {
  // ... 原有字段
  orderItems  OrderItem[]
}
```

#### 2. 执行数据库迁移

```bash
npx prisma migrate dev --name add_order_tables
npx prisma generate  # 如果迁移后类型提示没更新，手动重新生成
```

> ⚠️ 如果 IDE 仍然报错找不到 `this.prisma.order`，在 VS Code 中按 `Cmd+Shift+P` → `TypeScript: Restart TS Server` 重启类型服务。

#### 3. 订单 Service 核心逻辑

**创建订单 —— Prisma 嵌套写入（Nested Create）：**

```typescript
async createOrder() {
  // 1. 从数据库查出购物车全部条目（含商品信息）
  const cartItems = await this.prisma.cartItem.findMany({
    include: { product: true },
  });
  if (!cartItems) throw new BadRequestException('购物车是空的，无法下单');

  // 2. 计算总价
  const totalPrice = cartItems.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity, 0
  );

  // 3. 嵌套写入：同时创建 Order + OrderItem
  const newOrder = await this.prisma.order.create({
    data: {
      totalPrice,
      items: {
        create: cartItems.map((item) => ({
          product: { connect: { id: item.productId } }, // 关联已有商品
          quantity: item.quantity,
          price: Number(item.product.price),
        })),
      },
    },
  });

  // 4. 清空购物车
  await this.cartService.clearCart();

  return { message: '下单成功！', orderId: newOrder.id, totalPrice: newOrder.totalPrice };
}
```

> 💡 **`connect` vs 直接传 `productId`**：在 Prisma 的嵌套创建（nested create）中，关联已有记录必须使用 `connect: { id: xxx }` 语法，不能直接写 `productId: xxx`。`connect` 的意思是"连接到一个已经存在的记录"。

**查看所有订单 —— 多级连表查询：**

```typescript
async findAll() {
  return this.prisma.order.findMany({
    include: {
      items: {                    // 包含订单明细
        include: { product: true }, // 明细里还要包含商品信息
      },
    },
    orderBy: { createdAt: 'desc' }, // 最新的订单排在最前面
  });
}
```

> 💡 这是 **两级嵌套 include**：`Order → OrderItem → Product`，Prisma 会自动生成 JOIN 查询，一次性返回完整的订单数据。

#### 4. 订单模块需要导入购物车模块

因为创建订单后要清空购物车，所以 `OrdersModule` 需要导入 `CartModule`：

```typescript
@Module({
  imports: [CartModule], // 导入购物车模块，才能使用 CartService
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
```

> 💡 前提是 `CartModule` 已经用 `exports: [CartService]` 导出了 CartService。

### 十、开发流程总结

每当需要新增功能模块时，按以下步骤进行：

```
1. 设计数据表  →  修改 schema.prisma
2. 同步数据库  →  npx prisma migrate dev --name xxx
3. 生成类型    →  npx prisma generate（迁移通常会自动执行）
4. 创建模块    →  nest g resource 模块名
5. 编写 DTO    →  定义数据验证规则
6. 编写 Service →  用 this.prisma.xxx 操作数据库
7. 编写 Controller → 定义路由，调用 Service
8. 注册模块    →  在 app.module.ts 中 imports
9. 测试接口    →  用 Postman / curl 测试
10. 查看数据   →  npx prisma studio 可视化确认
```

**Prisma 工作流口诀：**

> 改蓝图（schema）→ 跑迁移（migrate）→ 生类型（generate）→ 写代码（service）
