import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// 简易的本地 RAG（检索增强）元数据数据库
// 这用来替代真实的生图模型。您可以根据桌面的实际图片内容，修改这些标签
interface ImageMetadata {
  filename: string;
  tags: string[];
}

@Injectable()
export class AnimeService {
  private readonly logger = new Logger(AnimeService.name);
  private cachedImages: string[] = [];

  // 我们建立一个人为的“特征词库”来充当向量数据库的功能
  private readonly db: ImageMetadata[] = [
    {
      filename: 'psc_1.jpeg',
      tags: ['少女', '战斗', '长发', '帅气', '二次元'],
    },
    { filename: 'psc_2.jpeg', tags: ['风景', '星空', '唯美', '治愈'] },
    { filename: 'psc_3.jpeg', tags: ['日常', '阳光', '微笑', '校服'] },
    { filename: 'psc_4.jpeg', tags: ['魔法', '萝莉', '可爱', '法杖'] },
    { filename: 'psc_5.jpeg', tags: ['赛博朋克', '未来', '科幻', '霓虹'] },
    { filename: 'psc_6.jpeg', tags: ['和服', '樱花', '古风', '唯美'] },
    { filename: 'psc_7.jpeg', tags: ['海边', '夏天', '沙滩', '清凉'] },
    { filename: 'psc_8.jpeg', tags: ['宠物', '猫咪', '温馨', '宅家'] },
    { filename: 'psc_9.jpeg', tags: ['机甲', '机械', '巨型', '硬核'] },
    { filename: 'image.jpeg', tags: ['风景', '天空', '自然', '壁纸'] },
    {
      filename: '微信图片_20260312153648_204_3.png',
      tags: ['横版', '壁纸', '绝美', '电脑'],
    },
  ];

  constructor() {
    this.loadImages();
  }

  // 加载本地 public/images 目录下的所有图片文件名
  private loadImages() {
    const imagesDir = path.join(process.cwd(), 'public', 'images');
    try {
      if (fs.existsSync(imagesDir)) {
        const files = fs.readdirSync(imagesDir);
        this.cachedImages = files.filter(
          (file) =>
            file.endsWith('.jpg') ||
            file.endsWith('.jpeg') ||
            file.endsWith('.png') ||
            file.endsWith('.webp'),
        );
        this.logger.log(
          `成功加载了 ${this.cachedImages.length} 张动漫图片，特征向量库已就绪。`,
        );
      } else {
        this.logger.warn(`未找到动漫图片资源目录：${imagesDir}`);
      }
    } catch (error) {
      this.logger.error(`加载动漫图片资源失败`, error);
    }
  }

  /**
   * 模拟调用大模型文生图接口：使用 RAG 检索评分机制
   * 根据 Gemini 提炼的 keywords 进行标签碰撞计分，得分最高者胜出
   * @param prompt 用户的原话
   * @param keywords 提取的核心关键词数组
   */
  generateAnimeImage(
    prompt: string,
    keywords: string[] = [],
  ): Promise<{ url: string; message: string }> {
    if (this.cachedImages.length === 0) {
      return Promise.resolve({
        url: '',
        message: '抱歉，本地图库未初始化成功。',
      });
    }

    let bestMatchFilename = '';
    let maxScore = -1;

    // 1. 开始计算相似度得分
    for (const imgMeta of this.db) {
      // 必须确保该图片确实在刚刚本地读取的图库里
      if (!this.cachedImages.includes(imgMeta.filename)) continue;

      let score = 0;
      // 用模型的 keywords 和 用户 prompt 一起去匹配标签
      for (const tag of imgMeta.tags) {
        if (keywords.includes(tag) || prompt.includes(tag)) {
          score += 1;
        }
      }

      if (score > maxScore) {
        maxScore = score;
        bestMatchFilename = imgMeta.filename;
      }
    }

    // 2. 如果没有任何词库匹配上，我们进入 Fallback 回退逻辑：随机抽取目前图库里未在特征库登记的一张图
    if (maxScore <= 0 || !bestMatchFilename) {
      this.logger.debug(`未精准命中词汇 (Prompt: ${prompt})，随机发货。`);
      const randomIndex = Math.floor(Math.random() * this.cachedImages.length);
      bestMatchFilename = this.cachedImages[randomIndex];
    } else {
      this.logger.debug(
        `【命中图库】得分: ${maxScore}, Keywords: ${keywords.join(', ')}, 选图: ${bestMatchFilename}`,
      );
    }

    // 3. 拼接结果
    // 注意：部署到真实服务器时应使用配置文件的 HOST
    const HOST = 'http://localhost:3000';
    const imageUrl = `${HOST}/public/images/${encodeURIComponent(bestMatchFilename)}`;

    return Promise.resolve({
      message: `这是根据您的要求生成的二次元图片：`,
      url: imageUrl,
    });
  }
}
