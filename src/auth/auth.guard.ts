import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  // 注入 JWT 服务（因为在 AuthModule 中设置了 global: true，所以这里可以直接注入）
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. 从请求头中提取 Token
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    // 如果请求头里没有 Token，直接赶走
    if (!token) {
      throw new UnauthorizedException('你还没有登录，请先登录获取 Token！');
    }

    // 2. 验证 Token 是否合法
    try {
      // verifyAsync 会验证签名和过期时间，验证通过后返回 payload
      const payload = await this.jwtService.verifyAsync(token, {
        secret: 'my-super-secret-key-123456', // 必须和签发时的秘钥一致！
      });

      // 3. 验证通过！把用户信息挂载到 request 对象上
      // 这样后面的 Controller 就能通过 request.user 获取到当前用户信息了
      // payload 里有 sub (用户ID)、username (用户名)
      request['user'] = payload;
    } catch {
      // Token 过期、被篡改、格式不对等等，都会被抓到这里
      throw new UnauthorizedException('Token 无效或已过期，请重新登录！');
    }

    // 4. 放行！返回 true 表示"身份验证通过，可以进入"
    return true;
  }

  // 辅助方法：从请求头中提取 Token
  // 标准格式是 "Authorization: Bearer eyJhbGciOiJI..."
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
