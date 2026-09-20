import { Test } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AuthGuard } from '../auth/auth.guard';

// 控制器测试只模拟直接依赖，认证上下文由测试显式提供。
describe('OrdersController', () => {
  it('使用认证用户而非请求体中的身份', async () => {
    const mock = {
      createOrder: jest.fn().mockResolvedValue({ result: '完成' }),
    };
    const module = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const controller = module.get(OrdersController);
    const query = { user: { sub: 7 }, body: { userId: 99 } };
    await expect(controller.create(query)).resolves.toEqual({ result: '完成' });
    expect(mock.createOrder).toHaveBeenCalledWith(7);
    await module.close();
  });
});
