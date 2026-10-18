import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSellerConversation } from '../app/api';
import { EvidenceImage } from '../app/EvidenceImage';
import { ChatScreen } from '../chat/ChatScreen';
import { MessageBubble } from '../chat/MessageBubble';
import { useChatFlow } from '../chat/useChatFlow';
import { connectSellerLevels, isSellerDraftReady } from './connect-seller-levels';
import { connectSellerPhotos } from './connect-seller-photos';
import type { SellerItemDraft } from '@monabid/shared';
import { getCurrentSellerDraft } from './connect-seller-correction';
import { SellerItemDetailsCard } from './SellerItemDetailsCard';
import { sellerMessageSchema, type SellerMessage } from './messages';
import { SellerComparisonResults } from './SellerComparisonResults';
import { SellerHouseCards } from './SellerHouseCards';
import { SellerActionCard } from './SellerActionCard';

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
  const [draftLoadError, setDraftLoadError] = useState('');
  const draftShown = useRef(false);

  useEffect(() => {
    if (!isSellerDraftReady()) return;
    let isCurrent = true;
    void getCurrentSellerDraft().then((draft) => {
      if (isCurrent && draft) showItemDraft(draft);
    }).catch(() => {
      if (isCurrent) setDraftLoadError(t('chat.itemEdit.loadError'));
    });
    return () => {
      isCurrent = false;
    };
  }, [t]);

  // הלוגיקה המשותפת לקונה ולמוכר: טעינת שיחה, callback להצגה, נעילה בזמן עבודה ושגיאות.
  // כאן מוגדר רק מה שייחודי למוכר: הסכמה, צורת הודעת המוכר והחיבור לשכבה שמנהלת את התהליך.
  const { messages, isLoading, isError, refetch, isBusy, handleSend, addMessage, showError } = useChatFlow<SellerMessage>({
    schema: sellerMessageSchema,
    conversation: {
      queryKey: ['seller-conversation', language],
      fetch: (signal) => getSellerConversation(language, signal),
    },
    userMessage: (text) => ({ speaker: 'seller', text }),
    connect: (message, onUpdate) => connectSellerLevels(message, onUpdate, showItemDraft, draftShown.current),
    errorText: t('chat.sendError'),
    storageKey: `monabid.chat.seller.${language}`,
  });

  function showItemDraft(draft: SellerItemDraft) {
    draftShown.current = true;
    addMessage({ speaker: 'system', text: language === 'he' ? 'פרטי הפריט שלי' : 'My item details',
      comparison: { mode: 'details', item: draft.item, evidence: draft.evidence } });
  }

  // Handles one or several photos chosen from the computer: checks each one, hands them all together to S1
  // (one upload = one item), and shows what S1 returns in the conversation as a seller message.
  // The number of photos and the rest of the upload rules are enforced by the upload service.
  // A failed upload is shown as an error message instead.
  async function handlePhotoChosen(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    // מאפס את השדה כדי שאפשר יהיה לבחור שוב את אותם קבצים.
    input.value = '';
    if (files.length === 0) return;

    if (files.some((file) => !allowedPhotoTypes.includes(file.type) || file.size > maxPhotoSize)) {
      setPhotoError(t('chat.invalidPhoto'));
      return;
    }

    setPhotoError('');
    setIsUploading(true);
    try {
      await connectSellerPhotos(files, addMessage);
      if (draftShown.current) {
        const draft = await getCurrentSellerDraft();
        if (draft) showItemDraft(draft);
      }
    } catch {
      showError('photo-upload-failed');
    } finally {
      setIsUploading(false);
    }
  }

  // Renders a single conversation message as a bubble: the photo (if any) above the text (if any).
  function renderMessageContent(message: SellerMessage) {
    if (message.speaker === 'system' && message.action) return <li data-speaker="system" className="w-full min-w-0">
      <SellerActionCard action={message.action} language={language} summary={message.text} />
    </li>;
    if (message.speaker === 'system' && message.houseRanking) {
      return <li data-speaker="system" className="w-full min-w-0">
        <h2 className="mb-3 text-lg font-semibold">{message.text}</h2>
        <SellerHouseCards ranking={message.houseRanking} category={message.houseCategory} language={language} />
      </li>;
    }
    if (message.speaker === 'system' && message.comparison) {
      return <li data-speaker="system" className="w-full min-w-0">
        <h2 className="mb-3 text-lg font-semibold">{message.text}</h2>
        {message.comparison.mode === 'details'
          ? <SellerItemDetailsCard item={message.comparison.item} evidence={message.comparison.evidence} language={language} />
          : <SellerComparisonResults result={message.comparison} language={language} />}
      </li>;
    }
    return (
      <MessageBubble speaker={message.speaker} isOwn={message.speaker === 'seller'}>
        {message.speaker === 'seller' &&
          message.images?.map((image) => (
            <EvidenceImage
              key={image.fileId}
              path={image.previewUri}
              alt={image.originalName}
              className="max-h-60 rounded-lg"
            />
          ))}
        {message.speaker === 'system'
          ? message.text.replace(/^(?:ה[־-]?AI אינו זמין כרגע, אז נמשיך באיסוף פרטים מונחה\.\s*|AI is temporarily unavailable, so we will continue with guided questions\.\s*)/, '')
          : message.text}
        {message.speaker === 'system' && /בית המכירות המומלץ|Recommended auction house|המלצת בתי המכירות מוכנה/.test(message.text) && <Link to="/seller/houses" className="mt-2 block underline">{language === 'he' ? 'בתי מכירות' : 'Auction houses'}</Link>}
        {message.speaker === 'system' && /פניות שמורות|saved enquiries|פרטי הפנייה/.test(message.text) && <Link to="/seller/enquiry" className="mt-2 block underline">{language === 'he' ? 'פניית מוכר' : 'Seller enquiry'}</Link>}
        {message.speaker === 'system' && message.comparison && <SellerComparisonResults result={message.comparison} language={language} />}
      </MessageBubble>
    );
  }

  function renderMessage(message: SellerMessage) {
    return renderMessageContent(message);
  }

  // לחצן צירוף תמונה: תווית שמפעילה שדה קובץ מוסתר, ואזהרה כשהקובץ שנבחר אינו תמונה תקינה.
  const attachPhoto = (
    <div className="flex items-center gap-2">
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
          multiple
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
      {draftLoadError && (
        <p role="alert" className="text-xs text-red-900">
          {draftLoadError}
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
