# 八、Redis 缓存、定时任务与架构愿景

> 本篇涵盖 Redis 缓存应对高并发、定时任务自动取消超时订单，以及微服务与 Kubernetes 的进阶架构展望。

---

## 1. 引入 Redis 缓存 (应对高并发读写)

**痛点场景**：假设你的商城搞双十一，一秒钟内有 10 万人同时打开首页看商品列表（调用 `GET /products`）。如果这 10 万次请求全部打向 PostgreSQL 数据库，数据库瞬间就会 CPU 100% 宕机。

**解决方案**：引入 **Redis（内存键值对数据库）**。把热门商品列表存到内存里，速度比查 PostgreSQL 快成百上千倍。

### 启动 Redis 容器

在 `docker-compose.yml` 中追加 Redis 服务配置：

```yaml
# 追加到已有的 docker-compose.yml 的 services 下
redis:
  image: redis:7-alpine # 轻量级 Redis 7
  container_name: shopping-cart-redis
  restart: always
  ports:
    - '6379:6379'
  volumes:
    - redis_data:/data
```

> 💡 别忘了在顶级 `volumes:` 下也追加 `redis_data:` 的声明。

运行 `docker compose up -d` 启动 Redis 容器。同时在 `.env` 中配置连接信息：

```env
REDIS_HOST="localhost"
REDIS_PORT=6379
```

### 安装并全局配置缓存模块

```bash
pnpm add @nestjs/cache-manager cache-manager cache-manager-redis-yet
```

在 `src/redis.module.ts` 中进行全局注册：

```typescript
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true, // 全局可用
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const store = await redisStore({
          socket: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
          },
        });
        return { store, ttl: 60 * 1000 }; // 默认缓存 60 秒
      },
    }),
  ],
})
export class RedisModule {}
```

### 业务代码引入缓存与更新失效机制

查询商品列表时使用 Redis 的核心逻辑：

1. **先查缓存**：根据分页参数生成 Cache Key（如 `products:page=1:limit=10:keyword=`）
2. 如果有缓存，**直接返回内存结果（极速响应）**
3. 如果无缓存：**查询 PostgreSQL → 存入 Redis → 返回给前端**

但是，一旦管理员在后台**上架/下架/更新商品**，缓存可能还没过期，用户看到的就是过时数据。这就需要**写操作清缓存**：

```typescript
// 在 ProductsService 中注入 CACHE_MANAGER
constructor(
  private prisma: PrismaService,
  @Inject(CACHE_MANAGER) private cacheManager: Cache,
) {}

async getAllProducts(query: QueryProductDto) {
  const { page = 1, limit = 10, keyword } = query;
  const cacheKey = `products:page=${page}:limit=${limit}:keyword=${keyword || ''}`;

  // 1. 先查 Redis 缓存
  const cached = await this.cacheManager.get(cacheKey);
  if (cached) return cached; // 命中缓存，直接返回！

  // 2. 没命中则查数据库
  const [items, total] = await Promise.all([ /* 数据库查询操作 */ ]);
  const result = { items, total, page, limit, totalPages };

  // 3. 把查询结果写入 Redis，保存 60 秒
  await this.cacheManager.set(cacheKey, result, 60 * 1000);

  return result;
}

// ==== 在数据发生更新的时候清除缓存 ====
private async clearProductListCache() {
  const client = (this.cacheManager as any)?.store?.client;
  if (client) {
    const keys = await client.keys('products:*');
    if (keys.length > 0) await client.del(keys);
  }
}

// 上架新商品（写操作后清除缓存）
async createProduct(name: string, price: number) {
  const product = await this.prisma.product.create({ data: { name, price } });
  await this.clearProductListCache(); // 商品数据变了，清空缓存！
  return product;
}
```

### 面试必问核心概念：缓存雪崩与缓存穿透

- 💣 **缓存雪崩 (Cache Avalanche)**：如果大批量热门商品在**同一时间过期失效**，几万个请求同时去请求数据库重建缓存，瞬间激增的并发直接引发数据库宕机。
  - **怎么防范**：给每条缓存的 `TTL 过期时间` 加一个随机波动范围，让失效时间错开。
  - **实际项目**：活动时间很长时可设置永不失效，管理员编辑时采用**手动覆盖失效（Cache Invalidation）**。

- 👻 **缓存穿透 (Cache Penetration)**：黑客故意用完全不存在的恶意关键词疯狂查询。因为商品不在数据库里，Redis 也不会有缓存；所有恶意查询都直击数据库，导致负荷瘫痪——你的 Redis 大门被黑客当空气直接**穿过**了。
  - **怎么防范**：哪怕查不到的结果，也存进 Redis 缓存，记录值为空。下次同样访问直接返回空，免去数据库查询。

---

## 2. 定时任务与自动状态流转 (Task Scheduling)

**痛点场景**：用户下了单却不付钱，商品就会一直被"占着库存"，别人想买都买不到！

**解决方案**：利用 `@nestjs/schedule` 写一个"后台机器人"，每分钟巡逻一次数据库。发现超过 15 分钟还没付款的订单，自动改成 `CANCELLED`（已取消），并归还库存！

### 数据库改造

在 `schema.prisma` 中新增枚举和库存字段：

```prisma
enum OrderStatus {
  PENDING   // 待付款（会锁库存）
  PAID      // 已付款
  CANCELLED // 已取消（超时未付，释放库存）
}

model Product {
  // ... 其他字段
  stock     Int @default(100)
}

model Order {
  // ... 其他字段
  status OrderStatus @default(PENDING)
}
```

运行迁移 `npx prisma migrate dev`。

### 安装与配置

```bash
pnpm add @nestjs/schedule
```

在 `app.module.ts` 开启定时任务引擎：`ScheduleModule.forRoot()`。

### 业务代码实现

在 `orders.service.ts` 中，实现了两大功能：

1. **下订单时扣减库存**：`stock: { decrement: item.quantity }`（库存不够则拒绝下单）
2. **巡逻机器人**：用 `@Cron()` 装饰器创建后台定时任务

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class OrdersService {
  // ... 其他代码

  // 🤖 机器人巡逻：每分钟执行一次
  @Cron(CronExpression.EVERY_MINUTE)
  async cancelUnpaidOrders() {
    this.logger.log('🕵️‍♂️ 开始巡逻：检查是否有超时未支付的订单...');

    // 1. 找到所有 状态为 PENDING 且 创建时间在 15分钟前 的订单
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const expiredOrders = await this.prisma.order.findMany({
      where: { status: 'PENDING', createdAt: { lt: fifteenMinutesAgo } },
      include: { items: true },
    });

    if (expiredOrders.length === 0) return;

    // 2. 依次取消这些超时订单并归还库存
    for (const order of expiredOrders) {
      await this.prisma.$transaction(async (tx) => {
        // a. 把订单状态改成 CANCELLED
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' },
        });

        // b. 把里面每个商品数量加回 stock 中！
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }, // increment 原子自增
          });
        }
      });
      this.logger.log(`❌ 订单 #${order.id} 超时已取消，库存已归还。`);
    }
  }
}
```

你可以根据需要定制成各种规律，比如 "每周一早上 8:30 执行"，这在业务开发中极为常见（报表统计、邮件群发、会员检查）。

---

## 3. 结语与进阶架构愿景：微服务与 Kubernetes (K8s) 化

恭喜你！到这里，你已经手写完成了一个**五脏俱全的单体（Monolith）架构后端系统**。从 DTO 校验、统一拦截器、Prisma 数据库、Redis 缓存到定时任务，这套架构在中小企业（日均十万级 PV）已经完全够用了。

### 为什么要拆分微服务？（单体架构的噩梦）

现在我们的代码是把"用户模块"、"商品模块"、"订单模块"全写在一个工程里。

- **痛点 A (一崩全崩)**：双十一秒杀时，订单模块因为并发过高内存溢出了！结果因为大家在同一个进程里，连带着"用户登录"、"查看商品"也全部宕机。
- **痛点 B (资源浪费)**：为了抗压升级到 64 核 128G，但其实平时只有 20% 的时间需要这么高配置。

### NestJS 微服务架构 (Microservices)

**解法**：把一个大工程，拆成 4 个完全独立的小工程！

1. 门户网关服务 (API Gateway)
2. 用户登录服务 (User Service)
3. 订单处理服务 (Order Service)
4. 商品展示服务 (Product Service)

放在 4 台不同的服务器上。**订单系统崩了，用户照样能看商品！** 如果订单系统压力大，就**只给订单系统单独加机器**。

**NestJS 原生支持微服务通信**（`@nestjs/microservices`）：拆分开的系统可以使用 **TCP**、**gRPC**、**Redis/RabbitMQ/Kafka 消息队列** 进行内部沟通，速度极快！

### 为什么要用 Kubernetes (K8s)？

在微服务时代，你可能有几十上百个 Docker 容器！普通的 `docker-compose` 已经管不过来了。

**Kubernetes (K8s)** 是 Google 开源的容器编排大杀器，**管理这几百个 Docker 容器的总指挥官**。

K8s 四大神兽配置：

1. 📦 **Pod (豆荚)**：K8s 的最小单位，把你的容器包装进一个 Pod 里。
2. 🪖 **Deployment (部署指令)**：Pod 们的司令。"我需要订单服务随时保持 5 个副本"。**哪怕一台机器断电了，K8s 也会自动在另一台服务器上重新拉起缺失的 Pod**！更牛的是**自动扩缩容 (HPA)**：CPU 超过 80%，K8s 自动加 Pod 抗压。
3. ⚖️ **Service (内部负载均衡)**：50 个订单 Pod 的 IP 都在变，商品服务只要喊一声 `order-service`，K8s 就会自动挑选最闲的那一个去接待。
4. 🚪 **Ingress (暴露大网关)**：让手机用户通过 `https://api.yourshop.com` 访问内部服务。

> **终极闭环**：当你的系统演进到 **「NestJS 微服务群 + gRPC 极速内网通信 + Kubernetes 自动扩缩容护航」** 的那一刻，你才真正触摸到了现代后端架构的巅峰。这就是你星辰大海的下一步！🚀
