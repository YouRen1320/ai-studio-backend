/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ description: '商品名称', example: 'iPhone 16' })
  @IsString({ message: '商品名称必须是字符串' })
  @IsNotEmpty({ message: '商品名称不能为空' })
  name: string;

  @ApiProperty({ description: '商品价格', example: 5999, minimum: 0.01 })
  @IsNumber({}, { message: '价格必须为数字' })
  @Min(0.01, { message: '价格不能小于0.01' })
  price: number;
}

// 定义数据类型
// 首先我们要明白，一个商品有哪些属性，
export interface Product {
  id: number;
  title: string; // 商品标题
  price: number; // 价格
  coverUrl?: string; // 封面图链接
  tags?: string[]; // 标签（比如：京东超市、包邮、看相似）
  commentCount?: string; // 评论数（比如：100+条评论）
  shopName?: string; // 店铺名称
}
