export const resources = {
  en: {
    translation: {
      appName: 'Monabid Assistant',
      navigation: { sample: 'Sample lot' },
      sample: {
        eyebrow: 'Foundation example',
        title: 'A source-backed auction lot',
        intro: 'This route proves the fixture-to-database-to-API-to-client path.',
        loading: 'Loading the sample lot…',
        error: 'The sample lot could not be loaded.',
        retry: 'Try again',
        empty: 'No sample lot is available.',
      },
      card: {
        estimate: 'Estimate', realized: 'Realized price', source: 'View exact source',
        sold: 'Sold', unsold: 'Unsold', upcoming: 'Upcoming', withdrawn: 'Withdrawn', unknown: 'Status unknown',
      },
      chat: {
        send: 'Send', inputLabel: 'Message', loading: 'Loading conversation…',
        error: "Couldn't load the conversation.", retry: 'Try again',
      },
      language: 'עברית',
    },
  },
  he: {
    translation: {
      appName: 'העוזר של מונביד',
      navigation: { sample: 'פריט לדוגמה' },
      sample: {
        eyebrow: 'דוגמת תשתית',
        title: 'פריט מכירה עם מקור',
        intro: 'עמוד זה מדגים את המסלול מהנתונים למסד הנתונים, ל־API וללקוח.',
        loading: 'הפריט לדוגמה נטען…',
        error: 'לא ניתן לטעון את הפריט לדוגמה.',
        retry: 'נסו שוב',
        empty: 'אין פריט לדוגמה.',
      },
      card: {
        estimate: 'הערכה', realized: 'מחיר מכירה', source: 'הצגת המקור המדויק',
        sold: 'נמכר', unsold: 'לא נמכר', upcoming: 'עתידי', withdrawn: 'הוסר', unknown: 'סטטוס לא ידוע',
      },
      chat: {
        send: 'שליחה', inputLabel: 'הודעה', loading: 'טוען שיחה…',
        error: 'לא הצלחנו לטעון את השיחה.', retry: 'נסו שוב',
      },
      language: 'English',
    },
  },
} as const;
