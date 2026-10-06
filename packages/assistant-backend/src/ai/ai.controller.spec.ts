import { AiController } from './ai.controller';
import { AiHistoryService } from './ai-history.service';
import { AiService } from './ai.service';

//check the content between the controller and the service

//the fixture provider is mock for the test
describe('AiController', () => {
  it('forwards a generation request to the AI service', async () => {
    const service = {
      generate: jest.fn().mockResolvedValue({
        provider: 'fixture',
        mode: 'fixture',
        content: 'fixture answer',
        summary: 'סיכום קבוע',
        recommendation: 'הצג אפשרויות דומות',
        nextAction: 'בקש מידע נוסף',
        confidence: 'medium',
      }),
    } as unknown as AiService;

    const history = {
      validateConversation: jest.fn().mockResolvedValue(undefined),
      resolveUserId: jest.fn().mockResolvedValue('user-1'),
      record: jest.fn().mockResolvedValue({ conversationId: 'conversation-1', id: 'exchange-1' }),
    };
    const controller = new AiController(service, history as unknown as AiHistoryService);

    //make sure that the result equals the expected output

    await expect(
      controller.generate({
        prompt: 'טבעת כחולה משנת 2021',
        role: 'buyer',
        language: 'he',
      }, 'session-1'),
    ).resolves.toEqual({
      conversationId: 'conversation-1', exchangeId: 'exchange-1',
      provider: 'fixture',
      mode: 'fixture',
      content: 'fixture answer',
      summary: 'סיכום קבוע',
      recommendation: 'הצג אפשרויות דומות',
      nextAction: 'בקש מידע נוסף',
      confidence: 'medium',
    });

    expect(service.generate).toHaveBeenCalledWith({
      sessionId: 'session-1',
      prompt: 'טבעת כחולה משנת 2021',
      role: 'buyer',
      language: 'he',
    });
    expect(history.resolveUserId).toHaveBeenCalledWith('session-1');
    expect(history.record).toHaveBeenCalledWith('user-1', expect.objectContaining({ role: 'buyer' }), expect.objectContaining({ content: 'fixture answer' }));
  });

});
