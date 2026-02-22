import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException) // 告诉 NestJS：只要有 HttpException 被抛出，都交给我处理
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus(); // 获取 HTTP 状态码（如 400, 401, 404）

    // 获取 NestJS 原始的错误信息
    const exceptionResponse = exception.getResponse();

    // 错误信息可能是字符串，也可能是对象（比如 ValidationPipe 返回的数组）
    let message: string;
    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const res = exceptionResponse as Record<string, unknown>;
      // ValidationPipe 的错误信息通常在 message 字段里，可能是数组
      message = Array.isArray(res.message)
        ? res.message.join('; ') // 多条验证错误用分号拼接
        : (res.message as string) || '请求失败';
    } else {
      message = '请求失败';
    }

    // 统一返回格式，和成功时的结构完全一致
    response.status(status).json({
      code: status, // 错误时 code 就是 HTTP 状态码（400, 401, 404 等）
      message: message,
      data: null, // 报错时没有数据，统一返回 null
    });
  }
}
