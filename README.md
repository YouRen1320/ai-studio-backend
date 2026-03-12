# 🌌 AI Studio (后端引擎)

这是一个基于 **NestJS** 构建的 AI Agent 驱动的后台服务，负责为前端提供自然语言理解、意图识别与基于本地 RAG 的生图匹配检索服务。

## 🌟 核心特性

- **Gemini 2.5 Flash 驱动**：使用 `@google/generative-ai` 深度集成，打造高可用的大语言模型交互中枢。
- **Function Calling (工具调用)**：模型可结合用户的 Prompt，自动提取核心关键字（Keywords）去触发对应的检索服务。
- **RAG 向量图库检索**：内置简单的类似于向量特征匹配的打分机制，将大模型提取的关键词与本地图库的元数据特征标签碰撞，最高分图片作为最终“生成”的图片呈现给用户。
- **JWT 鉴权防护**：Agent 核心接口受全局鉴权保护，不同用户的对话 Session 进行沙箱隔离。
- **全局拦截支持**：封装了统一结构的 `TransformInterceptor` 与跨域请求处理，保证端点数据分发标准。

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
   请确保你已安装 `Node.js (v18+)` 及包管理工具 `pnpm`。

2. **配置秘钥**
   修改或创建根目录下的 `.env` 文件，补充您的 Google 大模型密钥：

```env
GEMINI_API_KEY=AIzaSyBqQOpIxY50ZH...（替换为您申请的真实 Key）
```

3. **依赖安装**

```bash
pnpm install
```

4. **启动服务**

```bash
# 开发环境热重载运行
pnpm start:dev
```

服务默认运行在 `http://localhost:3000`。

## 🔗 相关脚本

- `pnpm format`: 代码格式化
- `pnpm lint`: 代码静态质量诊断
- `pnpm test`: 单元测试

---

🎯 _Built for the AI Studio Workspace._
