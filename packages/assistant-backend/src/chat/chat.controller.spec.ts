import { ChatController } from './chat.controller';

// Tests for ChatController — takes a request, delegates to the service, and returns its result.
describe('ChatController', () => {
  // Verifies the controller passes the language to the service and returns the conversation it gets back.
  it('passes the language to the service and returns the conversation', async () => {
    const fakeConversation = [{ kind: 'buyer', id: 'he-1', at: '2026-01-01T10:00:00.000Z', text: 'שלום' }];
    const fakeService = { findConversation: jest.fn().mockResolvedValue(fakeConversation) };
    const controller = new ChatController(fakeService as never);

    const result = await controller.conversation('he');

    expect(result).toBe(fakeConversation);
    expect(fakeService.findConversation).toHaveBeenCalledWith('he');
  });
});
