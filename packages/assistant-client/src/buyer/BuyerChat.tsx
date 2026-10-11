import { ItemCard, type ItemCardLabels } from '@monabid/ui';
import { useTranslation } from 'react-i18next';
import { getConversation } from '../app/api';
import { ChatScreen } from '../chat/ChatScreen';
import { MessageBubble } from '../chat/MessageBubble';
import { useChatFlow } from '../chat/useChatFlow';
import { getBuyerChatFlowSnapshot } from './buyer-chat-flow';
import { connectLevels } from './connect-levels';
import { buyerMessageSchema, type BuyerMessage } from './messages';

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

  // הלוגיקה המשותפת לקונה ולמוכר: טעינת שיחה, callback להצגה, נעילה בזמן עבודה ושגיאות.
  // כאן מוגדר רק מה שייחודי לקונה: הסכמה, צורת הודעת הקונה והחיבור לשכבה שמנהלת את התהליך.
  const { messages, isLoading, isError, refetch, isBusy, handleSend } = useChatFlow<BuyerMessage>({
    schema: buyerMessageSchema,
    conversation: {
      queryKey: ['buyer-conversation', language],
      fetch: (signal) => getConversation(language, signal),
    },
    userMessage: (text) => ({ speaker: 'buyer', skipped: false, text }),
    connect: (text, onUpdate) => connectLevels(text, onUpdate, language),
    errorText: t('chat.sendError'),
    // מזהה השיחה האמיתי שהשרת של B2 החזיר (null לפני ההודעה הראשונה).
    getSessionId: () => getBuyerChatFlowSnapshot().sessionId,
  });

  // Renders a single conversation message in the form that fits its kind.
  function renderMessage(message: BuyerMessage) {
    if (message.speaker === 'price-trend') {
      const points = message.points;
      const prices = points.map((point) => point.price.amount);
      const min = Math.min(...prices, 0);
      const max = Math.max(...prices, 1);
      const scaleY = (amount: number) => 150 - ((amount - min) / Math.max(max - min, 1)) * 120;
      const scaleX = (index: number) => 28 + (index * 304) / Math.max(points.length - 1, 1);
      const polyline = points.map((point, index) => `${scaleX(index)},${scaleY(point.price.amount)}`).join(' ');
      const money = (amount: number, currency: string) => new Intl.NumberFormat(locale, {
        style: 'currency', currency, maximumFractionDigits: 0,
      }).format(amount);

      return (
        <li data-speaker={message.speaker} className="rounded-2xl border border-[#e1d4bd] bg-[#fffaf0] p-5">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">{message.title}</h2>
          {points.length >= 2 ? (
            <svg viewBox="0 0 360 180" className="h-52 w-full" role="img" aria-label={message.title}>
              <line x1="28" y1="150" x2="332" y2="150" stroke="#c9b692" />
              <line x1="28" y1="24" x2="28" y2="150" stroke="#c9b692" />
              <polyline points={polyline} fill="none" stroke="#ad8545" strokeWidth="3" />
              {points.map((point, index) => (
                <g key={point.lotId}>
                  <circle cx={scaleX(index)} cy={scaleY(point.price.amount)} r="5" fill="#fffaf0" stroke="#ad8545" strokeWidth="3" />
                  <text x={scaleX(index)} y="170" textAnchor="middle" className="fill-slate-600 text-[10px]">{point.saleDate.slice(0, 4)}</text>
                  <title>{`${point.title}: ${money(point.price.amount, point.price.currency)}`}</title>
                </g>
              ))}
            </svg>
          ) : (
            <p className="text-sm text-slate-600">{language === 'he' ? 'אין מספיק מכירות מאומתות להצגת מגמה.' : 'There are not enough verified sales to show a trend.'}</p>
          )}
          <ul className="mt-4 flex gap-4 overflow-x-auto pb-2">
            {message.lots.map((lot) => (
              <li key={lot.id} className="w-72 shrink-0"><ItemCard lot={lot} locale={locale} labels={cardLabels} /></li>
            ))}
          </ul>
        </li>
      );
    }

    if (message.speaker === 'result-group') {
      return (
        <li data-speaker={message.speaker} className="flex flex-col gap-4">
          {message.title && <h2 className="text-lg font-semibold text-neutral-900">{message.title}</h2>}
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
      <MessageBubble speaker={message.speaker} isOwn={message.speaker === 'buyer'}>
        {message.text}
      </MessageBubble>
    );
  }

  return (
    <ChatScreen
      messages={messages}
      renderMessage={renderMessage}
      isLoading={isLoading}
      isError={isError}
      isBusy={isBusy}
      onRetry={refetch}
      onSend={handleSend}
      dir={dir}
      loadingLabel={t('chat.loading')}
      errorLabel={t('chat.error')}
      retryLabel={t('chat.retry')}
      inputLabel={t('chat.inputLabel')}
      sendLabel={t('chat.send')}
    />
  );
}
