import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// 控制器测试只模拟直接依赖，认证上下文由测试显式提供。
describe('AuthController', () => {
  it('传递参数并返回业务结果', async () => {
    const mock = { login: jest.fn().mockResolvedValue({ result: '完成' }) };
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mock }],
    }).compile();
    const controller = module.get(AuthController);
    const query = { username: 'tester', password: 'test-password' };
    await expect(controller.login(query)).resolves.toEqual({ result: '完成' });
    expect(mock.login).toHaveBeenCalledWith(query.username, query.password);
    await module.close();
  });
});
