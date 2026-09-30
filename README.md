# AI Studio 后端实验项目

这是一个基于 NestJS 的 AI Agent 实验后端。Gemini 负责理解用户描述并提取关键词，服务端再用关键词和本地图片标签进行确定性打分，返回已有图库中最匹配的图片。

> 当前版本不调用文生图模型、不生成新图片，也没有向量数据库。代码中的 `generate_anime_image` 是为兼容现有前端保留的工具名，实际行为是“本地图库匹配”。

## 🌟 核心特性

- **Gemini 2.5 Flash**：通过 Function Calling 提取 2—4 个图片特征关键词。
- **本地图库匹配**：将关键词与人工维护的图片标签碰撞计分；没有命中时从本地图库随机回退。
- **JWT 鉴权**：Agent 接口需要登录令牌；会话当前保存在单进程内存中，重启会丢失，也不适合多实例部署。
- **统一响应结构**：NestJS 拦截器和异常过滤器统一成功与错误响应。

## 📁 目录结构

```text
src/
├── agent/            # 🤖 核心 AI Agent 模块 (含 Gemini 接入、图库 RAG 服务、System Prompt 设定等)
├── auth/             # 🔐 身份验证签发与鉴权拦截模块
├── users/            # 👤 用户注册与管理
├── products/         # 📦 商品陈列库 (已剥离上下文，可单独作为基础 CRUD)
├── cart/             # 🛒 购物车组件 (遗留基础组件)
├── orders/           # 🧾 订单调度系统与巡查计划任务 (遗留基础处理组件)
└── main.ts           # 🚦 全局应用入口及静态资源挂载
```

## 🚀 快速启动

1. **环境准备**
   请使用 Node.js 22.12+（22.x）或 24+ 及包管理工具 `pnpm`；当前 Prisma 7 依赖不支持 Node.js 18。

2. **配置环境变量**
   复制示例后替换本地开发值：

```bash
cp .env.example .env
```

`.env` 已被 Git 忽略。不要把 Gemini Key、JWT Secret、数据库口令或用户对话提交到仓库、Issue、日志和截图。

3. **依赖安装与 Prisma Client 生成**

```bash
pnpm install
pnpm exec prisma generate
```

> [!IMPORTANT]
> Prisma 7 不再在安装时自动生成客户端，`prisma generate` 是必需步骤；跳过它服务与测试都会报 `Cannot find module '.prisma/client'`。本仓库的 `pnpm-workspace.yaml` 已允许 prisma/engines/bcrypt 执行安装脚本，`pnpm install` 无需额外批准。

4. **启动服务**

```bash
# 开发环境热重载运行
pnpm start:dev
```

服务默认运行在 `http://localhost:3000`。

前端项目见 [ai-studio-frontend](https://github.com/YouRen1320/ai-studio-frontend)。

## 当前边界

- 仅作为本地实验项目维护，尚未提供生产级会话持久化、限流和审计脱敏；端到端测试目前仅覆盖应用启动与健康路由（连接真实 PostgreSQL/Redis），业务接口的端到端验收仍未提供。
- 日志只记录消息长度、工具名和结果类型，不记录用户原文、模型回复、关键词或图片文件名。
- 本地图片及其授权由使用者负责；公开部署前需确认素材来源、许可和隐私要求。
- `products`、`cart`、`orders` 是早期商城练习模块，与 AI 图库匹配没有业务依赖。

## 🔗 相关脚本

- `pnpm format`: 代码格式化
- `pnpm lint`: 代码静态质量诊断
- `pnpm test`: 单元测试

## 单元测试与构建验证

首次安装后先生成 Prisma Client；此步骤只根据本地 schema 生成代码，不运行数据库迁移：

```bash
pnpm exec prisma generate
pnpm exec jest --runInBand
pnpm build
```

单元测试使用 Nest 依赖替身，不需要启动 PostgreSQL、Redis 或配置 Gemini Key。
覆盖商品缓存与分页、购物车用户范围与金额、空购物车和库存不足拒绝下单、注册密码哈希、
登录令牌签发边界以及 Agent 会话隔离。控制器直接调用测试不代表 HTTP 守卫、参数校验或上传拦截器已通过端到端验收。
订单事务测试验证服务对事务客户端的调用，不验证真实数据库回滚、并发库存竞争或支付流程。

---

## 许可证

本项目以 [MIT](./LICENSE) 许可证发布。
