import { AiController } from './ai.controller';
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

    const controller = new AiController(service);

    //make sure that the result equals the expected output

    await expect(
      controller.generate({
        prompt: 'טבעת כחולה משנת 2021',
        language: 'he',
      }),
    ).resolves.toEqual({
      provider: 'fixture',
      mode: 'fixture',
      content: 'fixture answer',
      summary: 'סיכום קבוע',
      recommendation: 'הצג אפשרויות דומות',
      nextAction: 'בקש מידע נוסף',
      confidence: 'medium',
    });

    expect(service.generate).toHaveBeenCalledWith({
      prompt: 'טבעת כחולה משנת 2021',
      language: 'he',
    });
  });

});
