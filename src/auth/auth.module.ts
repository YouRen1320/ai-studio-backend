import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module'; // 1. 导入用户部
import { JwtModule } from '@nestjs/jwt'; // 2. 导入制卡机
import { ConfigService } from '@nestjs/config'; // 3. 导入配置服务

@Module({
  imports: [
    UsersModule,
    // 改为异步注册：等 ConfigService 读取完 .env 后，再配置 JWT
    JwtModule.registerAsync({
      global: true, // 全局可用
      inject: [ConfigService], // 注入 ConfigService
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'), // 从 .env 读取秘钥
        signOptions: { expiresIn: '1h' }, // 房卡有效期 1 小时
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
