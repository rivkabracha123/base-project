import { Fragment, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PageShell } from '@monabid/ui';

interface ChatScreenProps<T extends { id: string }> {
  messages: T[];
  renderMessage: (message: T) => ReactNode;
  isLoading: boolean;
  isError: boolean;
  // true בזמן שהשיחה עובדת (חושבת או מחפשת): השדה והכפתור נעולים.
  isBusy?: boolean;
  onRetry: () => void;
  onSend: (text: string) => void;
  dir: 'rtl' | 'ltr';
  loadingLabel: string;
  errorLabel: string;
  retryLabel: string;
  inputLabel: string;
  sendLabel: string;
  placeholder?: string;
  busyLabel?: string;
  tone?: 'default' | 'journey';
  // תוכן נוסף בשורת הכתיבה, לפני שדה ההקלדה (למשל לחצן צירוף תמונה). אופציונלי.
  composerExtra?: ReactNode;
  // תוכן מעל שורת הכתיבה (למשל תצוגות מקדימות של תמונות שממתינות לשליחה).
  composerAbove?: ReactNode;
  // מאפשר שליחה בלי טקסט, למשל כשיש קבצים ממתינים בקומפוזר.
  canSendEmpty?: boolean;
}

// Generic chat screen shell shared by every conversation role (buyer, seller, ...): the message
// log, loading/error states, and the composer (textarea + send, Enter/Shift+Enter, scroll, focus).
// It does not know what a message "means" — the caller supplies the data and how to render it.
export function ChatScreen<T extends { id: string }>({
  messages,
  renderMessage,
  isLoading,
  isError,
  isBusy = false,
  onRetry,
  onSend,
  dir,
  loadingLabel,
  errorLabel,
  retryLabel,
  inputLabel,
  sendLabel,
  placeholder,
  busyLabel,
  tone = 'default',
  composerExtra,
  composerAbove,
  canSendEmpty = false,
}: ChatScreenProps<T>) {
  const journey = tone === 'journey';
  // הטקסט שנמצא כרגע בשדה הכתיבה.
  const [draft, setDraft] = useState('');
  // הפניה לאלמנט בתחתית השיחה, כדי לגלול אליו.
  const bottomRef = useRef<HTMLDivElement>(null);
  // הפניה לשדה ההקלדה, כדי להחזיר אליו מיקוד אחרי שליחה.
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // גולל לתחתית השיחה בכל פעם שנוספת הודעה.
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length]);

  // מתאים את גובה שדה ההקלדה לתוכן: מאפס ל-auto כדי שגם יוכל לקטון, ואז קובע לפי scrollHeight.
  // scrollHeight לא כולל את עובי המסגרת, ובלעדיה הגובה קטן ב-2px ומופיעים חצי הגלילה מיד;
  // לכן מוסיפים את המסגרת (offsetHeight - clientHeight). כשהתוכן עובר את max-h-40 הגלילה מופיעה כרגיל.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    const borderHeight = input.offsetHeight - input.clientHeight;
    input.style.height = `${input.scrollHeight + borderHeight}px`;
  }, [draft]);

  // מחזיר מיקוד לשדה ברגע שהוא חוזר להיות פעיל: בזמן עבודה השדה disabled והדפדפן מוריד ממנו את
  // המיקוד, ולכן ה-focus() שאחרי השליחה לא מספיק.
  const isLocked = isLoading || isBusy;
  useEffect(() => {
    if (!isLocked) inputRef.current?.focus();
  }, [isLocked]);

  // שולח את תוכן השדה דרך onSend ומנקה את השדה.
  function sendDraft() {
    const text = draft.trim();
    if (!text && !canSendEmpty) return;
    onSend(text);
    setDraft('');
    inputRef.current?.focus();
  }

  // מפעיל שליחה כשהטופס נשלח (לחיצה על הכפתור).
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    sendDraft();
  }

  // Enter לבד שולח את ההודעה; Shift+Enter משאיר את התנהגות השורה החדשה של השדה.
  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendDraft();
    }
  }

  return (
    // רקע קרם למסך הצ'אט בלבד; #f7efe2 הוא צבע זמני עד שיתקבל טוקן המותג הרשמי של Monabid.
    <div className={`min-h-screen ${journey ? 'bg-[#f6f1e8]' : 'bg-[#f7efe2]'}`}>
      <PageShell>
        {/* flex+min-h-screen+gap-4: כשהשיחה קצרה, mt-auto בטופס דוחף אותו לתחתית המסך בפועל
            (במקום שיישאר תקוע מיד אחרי ההודעה האחרונה), וה-gap-4 שומר רווח קבוע של 1rem בין
            כל האלמנטים גם כששיחה ארוכה ואין מקום פנוי לדחוף אליו. */}
        <div className="flex min-h-screen flex-col gap-4">
        <ol role="log" dir={dir} className="flex flex-col gap-4">
          {messages.map((message) => (
            <Fragment key={message.id}>{renderMessage(message)}</Fragment>
          ))}
        </ol>
        {/* חיווי טעינה: מוצג רק כל עוד השיחה הראשונית עדיין בדרך מהשרת. */}
        {isLoading && (
          <p role="status" dir={dir} className="text-sm text-neutral-500">
            {loadingLabel}
          </p>
        )}
        {isBusy && busyLabel ? (
          <p role="status" dir={dir} className="self-end text-sm text-stone-400">
            {busyLabel}
          </p>
        ) : null}
        {/* מצב שגיאה: הודעה + כפתור שמבקש את השיחה שוב. */}
        {isError && (
          <div role="alert" dir={dir} className="mt-4 flex flex-col items-start gap-2 text-sm text-red-900">
            <p>{errorLabel}</p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-xl border border-red-300 px-4 py-2 font-medium"
            >
              {retryLabel}
            </button>
          </div>
        )}
        {/* יעד הגלילה: תמיד בתחתית השיחה. scroll-mb משאיר מקום פנוי מתחת לשדה הדביק. */}
        <div ref={bottomRef} aria-hidden="true" className="scroll-mb-28" />

        {/* שדה כתיבת הודעה וכפתור שליחה. mt-auto דוחף אותו לתחתית ה-flex גם כששיחה קצרה. */}
        <form onSubmit={handleSubmit} dir={dir} className={`sticky bottom-0 mt-auto flex flex-col gap-2 py-3 ${journey ? 'bg-[#f6f1e8]' : 'bg-[#f7efe2]'}`}>
          {composerAbove}
          <div className={`flex w-full items-end gap-2 ${journey ? 'rounded-full border border-[#e6d9c4] bg-white px-2 py-1.5 shadow-sm' : ''}`}>
          {composerExtra}
          <textarea
            ref={inputRef}
            aria-label={inputLabel}
            placeholder={placeholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || isBusy}
            rows={1}
            className={journey
              ? 'min-h-10 max-h-40 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none disabled:opacity-60'
              : 'min-h-11 max-h-40 min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100'}
          />
          <button
            type="submit"
            disabled={isLoading || isBusy}
            className={journey
              ? 'h-10 shrink-0 rounded-full bg-[#c4a574] px-5 text-sm font-medium text-white hover:bg-[#b08948] disabled:opacity-50'
              : 'h-11 shrink-0 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'}
          >
            {sendLabel}
          </button>
          </div>
        </form>
        </div>
      </PageShell>
    </div>
  );
}
