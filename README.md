# 🛒 购物城后端

> 使用 **NestJS + PostgreSQL + Prisma 7 + Redis + Docker** 构建的购物商城后端 API

## 技术栈

| 技术               | 用途                           |
| ------------------ | ------------------------------ |
| NestJS             | 后端框架（基于 Express）       |
| PostgreSQL 15      | 关系型数据库                   |
| Prisma 7           | ORM（操作数据库的工具）        |
| Docker             | 容器化运行 PostgreSQL + Redis  |
| Redis              | 内存缓存（商品列表高并发读取） |
| `@nestjs/jwt`      | JWT 用户认证                   |
| `bcrypt`           | 密码加密                       |
| `@nestjs/swagger`  | 自动生成接口文档               |
| `@nestjs/schedule` | 定时任务（自动取消超时订单）   |
| `@nestjs/config`   | 环境变量管理                   |
| `class-validator`  | DTO 数据验证管道               |

## 项目结构

```
src/
├── main.ts                           # 入口文件（全局管道、拦截器、Swagger、静态文件服务）
├── app.module.ts                     # 根模块，组织所有子模块
├── app.controller.ts                 # 根控制器（首页路由 /）
├── app.service.ts                    # 根服务
├── prisma.service.ts                 # Prisma 数据库服务（全局）
├── prisma.module.ts                  # Prisma 模块（注册为全局模块）
├── redis.module.ts                   # Redis 缓存模块（全局）
├── products/                         # 📦 商品模块
│   ├── products.module.ts
│   ├── products.controller.ts        # 路由：/products
│   ├── products.service.ts           # 商品业务逻辑（含分页、软删除、文件上传、Redis 缓存）
│   └── dto/
│       ├── create-product.dto.ts     # 创建商品的数据格式定义
│       └── query-product.dto.ts      # 分页查询参数定义
├── cart/                             # 🛒 购物车模块
│   ├── cart.module.ts
│   ├── cart.controller.ts            # 路由：/cart（需要 Token）
│   ├── cart.service.ts               # 购物车业务逻辑（按用户隔离）
│   └── dto/
│       └── create-cart.dto.ts        # 添加购物车的数据格式定义
├── orders/                           # 📋 订单模块
│   ├── orders.module.ts
│   ├── orders.controller.ts          # 路由：/orders（需要 Token）
│   ├── orders.service.ts             # 订单业务逻辑（事务 + 库存扣减 + 定时取消）
│   └── dto/
│       └── orders.dto.ts             # 订单数据格式定义
├── users/                            # 👤 用户模块
│   ├── users.module.ts
│   ├── users.controller.ts           # 路由：/users（注册）
│   ├── users.service.ts              # 用户业务逻辑（bcrypt 加密）
│   └── dto/
│       └── create-user.dto.ts        # 注册数据格式定义
├── auth/                             # 🔐 认证模块
│   ├── auth.module.ts                # JWT 配置（从 .env 读取秘钥）
│   ├── auth.controller.ts            # 路由：/auth（登录）
│   ├── auth.service.ts               # 登录逻辑（密码验证 + Token 签发）
│   └── auth.guard.ts                 # 路由守卫（验证 Token）
└── common/                           # 🔧 公共模块
    ├── interceptors/
    │   └── transform.interceptor.ts  # 统一成功响应格式 { code, message, data }
    └── filters/
        └── http-exception.filter.ts  # 统一错误响应格式 { code, message, data: null }
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动 Docker（PostgreSQL + Redis）

```bash
docker compose up -d
```

### 3. 配置环境变量

项目根目录创建 `.env` 文件：

```env
# 数据库连接
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/shopping_cart"

# JWT 秘钥（生产环境请替换为随机强密码）
JWT_SECRET="my-super-secret-key-123456"

# Redis 连接
REDIS_HOST="localhost"
REDIS_PORT=6379
```

### 4. 数据库迁移（创建数据表）

```bash
npx prisma migrate dev --name init
```

### 5. 启动开发服务器

```bash
pnpm start:dev
```

服务运行在 `http://localhost:3000`，接口文档在 `http://localhost:3000/api-docs`（Swagger UI）。

---

## API 接口

> 标注 🔒 的接口需要在请求头携带 `Authorization: Bearer <token>`

### 👤 用户 `/users`

| 方法 | 路径              | 说明     | 请求体                                             |
| ---- | ----------------- | -------- | -------------------------------------------------- |
| POST | `/users/register` | 用户注册 | `{ "username": "zhangsan", "password": "123456" }` |

### 🔐 认证 `/auth`

| 方法 | 路径          | 说明                   | 请求体                                             |
| ---- | ------------- | ---------------------- | -------------------------------------------------- |
| POST | `/auth/login` | 用户登录（获取 Token） | `{ "username": "zhangsan", "password": "123456" }` |

### 📦 商品 `/products`

| 方法  | 路径                         | 说明                 | 请求体 / 参数                            |
| ----- | ---------------------------- | -------------------- | ---------------------------------------- |
| GET   | `/products`                  | 获取商品列表（分页） | Query: `?page=1&limit=10&keyword=iPhone` |
| POST  | `/products`                  | 上架新商品           | `{ "name": "iPhone 16", "price": 5999 }` |
| PATCH | `/products/:id/deactivate`   | 下架商品（软删除）   | —                                        |
| POST  | `/products/:id/upload-image` | 上传商品图片         | FormData: `file`                         |

### 🛒 购物车 `/cart` 🔒

| 方法 | 路径    | 说明                 | 请求体                              |
| ---- | ------- | -------------------- | ----------------------------------- |
| GET  | `/cart` | 查看当前用户的购物车 | —                                   |
| POST | `/cart` | 添加商品到购物车     | `{ "productId": 1, "quantity": 2 }` |

### 📋 订单 `/orders` 🔒

| 方法 | 路径      | 说明                   | 请求体 |
| ---- | --------- | ---------------------- | ------ |
| GET  | `/orders` | 查看当前用户的历史订单 | —      |
| POST | `/orders` | 提交订单（购物车结算） | —      |

---

## 📚 学习笔记

本项目配套的完整学习笔记在 [`docs/`](./docs/) 目录下，按主题拆分为 8 个文档：

| #   | 文档                                                             | 内容                                                              |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| 01  | [NestJS 基础入门](./docs/01-nestjs-basics.md)                    | 核心三件套、依赖注入、DTO 数据验证、开发流程总结                  |
| 02  | [数据库配置](./docs/02-database-setup.md)                        | Docker + PostgreSQL + Prisma 7 配置、CRUD 方法速查、Prisma Studio |
| 03  | [购物车与订单实战](./docs/03-cart-and-orders.md)                 | 购物车接入数据库、表关系设计、嵌套写入与连表查询                  |
| 04  | [用户认证系统](./docs/04-auth-and-jwt.md)                        | 用户注册 + bcrypt 加密、JWT 登录、路由守卫身份拦截                |
| 05  | [中间件与数据格式化](./docs/05-interceptors-and-filters.md)      | 统一返回格式（拦截器 + 过滤器）、CORS 跨域、环境变量安全          |
| 06  | [事务与接口文档](./docs/06-transactions-and-swagger.md)          | Prisma `$transaction` 原子操作、Swagger 自动文档                  |
| 07  | [进阶功能](./docs/07-advanced-features.md)                       | 分页与条件查询、软删除（下架/上架）、Multer 文件上传              |
| 08  | [Redis 缓存与架构愿景](./docs/08-redis-scheduling-and-beyond.md) | Redis 缓存、定时任务自动取消订单、微服务 + K8s 展望               |

---

## 常见问题 (FAQ)

**Q: 迁移后 IDE 报错找不到 `this.prisma.order`？**

> 在 VS Code 中按 `Cmd+Shift+P` → `TypeScript: Restart TS Server` 重启类型服务。

**Q: Prisma 7 为什么需要 Driver Adapter？**

> Prisma 7 不再支持直连数据库，必须通过 `@prisma/adapter-pg` + `pg` 驱动连接。详见 [02-database-setup.md](./docs/02-database-setup.md)。

**Q: 生产环境注意事项？**

> - `.env` 文件绝对不能上传到代码仓库（已被 `.gitignore` 排除）
> - `enableCors()` 上线时应指定允许的域名
> - 图片建议上传到云存储（OSS/COS/S3），不要存在服务器本地

---

## License

MIT
