import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { evidenceUrl, getCurrentProfile, getSellerConversation, uploadItemEvidence } from '../app/api';
import { ChatScreen } from '../chat/ChatScreen';
import { MessageBubble } from '../chat/MessageBubble';
import { useChatFlow } from '../chat/useChatFlow';
import { clearPendingSellerEvidenceItemId, connectSellerLevels, getPendingSellerEvidenceItemId } from './connect-seller-levels';
import { sellerMessageSchema, type SellerMessage } from './messages';

// Photo limits checked in the browser before uploading (the server enforces them again).
const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxPhotoSize = 10 * 1024 * 1024;

// Seller chat screen — displays the conversation messages in the current language.
// Uses the same ChatScreen shell and the same chat flow as BuyerChat; only the data source and message rendering differ.
export function SellerChat() {
  const { i18n, t } = useTranslation();
  const language = i18n.language.startsWith('he') ? 'he' : 'en';
  const dir = language === 'he' ? 'rtl' : 'ltr';
  // הודעת ולידציה לקובץ שנבחר ואינו תמונה תקינה; ריקה כשאין בעיה.
  const [photoError, setPhotoError] = useState('');
  // true בזמן שתמונה מועלית; בזמן הזה אי אפשר לבחור תמונה נוספת.
  const [isUploading, setIsUploading] = useState(false);

  // הלוגיקה המשותפת לקונה ולמוכר: טעינת שיחה, callback להצגה, נעילה בזמן עבודה ושגיאות.
  // כאן מוגדר רק מה שייחודי למוכר: הסכמה, צורת הודעת המוכר והחיבור לשכבה שמנהלת את התהליך.
  const { messages, isLoading, isError, refetch, isBusy, handleSend, addMessage, showError } = useChatFlow<SellerMessage>({
    schema: sellerMessageSchema,
    conversation: {
      queryKey: ['seller-conversation', language],
      fetch: (signal) => getSellerConversation(language, signal),
    },
    userMessage: (text) => ({ speaker: 'seller', text }),
    connect: connectSellerLevels,
    errorText: t('chat.sendError'),
  });

  // Handles a photo chosen from the computer: checks it, uploads it for the seller's profile, and shows it in the
  // conversation as a seller message. A failed upload is shown as an error message instead.
  async function handlePhotoChosen(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // מאפס את השדה כדי שאפשר יהיה לבחור שוב את אותו קובץ.
    input.value = '';
    if (!file) return;

    if (!allowedPhotoTypes.includes(file.type) || file.size > maxPhotoSize) {
      setPhotoError(t('chat.invalidPhoto'));
      return;
    }

    setPhotoError('');
    setIsUploading(true);
    try {
      const profile = await getCurrentProfile();
      const pendingItemId = getPendingSellerEvidenceItemId();
      const itemId = pendingItemId ?? `chat-${crypto.randomUUID()}`;
      const [photo] = await uploadItemEvidence(profile.id, itemId, [file]);
      if (!photo) throw new Error('Upload returned no photo');
      if (pendingItemId) clearPendingSellerEvidenceItemId(pendingItemId);
      addMessage({ speaker: 'seller', image: photo });
    } catch {
      showError('photo-upload-failed');
    } finally {
      setIsUploading(false);
    }
  }

  // Renders a single conversation message as a bubble: the photo (if any) above the text (if any).
  function renderMessage(message: SellerMessage) {
    return (
      <MessageBubble speaker={message.speaker} isOwn={message.speaker === 'seller'}>
        {message.speaker === 'seller' && message.image && (
          <img
            src={evidenceUrl(message.image.previewUri)}
            alt={message.image.originalName}
            className="max-h-60 rounded-lg"
          />
        )}
        {message.text}
      </MessageBubble>
    );
  }

  // לחצן צירוף תמונה: תווית שמפעילה שדה קובץ מוסתר, ואזהרה כשהקובץ שנבחר אינו תמונה תקינה.
  const attachPhoto = (
    <div className="flex flex-col justify-center gap-1">
      <label
        title={t('chat.attachPhoto')}
        className="flex cursor-pointer items-center rounded-xl border border-neutral-300 px-3 py-2 text-neutral-700 hover:bg-white/60"
      >
        {/* איור העלאת קובץ: חץ כלפי מעלה מעל מגש. הטקסט נשאר לקוראי מסך בלבד. */}
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 16V4" />
          <path d="M7 9l5-5 5 5" />
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
        <span className="sr-only">{t('chat.attachPhoto')}</span>
        <input
          type="file"
          accept={allowedPhotoTypes.join(',')}
          className="sr-only"
          disabled={isLoading || isBusy || isUploading}
          onChange={(event) => void handlePhotoChosen(event)}
        />
      </label>
      {photoError && (
        <p role="alert" className="text-xs text-red-900">
          {photoError}
        </p>
      )}
    </div>
  );

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
      composerExtra={attachPhoto}
    />
  );
}
