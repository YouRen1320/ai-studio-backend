import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
// 1. 引入 bcrypt
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // --- 注册功能 ---
  async register(createUserDto: CreateUserDto) {
    const { username, password } = createUserDto;

    // 1. 检查用户名是否已经被注册了
    const existingUser = await this.prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      throw new BadRequestException('该用户名已被注册！');
    }

    // 2. 【核心安全步骤】对密码进行加盐哈希加密
    const saltRounds = 10; // 加密强度
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. 把用户存入数据库（存的是加密后的密码）
    const newUser = await this.prisma.user.create({
      data: {
        username,
        password: hashedPassword, // 注意这里！千万别存原密码
      },
    });

    // 4. 返回成功信息，但为了安全，绝对不能把密码返回给前端！
    return {
      message: '注册成功！',
      user: {
        id: newUser.id,
        username: newUser.username,
      },
    };
  }
}
