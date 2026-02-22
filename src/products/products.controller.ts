import { Body, Controller, Get, Post } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/ create-product.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('商品') // Swagger 分组标签
@Controller('products') //1.这里定义了路由前缀，访问这个接口的时候，就是/products。告诉 Nest，凡是地址是 /products 的请求都来找我。
export class ProductsController {
  // 2.注入service，这就是nestjs中的依赖注入，你不需要自己构造函数
  // nestjs会自动在控制器中注入业务逻辑
  // 这是 NestJS 的魔法（依赖注入），自动把 Service 给 Controller 用
  constructor(private readonly productsService: ProductsService) {}

  // 发起get请求，获取商品所有数据，一般都使用get请求
  // 表示这是一个 HTTP GET 请求（浏览器直接回车就是 GET）
  @ApiOperation({ summary: '获取所有商品列表' })
  @Get()
  findAll(): any {
    return this.productsService.getAllProducts();
  }

  @ApiOperation({ summary: '上架新商品' })
  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.createProduct(
      createProductDto.name,
      createProductDto.price,
    );
  }
}
