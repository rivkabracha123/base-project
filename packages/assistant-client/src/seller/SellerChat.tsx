import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { evidenceUrl, getSellerConversation } from '../app/api';
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
  const [pendingPhotos, setPendingPhotos] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const pendingPhotosRef = useRef(pendingPhotos);
  pendingPhotosRef.current = pendingPhotos;
  const [draftLoadError, setDraftLoadError] = useState('');
  const draftShown = useRef(false);

  useEffect(() => () => {
    pendingPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
  }, []);

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
  });

  function showItemDraft(draft: SellerItemDraft) {
    draftShown.current = true;
    addMessage({ speaker: 'system', text: language === 'he' ? 'פרטי הפריט שלי' : 'My item details',
      comparison: { mode: 'details', item: draft.item, evidence: draft.evidence } });
  }

  // Stages chosen photos in the composer. They are uploaded only when the seller presses Send.
  function handlePhotoChosen(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length === 0) return;

    if (files.some((file) => !allowedPhotoTypes.includes(file.type) || file.size > maxPhotoSize)) {
      setPhotoError(t('chat.invalidPhoto'));
      return;
    }

    setPhotoError('');
    setPendingPhotos((current) => [
      ...current,
      ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
  }

  function removePendingPhoto(index: number) {
    setPendingPhotos((current) => {
      const next = [...current];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  async function handleComposerSend(text: string) {
    const staged = pendingPhotos;
    const files = staged.map((photo) => photo.file);
    if (staged.length > 0) {
      staged.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      setPendingPhotos([]);
      setIsUploading(true);
      try {
        await connectSellerPhotos(files, (update) => {
          if (update.speaker === 'seller') {
            addMessage({
              ...update,
              ...(text.trim() ? { text: text.trim() } : {}),
            });
            return;
          }
          addMessage(update);
        });
        if (draftShown.current) {
          const draft = await getCurrentSellerDraft();
          if (draft) showItemDraft(draft);
        }
      } catch {
        showError('photo-upload-failed');
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    if (!text.trim()) return;
    if (files.length > 0) {
      setIsUploading(true);
      try {
        await connectSellerLevels(text, addMessage, showItemDraft, draftShown.current);
      } catch {
        showError('send-failed');
      } finally {
        setIsUploading(false);
      }
      return;
    }
    void handleSend(text);
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
    if (message.speaker === 'seller' && message.images && message.images.length > 0) {
      return (
        <li data-speaker="seller" className="flex max-w-lg flex-col items-end gap-2 self-end">
          {message.images.map((image) => (
            <img
              key={image.fileId}
              src={evidenceUrl(image.previewUri)}
              alt={image.originalName}
              className="h-36 w-52 rounded-2xl object-cover shadow-sm"
            />
          ))}
          {message.text ? (
            <p className="max-w-lg whitespace-pre-wrap rounded-full bg-[#2b2438] px-4 py-2 text-sm text-white">
              {message.text}
            </p>
          ) : null}
        </li>
      );
    }
    return (
      <MessageBubble speaker={message.speaker} isOwn={message.speaker === 'seller'}>
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
        className="flex cursor-pointer items-center rounded-full p-2 text-stone-500 hover:bg-[#f3ead8]"
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
      isBusy={isBusy || isUploading}
      onRetry={refetch}
      onSend={handleComposerSend}
      dir={dir}
      tone="journey"
      placeholder={t('chat.placeholder')}
      busyLabel={isUploading ? t('chat.checkingPhotos') : undefined}
      loadingLabel={t('chat.loading')}
      errorLabel={t('chat.error')}
      retryLabel={t('chat.retry')}
      inputLabel={t('chat.inputLabel')}
      sendLabel={t('chat.sellerSend')}
      canSendEmpty={pendingPhotos.length > 0}
      composerAbove={pendingPhotos.length > 0 ? (
        <div className="flex flex-wrap justify-end gap-2 px-1">
          {pendingPhotos.map((photo, index) => (
            <div key={photo.previewUrl} className="relative">
              <img src={photo.previewUrl} alt={photo.file.name} className="h-36 w-52 rounded-2xl object-cover shadow-sm" />
              <button
                type="button"
                onClick={() => removePendingPhoto(index)}
                className="absolute -end-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-stone-800 text-xs text-white"
                aria-label={language === 'he' ? 'הסרת תמונה' : 'Remove photo'}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      composerExtra={attachPhoto}
    />
  );
}
