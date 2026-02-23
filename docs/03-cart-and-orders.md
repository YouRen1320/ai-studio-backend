# 三、购物车与订单模块实战

> 本篇涵盖购物车模块从文件存储迁移到数据库、数据库表关系设计，以及订单模块的嵌套写入和多级连表查询。

---

## 1. 购物车模块接入数据库

最初购物车数据是存在本地 JSON 文件中的，后来改为使用 Prisma 操作 PostgreSQL 数据库。

### 在 `schema.prisma` 中添加购物车表

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

### 执行数据库迁移

```bash
npx prisma migrate dev --name add_cart_item
```

这条命令会做三件事：

1. 对比 `schema.prisma` 和当前数据库的差异
2. 生成 SQL 迁移文件（保存在 `prisma/migrations/` 目录下）
3. 自动运行 `prisma generate` 重新生成 Prisma Client

### 改造购物车 Service

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

---

## 2. 数据库表关系设计

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

---

## 3. 订单模块接入数据库

### 在 `schema.prisma` 中添加订单相关表

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

### 执行数据库迁移

```bash
npx prisma migrate dev --name add_order_tables
npx prisma generate  # 如果迁移后类型提示没更新，手动重新生成
```

> ⚠️ 如果 IDE 仍然报错找不到 `this.prisma.order`，在 VS Code 中按 `Cmd+Shift+P` → `TypeScript: Restart TS Server` 重启类型服务。

### 订单 Service 核心逻辑

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

### 订单模块需要导入购物车模块

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
