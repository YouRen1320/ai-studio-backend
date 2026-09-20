import { Test } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { AuthGuard } from '../auth/auth.guard';

// 控制器测试只模拟直接依赖，认证上下文由测试显式提供。
describe('CartController', () => {
  it('使用认证用户而非请求体中的身份', async () => {
    const mock = { getCart: jest.fn().mockResolvedValue({ result: '完成' }) };
    const module = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: mock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const controller = module.get(CartController);
    const query = { user: { sub: 7 }, body: { userId: 99 } };
    await expect(controller.findAll(query)).resolves.toEqual({
      result: '完成',
    });
    expect(mock.getCart).toHaveBeenCalledWith(7);
    await module.close();
  });
});
