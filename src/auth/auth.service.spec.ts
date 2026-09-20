import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
// 使用依赖注入替身隔离持久化与外部服务，执行实际业务方法。
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
describe('AuthService 登录边界', () => {
  let service: AuthService;
  const users = { findOneByUsername: jest.fn() };
  const jwt = { signAsync: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = module.get(AuthService);
  });
  it('未知用户不签发令牌', async () => {
    users.findOneByUsername.mockResolvedValue(null);
    await expect(service.login('tester', 'wrong')).rejects.toThrow(
      '用户名或密码错误',
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
  it('错误密码不签发令牌', async () => {
    users.findOneByUsername.mockResolvedValue({
      id: 7,
      username: 'tester',
      password: await bcrypt.hash('test-password', 4),
    });
    await expect(service.login('tester', 'wrong')).rejects.toThrow(
      '用户名或密码错误',
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
  it('正确密码只签发用户身份，不携带密码', async () => {
    users.findOneByUsername.mockResolvedValue({
      id: 7,
      username: 'tester',
      password: await bcrypt.hash('test-password', 4),
    });
    jwt.signAsync.mockResolvedValue('test-token');
    await expect(service.login('tester', 'test-password')).resolves.toEqual({
      message: '登录成功！',
      access_token: 'test-token',
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 7, username: 'tester' });
  });
});
