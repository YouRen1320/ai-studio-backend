import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { createCartDto } from './dto/create-cart.dto';
import { AuthGuard } from 'src/auth/auth.guard'; // 导入我们的"保安"

@UseGuards(AuthGuard) // 给整个购物车控制器上锁！所有接口都需要登录才能访问
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // post请求，添加商品到购物车中
  // 现在 userId 不再从 body 里传，而是从 Token 中自动获取！
  @Post()
  add(@Body() body: createCartDto, @Request() req) {
    // req.user 是 AuthGuard 验证通过后挂载上去的用户信息
    // req.user.sub 就是用户ID（从 Token 的 payload 中解析出来的）
    return this.cartService.addToCart(body, req.user.sub);
  }

  // get请求，获取购物车数据（只返回当前登录用户的购物车）
  @Get()
  findAll(@Request() req) {
    return this.cartService.getCart(req.user.sub);
  }
}
