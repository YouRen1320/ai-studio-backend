import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module'; // 刚刚我们使用cli新建的模块，nestjs会自动注册
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './redis.module'; // Redis 缓存模块
import { ScheduleModule } from '@nestjs/schedule'; // 定时任务模块

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(), // 启用定时任务
    RedisModule, // 注册 Redis 缓存（全局可用）
    ProductsModule,
    CartModule,
    OrdersModule,
    PrismaModule,
    UsersModule,
    AuthModule,
  ], // 导入产品模块
  controllers: [AppController], //这个是app.module.ts的控制器
  providers: [AppService], //这个是app.module.ts的服务
})
export class AppModule {}
