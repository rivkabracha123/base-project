import { ChatService } from './chat.service';

// Tests for ChatService — supplies the conversation messages for a language from the demo file.
describe('ChatService', () => {
  // Verifies the service returns the Hebrew conversation from the demo file, with a buyer message first.
  it('returns the Hebrew conversation from the demo file', async () => {
    const service = new ChatService();
    const conversation = await service.findConversation('he');
    expect(conversation[0]).toEqual({
      kind: 'buyer',
      id: 'he-1',
      at: '2026-01-01T10:00:00.000Z',
      text: 'אני מחפשת כתבי יד עבריים נדירים, עד 15,000 דולר',
    });
  });

  // Verifies an unsupported language returns an empty list instead of crashing the service.
  it('returns an empty list for an unsupported language', async () => {
    const service = new ChatService();
    const conversation = await service.findConversation('fr');
    expect(conversation).toEqual([]);
  });

  // Verifies 'en' returns the English conversation — non-empty and different from the Hebrew one.
  it('returns the English conversation when en is requested', async () => {
    const service = new ChatService();
    const hebrew = await service.findConversation('he');
    const english = await service.findConversation('en');
    expect(english.length).toBeGreaterThan(0);
    expect(english).not.toEqual(hebrew);
  });
});
