import { ItemCard, type ItemCardLabels } from '@monabid/ui';
import { useTranslation } from 'react-i18next';
import { getConversation } from '../app/api';
import { ChatScreen } from '../chat/ChatScreen';
import { MessageBubble } from '../chat/MessageBubble';
import { useChatFlow } from '../chat/useChatFlow';
import { getBuyerChatFlowSnapshot } from './buyer-chat-flow';
import { BuyerLotCard, type BuyerLotCardLabels } from './BuyerLotCard';
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

  const lotCardLabels: BuyerLotCardLabels = {
    estimate: cardLabels.estimate,
    realized: cardLabels.realized,
    source: cardLabels.source,
    lot: t('buyerCard.lot'),
    matchReasons: t('buyerCard.matchReasons'),
    status: {
      sold: cardLabels.sold,
      unsold: cardLabels.unsold,
      upcoming: cardLabels.upcoming,
      withdrawn: cardLabels.withdrawn,
      unknown: cardLabels.unknown,
    },
  };

  // The lot's category in the buyer's language; a category with no translation is shown as the data names it.
  function categoryLabel(category: string): string {
    return t(`buyerCard.categories.${category}`, { defaultValue: category.replace(/[_-]+/g, ' ') });
  }

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
    // Lots from other categories: a card that shows each lot's category and the reasons the search reported.
    if (message.speaker === 'result-group' && message.variant === 'other-categories') {
      return (
        <li data-speaker={message.speaker} data-variant={message.variant} className="flex flex-col gap-4">
          {message.title && <h2 className="text-lg font-semibold text-neutral-900">{message.title}</h2>}
          {/* Horizontal carousel: one card wide on a phone, up to three side by side when the chat is wide enough. */}
          <ul className="flex snap-x gap-4 overflow-x-auto pb-3">
            {message.lots.map((lot) => (
              <li key={lot.id} className="w-72 shrink-0 snap-start sm:w-80 lg:w-[calc((100%-2rem)/3)] lg:min-w-[17rem]">
                <BuyerLotCard
                  lot={lot}
                  locale={locale}
                  labels={lotCardLabels}
                  categoryLabel={categoryLabel(lot.category)}
                  reasons={(message.matchReasons?.[lot.id] ?? []).map((reason) => ({
                    label: t(`buyerCard.reasons.${reason.field}`, { defaultValue: '' }),
                    detail: reason.detail,
                  }))}
                />
              </li>
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
