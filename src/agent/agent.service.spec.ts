import { AgentService } from './agent.service';

describe('AgentService 会话隔离', () => {
  const createChat = () => ({
    sendMessage: jest.fn().mockResolvedValue({
      response: {
        functionCalls: () => undefined,
        text: () => '完成',
      },
    }),
  });

  it('同一用户复用会话，不同用户使用独立会话', async () => {
    const chats = [createChat(), createChat()];
    const gemini = { startChat: jest.fn(() => chats.shift()) };
    const service = new AgentService(gemini as never, {} as never);

    await service.chat('第一条', 1, 'shared-id');
    await service.chat('第二条', 1, 'shared-id');
    await service.chat('第三条', 2, 'shared-id');

    expect(gemini.startChat).toHaveBeenCalledTimes(2);
  });
});
