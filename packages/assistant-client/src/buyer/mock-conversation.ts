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
    { kind: 'buyer', id: 'he-1', at: '2026-01-01T10:00:00.000Z', text: 'אני מחפשת פריט לדוגמה' },
    { kind: 'assistant', id: 'he-2', at: '2026-01-01T10:00:05.000Z', text: 'מחפש עבורך…' },
    { kind: 'result-group', id: 'he-3', at: '2026-01-01T10:00:10.000Z', title: 'פריטים דומים', lots: [mockLot] },
    { kind: 'error', id: 'he-4', at: '2026-01-01T10:00:15.000Z', code: 'results_failed', text: 'טעינת התוצאות נכשלה. נסו שוב.' },
  ],
  en: [
    { kind: 'buyer', id: 'en-1', at: '2026-01-01T10:00:00.000Z', text: 'I am looking for a mock lot' },
    { kind: 'assistant', id: 'en-2', at: '2026-01-01T10:00:05.000Z', text: 'Searching for you…' },
    { kind: 'result-group', id: 'en-3', at: '2026-01-01T10:00:10.000Z', title: 'Nearby lots', lots: [mockLot] },
    { kind: 'error', id: 'en-4', at: '2026-01-01T10:00:15.000Z', code: 'results_failed', text: 'Loading results failed. Please try again.' },
  ],
};
