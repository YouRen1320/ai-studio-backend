import { IsOptional, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QueryProductDto {
  @ApiProperty({ description: '页码', example: 1, required: false })
  @IsOptional()
  @Type(() => Number) // Query 参数默认是字符串，要转成数字
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码最小为1' })
  page?: number = 1;

  @ApiProperty({ description: '每页数量', example: 10, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量最小为1' })
  limit?: number = 10;

  @ApiProperty({
    description: '搜索关键词（按商品名模糊搜索）',
    example: 'iPhone',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '关键词必须是字符串' })
  keyword?: string;
}
