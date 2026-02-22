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

<!-- 至此，基本的增删改查，连表查询，依赖注入全部掌握 -->

打开 prisma/schema.prisma，我们要增加 User 表，并把它和 CartItem、Order 关联起来。
由于我们给 CartItem 和 Order 表加上了必填的 userId，但你数据库里以前存的老数据并没有 userId，这会导致冲突。

在终端运行：npx prisma migrate dev --name add_user_model

业界绝对禁止把用户的密码（如 123456）直接存进数据库。万一数据库被黑客脱库，所有人的密码就全裸奔了。
我们要用一种叫 Hash (哈希) 的单向加密算法，把密码变成一堆不可逆的乱码。最常用的工具是 bcrypt。
pnpm add bcrypt
pnpm add -D @types/bcrypt

创建“用户部”
nest g resource users
选择 REST API，不生成 CRUD (n)
在 src/users 下新建 dto/create-user.dto.ts

打开 src/users/users.service.ts，这是我们要使用密码加密的地方
打开 src/users/users.controller.ts： 开放注册接口 (UsersController)
重启服务器 (pnpm start:dev)。完毕

### 十一、用户登录 —— JWT (JSON Web Token) 认证

现在，我们成功实现了用户的安全创建。但问题来了：
用户注册了，他怎么证明自己是谁呢？ 总不能每次买东西都带上账号密码吧？
下一关，我们要学习目前互联网最流行的认证方式：**登录颁发 JWT (JSON Web Token)**

#### 什么是 JWT？(一个通俗的比喻)

想象你去住酒店：

1. **登录**：你拿着身份证（账号密码）去前台证明你是谁。
2. **颁发 JWT**：前台核对无误后，不会让你每次开门都出示身份证，而是给你一张**房卡 (Token)**。
3. **携带 JWT**：这张房卡里记录了你的房间号和退房时间。接下来你在这个酒店里去健身房、吃自助餐、开房门，只需要刷这张房卡就行了。

#### 第一步：准备"制卡机" (安装依赖)

我们需要让 NestJS 具备生成和解析 JWT 的能力。

```bash
pnpm add @nestjs/jwt
```

#### 第二步：创建"安保部" (Auth 模块)

虽然用户相关的逻辑在 UsersModule 里，但为了让代码更规范，"登录颁发令牌"和"验证令牌"这种安保工作，通常会单独成立一个 AuthModule。

```bash
nest g resource auth
# 选择 REST API，不生成 CRUD (n)
```

#### 第三步：给"用户部"增加一个找人的方法

登录的第一步是去数据库里看这个用户存不存在。
打开 `src/users/users.service.ts`，在最下面增加一个根据用户名找人的方法：

```typescript
// 根据用户名查询用户
async findOneByUsername(username: string) {
  return this.prisma.user.findUnique({
    where: { username },
  });
}
```

并且，我们需要允许"安保部"调用"用户部"的这个方法。
打开 `src/users/users.module.ts`，把 UsersService 暴露出去：

```typescript
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // 对外开放 UsersService，让 AuthModule 可以使用
})
export class UsersModule {}
```

> **注意**：exports 要加在 `UsersModule` 里，而不是 `AppModule` 里！

#### 第四步：配置"安保部"的制卡机

我们需要在 AuthModule 里注册制卡机（JWT）。
打开 `src/auth/auth.module.ts`：

```typescript
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module'; // 1. 导入用户部
import { JwtModule } from '@nestjs/jwt'; // 2. 导入制卡机

@Module({
  imports: [
    UsersModule,
    // 3. 配置 JWT (这里为了新手方便把秘钥写死了，真实项目中应该写在 .env 文件里！)
    JwtModule.register({
      global: true, // 全局可用
      secret: 'my-super-secret-key-123456', // 签发房卡的防伪印章（秘钥）
      signOptions: { expiresIn: '1h' }, // 房卡有效期 1 小时
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
```

关键点：

- `imports: [UsersModule]`：导入用户模块，这样 AuthService 才能注入 UsersService
- `JwtModule.register()`：配置 JWT 的秘钥和过期时间
- `global: true`：让 JwtService 在整个应用中都可以使用

#### 第五步：编写登录与发卡逻辑 (AuthService)

现在，重头戏来了。前台拿到用户的账号密码，要怎么处理？
打开 `src/auth/auth.service.ts`：

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  // 注入用户服务(用来找人) 和 JWT服务(用来发卡)
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(username: string, pass: string) {
    // 1. 去数据库里找这个用户
    const user = await this.usersService.findOneByUsername(username);

    // 如果没找到用户，直接赶出去 (抛出 401 未授权异常)
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误！');
    }

    // 2. 【核对密码】：用 bcrypt.compare 比较明文密码和数据库里的火星文密码
    const isPasswordValid = await bcrypt.compare(pass, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误！');
    }

    // 3. 【制作房卡 Payload】：房卡里要写什么信息？
    // 通常不写密码等敏感信息，只写不可变的 ID 和用户名
    const payload = { sub: user.id, username: user.username };

    // 4. 发卡 (生成 Token)
    return {
      message: '登录成功！',
      access_token: await this.jwtService.signAsync(payload), // 签名并生成长字符串
    };
  }
}
```

登录流程：找用户 → 核对密码 → 制作 Payload → 签发 Token

#### 第六步：开放登录接口 (AuthController)

打开 `src/auth/auth.controller.ts`：

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
// 我们可以复用之前写的 CreateUserDto 来作为登录的数据格式
import { CreateUserDto } from 'src/users/dto/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: CreateUserDto) {
    return this.authService.login(loginDto.username, loginDto.password);
  }
}
```

接口地址：`POST /auth/login`，复用 CreateUserDto（username + password）作为请求体格式。

#### 第七步：见证奇迹时刻

确保你的服务器正在运行（如果改了 .module.ts 最好重启一下 `pnpm start:dev`）。

用 curl 或 Postman 测试登录（注意，账号密码必须是你上一节注册过的）：

```bash
# 登录
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "你注册的用户名", "password": "你注册的密码"}'
```

成功后会返回：

```json
{
  "message": "登录成功！",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoiemhhbmdzYW4iLCJpYXQiOjE3..."
}
```

这个 `access_token` 就是你的"房卡"，后续的接口请求需要在请求头里携带它来证明身份。

### 十二、路由守卫 (Guards) 与身份拦截

现在用户已经能登录并获得 Token 了，但是问题来了：**购物车和订单接口是"裸奔"的！** 任何人都可以直接访问，甚至不需要登录。更危险的是，之前 userId 是从请求体里传的，任何人都可以伪装成别的用户。

我们的目标：给购物车和订单接口加上一把"密码锁"。没有 `access_token` 的人，一律不准靠近。

#### 什么是 Guard？（又一个酒店比喻）

继续上面酒店的比喻：

- **房卡（Token）** 已经在"登录"时发给你了
- 现在我们需要在**每个房间门口安排一个保安（Guard）**
- 保安的工作很简单：**"你的房卡呢？刷一下。" → "嗯，是本酒店的卡没错，请进。"**
- 如果没有房卡，或者房卡是假的，保安就会把你挡在门外（`401 Unauthorized`）

#### 第一步：设立"门禁保安" (AuthGuard)

在 `src/auth` 目录下，新建 `auth.guard.ts`：

```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  // 注入 JWT 服务（因为在 AuthModule 中设置了 global: true，所以这里可以直接注入）
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. 从请求头中提取 Token
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    // 如果请求头里没有 Token，直接赶走
    if (!token) {
      throw new UnauthorizedException('你还没有登录，请先登录获取 Token！');
    }

    // 2. 验证 Token 是否合法
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: 'my-super-secret-key-123456', // 必须和签发时的秘钥一致！
      });

      // 3. 验证通过！把用户信息挂载到 request 对象上
      // 这样后面的 Controller 就能通过 request.user 获取到当前用户信息了
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException('Token 无效或已过期，请重新登录！');
    }

    // 4. 放行
    return true;
  }

  // 辅助方法：从请求头 "Authorization: Bearer xxxxx" 中提取 Token
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
```

**关键点解释：**

| 概念                        | 说明                                                |
| --------------------------- | --------------------------------------------------- |
| `CanActivate`               | NestJS 守卫的接口，必须实现 `canActivate` 方法      |
| `ExecutionContext`          | 请求的执行上下文，可以从中获取到 Request 对象       |
| `verifyAsync`               | 验证 Token 的签名和过期时间，返回 payload           |
| `request['user'] = payload` | 把解析出来的用户信息挂到请求对象上，供后续使用      |
| `extractTokenFromHeader`    | 从 `Authorization: Bearer <token>` 格式中提取 token |

#### 第二步：给购物车和订单"上锁"

有了保安（Guard），我们只需要把他安排到购物车和订单的门口就行了。

**购物车控制器 `cart.controller.ts`：**

```typescript
import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { createCartDto } from './dto/create-cart.dto';
import { AuthGuard } from 'src/auth/auth.guard'; // 导入我们的"保安"

@UseGuards(AuthGuard) // 给整个购物车控制器上锁！
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  add(@Body() body: createCartDto, @Request() req) {
    // req.user.sub 就是从 Token 解析出的用户 ID，不再需要用户自己传 userId
    return this.cartService.addToCart({ ...body, userId: req.user.sub });
  }

  @Get()
  findAll(@Request() req) {
    // 只返回当前登录用户的购物车
    return this.cartService.getCart(req.user.sub);
  }
}
```

**订单控制器 `orders.controller.ts`：**

```typescript
import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from 'src/auth/auth.guard';

@UseGuards(AuthGuard) // 给整个订单控制器上锁！
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Request() req) {
    return this.ordersService.createOrder(req.user.sub);
  }

  @Get()
  findAll(@Request() req) {
    return this.ordersService.findAll(req.user.sub);
  }
}
```

**核心变化总结：**

| 之前                      | 之后                                         |
| ------------------------- | -------------------------------------------- |
| 接口谁都能访问            | 必须携带有效 Token 才能访问                  |
| `userId` 从请求体手动传入 | `userId` 从 Token 自动解析（`req.user.sub`） |
| 所有用户共享购物车        | 每个用户只能看到自己的购物车                 |
| 所有用户共享订单          | 每个用户只能看到自己的订单                   |

> 💡 **`@UseGuards(AuthGuard)`** 可以放在类上（保护整个控制器的所有接口）或放在方法上（只保护某个接口）。

#### 第三步：Service 层也要配合改造

光在 Controller 门口站保安还不够，Service 层的查询逻辑也必须加上用户过滤，否则"进了门以后还是能看到别人的东西"。

**购物车 Service 改造（`cart.service.ts`）：**

一共要改 3 个方法，核心就是每个数据库操作都带上 `userId`：

```typescript
// ① addToCart：接受 userId 参数，查找和创建时都要限制到当前用户
async addToCart(item: createCartDto, userId: number) {
  // 查找购物车是否已有该商品时，加上用户限制
  const existingItem = await this.prisma.cartItem.findFirst({
    where: {
      productId: item.productId,
      userId: userId, // 🔒 只在当前用户的购物车里找
    },
  });

  if (existingItem) {
    // 有就更新数量
    await this.prisma.cartItem.update({ ... });
  } else {
    // 没有就新建，打上用户的钢印
    await this.prisma.cartItem.create({
      data: {
        productId: item.productId,
        quantity: item.quantity,
        userId: userId, // 🔒 新建记录关联到当前用户
      },
    });
  }
}

// ② getCart：只查当前用户的购物车
async getCart(userId: number) {
  const cartItems = await this.prisma.cartItem.findMany({
    where: { userId: userId }, // 🔒 只查当前用户的
    include: { product: true },
  });
  // ... 格式化和计算总价的逻辑不变
}

// ③ clearCart：只清空当前用户的购物车，不影响别人
async clearCart(userId: number) {
  await this.prisma.cartItem.deleteMany({
    where: { userId: userId }, // 🔒 只删当前用户的
  });
}
```

**订单 Service 改造（`orders.service.ts`）：**

订单部的改造更加关键——它是"钱"的地方，必须滴水不漏：

```typescript
// ① createOrder：整个下单流程都锁定到当前用户
async createOrder(userId: number) {
  // 1. 只从"当前用户"的购物车里取商品
  const cartItems = await this.prisma.cartItem.findMany({
    where: { userId }, // 🔒 只拿这个用户的购物车
    include: { product: true },
  });
  if (!cartItems.length)
    throw new BadRequestException('购物车是空的，无法下单');

  // 2. 计算总价
  const totalPrice = cartItems.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity, 0,
  );

  // 3. 创建订单时，关联到当前用户
  const newOrder = await this.prisma.order.create({
    data: {
      totalPrice: totalPrice,
      userId: userId, // 🔒 这个订单属于谁
      items: {
        create: cartItems.map((item) => ({
          product: { connect: { id: item.productId } },
          quantity: item.quantity,
          price: Number(item.product.price),
        })),
      },
    },
  });

  // 4. 只清空"当前用户"的购物车，不动别人的
  await this.cartService.clearCart(userId); // 🔒 传入 userId

  return {
    message: '下单成功！',
    orderId: newOrder.id,
    totalPrice: newOrder.totalPrice,
  };
}

// ② findAll：只查当前用户的历史订单
async findAll(userId: number) {
  return this.prisma.order.findMany({
    where: { userId }, // 🔒 只查当前用户的订单
    include: {
      items: { include: { product: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
```

**改造前后对比总结：**

| 方法                  | 改造前                           | 改造后                                |
| --------------------- | -------------------------------- | ------------------------------------- |
| `addToCart(item)`     | 不区分用户，所有人共用一个购物车 | `addToCart(item, userId)`，按用户隔离 |
| `getCart()`           | 查所有人的购物车                 | `getCart(userId)`，只查自己的         |
| `clearCart()`         | 清空整张表！所有人的购物车都没了 | `clearCart(userId)`，只清自己的       |
| `createOrder(userId)` | 查所有人的购物车来下单           | 只从自己的购物车取商品                |
| `findAll()`           | 查所有人的订单                   | `findAll(userId)`，只查自己的         |

> 💡 **核心原则**：每一次数据库操作的 `where` 条件里，都必须带上 `userId`。这就像去银行取钱，你只能操作**自己名下的账户**。

#### 第四步：测试"门禁系统"

重启服务器后，用 curl 测试：

```bash
# ❌ 不带 Token 访问购物车 → 被拦截
curl http://localhost:3000/cart
# 返回: { "message": "你还没有登录，请先登录获取 Token！", "statusCode": 401 }

# ✅ 先登录获取 Token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "你的用户名", "password": "你的密码"}'
# 返回: { "message": "登录成功！", "access_token": "eyJhbGciOi..." }

# ✅ 带 Token 访问购物车
curl http://localhost:3000/cart \
  -H "Authorization: Bearer eyJhbGciOi..."
# 返回: { "items": [...], "totalPrice": 0 }

# ✅ 带 Token 添加商品到购物车（不需要再传 userId 了！）
curl -X POST http://localhost:3000/cart \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -d '{"productId": 1, "quantity": 2}'

# ✅ 带 Token 提交订单（userId 自动从 Token 获取）
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer eyJhbGciOi..."
# 返回: { "message": "下单成功！", "orderId": 1, "totalPrice": 200 }

# ✅ 带 Token 查看历史订单（只返回自己的订单）
curl http://localhost:3000/orders \
  -H "Authorization: Bearer eyJhbGciOi..."

# ❌ 不带 Token 访问订单 → 一样被拦截
curl http://localhost:3000/orders
# 返回: { "message": "你还没有登录，请先登录获取 Token！", "statusCode": 401 }
```

> 💡 **注意**：在 Postman 中测试时，在 `Headers` 选项卡中添加 `Authorization` 头，值为 `Bearer <你的token>`。

#### 完整的请求流程

```
用户请求 → Guard (保安检查房卡)
  ├── ❌ 没有 Token / Token 无效 → 返回 401
  └── ✅ Token 验证通过
        ↓
      把用户信息挂到 request.user
        ↓
      Controller (用 req.user.sub 获取用户ID)
        ↓
      Service (用 userId 查询/操作数据)
        ↓
      返回"只属于该用户"的数据
```

### 十三、统一接口返回格式（拦截器与过滤器）

在真实的团队协作中，前端最怕的就是后端返回的数据格式"随心所欲"。为了让未来的前端（Vue）开发不需要写一堆 `if/else` 来判断数据结构，后端必须制定一个铁律：**所有返回数据都装进统一的"包装盒"**。

#### 目标格式

```json
// ✅ 成功时
{
  "code": 200,
  "message": "请求成功",
  "data": { "items": [...], "totalPrice": 100 }
}

// ❌ 失败时
{
  "code": 401,
  "message": "Token 无效或已过期，请重新登录！",
  "data": null
}
```

前端只需要判断 `code === 200`，永远不用猜结构。

#### 核心概念：拦截器 vs 过滤器

| 角色                              | 处理什么   | 比喻                                       |
| --------------------------------- | ---------- | ------------------------------------------ |
| **拦截器 (Interceptor)**          | 成功的响应 | 快递打包员，把货物装进统一的快递盒         |
| **异常过滤器 (Exception Filter)** | 抛出的异常 | 售后客服，把投诉信息也装进统一格式的回执单 |

#### 第一步：创建"快递打包员"（成功响应拦截器）

新建 `src/common/interceptors/transform.interceptor.ts`：

```typescript
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

// 定义统一的返回格式接口
interface ResponseFormat<T> {
  code: number;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ResponseFormat<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseFormat<T>> {
    // next.handle() 执行真正的 Controller 方法
    // pipe(map(...)) 在 Controller 返回数据之后，把数据"包装"一层
    return next.handle().pipe(
      map((data) => ({
        code: 200,
        message: '请求成功',
        data: data, // Controller 返回的原始数据
      })),
    );
  }
}
```

**关键点：**

- `NestInterceptor` 是 NestJS 拦截器的接口
- `next.handle()` 会执行 Controller 方法，返回一个 RxJS `Observable`
- `pipe(map(...))` 是 RxJS 的操作符，在数据流出时对数据做转换
- 这样 Controller 里的代码完全不需要改动，返回什么数据都会自动被包装

#### 第二步：创建"售后客服"（异常过滤器）

新建 `src/common/filters/http-exception.filter.ts`：

```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException) // 只要有 HttpException 被抛出，都交给我处理
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    // 获取 NestJS 原始的错误信息
    const exceptionResponse = exception.getResponse();

    // 错误信息可能是字符串，也可能是对象（比如 ValidationPipe 返回的数组）
    let message: string;
    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const res = exceptionResponse as Record<string, unknown>;
      message = Array.isArray(res.message)
        ? res.message.join('; ') // 多条验证错误用分号拼接
        : (res.message as string) || '请求失败';
    } else {
      message = '请求失败';
    }

    // 统一返回格式
    response.status(status).json({
      code: status,
      message: message,
      data: null,
    });
  }
}
```

**为什么要特别处理 `message`？**

因为 NestJS 的 `ValidationPipe` 验证失败时，返回的错误信息是一个**数组**，比如 `["商品名称不能为空", "价格必须为数字"]`。我们把它用分号拼接成一个字符串，前端展示更友好。

#### 第三步：注册到全局（main.ts）

```typescript
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // 注册全局拦截器：成功响应自动包装
  app.useGlobalInterceptors(new TransformInterceptor());

  // 注册全局异常过滤器：错误响应自动包装
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
```

> 💡 **注册顺序**：`Pipes → Interceptors → Filters`。管道先验证数据，拦截器包装成功响应，过滤器兜底处理异常。

#### 第四步：效果对比

**获取购物车（成功）：**

```json
// 之前
{ "items": [...], "totalPrice": 100 }

// 之后 ✅
{ "code": 200, "message": "请求成功", "data": { "items": [...], "totalPrice": 100 } }
```

**未登录访问（401 错误）：**

```json
// 之前
{ "message": "你还没有登录，请先登录获取 Token！", "error": "Unauthorized", "statusCode": 401 }

// 之后 ✅
{ "code": 401, "message": "你还没有登录，请先登录获取 Token！", "data": null }
```

**参数验证失败（400 错误）：**

```json
// 之前
{ "message": ["商品id必须是整数", "商品数量最小为1"], "error": "Bad Request", "statusCode": 400 }

// 之后 ✅
{ "code": 400, "message": "商品id必须是整数; 商品数量最小为1", "data": null }
```

#### 完整的请求处理链路

```
用户请求
  ↓
Pipes (数据验证) → 验证失败? → ExceptionFilter 包装错误
  ↓ 验证通过
Guards (身份认证) → 认证失败? → ExceptionFilter 包装错误
  ↓ 认证通过
Controller → Service → 返回数据
  ↓
Interceptor 包装成功响应 → { code: 200, message: "请求成功", data: ... }
```

> 💡 **前端福利**：有了统一格式后，Vue 前端可以写一个通用的 Axios 拦截器，所有接口只需要判断 `res.data.code === 200`，极大简化前端错误处理逻辑。

### 十四、跨域配置 (CORS)

当你的 Vue 前端（`http://localhost:5173`）要请求 NestJS 后端（`http://localhost:3000`）时，浏览器会因为**端口号不同**而拦截请求。这就是浏览器的"同源安全策略"。

#### 什么是同源策略？

浏览器规定：只有**协议、域名、端口号**完全一致的两个地址才算"同源"。不同源的请求会被浏览器直接拦截。

| 前端地址                | 后端地址                | 是否同源    |
| ----------------------- | ----------------------- | ----------- |
| `http://localhost:5173` | `http://localhost:3000` | ❌ 端口不同 |
| `http://localhost:3000` | `http://localhost:3000` | ✅ 完全一致 |

#### 解决办法：一行代码开启 CORS

在 `src/main.ts` 中，`app` 创建之后加一行：

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 开启跨域：允许其他端口的前端访问后端接口
  app.enableCors();

  // ... 其他全局管道注册
}
```

`app.enableCors()` 会让后端在响应头中加上 `Access-Control-Allow-Origin: *`，告诉浏览器"我允许任何来源的前端来访问我"。

> ⚠️ **生产环境注意**：`enableCors()` 不传参数时默认允许所有来源访问。上线时应该指定允许的域名：
>
> ```typescript
> app.enableCors({
>   origin: 'https://your-domain.com', // 只允许你的正式域名
> });
> ```

### 十五、环境变量与秘钥安全

我们之前在 `AuthModule` 和 `AuthGuard` 里，把 JWT 秘钥直接写死在了代码里。如果代码传到了公开的 GitHub 上，黑客只要看到这个秘钥，就能随意伪造 Token。

**行业铁律**：所有的密码、秘钥，必须写在 `.env` 文件里，并且 `.env` 文件绝对不能上传到代码仓库（已被 `.gitignore` 排除）。

#### 第一步：安装配置模块

```bash
pnpm add @nestjs/config
```

#### 第二步：配置 .env 文件

```env
# 之前的数据库配置保持不变
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/shopping_cart"

# 【新增】JWT 秘钥配置
JWT_SECRET="my-super-secret-key-123456"
```

#### 第三步：注册 ConfigModule（`app.module.ts`）

```typescript
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // 全局可用，所有模块都能注入 ConfigService
    // ... 其他模块
  ],
})
export class AppModule {}
```

`isGlobal: true` 意味着不需要在每个模块里单独导入 `ConfigModule`，任何地方都能直接注入 `ConfigService`。

#### 第四步：改造 AuthModule —— 秘钥从 .env 读取

```typescript
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    UsersModule,
    // 改为异步注册：等 ConfigService 读取完 .env 后，再配置 JWT
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService], // 注入 ConfigService
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'), // 从 .env 读取
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
})
```

**为什么要用 `registerAsync` 而不是 `register`？**

因为 `.env` 文件是异步加载的。如果用 `register`，代码执行时 `.env` 可能还没读完，`configService.get()` 会拿到 `undefined`。`registerAsync` + `useFactory` 会等 `ConfigService` 准备好了再执行。

#### 第五步：改造 AuthGuard —— 验证 Token 时也从 .env 读秘钥

```typescript
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService, // 注入配置服务
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ...
    const payload = await this.jwtService.verifyAsync(token, {
      secret: this.configService.get<string>('JWT_SECRET'), // 从 .env 读取
    });
    // ...
  }
}
```

#### 改造前后对比

| 位置             | 改造前                                 | 改造后                                 |
| ---------------- | -------------------------------------- | -------------------------------------- |
| `auth.module.ts` | `secret: 'my-super-secret-key-123456'` | `configService.get('JWT_SECRET')`      |
| `auth.guard.ts`  | `secret: 'my-super-secret-key-123456'` | `this.configService.get('JWT_SECRET')` |

> 💡 **ConfigService 常用方法**：
>
> ```typescript
> configService.get<string>('JWT_SECRET'); // 读取字符串
> configService.get<number>('PORT'); // 读取数字
> configService.get('KEY', 'default_value'); // 读取，如果没有就用默认值
> ```

### 十六、数据库事务 (Transaction)

#### 为什么需要事务？（灾难场景重现）

看看改造前的下单逻辑：

1. 算好总价，创建订单（写入 Order 表） ✅
2. 调用 `clearCart()` 清空购物车（删除 CartItem 表的数据） ❌ 突然断网了！

**结果**：用户的钱扣了（订单生成了），但购物车里的东西还在！用户一刷新，又点了一次结账，系统又生成了一个重复订单。这就是灾难。

**事务 (Transaction)** 能把多步操作"绑定"在一起：**要么全成功，要么全失败（回滚 Rollback）**。哪怕第 2 步报错了，数据库也会自动把第 1 步的订单撤销掉，当做什么都没发生过。这就是数据库的 **ACID 特性**。

#### 第一步：改造下单逻辑，引入 `$transaction`

在 Prisma 中，处理事务用 `$transaction` 方法。打开 `src/orders/orders.service.ts`：

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

      // 返回创建好的订单
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

#### 关键变化解读

| 改造前                               | 改造后                                |
| ------------------------------------ | ------------------------------------- |
| `this.prisma.order.create(...)`      | `tx.order.create(...)`                |
| `this.cartService.clearCart(userId)` | `tx.cartItem.deleteMany(...)`         |
| 两步操作各自独立，可能只成功一半     | 包在 `$transaction` 里，原子性保证    |
| 依赖 CartService（跨模块调用）       | 直接在事务中操作，不再需要 CartModule |

**最核心的一点**：事务回调里的 `tx` 参数，就是 Prisma 给你的"事务专用客户端"。回调里所有数据库操作都必须用 `tx`，不能用 `this.prisma`。只有用 `tx` 执行的操作才会被事务管理。

#### 第二步：清理模块依赖

清空购物车直接写在事务里了，不再需要调用 `CartService.clearCart()`，所以 `OrdersModule` 不再需要导入 `CartModule`：

```typescript
// orders.module.ts（改造后）
@Module({
  // 不再需要 imports: [CartModule]
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
```

> 💡 **为什么不在事务里调用 `CartService.clearCart()`？** 因为 `clearCart()` 用的是 `this.prisma`（普通客户端），不是事务客户端 `tx`。通过 service 调用的操作不在事务管控范围内，回滚时不会被撤销。

#### Prisma 事务方法速查

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

### 十七、自动生成接口文档 (Swagger)

做完了后端所有接口，终于到了一个灵魂拷问：**前端同事怎么知道你写了哪些接口？每个接口要传什么参数？返回什么数据？**

传统做法是写一份 Word 或 Markdown 文档，但问题是——你改了代码，经常忘了更新文档。时间一长，文档和代码就"分家"了。

**Swagger（OpenAPI）** 就是为了解决这个问题：它能**自动扫描你的代码**，生成一个漂亮的网页版接口文档，前端打开浏览器就能看，还能直接在网页上测试接口！

#### 第一步：安装 Swagger 模块

```bash
pnpm add @nestjs/swagger
```

> 💡 NestJS 11 的 `@nestjs/swagger` 已经内置了 `swagger-ui-express`，不需要像老版本那样额外安装。

#### 第二步：配置 Swagger（main.ts）

在 `src/main.ts` 中，添加 Swagger 的配置代码：

```typescript
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ... 之前的 CORS、管道、拦截器、过滤器配置保持不变 ...

  // ========== Swagger 接口文档配置 ==========
  const config = new DocumentBuilder()
    .setTitle('购物城 API') // 文档标题
    .setDescription('仿京东购物城后端接口文档') // 文档描述
    .setVersion('1.0') // 版本号
    .addBearerAuth() // 添加 Bearer Token 认证（右上角会出现 Authorize 按钮）
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document); // 挂载到 /api-docs 路径

  await app.listen(process.env.PORT ?? 3000);
}
```

**关键点解释：**

| 方法               | 说明                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| `DocumentBuilder`  | 链式调用，配置文档的标题、描述、版本等元信息                                         |
| `.addBearerAuth()` | 告诉 Swagger 这个项目使用 Bearer Token 认证，会在页面右上角显示一个 `Authorize` 按钮 |
| `createDocument()` | 扫描所有 Controller 和 DTO，生成 OpenAPI 规范的 JSON                                 |
| `setup()`          | 把生成的文档挂载到指定路径，启动后访问 `/api-docs` 即可看到                          |

#### 第三步：给 DTO 添加描述（@ApiProperty）

Swagger 需要知道每个字段的含义和示例值。我们用 `@ApiProperty()` 装饰器来告诉它：

**用户 DTO（`create-user.dto.ts`）：**

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

**商品 DTO（`create-product.dto.ts`）：**

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

**购物车 DTO（`create-cart.dto.ts`）：**

```typescript
import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';

export class createCartDto {
  @ApiHideProperty() // userId 从 Token 自动获取，不需要在文档中展示
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

> 💡 **@ApiHideProperty()**：购物车的 `userId` 现在是从 Token 自动获取的，前端不需要传。用这个装饰器可以在 Swagger 文档中隐藏这个字段，避免误导前端。

**常用 @ApiProperty 参数速查：**

| 参数          | 说明           | 示例                                   |
| ------------- | -------------- | -------------------------------------- |
| `description` | 字段的文字说明 | `'商品名称'`                           |
| `example`     | 示例值         | `'iPhone 16'`、`5999`                  |
| `minimum`     | 最小值         | `0.01`                                 |
| `minLength`   | 最小长度       | `3`                                    |
| `required`    | 是否必填       | `true`（默认就是 true）                |
| `type`        | 字段类型       | `'string'`、`'number'`（通常自动推断） |

#### 第四步：给 Controller 添加分组和说明

用 `@ApiTags()` 给每个 Controller 分组，用 `@ApiOperation()` 描述每个接口的用途，需要认证的加 `@ApiBearerAuth()`：

**示例——购物车控制器：**

```typescript
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('购物车') // 在 Swagger 页面中，这个控制器下的接口会归到"购物车"分组
@ApiBearerAuth() // 标记这组接口需要 Bearer Token 认证
@UseGuards(AuthGuard)
@Controller('cart')
export class CartController {
  @ApiOperation({ summary: '添加商品到购物车' }) // 接口的简短说明
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

#### 第五步：启动服务，访问文档

```bash
pnpm start:dev
```

打开浏览器，访问 **http://localhost:3000/api-docs**，你会看到一个漂亮的接口文档页面！

页面上会展示：

- 所有接口按 `@ApiTags` 分好了组（商品、购物车、订单、用户、认证）
- 每个接口都有 `@ApiOperation` 写的简短说明
- 点开某个接口，能看到请求参数的详细描述（来自 `@ApiProperty`）
- 右上角有一个绿色的 **Authorize** 按钮（来自 `.addBearerAuth()`）

#### 第六步：在 Swagger UI 中测试需要 Token 的接口

1. 先展开 **认证** 分组，点击 **POST /auth/login**
2. 点击 **Try it out**，填入用户名和密码，点击 **Execute**
3. 从返回结果中复制 `access_token` 的值
4. 点击页面右上角的 **Authorize** 按钮
5. 在弹出框中输入 `Bearer 你复制的token`（注意 Bearer 和 token 之间有空格）
6. 点击 **Authorize** 确认
7. 现在你就可以直接测试购物车和订单接口了！Swagger 会自动在请求头中携带 Token

#### 完整的装饰器速查表

| 装饰器               | 用在哪里        | 作用                                        |
| -------------------- | --------------- | ------------------------------------------- |
| `@ApiTags()`         | Controller 类   | 给接口分组，方便前端按模块查看              |
| `@ApiOperation()`    | Controller 方法 | 给单个接口写简短说明                        |
| `@ApiProperty()`     | DTO 字段        | 描述请求体中每个字段的含义、类型、示例值    |
| `@ApiHideProperty()` | DTO 字段        | 在文档中隐藏某个字段（如自动获取的 userId） |
| `@ApiBearerAuth()`   | Controller 类   | 标记这组接口需要 Bearer Token 认证          |

> 💡 **前端福利**：有了 Swagger，前端再也不用问后端"这个接口传什么参数"了。打开 `/api-docs`，所有信息一目了然，还能直接在线调试！
