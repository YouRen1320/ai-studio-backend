import { Test } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

// 控制器测试只模拟直接依赖，认证上下文由测试显式提供。
describe('ProductsController', () => {
  it('传递参数并返回业务结果', async () => {
    const mock = {
      getAllProducts: jest.fn().mockResolvedValue({ result: '完成' }),
    };
    const module = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mock }],
    }).compile();
    const controller = module.get(ProductsController);
    const query = { page: 2, limit: 5, keyword: '测试' };
    await expect(controller.findAll(query)).resolves.toEqual({
      result: '完成',
    });
    expect(mock.getAllProducts).toHaveBeenCalledWith(query);
    await module.close();
  });
});
