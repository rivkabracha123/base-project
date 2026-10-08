import type { SellerMessage } from './messages';

// נתוני מוק לשיחת מוכר עבור הטסטים בלבד: שיחה קצרה בעברית ובאנגלית עם הודעה אחת מכל סוג
// (מוכר, מערכת, שגיאה). מקביל ל-buyer/mock-conversation.ts.
export const mockConversation: { he: SellerMessage[]; en: SellerMessage[] } = {
  he: [
    {
      speaker: 'seller',
      id: 'he-1',
      sessionId: 'mock-session-he',
      text: 'יש לי שעון עתיק שאני רוצה למכור',
    },
    {
      speaker: 'system',
      id: 'he-2',
      sessionId: 'mock-session-he',
      text: 'תוכל/י להעלות תמונה ולתאר את מצבו?',
    },
    {
      speaker: 'error',
      id: 'he-3',
      sessionId: 'mock-session-he',
      code: 'save_failed',
      text: 'שמירת הפרטים נכשלה. נסו שוב.',
    },
  ],
  en: [
    {
      speaker: 'seller',
      id: 'en-1',
      sessionId: 'mock-session-en',
      text: 'I have an antique watch I want to sell',
    },
    {
      speaker: 'system',
      id: 'en-2',
      sessionId: 'mock-session-en',
      text: 'Could you upload a photo and describe its condition?',
    },
    {
      speaker: 'error',
      id: 'en-3',
      sessionId: 'mock-session-en',
      code: 'save_failed',
      text: 'Saving the details failed. Please try again.',
    },
  ],
};
