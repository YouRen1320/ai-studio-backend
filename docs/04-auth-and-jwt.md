# 四、用户认证系统（注册 + JWT + 路由守卫）

> 本篇涵盖用户模块的创建与密码加密、JWT 登录认证，以及路由守卫的身份拦截机制。

---

## 1. 用户模块与密码加密

### 添加 User 模型

在 `schema.prisma` 中新增 `User` 表，并将 `CartItem`、`Order` 与用户关联：

```prisma
model User {
  id        Int        @id @default(autoincrement())
  username  String     @unique
  password  String     // 存储的是 bcrypt 加密后的哈希值，不是明文！
  createdAt DateTime   @default(now())
  cartItems CartItem[]
  orders    Order[]
}

model CartItem {
  // ... 原有字段
  userId  Int
  user    User @relation(fields: [userId], references: [id])
}

model Order {
  // ... 原有字段
  userId  Int
  user    User @relation(fields: [userId], references: [id])
}
```

由于给 `CartItem` 和 `Order` 加上了**必填**的 `userId`，但数据库里以前存的老数据没有 `userId`，会导致冲突。运行迁移时如果有旧数据，需要先清空或手动处理：

```bash
npx prisma migrate dev --name add_user_model
```

### 安装密码加密工具

业界绝对禁止把用户密码直接存进数据库。我们使用 **bcrypt** 单向哈希加密：

```bash
pnpm add bcrypt
pnpm add -D @types/bcrypt
```

### 创建用户模块

```bash
nest g resource users
# 选择 REST API，不生成 CRUD (n)
```

### 编写用户 DTO（`src/users/dto/create-user.dto.ts`）

```typescript
import { IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3, { message: '用户名至少3个字符' })
  username: string;

  @IsString()
  @MinLength(6, { message: '密码至少6个字符' })
  password: string;
}
```

### 编写用户 Service（`src/users/users.service.ts`）

```typescript
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // 注册新用户
  async create(createUserDto: CreateUserDto) {
    // 1. 检查用户名是否已存在
    const existingUser = await this.prisma.user.findUnique({
      where: { username: createUserDto.username },
    });
    if (existingUser) {
      throw new ConflictException('用户名已存在');
    }

    // 2. 用 bcrypt 对密码进行哈希加密（10 是 salt 轮数）
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // 3. 存入数据库（存的是加密后的密码）
    const user = await this.prisma.user.create({
      data: {
        username: createUserDto.username,
        password: hashedPassword,
      },
    });

    // 4. 返回用户信息（注意：不要返回密码！）
    return {
      message: '注册成功！',
      userId: user.id,
      username: user.username,
    };
  }

  // 根据用户名查询用户（供登录使用）
  async findOneByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }
}
```

### 编写用户 Controller（`src/users/users.controller.ts`）

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
```

### 导出 UsersService

在 `src/users/users.module.ts` 中，把 `UsersService` 暴露出去，让后续的 `AuthModule` 可以调用：

```typescript
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // 对外开放 UsersService
})
export class UsersModule {}
```

### 测试注册

```bash
curl -X POST http://localhost:3000/users/register \
  -H "Content-Type: application/json" \
  -d '{"username": "zhangsan", "password": "123456"}'
# 返回: { "message": "注册成功！", "userId": 1, "username": "zhangsan" }
```

---

## 2. 用户登录 —— JWT (JSON Web Token) 认证

用户注册了，他怎么证明自己是谁呢？总不能每次买东西都带上账号密码吧？

### 什么是 JWT？(一个通俗的比喻)

想象你去住酒店：

1. **登录**：你拿着身份证（账号密码）去前台证明你是谁。
2. **颁发 JWT**：前台核对无误后，不会让你每次开门都出示身份证，而是给你一张**房卡 (Token)**。
3. **携带 JWT**：这张房卡里记录了你的房间号和退房时间。接下来你在这个酒店里去健身房、吃自助餐、开房门，只需要刷这张房卡就行了。

### 第一步：安装依赖

```bash
pnpm add @nestjs/jwt
```

### 第二步：创建 Auth 模块

```bash
nest g resource auth
# 选择 REST API，不生成 CRUD (n)
```

### 第三步：配置 JWT（`src/auth/auth.module.ts`）

```typescript
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    UsersModule,
    // 配置 JWT（这里为了新手方便把秘钥写死了，真实项目中应该写在 .env 文件里！）
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

### 第四步：编写登录逻辑（`src/auth/auth.service.ts`）

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(username: string, pass: string) {
    // 1. 去数据库里找这个用户
    const user = await this.usersService.findOneByUsername(username);

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误！');
    }

    // 2. 核对密码：用 bcrypt.compare 比较明文密码和数据库里的哈希密码
    const isPasswordValid = await bcrypt.compare(pass, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误！');
    }

    // 3. 制作 Payload：房卡里只写不可变的 ID 和用户名，不写密码
    const payload = { sub: user.id, username: user.username };

    // 4. 签发 Token
    return {
      message: '登录成功！',
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
```

登录流程：找用户 → 核对密码 → 制作 Payload → 签发 Token

### 第五步：开放登录接口（`src/auth/auth.controller.ts`）

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
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

### 第六步：测试登录

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "zhangsan", "password": "123456"}'
```

成功后会返回：

```json
{
  "message": "登录成功！",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

这个 `access_token` 就是你的"房卡"，后续的接口请求需要在请求头里携带它来证明身份。

---

## 3. 路由守卫 (Guards) 与身份拦截

现在用户已经能登录并获得 Token 了，但是问题来了：**购物车和订单接口是"裸奔"的！** 任何人都可以直接访问，甚至不需要登录。

我们的目标：给购物车和订单接口加上一把"密码锁"。没有 `access_token` 的人，一律不准靠近。

### 什么是 Guard？

继续上面酒店的比喻：

- **房卡（Token）** 已经在"登录"时发给你了
- 现在我们需要在**每个房间门口安排一个保安（Guard）**
- 保安的工作很简单：**"你的房卡呢？刷一下。" → "嗯，是本酒店的卡没错，请进。"**
- 如果没有房卡，或者房卡是假的，保安就会把你挡在门外（`401 Unauthorized`）

### 第一步：创建 AuthGuard（`src/auth/auth.guard.ts`）

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
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. 从请求头中提取 Token
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('你还没有登录，请先登录获取 Token！');
    }

    // 2. 验证 Token 是否合法
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: 'my-super-secret-key-123456', // 必须和签发时的秘钥一致！
      });

      // 3. 验证通过！把用户信息挂载到 request 对象上
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException('Token 无效或已过期，请重新登录！');
    }

    return true;
  }

  // 辅助方法：从 "Authorization: Bearer xxxxx" 中提取 Token
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

### 第二步：给购物车和订单"上锁"

**购物车控制器 `cart.controller.ts`：**

```typescript
@UseGuards(AuthGuard) // 给整个购物车控制器上锁！
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  add(@Body() body: createCartDto, @Request() req) {
    // req.user.sub 就是从 Token 解析出的用户 ID
    return this.cartService.addToCart({ ...body, userId: req.user.sub });
  }

  @Get()
  findAll(@Request() req) {
    return this.cartService.getCart(req.user.sub);
  }
}
```

**订单控制器 `orders.controller.ts`：**

```typescript
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

### 第三步：Service 层也要配合改造

光在 Controller 门口站保安还不够，Service 层的查询逻辑也必须加上用户过滤，否则"进了门以后还是能看到别人的东西"。

**购物车 Service 改造（`cart.service.ts`）：**

一共要改 3 个方法，核心就是每个数据库操作都带上 `userId`：

```typescript
// ① addToCart：查找和创建时都要限制到当前用户
async addToCart(item: createCartDto, userId: number) {
  const existingItem = await this.prisma.cartItem.findFirst({
    where: {
      productId: item.productId,
      userId: userId, // 🔒 只在当前用户的购物车里找
    },
  });

  if (existingItem) {
    await this.prisma.cartItem.update({ ... });
  } else {
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

// ③ clearCart：只清空当前用户的购物车
async clearCart(userId: number) {
  await this.prisma.cartItem.deleteMany({
    where: { userId: userId }, // 🔒 只删当前用户的
  });
}
```

**订单 Service 改造（`orders.service.ts`）：**

```typescript
// ① createOrder：整个下单流程都锁定到当前用户
async createOrder(userId: number) {
  const cartItems = await this.prisma.cartItem.findMany({
    where: { userId }, // 🔒 只拿这个用户的购物车
    include: { product: true },
  });
  if (!cartItems.length)
    throw new BadRequestException('购物车是空的，无法下单');

  const totalPrice = cartItems.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity, 0,
  );

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

### 第四步：测试

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

# ✅ 带 Token 提交订单
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer eyJhbGciOi..."

# ❌ 不带 Token 访问订单 → 被拦截
curl http://localhost:3000/orders
# 返回: { "message": "你还没有登录，请先登录获取 Token！", "statusCode": 401 }
```

> 💡 **注意**：在 Postman 中测试时，在 `Headers` 选项卡中添加 `Authorization` 头，值为 `Bearer <你的token>`。

### 完整的请求流程

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
