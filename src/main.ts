import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common'; // 引入验证管道
import { TransformInterceptor } from './common/interceptors/transform.interceptor'; // 引入统一返回格式拦截器
import { HttpExceptionFilter } from './common/filters/http-exception.filter'; // 引入统一异常过滤器

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 开启全局验证管道 app.useGlobalPipes(...) 这行的意思是设置全局关卡，项目中的所有接口都会先经过ValidationPipe的检查
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动剔除用户多传的、我们在DTO中没定义的属性（防止恶意的数据注入） 只允许DTO中定义过的属性通过
    }),
  );

  // 注册全局拦截器：所有成功的响应都会被包装成 { code: 200, message: "请求成功", data: ... }
  app.useGlobalInterceptors(new TransformInterceptor());

  // 注册全局异常过滤器：所有错误都会被包装成 { code: 状态码, message: "错误信息", data: null }
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
