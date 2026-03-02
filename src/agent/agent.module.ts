import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { GeminiService } from './gemini.service';
import { ProductsModule } from '../products/products.module';
import { CartModule } from '../cart/cart.module';
import { OrdersModule } from '../orders/orders.module';

import { AnimeService } from './anime.service';

@Module({
  imports: [ProductsModule, CartModule, OrdersModule],
  controllers: [AgentController],
  providers: [AgentService, GeminiService, AnimeService],
})
export class AgentModule {}
