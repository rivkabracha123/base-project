import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { baseMessageFields, errorMessageSchema, systemMessageSchema } from '@monabid/shared';
import { createQueryClient } from '../app/query-client';
import type { OnChatUpdate } from './chat-types';
import { useChatFlow } from './useChatFlow';

// סכמת בדיקה קטנה: משתמש, מערכת ושגיאה — כמו הצורה המשותפת לקונה ולמוכר.
const testMessageSchema = z.discriminatedUnion('speaker', [
  z.object({ speaker: z.literal('user'), ...baseMessageFields, text: z.string().min(1) }),
  systemMessageSchema,
  errorMessageSchema,
]);
type TestMessage = z.infer<typeof testMessageSchema>;

const ERROR_TEXT = 'Something went wrong. Please try again.';

afterEach(() => {
  vi.restoreAllMocks();
});

// Helper: מרנדר את ה-hook עם שיחה קיימת אחת מהשרת, והחיבור שהבדיקה מספקת.
// getSessionId (אופציונלי): מחזיר את מזהה השיחה האמיתי כשהוא כבר ידוע.
function setup(
  connect: (message: string, onUpdate: OnChatUpdate<TestMessage>) => Promise<void>,
  getSessionId?: () => string | null,
) {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const loaded: TestMessage = { speaker: 'system', id: 'srv-1', sessionId: 's', text: 'Loaded from server' };
  return renderHook(
    () =>
      useChatFlow<TestMessage>({
        schema: testMessageSchema,
        conversation: { queryKey: ['test-conversation'], fetch: async () => [loaded] },
        userMessage: (text) => ({ speaker: 'user', text }),
        connect,
        errorText: ERROR_TEXT,
        getSessionId,
      }),
    { wrapper },
  );
}

// Helper: הטקסטים של כל ההודעות לפי הסדר.
function texts(messages: TestMessage[]) {
  return messages.map((message) => message.text);
}

// Tests for the shared chat flow used by both the buyer and the seller screens.
describe('useChatFlow', () => {
  // בודק שהשיחה שנטענה מהשרת מופיעה, ואחריה ההודעות שנוספו מקומית.
  it('shows the loaded conversation first and the local messages after it', async () => {
    const { result } = setup(async (_message, onUpdate) => {
      onUpdate({ speaker: 'system', text: 'Checking results...' });
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.handleSend('Looking for a watch'));

    expect(texts(result.current.messages)).toEqual(['Loaded from server', 'Looking for a watch', 'Checking results...']);
  });

  // בודק שכל עוד החיבור עובד אי אפשר לשלוח (isBusy), ושזה מסתיים כשהוא מסיים.
  it('is busy while the connection works and free when it finishes', async () => {
    let finish!: () => void;
    const { result } = setup(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isBusy).toBe(false);

    act(() => {
      void result.current.handleSend('Looking for a watch');
    });
    expect(result.current.isBusy).toBe(true);

    await act(async () => finish());
    expect(result.current.isBusy).toBe(false);
  });

  // בודק שכשהחיבור נכשל מוצגת הודעת שגיאה ידידותית (ולא הטקסט הטכני), והעבודה מסתיימת.
  it('shows an error and becomes free when the connection fails', async () => {
    const { result } = setup(async () => {
      throw new Error('search failed');
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.handleSend('Looking for a watch'));

    expect(texts(result.current.messages)).toEqual(['Loaded from server', 'Looking for a watch', ERROR_TEXT]);
    expect(result.current.messages.at(-1)?.speaker).toBe('error');
    expect(result.current.isBusy).toBe(false);
  });

  // בודק שיחה של כמה פניות: אחרי שאלה אפשר לענות ולקבל שאלה נוספת, והכול לפי הסדר.
  it('supports several turns in a row, in order', async () => {
    const questions = ['What is your budget?', 'Which period?'];
    const { result } = setup(async (_message, onUpdate) => {
      onUpdate({ speaker: 'system', text: questions.shift() ?? 'Done' });
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.handleSend('Looking for a watch'));
    await act(async () => result.current.handleSend('Up to 500'));

    expect(texts(result.current.messages)).toEqual([
      'Loaded from server',
      'Looking for a watch',
      'What is your budget?',
      'Up to 500',
      'Which period?',
    ]);
  });

  // בודק שכל עדכון פגום (סוג לא מוכר או טקסט ריק) מוחלף בהודעת שגיאה אחת, ועדכון תקין שאחריו מוצג.
  it('shows an error instead of each invalid update and keeps the valid ones', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = setup(async (_message, onUpdate) => {
      onUpdate({
        speaker: 'unknown',
        text: 'verification-code-9382 email seller@example.test signed-url-secret',
      } as never);
      onUpdate({ speaker: 'system', text: '' });
      onUpdate({ speaker: 'system', text: 'Valid after invalid' });
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.handleSend('Looking for a watch'));

    expect(texts(result.current.messages)).toEqual([
      'Loaded from server',
      'Looking for a watch',
      ERROR_TEXT,
      ERROR_TEXT,
      'Valid after invalid',
    ]);
    expect(warn).toHaveBeenCalledWith('Invalid chat update ignored');
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/verification-code|seller@example\.test|signed-url-secret/);
  });

  // בודק שהודעה שמגיעה מהחיבור נושאת את מזהה השיחה האמיתי ברגע שהוא ידוע, ולא מזהה מקומי קבוע.
  it('stamps messages from the connection with the real chat id once it is known', async () => {
    let chatId: string | null = null;
    const { result } = setup(
      async (_message, onUpdate) => {
        // השרת החזיר מזהה שיחה, ורק אחר כך מגיעים העדכונים.
        chatId = 'chat-123';
        onUpdate({ speaker: 'system', text: 'Which period?' });
      },
      () => chatId,
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.handleSend('Looking for a watch'));

    const reply = result.current.messages.find((message) => message.text === 'Which period?');
    expect(reply?.sessionId).toBe('chat-123');
  });

  // בודק שגם הודעת שגיאה נושאת את מזהה השיחה האמיתי כשהוא ידוע.
  it('stamps an error message with the real chat id once it is known', async () => {
    let chatId: string | null = null;
    const { result } = setup(
      async () => {
        chatId = 'chat-123';
        throw new Error('search failed');
      },
      () => chatId,
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.handleSend('Looking for a watch'));

    expect(result.current.messages.at(-1)?.sessionId).toBe('chat-123');
  });

  // בודק שכשעדיין אין מזהה שיחה (לפני התשובה הראשונה של השרת) ההודעה עדיין מוצגת, עם מזהה מקומי.
  it('still shows messages with a local id while no chat id is known yet', async () => {
    const { result } = setup(
      async (_message, onUpdate) => {
        onUpdate({ speaker: 'system', text: 'Checking results...' });
      },
      () => null,
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.handleSend('Looking for a watch'));

    const reply = result.current.messages.find((message) => message.text === 'Checking results...');
    expect(reply?.sessionId).toBe('local-session');
  });

  // בודק שניסיון שליחה בזמן שהעבודה רצה לא מוסיף הודעה ולא מפעיל את החיבור שוב.
  it('ignores a send while the connection is still working', async () => {
    let finish!: () => void;
    const { result } = setup(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      void result.current.handleSend('First message');
    });
    await act(async () => result.current.handleSend('Second message'));
    expect(texts(result.current.messages)).not.toContain('Second message');

    await act(async () => finish());
    act(() => {
      void result.current.handleSend('Third message');
    });
    expect(texts(result.current.messages)).toContain('Third message');
  });
});
