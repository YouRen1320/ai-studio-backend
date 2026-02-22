import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
// 我们可以复用之前写的 CreateUserDto 来作为登录的数据格式
import { CreateUserDto } from 'src/users/dto/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: CreateUserDto) {
    return this.authService.login(loginDto.username, loginDto.password);
  }
}
