import { BuyerChatService } from './buyer-chat.service';

// Tests for BuyerChatService — supplies the conversation messages for a language from the demo file.
describe('BuyerChatService', () => {
  // Verifies asking for 'he' returns a non-empty conversation that opens with a buyer message.
  it('returns the Hebrew conversation from the demo file', async () => {
    const service = new BuyerChatService();
    const conversation = await service.findConversation('he');
    expect(conversation.length).toBeGreaterThan(0);
    expect(conversation[0]).toMatchObject({ kind: 'buyer', text: expect.any(String) });
    expect((conversation[0] as { text: string }).text.length).toBeGreaterThan(0);
  });

  // Verifies an unsupported language returns an empty list instead of crashing the service.
  it('returns an empty list for an unsupported language', async () => {
    const service = new BuyerChatService();
    const conversation = await service.findConversation('fr');
    expect(conversation).toEqual([]);
  });

  // Verifies 'en' returns the English conversation — non-empty and different from the Hebrew one.
  it('returns the English conversation when en is requested', async () => {
    const service = new BuyerChatService();
    const hebrew = await service.findConversation('he');
    const english = await service.findConversation('en');
    expect(english.length).toBeGreaterThan(0);
    expect(english).not.toEqual(hebrew);
  });
});
