import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService], // 导出服务供 Agent 等模块使用
})
export class OrdersModule {}
