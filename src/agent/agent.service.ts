import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { ChatSession } from '@google/generative-ai';
import { AnimeService } from './anime.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  // 用内存管理用户的 ChatSession 上下文，生产环境推荐改存 Redis 配合 history 队列。
  private sessions = new Map<string, ChatSession>();

  constructor(
    private readonly gemini: GeminiService,
    private readonly animeSvc: AnimeService,
  ) {}

  /**
   * 核心聊天逻辑
   * @param message 用户新发过来的消息
   * @param userId 当前对话人身份
   * @param overrideSessionId 若携带此 id 则恢复历史对话，否则开新局
   */
  async chat(message: string, userId: number, overrideSessionId?: string) {
    const sessionId = overrideSessionId || randomUUID();
    let chatSession = this.sessions.get(sessionId);

    // 如果还没有建立会话，或者过期的 ID，重新创建一个 ChatSession
    if (!chatSession) {
      chatSession = this.gemini.startChat();
      this.sessions.set(sessionId, chatSession);
    }

    this.logger.log(
      `\n=== 🧑‍💻 [用户 ID:${userId}] 发起请求 ===\n💬 消息：${message}`,
    );

    try {
      // 1. 发送用户的消息，获取大模型的第一轮响应
      let responseResult = await chatSession.sendMessage(message);

      let fCalls = responseResult.response.functionCalls
        ? responseResult.response.functionCalls()
        : undefined;
      // 2. ReAct 循环：如果模型解析意图后发现需要请求我们给定的工具，则处理它们
      while (fCalls && fCalls.length > 0) {
        const functionCalls = fCalls || [];
        // 支持模型在一个回答周期里调用多个 Tools
        const toolResponses: any[] = [];

        for (const call of functionCalls) {
          const fnName = call.name;
          const fnArgs = call.args || {};

          this.logger.debug(
            `🤖 模型决定调用工具: [${fnName}] 参数: ${JSON.stringify(fnArgs)}`,
          );

          // 核心执行：映射调起后端原本就有的业务函数
          const apiResult = await this.executeTool(fnName, fnArgs, userId);

          this.logger.debug(
            `🔙 业务函数返回值返回给大模型: ${JSON.stringify(apiResult).substring(0, 100)}...`,
          );

          // 打包模型想要的工具响应结果
          toolResponses.push({
            functionResponse: {
              name: fnName,
              response: apiResult,
            },
          });
        }

        // 3. 带着执行出来的具体数据结果，回复给模型，让它继续判断是否能结束这一轮回复
        responseResult = await chatSession.sendMessage(toolResponses);
        fCalls = responseResult.response.functionCalls
          ? responseResult.response.functionCalls()
          : undefined;
      }

      // 跳出循环，意味着当前所有的操作都已经成功完成，这时候必定有大模型的 Text 文字汇总建议
      const reply = responseResult.response.text();
      this.logger.log(`\n=== 🤖 AI 最终回复 ===\n${reply}\n`);

      return {
        reply,
        conversationId: sessionId,
      };
    } catch (e) {
      this.logger.error('Gemini 处理通信发生异常:', e);
      throw e;
    }
  }

  /**
   * 工具路由，利用传入的名字找到我们的 Service 执行。
   */
  private async executeTool(
    name: string,
    args: Record<string, any>,
    userId: number,
  ): Promise<any> {
    try {
      switch (name) {
        case 'generate_anime_image':
          return await this.animeSvc.generateAnimeImage(
            args.prompt || '默认风格',
            args.keywords || [],
          );

        default:
          this.logger.warn(`未知功能的 Tool 调用请求: ${name}`);
          return { error: '抱歉，对应的操作不存在或暂时不可用' };
      }
    } catch (error: any) {
      this.logger.error(`工具 [${name}] 执行异常: ${error?.message}`);
      return { error: `操作遭遇失败：${error?.message}` };
    }
  }
}
