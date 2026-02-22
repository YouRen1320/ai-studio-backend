import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  // 注入用户服务(用来找人) 和 JWT服务(用来发卡)
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(username: string, pass: string) {
    // 1. 去数据库里找这个用户
    const user = await this.usersService.findOneByUsername(username);

    // 如果没找到用户，直接赶出去 (抛出 401 未授权异常)
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误！');
    }

    // 2. 【核对密码】：用 bcrypt.compare 比较明文密码和数据库里的火星文密码
    const isPasswordValid = await bcrypt.compare(pass, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误！');
    }

    // 3. 【制作房卡 Payload】：房卡里要写什么信息？
    // 通常不写密码等敏感信息，只写不可变的 ID 和用户名
    const payload = { sub: user.id, username: user.username };

    // 4. 发卡 (生成 Token)
    return {
      message: '登录成功！',
      access_token: await this.jwtService.signAsync(payload), // 签名并生成长字符串
    };
  }
}
