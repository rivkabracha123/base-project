import type { AuctionLot } from '@monabid/shared';
import type { BuyerMessage } from './messages';

// נתוני מוק לשיחת קונה עבור הטסטים בלבד: שיחה קצרה בעברית ובאנגלית עם הודעה אחת מכל סוג
// (קונה, עוזר, קבוצת תוצאות עם פריט אחד תקין, שגיאה). מחליף את הישענות הטסטים על קובץ ה-fixture החיצוני.

// פריט מכירה אחד תקין לפי auctionLotSchema, לשימוש בהודעת result-group.
const mockLot: AuctionLot = {
  id: 'mock-lot-1',
  source: {
    provider: 'mock-provider',
    recordId: 'mock-record-1',
    url: 'https://example.com/lot/1',
    retrievedAt: '2026-01-01T00:00:00.000Z',
  },
  auctionHouse: { id: 'mock-house', name: 'Mock Auction House' },
  auctionTitle: 'Mock Sale',
  lotNumber: '1',
  title: { en: 'A mock lot', he: 'פריט לדוגמה' },
  description: { en: 'A mock lot for tests.', he: 'פריט לדוגמה לטסטים.' },
  category: 'rare_books',
  saleDate: '2026-01-01',
  status: 'sold',
  estimate: {
    low: { amount: 100, currency: 'USD' },
    high: { amount: 200, currency: 'USD' },
  },
  realizedPrice: { amount: 150, currency: 'USD' },
};

// שיחת מוק דו-לשונית: אותו מבנה כמו conversations בקובץ ה-fixture, בגרסה מוקטנת לטסטים.
export const mockConversation: { he: BuyerMessage[]; en: BuyerMessage[] } = {
  he: [
    { speaker: 'buyer', id: 'he-1', sessionId: 'mock-session-he', skipped: false, text: 'אני מחפשת פריט לדוגמה' },
    { speaker: 'system', id: 'he-2', sessionId: 'mock-session-he', text: 'מחפש עבורך…' },
    { speaker: 'result-group', id: 'he-3', sessionId: 'mock-session-he', lots: [mockLot] },
    { speaker: 'error', id: 'he-4', sessionId: 'mock-session-he', code: 'results_failed', text: 'טעינת התוצאות נכשלה. נסו שוב.' },
  ],
  en: [
    { speaker: 'buyer', id: 'en-1', sessionId: 'mock-session-en', skipped: false, text: 'I am looking for a mock lot' },
    { speaker: 'system', id: 'en-2', sessionId: 'mock-session-en', text: 'Searching for you…' },
    { speaker: 'result-group', id: 'en-3', sessionId: 'mock-session-en', lots: [mockLot] },
    { speaker: 'error', id: 'en-4', sessionId: 'mock-session-en', code: 'results_failed', text: 'Loading results failed. Please try again.' },
  ],
};
