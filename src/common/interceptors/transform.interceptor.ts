import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

// 定义统一的返回格式接口
interface ResponseFormat<T> {
  code: number;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ResponseFormat<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseFormat<T>> {
    // next.handle() 会执行真正的 Controller 方法
    // pipe(map(...)) 会在 Controller 返回数据之后，把数据"包装"一层
    return next.handle().pipe(
      map((data) => ({
        code: 200, // 业务状态码：200 代表成功
        message: '请求成功',
        data: data, // Controller 返回的原始数据
      })),
    );
  }
}
