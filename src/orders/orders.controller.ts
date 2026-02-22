import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from 'src/auth/auth.guard'; // 导入我们的"保安"

@UseGuards(AuthGuard) // 给整个订单控制器上锁！
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // 提交订单（userId 从 Token 中自动获取，不再从 body 传入）
  @Post()
  create(@Request() req) {
    return this.ordersService.createOrder(req.user.sub);
  }

  // 查看历史订单（只返回当前登录用户的订单）
  @Get()
  findAll(@Request() req) {
    return this.ordersService.findAll(req.user.sub);
  }
}
