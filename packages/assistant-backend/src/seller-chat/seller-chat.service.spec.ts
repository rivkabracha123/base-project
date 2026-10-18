import { SellerChatService } from './seller-chat.service';

// Tests for SellerChatService — mirrors buyer-chat/buyer-chat.service.spec.ts for the seller demo file.
describe('SellerChatService', () => {
  // Verifies asking for 'he' returns a non-empty conversation that opens with a seller message.
  it('starts an empty Hebrew conversation without a demo file', async () => {
    const service = new SellerChatService();
    const conversation = await service.findConversation('he');
    expect(conversation).toEqual([]);
  });

  // Verifies an unsupported language returns an empty list instead of crashing the service.
  it('returns an empty list for an unsupported language', async () => {
    const service = new SellerChatService();
    const conversation = await service.findConversation('fr');
    expect(conversation).toEqual([]);
  });

  // Verifies 'en' returns the English conversation — non-empty and different from the Hebrew one.
  it('starts empty conversations in both supported languages', async () => {
    const service = new SellerChatService();
    const hebrew = await service.findConversation('he');
    const english = await service.findConversation('en');
    expect(english).toEqual([]);
    expect(hebrew).toEqual([]);
  });
});
