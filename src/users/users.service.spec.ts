import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
// 使用依赖注入替身隔离持久化与外部服务，执行实际业务方法。
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
describe('UsersService 注册密码边界', () => {
  let service: UsersService;
  const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(UsersService);
  });
  it('重复用户名拒绝写入', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 7 });
    await expect(
      service.register({ username: 'tester', password: 'test-password' }),
    ).rejects.toThrow('已被注册');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
  it('保存可验证的密码哈希且响应不泄露密码', async () => {
    prisma.user.create.mockResolvedValue({
      id: 7,
      username: 'tester',
      password: '不得返回',
    });
    await expect(
      service.register({ username: 'tester', password: 'test-password' }),
    ).resolves.toEqual({
      message: '注册成功！',
      user: { id: 7, username: 'tester' },
    });
    const calls = prisma.user.create.mock.calls as [
      { data: { username: string; password: string } },
    ][];
    const saved = calls[0][0];
    expect(saved.data.username).toBe('tester');
    expect(saved.data.password).not.toBe('test-password');
    expect(await bcrypt.compare('test-password', saved.data.password)).toBe(
      true,
    );
  });
});
