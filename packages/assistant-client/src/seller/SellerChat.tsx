import { useTranslation } from 'react-i18next';
import { getSellerConversation } from '../app/api';
import { ChatScreen } from '../chat/ChatScreen';
import { MessageBubble } from '../chat/MessageBubble';
import { useChatFlow } from '../chat/useChatFlow';
import { connectSellerLevels } from './connect-seller-levels';
import { sellerMessageSchema, type SellerMessage } from './messages';

// Seller chat screen — displays the conversation messages in the current language.
// Uses the same ChatScreen shell and the same chat flow as BuyerChat; only the data source and message rendering differ.
export function SellerChat() {
  const { i18n, t } = useTranslation();
  const language = i18n.language.startsWith('he') ? 'he' : 'en';
  const dir = language === 'he' ? 'rtl' : 'ltr';

  // הלוגיקה המשותפת לקונה ולמוכר: טעינת שיחה, callback להצגה, נעילה בזמן עבודה ושגיאות.
  // כאן מוגדר רק מה שייחודי למוכר: הסכמה, צורת הודעת המוכר והחיבור לשכבה שמנהלת את התהליך.
  const { messages, isLoading, isError, refetch, isBusy, handleSend } = useChatFlow<SellerMessage>({
    schema: sellerMessageSchema,
    conversation: {
      queryKey: ['seller-conversation', language],
      fetch: (signal) => getSellerConversation(language, signal),
    },
    userMessage: (text) => ({ speaker: 'seller', text }),
    connect: connectSellerLevels,
    errorText: t('chat.sendError'),
  });

  // Renders a single conversation message as a text bubble; the seller conversation has no
  // non-text message kinds yet (unlike the buyer's result-group cards).
  function renderMessage(message: SellerMessage) {
    return (
      <MessageBubble speaker={message.speaker} isOwn={message.speaker === 'seller'}>
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
