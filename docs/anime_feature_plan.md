# 🎨 AI 全栈项目进阶：动漫图片生成功能改造方案

这部分文档旨在为您现有的「购物城 AI Agent」接入更多元的“生成式”能力。目前项目根目录 `Project/image` 下已经整理好了大量的动漫图片库，我们将围绕这些精美的存货，或者真实的外部开放 API 来做全栈动漫生图重构计划。

## 📍 资源存放位置策略：放后端还是前端？

基于目前前后端分离以及 AI Agent 职责划分的架构思路，**强烈建议把 `/image` 文件夹放入「后端」服务中进行托管（如 NestJS 的静态资源目录）**。

### 为什么放后端？

1. **Agent 的一致性**：大模型（Gemini）是在后端运行逻辑并分发工具（Tools）的，如果要给前端返回图片，应当由后端的一个 Tool（比如 `generate_anime_image` 工具）随机或按逻辑从后端取出图片 URL 喂给模型。
2. **扩展性更强**：如果初期用这批本地图片作为“Mock”假数据，当后面您想接入真实的大模型生图（Midjourney、阿里云通义万相、Stable Diffusion 等）API 时，前端代码完全不需要动！只需要让后端的工具把取本地文件改成发起真正生图 API 请求即可。
3. **前端减负**：几十张甚至数百张的高清图放在前端打包会导致体积臃肿，放入服务端静态托管符合标准流程。

---

## 🏗️ 架构改造思路

```mermaid
graph TB
    A[用户输入:帮我生成一个二次元少女] --> B[前端 ChatBot.vue]
    B --> C{NestJS: AgentController}
    C --> D[Gemini 2.5 解析意图]
    D --> |识别需生成图片| E[调用新 Tool: generate_anime]
    E --> F[后端的 ImageService]
    F --> |随机或根据词条匹配| G[返回 /public/image/ 下的图片URL]
    G --> D
    D --> |包装成 Markdown 图片语法| H[返回最终消息: ![描述](URL)]
    H --> B
```

---

## 📝 分步骤执行计划

### 步骤 1：后端的静态图片资源托管

- 将桌面的 `/Users/youren/Desktop/Project/image` 文件夹，整个移动到后端的 `shopping_cart_afterEnd/public/images` 目录下。
- 修改 NestJS 后端入口 `main.ts`，开启静态文件托管能力（`useStaticAssets`），让所有的图片都能通过网址被前端直接访问到（例如：`http://localhost:3000/images/psc_1.jpeg`）。

### 步骤 2：在智能体中封装新的 Tool (工具)

- 在现有后端的 `tools.definition.ts` 里，新增一个供 Gemini 调用的定义，比如：`generate_anime_image`，参数可以包含用户想要的 `prompt`。
- 在 `AgentService` 中的 `executeTool()` 分支判断中添加这个路由。

### 步骤 3：编写本地 Mock 的“出图Service”

- 新增 `AnimeService`，它的功能是：当接收到大模型的生图请求时，从 `public/images/` 中**随机**（为了生动可以稍微根据 hash 或词条去取不同的图）选出一张图片的绝对 URL 返还给 Gemini。
- Gemini 拿到 URL 后就可以直接发给用户。

### 步骤 4：前端支持图片与扩展渲染

- 我们之前的 `ChatBot.vue` 主要是普通文本结构，幸亏我们使用了 `v-html` 支持了 Markdown 的展示。为了让出图更炫酷，我们需要在这个 Vue 组件中增加类似“图片加载动画”和点击放大的体验交互优化。

### ✅ 后续长远打算（高阶版真 AI 生成）

如果您有第三方的文生图 API（比如通义千问绘画、智谱清言的生图服务等），直接把步骤 3 替换成发起 Axios 网络请求调用这些接口，等待它们吐出图片网址就行了！

---

此改造能够让您在面试环节充分向面试官展示：您不但能够做文字与业务流程的 AI function calling，还**具备将传统图片或文件存储转换抽象为 Agent 工具的能力（Agent as a Service）**。
