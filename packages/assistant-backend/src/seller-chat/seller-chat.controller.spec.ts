import { SellerChatController } from './seller-chat.controller';

// Tests for SellerChatController — mirrors buyer-chat/buyer-chat.controller.spec.ts for the seller module.
describe('SellerChatController', () => {
  // Verifies the controller passes the language to the service and returns the conversation it gets back.
  it('passes the language to the service and returns the conversation', async () => {
    const fakeConversation = [{ speaker: 'seller', id: 'he-1', sessionId: 'session-1', text: 'שלום' }];
    const fakeService = { findConversation: jest.fn().mockResolvedValue(fakeConversation) };
    const controller = new SellerChatController(fakeService as never);

    const result = await controller.conversation('he');

    expect(result).toBe(fakeConversation);
    expect(fakeService.findConversation).toHaveBeenCalledWith('he');
  });
});
