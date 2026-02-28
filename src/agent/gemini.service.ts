import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  ChatSession,
} from '@google/generative-ai';
import { agentTools } from './tools.definition';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: GenerativeModel;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('未配置 GEMINI_API_KEY 环境变量！');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);

    // 初始化 Gemini 2.5 模型并附带系统指令和工具定义
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction:
        '你是 AI Studio（人工智能生图工作室）的首席智能绘画 Agent，名字叫 "Vision"。\n' +
        '你的主要职责是直接服务用户，接收用户的创意描述，并利用你拥有的 `generate_anime_image` 工具为其匹配生成精美的图像。\n\n' +
        '**工作规范**：\n' +
        '1. 当用户有生图、画画、找图的意向时，你必须且只通过调用 `generate_anime_image` 工具，从用户的整段话汇总提取 2-4 个能代表图片特征的关键词（keywords参数）来下发指令。\n' +
        '2. 在调用出图工具后，请基于其拿到的图片 URL 直接使用 Markdown 图片语法反馈给用户，不要附加太多的冗长描述。\n' +
        '3. 面对闲聊，展现你作为顶尖二次元画师助理的热情，可以向用户索要生图关键词。\n' +
        '4. 禁止自称“购物助手”或提及购物车、订单、购买等电商相关的词汇。',
      tools: [
        {
          functionDeclarations: agentTools,
        },
      ],
    });
  }

  /**
   * 创建一个新的多轮对话 Session，用来记忆用户的上下文
   * @param history 可选的早期历史数组
   */
  startChat(history: any[] = []): ChatSession {
    return this.model.startChat({ history });
  }
}
