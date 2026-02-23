# 二、数据库配置（Docker + PostgreSQL + Prisma 7）

> 本篇涵盖数据库环境搭建、Prisma 7 安装配置、CRUD 方法速查，以及 Prisma Studio 可视化工具。

---

## 1. 启动数据库

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

---

## 2. 安装 Prisma 依赖

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

---

## 3. 初始化与迁移

```bash
npx prisma init          # 初始化，生成 prisma/ 文件夹
npx prisma migrate dev --name init  # 把 schema 同步到数据库
npx prisma generate      # 重新生成 Prisma Client
```

> **注意**：Prisma 7 不再自动生成 `.env` 文件，需要手动创建。
> `prisma.config.ts` 中配置 `datasource` 的 `url`，不在 `schema.prisma` 中配置。

---

## 4. Prisma 7 的关键变化：Driver Adapter

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

---

## 5. Prisma 常用方法速查

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

---

## 6. Prisma Studio —— 可视化查看数据库

Prisma 自带了一个网页版数据库管理工具，可以直接在浏览器里查看和编辑数据：

```bash
npx prisma studio
```

运行后会自动打开 `http://localhost:5555`，你可以在里面看到所有表和数据，非常方便调试。
