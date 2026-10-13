import { BuyerChatController } from './buyer-chat.controller';

// Tests for BuyerChatController — takes a request, delegates to the service, and returns its result.
describe('BuyerChatController', () => {
  // Verifies the controller passes the language to the service and returns the conversation it gets back.
  it('passes the language to the service and returns the conversation', async () => {
    const fakeConversation = [{ speaker: 'buyer', id: 'he-1', sessionId: 'session-1', skipped: false, text: 'שלום' }];
    const fakeService = { findConversation: jest.fn().mockResolvedValue(fakeConversation) };
    const controller = new BuyerChatController(fakeService as never);

    const result = await controller.conversation('he');

    expect(result).toBe(fakeConversation);
    expect(fakeService.findConversation).toHaveBeenCalledWith('he');
  });
});
