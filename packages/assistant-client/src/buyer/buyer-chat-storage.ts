import { buyerMessageSchema, type BuyerMessage } from './messages';

const storageKey = (language: 'he' | 'en') => `monabid.buyer-chat.${language}`;

export function loadStoredBuyerChatMessages(language: 'he' | 'en'): BuyerMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(language));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const result = buyerMessageSchema.safeParse(entry);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

export function saveStoredBuyerChatMessages(language: 'he' | 'en', messages: BuyerMessage[]): void {
  localStorage.setItem(storageKey(language), JSON.stringify(messages));
}
