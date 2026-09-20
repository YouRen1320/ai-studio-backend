import { Test } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// 控制器测试只模拟直接依赖，认证上下文由测试显式提供。
describe('UsersController', () => {
  it('传递参数并返回业务结果', async () => {
    const mock = { register: jest.fn().mockResolvedValue({ result: '完成' }) };
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mock }],
    }).compile();
    const controller = module.get(UsersController);
    const query = { username: 'tester', password: 'test-password' };
    await expect(controller.register(query)).resolves.toEqual({
      result: '完成',
    });
    expect(mock.register).toHaveBeenCalledWith(query);
    await module.close();
  });
});
