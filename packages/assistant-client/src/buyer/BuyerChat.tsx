import { useQuery } from '@tanstack/react-query';
import { ItemCard, PageShell, type ItemCardLabels } from '@monabid/ui';
import { useTranslation } from 'react-i18next';
import { getConversation } from '../app/api';
import type { BuyerMessage } from './messages';

// מחזירה את מחלקות העיצוב לכל הודעה לפי סוג הדובר: בועה שחורה לקונה, טקסט על הרקע לעוזר, בלוק אדום לשגיאה.
function bubbleClass(kind: BuyerMessage['kind']) {
  const base = 'max-w-lg text-sm';
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
          {(query.data ?? []).map((message) => (
            <ChatMessage key={message.id} message={message} locale={locale} cardLabels={cardLabels} />
          ))}
        </ol>
      </PageShell>
    </div>
  );
}
