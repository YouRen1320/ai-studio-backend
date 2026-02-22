import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/ create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@ApiTags('商品') // Swagger 分组标签
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // 获取商品列表（支持分页 + 关键词搜索）
  @ApiOperation({ summary: '获取商品列表（分页 + 搜索）' })
  @Get()
  findAll(@Query() query: QueryProductDto) {
    return this.productsService.getAllProducts(query);
  }

  // 上架新商品
  @ApiOperation({ summary: '上架新商品' })
  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.createProduct(
      createProductDto.name,
      createProductDto.price,
    );
  }

  // 下架商品（软删除）
  @ApiOperation({ summary: '下架商品（软删除）' })
  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.deactivateProduct(id);
  }

  // 上传商品图片
  @ApiOperation({ summary: '上传商品图片' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: '商品图片文件' },
      },
    },
  })
  @Post(':id/upload-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads', // 文件存到项目根目录的 uploads 文件夹
        filename: (req, file, cb) => {
          // 生成唯一文件名：时间戳 + 随机数 + 原始扩展名
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        // 只允许上传图片格式
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(new Error('只允许上传图片文件！'), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 限制最大 5MB
    }),
  )
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // 拼接图片的访问地址
    const imageUrl = `/uploads/${file.filename}`;
    const product = await this.productsService.updateImage(id, imageUrl);
    return {
      message: '图片上传成功！',
      imageUrl: product.imageUrl,
    };
  }
}
