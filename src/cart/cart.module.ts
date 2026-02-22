import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
// import { ProductsModule } from 'src/products/products.module';

@Module({
  // imports: [ProductsModule], //引入商品模块，这样才能在购物车中调用商品的所有功能，引入module模块
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService], // 允许其他模块使用Cart Service
})
export class CartModule {}
