import { IsInt, Min } from 'class-validator';

// 用户往购物车加东西的时候，需要传给我的数据
export class createCartDto {
  @IsInt({ message: '用户id必须是整数' })
  userId: number; //用户id

  @IsInt({ message: '商品id必须是整数' })
  productId: number; //商品id

  @IsInt({ message: '商品数量必须是整数' })
  @Min(1, { message: '商品数量最小为1' })
  quantity: number; //商品数量
}
