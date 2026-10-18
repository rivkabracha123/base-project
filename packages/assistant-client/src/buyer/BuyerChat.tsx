import { Link, useNavigate } from 'react-router-dom';
import { SellerComparisonResults } from '../seller/SellerComparisonResults';
import { ResultCard } from '../components/ResultCard';
import { HouseJourneyCard, selectableHouses } from '../app/SellerJourneyChrome';
import { useTranslation } from 'react-i18next';
import { getConversation } from '../app/api';
import { ChatScreen } from '../chat/ChatScreen';
import { MessageBubble } from '../chat/MessageBubble';
import { useChatFlow } from '../chat/useChatFlow';
import { getBuyerChatFlowSnapshot, selectBuyerLot, getBuyerHouseCategory } from './buyer-chat-flow';
import { connectLevels } from './connect-levels';
import { buyerMessageSchema, type BuyerMessage } from './messages';

// Buyer chat screen — displays the conversation messages in the current language.
export function BuyerChat() {
  const { i18n, t } = useTranslation();
  const language = i18n.language.startsWith('he') ? 'he' : 'en';
  const dir = language === 'he' ? 'rtl' : 'ltr';
  const navigate = useNavigate();
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
    storageKey: `monabid.chat.buyer.${language}`,
    chatRole: 'buyer',
    chatLanguage: language,
    // מזהה השיחה האמיתי שהשרת של B2 החזיר (null לפני ההודעה הראשונה).
    getSessionId: () => getBuyerChatFlowSnapshot().sessionId,
  });

  // Renders a single conversation message in the form that fits its kind.
  function renderMessage(message: BuyerMessage) {
    if (message.speaker === 'house-ranking') {
      return <li data-speaker={message.speaker} className="w-full min-w-0">
        <h2 className="mb-3 text-lg font-semibold">{language === 'he' ? 'בתי מכירות מתמחים' : 'Specialist auction houses'}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {selectableHouses(message.ranking).filter(row => row.house.categories.includes(message.category)).map(row =>
            <HouseJourneyCard key={row.house.id} row={row} recommended={row.house.id === message.ranking.recommendation?.house.id} />)}
        </div>
      </li>;
    }
    if (message.speaker === 'sale-history') {
      return <li data-speaker={message.speaker} className="w-full min-w-0 rounded-lg border border-stone-300 p-5">
        <h2 className="mb-4 text-lg font-semibold">{message.title}</h2>
        <ol className="space-y-4">
          {message.lots.filter(lot => lot.status === 'sold').slice().sort((a, b) => a.saleDate.localeCompare(b.saleDate)).map(lot =>
            <li key={lot.id} className="flex flex-wrap items-center justify-between gap-3 border-s-2 border-[#a58147] ps-4">
              <span>{lot.auctionHouse.name} · {lot.saleDate}</span>
              {lot.realizedPrice && <span dir="ltr" className="font-semibold text-[#a58147]">{new Intl.NumberFormat(language, { style: 'currency', currency: lot.realizedPrice.currency }).format(lot.realizedPrice.amount)}</span>}
              <Link className="underline" to={`/lots/${encodeURIComponent(lot.id)}`} state={{ returnTo: '/chat/buyer' }}>{language === 'he' ? 'פרטי המכירה' : 'Sale details'}</Link>
            </li>)}
        </ol>
      </li>;
    }
    if (message.speaker === 'price-trend') {
      return <li data-speaker={message.speaker} className="w-full min-w-0">
        <h2 className="mb-3 text-lg font-semibold">{message.title}</h2>
        <SellerComparisonResults language={language} result={{
          mode: 'trend', criteria: { category: message.lots[0]?.category ?? '' }, lots: message.lots,
        }} />
      </li>;
    }

    if (message.speaker === 'result-group') {
      return (
        <li data-speaker={message.speaker} className="flex flex-col gap-4">
          {message.title && <h2 className="text-lg font-semibold text-neutral-900">{message.title}</h2>}
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {message.lots.map((lot) => (
              <li key={lot.id} className="min-w-0">
                <ResultCard lot={lot} lang={language} onSelect={(id) => { selectBuyerLot(lot); navigate(`/lots/${encodeURIComponent(id)}`, { state: { returnTo: '/chat/buyer' } }); }} />
              </li>
            ))}
          </ul>
        </li>
      );
    }

    return (
      <MessageBubble speaker={message.speaker} isOwn={message.speaker === 'buyer'}>
        {message.text}
        {message.speaker === 'system' && /בתי מכירות מתמחים|Specialist auction houses/.test(message.text) && getBuyerHouseCategory() && <Link className="mt-2 block underline" to={`/buyer/houses?category=${encodeURIComponent(getBuyerHouseCategory()!)}`}>{language === 'he' ? 'בתי מכירות' : 'Auction houses'}</Link>}
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
