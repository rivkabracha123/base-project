import { AiController } from './ai.controller';
import { AiHistoryService } from './ai-history.service';
import { AiService } from './ai.service';
import { FixtureProviderService } from './fixture-provider.service';

//check the content between the controller and the service

//the fixture provider is mock for the test
describe('AiController', () => {
  it('retains answered preferences across turns and isolates new conversations', async () => {
    const entries: Array<{ prompt: string; response: unknown }> = [];
    const provider = new FixtureProviderService();
    const service = { generate: jest.fn(input => provider.generate(input)) };
    const history = {
      resolveUserId: jest.fn().mockResolvedValue('user-1'),
      validateConversation: jest.fn().mockResolvedValue(undefined),
      conversation: jest.fn(async () => ({ entries })),
      record: jest.fn(async (_user, request, response) => {
        entries.push({ prompt: request.prompt, response });
        return { conversationId: request.conversationId ?? 'conversation-1', id: String(entries.length) };
      }),
    };
    const controller = new AiController(service as unknown as AiService, history as unknown as AiHistoryService);
    const first = await controller.generate({ prompt: 'I want to buy a painting', role: 'buyer', language: 'en' }, 'session-1');
    const second = await controller.generate({ prompt: 'My budget is 5000 ILS', role: 'buyer', language: 'en', conversationId: first.conversationId }, 'session-1');
    expect(second.isRelevant).toBe(true);
    expect(second.nextAction).not.toContain('What is your budget');
    expect(second.nextAction).toContain('preferred year or period');
    const third = await controller.generate({ prompt: '1980', role: 'buyer', language: 'en', conversationId: first.conversationId }, 'session-1');
    expect(third.structuredAnswer).toEqual(expect.objectContaining({ price: { max: 5000, currency: 'ILS' }, periods: ['1980'] }));
    expect(third.nextAction).toContain('continue searching');
    const fresh = await controller.generate({ prompt: 'I want to buy a painting', role: 'buyer', language: 'en' }, 'session-1');
    expect(fresh.nextAction).toContain('What is your budget');
    expect(history.conversation).toHaveBeenCalledTimes(2);
    expect(history.conversation).toHaveBeenCalledWith('session-1', first.conversationId);
  });
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
