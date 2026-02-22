import { IsInt, Min } from 'class-validator';
import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';

// 用户往购物车加东西的时候，需要传给我的数据
export class createCartDto {
  @ApiHideProperty() // userId 从 Token 自动获取，Swagger 中不需要展示
  @IsInt({ message: '用户id必须是整数' })
  userId: number; //用户id

  @ApiProperty({ description: '商品ID', example: 1 })
  @IsInt({ message: '商品id必须是整数' })
  productId: number; //商品id

  @ApiProperty({ description: '购买数量', example: 2, minimum: 1 })
  @IsInt({ message: '商品数量必须是整数' })
  @Min(1, { message: '商品数量最小为1' })
  quantity: number; //商品数量
}
