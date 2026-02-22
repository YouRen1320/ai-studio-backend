import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common'; // 引入验证管道
import { TransformInterceptor } from './common/interceptors/transform.interceptor'; // 引入统一返回格式拦截器
import { HttpExceptionFilter } from './common/filters/http-exception.filter'; // 引入统一异常过滤器
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; // 引入 Swagger
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 开启跨域：允许其他端口的前端（如 Vue 的 localhost:5173）访问后端接口
  app.enableCors();

  // 配置静态文件服务：让 /uploads 目录下的文件可以通过 URL 直接访问
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/', // 访问前缀，如 http://localhost:3000/uploads/xxx.jpg
  });

  // 开启全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动剔除用户多传的、我们在DTO中没定义的属性（防止恶意的数据注入）
      transform: true, // 自动将 Query 字符串参数转换为 DTO 中定义的类型（配合 @Type 装饰器）
    }),
  );

  // 注册全局拦截器：所有成功的响应都会被包装成 { code: 200, message: "请求成功", data: ... }
  app.useGlobalInterceptors(new TransformInterceptor());

  // 注册全局异常过滤器：所有错误都会被包装成 { code: 状态码, message: "错误信息", data: null }
  app.useGlobalFilters(new HttpExceptionFilter());

  // ========== Swagger 接口文档配置 ==========
  const config = new DocumentBuilder()
    .setTitle('购物城 API') // 文档标题
    .setDescription('仿京东购物城后端接口文档') // 文档描述
    .setVersion('1.0') // 版本号
    .addBearerAuth() // 添加 Bearer Token 认证（右上角会出现 Authorize 按钮）
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document); // 挂载到 /api-docs 路径

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
