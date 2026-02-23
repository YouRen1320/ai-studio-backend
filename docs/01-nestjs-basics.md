# 一、NestJS 基础入门

> 本篇涵盖 NestJS 的核心概念：三件套、依赖注入、DTO 数据验证，以及完整的开发流程总结。

---

## 1. NestJS 核心三件套

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

---

## 2. 依赖注入

NestJS 最强大的地方就是**依赖注入**。你不需要手动 `new` 一个服务实例，只要在 `constructor` 里声明类型，NestJS 自动帮你创建并传入：

```typescript
constructor(private prisma: PrismaService) {}
// 之后就可以用 this.prisma 操作数据库
```

---

## 3. DTO（数据传输对象）

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

---

## 4. 开发流程总结

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
