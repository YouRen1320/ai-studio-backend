import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatRequestDto {
  @ApiProperty({ description: '用户的自然语言输入' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ description: '多轮对话的上下文 ID', required: false })
  @IsString()
  @IsOptional()
  conversationId?: string;
}

export class ChatResponseDto {
  @ApiProperty({ description: 'AI 的回复内容' })
  reply: string;

  @ApiProperty({ description: '当前会话使用的对话 ID (用于下次请求携带)' })
  conversationId: string;
}
