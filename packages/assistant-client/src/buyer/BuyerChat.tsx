import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ItemCard, PageShell, type ItemCardLabels } from '@monabid/ui';
import { useTranslation } from 'react-i18next';
import { getConversation } from '../app/api';
import type { BuyerMessage } from './messages';

// מחזירה את מחלקות העיצוב לכל הודעה לפי סוג הדובר: בועה שחורה לקונה, טקסט על הרקע לעוזר, בלוק אדום לשגיאה.
function bubbleClass(kind: BuyerMessage['kind']) {
  const base = 'max-w-lg whitespace-pre-wrap text-sm';
  if (kind === 'buyer') {
    return `${base} self-end rounded-2xl bg-neutral-900 px-4 py-2 text-white`;
  }
  if (kind === 'error') {
    return `${base} self-start rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-red-900`;
  }
  return `${base} self-start text-neutral-600`;
}

// Renders a single conversation message in the form that fits its kind.
function ChatMessage({
  message,
  locale,
  cardLabels,
}: {
  message: BuyerMessage;
  locale: string;
  cardLabels: ItemCardLabels;
}) {
  if (message.kind === 'result-group') {
    return (
      <li data-kind={message.kind} className="flex flex-col gap-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{message.title}</p>
        {/* שורת כרטיסים אחת שנגללת אופקית; לכל כרטיס רוחב קבוע (w-72) כדי שלא יימעך. */}
        <ul className="flex gap-4 overflow-x-auto pb-2">
          {message.lots.map((lot) => (
            <li key={lot.id} className="w-72 shrink-0">
              <ItemCard lot={lot} locale={locale} labels={cardLabels} />
            </li>
          ))}
        </ul>
      </li>
    );
  }

  return (
    <li data-kind={message.kind} className={bubbleClass(message.kind)}>
      {message.text}
    </li>
  );
}

// Buyer chat screen — displays the conversation messages in the current language.
export function BuyerChat() {
  const { i18n, t } = useTranslation();
  const language = i18n.language.startsWith('he') ? 'he' : 'en';
  const locale = language === 'he' ? 'he-IL' : 'en-US';
  const dir = language === 'he' ? 'rtl' : 'ltr';
  const cardLabels: ItemCardLabels = {
    estimate: t('card.estimate'),
    realized: t('card.realized'),
    source: t('card.source'),
    sold: t('card.sold'),
    unsold: t('card.unsold'),
    upcoming: t('card.upcoming'),
    withdrawn: t('card.withdrawn'),
    unknown: t('card.unknown'),
  };
  const query = useQuery({
    queryKey: ['buyer-conversation', language],
    queryFn: ({ signal }) => getConversation(language, signal),
  });

  // ההודעות שהקונה שלח מקומית; מתחיל ריק וגדל בכל שליחה.
  const [sentMessages, setSentMessages] = useState<BuyerMessage[]>([]);
  // הטקסט שנמצא כרגע בשדה הכתיבה.
  const [draft, setDraft] = useState('');
  // כל השיחה לציור: מה שנטען מהשרת, ואחריו ההודעות שהקונה שלח.
  const messages = [...(query.data ?? []), ...sentMessages];
  // בזמן שהשיחה עדיין נטענת מהשרת מציגים חיווי טעינה ונועלים את שדה הכתיבה.
  const isLoading = query.isPending;
  // כשבקשת השיחה נכשלה מציגים הודעת שגיאה וכפתור "נסו שוב".
  const isError = query.isError;

  // הפניה לאלמנט בתחתית השיחה, כדי לגלול אליו.
  const bottomRef = useRef<HTMLDivElement>(null);
  // הפניה לשדה ההקלדה, כדי להחזיר אליו מיקוד אחרי שליחה.
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // גולל לתחתית השיחה בכל פעם שנוספת הודעה.
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length]);

  // מוסיף את תוכן השדה לשיחה כהודעת קונה ומנקה את השדה.
  function sendDraft() {
    const text = draft.trim();
    if (!text) return;
    setSentMessages((prev) => [
      ...prev,
      { kind: 'buyer', id: `local-${prev.length + 1}`, at: new Date().toISOString(), text },
    ]);
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
    <div className="min-h-screen bg-[#f7efe2]">
      <PageShell>
        {/*
          Keyboard a11y (W2): the only Tab stops on this screen are the source links in the item cards,
          rendered in DOM order (which equals reading order), so Tab follows the visual order in both LTR and RTL;
          the input box and full keyboard flow come in W3.
        */}
        <ol role="log" dir={dir} className="flex flex-col gap-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} locale={locale} cardLabels={cardLabels} />
          ))}
        </ol>
        {/* חיווי טעינה: מוצג רק כל עוד השיחה הראשונית עדיין בדרך מהשרת. */}
        {isLoading && (
          <p role="status" dir={dir} className="text-sm text-neutral-500">
            {t('chat.loading')}
          </p>
        )}
        {/* מצב שגיאה: הודעה + כפתור שמבקש את השיחה שוב (query.refetch). */}
        {isError && (
          <div role="alert" dir={dir} className="mt-4 flex flex-col items-start gap-2 text-sm text-red-900">
            <p>{t('chat.error')}</p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="rounded-xl border border-red-300 px-4 py-2 font-medium"
            >
              {t('chat.retry')}
            </button>
          </div>
        )}
        {/* יעד הגלילה: תמיד בתחתית השיחה. scroll-mb משאיר מקום פנוי מתחת לשדה הדביק. */}
        <div ref={bottomRef} aria-hidden="true" className="scroll-mb-28" />

        {/* שדה כתיבת הודעה וכפתור שליחה. */}
        <form onSubmit={handleSubmit} dir={dir} className="sticky bottom-0 mt-4 flex gap-2 bg-[#f7efe2] py-3">
          <textarea
            ref={inputRef}
            aria-label={t('chat.inputLabel')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {t('chat.send')}
          </button>
        </form>
      </PageShell>
    </div>
  );
}
