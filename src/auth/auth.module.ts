import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module'; // 1. 导入用户部
import { JwtModule } from '@nestjs/jwt'; // 2. 导入制卡机

@Module({
  imports: [
    UsersModule,
    // 3. 配置 JWT (这里为了新手方便把秘钥写死了，真实项目中应该写在 .env 文件里！)
    JwtModule.register({
      global: true, // 全局可用
      secret: 'my-super-secret-key-123456', // 签发房卡的防伪印章（秘钥）
      signOptions: { expiresIn: '1h' }, // 房卡有效期 1 小时
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
