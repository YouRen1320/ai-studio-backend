import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

// 抽取所有的工具定义，用于注册给 Gemini模型
export const agentTools: FunctionDeclaration[] = [
  {
    name: 'generate_anime_image',
    description:
      '根据用户的描述 Prompt，生成一张二次元/动漫的高级高清绝美图片。图片结果格式是URL形式，你可以将其使用 ![描述](URL) 的 Markdown 语法直接回复给用户渲染预览。如果用户指令包含画图、生成照片、出图、二次元等字眼，请立刻调用它。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        keywords: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description:
            '从用户的描述中提取出的 2-4 个核心短特征或场景关键词（如：少女, 唯美, 战斗, 风景）',
        },
        prompt: {
          type: SchemaType.STRING,
          description: '用户期待的图片的主题或画面文字细节描述',
        },
      },
      required: ['prompt', 'keywords'],
    },
  },
];
