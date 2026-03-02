import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AgentService } from './agent.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';
import { AuthGuard } from '../auth/auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('AI助手 (Agent)')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  @ApiOperation({ summary: '发送自然语言给 AI 导购助手进行交互' })
  @ApiResponse({ status: 201, type: ChatResponseDto })
  async chat(
    @Body() chatRequest: ChatRequestDto,
    @Request() req,
  ): Promise<ChatResponseDto> {
    // req.user 由 AuthGuard 从 JWT 中解析并注入
    const userId = req.user.sub;

    // 把用户的请求分配给大模型引擎去执行核心骨架处理
    const result = await this.agentService.chat(
      chatRequest.message,
      userId,
      chatRequest.conversationId,
    );

    return result;
  }
}
