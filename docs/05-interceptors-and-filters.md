# 五、中间件与数据格式化

> 本篇涵盖统一接口返回格式（拦截器 + 异常过滤器）、跨域配置（CORS），以及环境变量与秘钥安全。

---

## 1. 统一接口返回格式（拦截器与过滤器）

在真实的团队协作中，前端最怕的就是后端返回的数据格式"随心所欲"。后端必须制定一个铁律：**所有返回数据都装进统一的"包装盒"**。

### 目标格式

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

### 核心概念：拦截器 vs 过滤器

| 角色                              | 处理什么   | 比喻                                       |
| --------------------------------- | ---------- | ------------------------------------------ |
| **拦截器 (Interceptor)**          | 成功的响应 | 快递打包员，把货物装进统一的快递盒         |
| **异常过滤器 (Exception Filter)** | 抛出的异常 | 售后客服，把投诉信息也装进统一格式的回执单 |

### 成功响应拦截器（`src/common/interceptors/transform.interceptor.ts`）

```typescript
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

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
    return next.handle().pipe(
      map((data) => ({
        code: 200,
        message: '请求成功',
        data: data,
      })),
    );
  }
}
```

**关键点：**

- `NestInterceptor` 是 NestJS 拦截器的接口
- `next.handle()` 会执行 Controller 方法，返回一个 RxJS `Observable`
- `pipe(map(...))` 是 RxJS 的操作符，在数据流出时对数据做转换
- Controller 里的代码完全不需要改动，返回什么数据都会自动被包装

### 异常过滤器（`src/common/filters/http-exception.filter.ts`）

```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();

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

### 注册到全局（`main.ts`）

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

### 效果对比

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
{ "message": "你还没有登录...", "error": "Unauthorized", "statusCode": 401 }

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

### 完整的请求处理链路

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

---

## 2. 跨域配置 (CORS)

当你的 Vue 前端（`http://localhost:5173`）要请求 NestJS 后端（`http://localhost:3000`）时，浏览器会因为**端口号不同**而拦截请求。这就是浏览器的"同源安全策略"。

### 什么是同源策略？

浏览器规定：只有**协议、域名、端口号**完全一致的两个地址才算"同源"。不同源的请求会被浏览器直接拦截。

| 前端地址                | 后端地址                | 是否同源    |
| ----------------------- | ----------------------- | ----------- |
| `http://localhost:5173` | `http://localhost:3000` | ❌ 端口不同 |
| `http://localhost:3000` | `http://localhost:3000` | ✅ 完全一致 |

### 解决办法：一行代码开启 CORS

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

---

## 3. 环境变量与秘钥安全

我们之前在 `AuthModule` 和 `AuthGuard` 里，把 JWT 秘钥直接写死在了代码里。如果代码传到了公开的 GitHub 上，黑客只要看到这个秘钥，就能随意伪造 Token。

**行业铁律**：所有的密码、秘钥，必须写在 `.env` 文件里，并且 `.env` 文件绝对不能上传到代码仓库（已被 `.gitignore` 排除）。

### 第一步：安装配置模块

```bash
pnpm add @nestjs/config
```

### 第二步：配置 `.env` 文件

```env
# 数据库配置
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/shopping_cart"

# JWT 秘钥配置
JWT_SECRET="my-super-secret-key-123456"
```

### 第三步：注册 ConfigModule（`app.module.ts`）

```typescript
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // 全局可用
    // ... 其他模块
  ],
})
export class AppModule {}
```

`isGlobal: true` 意味着不需要在每个模块里单独导入 `ConfigModule`，任何地方都能直接注入 `ConfigService`。

### 第四步：改造 AuthModule

```typescript
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    UsersModule,
    // 改为异步注册：等 ConfigService 读取完 .env 后，再配置 JWT
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
})
```

**为什么要用 `registerAsync` 而不是 `register`？**

因为 `.env` 文件是异步加载的。如果用 `register`，代码执行时 `.env` 可能还没读完，`configService.get()` 会拿到 `undefined`。`registerAsync` + `useFactory` 会等 `ConfigService` 准备好了再执行。

### 第五步：改造 AuthGuard

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

### 改造前后对比

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
