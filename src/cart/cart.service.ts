import { BadRequestException, Injectable } from '@nestjs/common';
import { createCartDto } from './dto/create-cart.dto';
// import { ProductsService } from 'src/products/products.service'; //引入商品逻辑函数
// import * as fs from 'fs'; //引入node.js中自带的文件操作模块
// import * as path from 'path';
import { PrismaService } from 'src/prisma.service'; // 引入全局的Prisma

@Injectable()
export class CartService {
  // 注入prismaService不需要再注入 ProductsService 了，因为数据库连通了）
  constructor(private prisma: PrismaService) {}

  // 1.模拟数据库
  // private cart: createCartDto[] = [];
  // 定义存档文件的位置：在项目根目录下创建一个data.json
  // private readonly filePath = path.join(process.cwd(), 'data.json');

  // nestjs最强大地方就在于依赖注入，我们引用了商品模块的函数，所以在购物车模块，我们需要注入进来
  // 注入 ProductsService 这样我们就能在购物车里，使用商品部的能力
  // constructor(private readonly productsService: ProductsService) {
  //   // 服务启动时，尝试读取"存档"
  //   this.loadCart();
  // }

  // 2.添加数据到数据库中,item是用户传输的数据
  async addToCart(item: createCartDto) {
    // 首先检查这个商品是否存在商库中
    const productExists = await this.prisma.product.findUnique({
      where: { id: item.productId },
    });

    if (!productExists) throw new BadRequestException('商品不存在');

    // 去数据库里找，购物车是不是已经有这个商品了
    const existingItem = await this.prisma.cartItem.findFirst({
      where: { productId: item.productId },
    });

    if (existingItem) {
      // 如果购物车已经有这个商品，就更新他的数量
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + item.quantity },
      });
    } else {
      // 如果购物车没有这个商品，就把商品添加进去
      await this.prisma.cartItem.create({
        data: {
          productId: item.productId,
          quantity: item.quantity,
          userId: item.userId,
        },
      });
    }

    // const existingItem = this.cart.find(
    //   (item) => item.productId === item.productId,
    // );
    // // 判断购物车是否有这个商品，如果有数量加1
    // if (existingItem) {
    //   existingItem.quantity += item.quantity;
    // } else {
    //   // 如果没有这个商品，就把商品添加到购物车中
    //   this.cart.push(item);
    // }
    // this.saveCart();
    return { message: '商品已添加到购物车！' };
  }

  // 3.查看购物车
  async getCart() {
    // 去数据库查所有的购物车条目，并且把对应的商品信息带回来
    const cartItems = await this.prisma.cartItem.findMany({
      include: {
        product: true, // 立即查询
      },
    });

    // 格式化数据，计算总价
    const items = cartItems.map((item) => ({
      cartItemId: item.id,
      productName: item.product.name,
      price: Number(item.product.price),
      quantity: item.quantity,
      subtotal: Number(item.product.price) * item.quantity,
    }));

    // 计算总金额
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    return { items, totalPrice: total };

    // 这里的逻辑是：遍历用户购物车里面的每一项，根据用户购物车的id，去商品的数据库里面查找这个商品详情，然后计算总价
    // items是用户购物车所有的商品
    // 因为 findOne 是异步的（要去数据库查），所以 map 回调也要用 async，最后用 Promise.all 等所有查询完成
    // const items = (
    //   await Promise.all(
    //     this.cart.map(async (item) => {
    //       // 查找用户购物车商品（await 等数据库返回结果）
    //       const product = await this.productsService.findOne(item.productId);
    //       // 如果商品不存在，就给个错误提示
    //       if (!product) return null;
    //       const price = Number(product.price); // Decimal 转 number 才能做运算
    //       return {
    //         name: product.name, //商品名称
    //         price: price, //商品价格
    //         quantity: item.quantity, //商品数量
    //         subtotal: price * item.quantity, //某个商品的总计价格（单价*数量）
    //       };
    //     }),
    //   )
    // ).filter((item) => item !== null); //过滤找不到的商品
    // // total 计算购物车的金额
    // const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    // return {
    //   items: items, //某个商品全部信息
    //   totalPrice: total, //购物车总价格
    // };
  }

  // 4.清空购物车
  async clearCart() {
    // this.cart = [];
    // this.saveCart();

    // 一句话清空整张表
    await this.prisma.cartItem.deleteMany();
  }

  // 辅助方法(读写文件)
  // private saveCart() {
  //   // 把内存里的数组，转换为字符串，写进文件
  //   fs.writeFileSync(this.filePath, JSON.stringify(this.cart, null, 2));
  // }

  // private loadCart() {
  //   // 如果文件存在，就读出来
  //   if (fs.existsSync(this.filePath)) {
  //     const date = fs.readFileSync(this.filePath, 'utf-8');
  //     this.cart = JSON.parse(date) as createCartDto[];
  //   }
  // }
}
