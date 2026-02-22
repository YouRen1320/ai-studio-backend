import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
// 我们可以复用之前写的 CreateUserDto 来作为登录的数据格式
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('认证') // Swagger 分组标签
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: '用户登录（获取 Token）' })
  @Post('login')
  login(@Body() loginDto: CreateUserDto) {
    return this.authService.login(loginDto.username, loginDto.password);
  }
}
