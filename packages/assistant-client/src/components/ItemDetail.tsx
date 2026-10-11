import { useState } from 'react';
import type { Money } from '@monabid/shared';
import { PriceHistory } from './PriceHistory';
import { getComparableSaleHistory, type ItemHistoryLot } from './price-history';

interface ItemDetailProps {
  lot: ItemHistoryLot;
  lang: 'he' | 'en';
  onBack: () => void;
  historyLots?: ItemHistoryLot[];
  historyLoading?: boolean;
  historyError?: boolean;
  onOpenChat?: () => void;
}

/**
 * תבנית דף הפריט: מקבלת לוט אחד ומציגה את פרטיו, המקור שלו, והיסטוריית מחיר אם התקבלה.
 * היא אינה מחפשת נתונים בעצמה; LotPage הוא שמספק לה את הלוט ואת רשימת ההיסטוריה.
 */
export function ItemDetail({
  lot,
  lang,
  onBack,
  historyLots = [],
  historyLoading = false,
  historyError = false,
  onOpenChat,
}: ItemDetailProps) {
  const isRtl = lang === 'he';
  // קובע אם להציג את טופס בקשת העזרה; שליחה אמיתית תחובר בעתיד ל-P3.
  const [showHelpForm, setShowHelpForm] = useState(false);
  const title = lot.title[lang] ?? lot.title.en;
  const description = lot.description[lang] ?? lot.description.en;
  // מסנן מן הרשימה שקיבלנו רק מכירות עבר שמתאימות לתרשים של הפריט הנוכחי.
  const historicalSales = getComparableSaleHistory(lot, historyLots);
  // מציג סכום תוך שמירה על המטבע המקורי שלו.
  const formatCurrency = (money: Money) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', {
    style: 'currency',
    currency: money.currency,
    maximumFractionDigits: 0,
  }).format(money.amount);

  return (
    <div className={`mx-auto max-w-3xl rounded-xl border border-[#ead9b8] bg-white p-6 shadow-sm ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <button type="button" onClick={onBack} className="mb-6 flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2">
        {isRtl ? 'חזרה לתוצאות החיפוש' : 'Back to Results'}
      </button>

      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-amber-700">{lot.auctionTitle}</span>
      <h1 className="mb-2 text-2xl font-extrabold text-stone-950">{title}</h1>

      <div className="mb-6 flex flex-wrap gap-4 border-b border-[#ead9b8] pb-4 text-sm text-stone-500">
        <div><span className="font-semibold">{isRtl ? 'בית מכירות:' : 'Auction House:'}</span> {lot.auctionHouse.name}</div>
        <div><span className="font-semibold">{isRtl ? 'מספר לוט:' : 'Lot Number:'}</span> {lot.lotNumber}</div>
        <div><span className="font-semibold">{isRtl ? 'תאריך מכירה:' : 'Sale Date:'}</span> {lot.saleDate}</div>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-stone-800">{isRtl ? 'תיאור הפריט' : 'Description'}</h2>
        <p className="rounded-lg bg-[#f7f1e6] p-4 leading-relaxed text-stone-600">{description}</p>
      </section>

      {lot.estimate || (lot.status === 'sold' && lot.realizedPrice) ? (
        <section className="mb-8 grid grid-cols-1 gap-4 rounded-xl border border-[#ead9b8] bg-[#f7f1e6] p-4 md:grid-cols-2">
          {lot.estimate ? (
            <div>
              <span className="block text-xs font-medium text-stone-500">{isRtl ? 'הערכת שווי מקורית' : 'Original Estimate'}</span>
              <span dir="ltr" className="text-lg font-bold text-[#b08948]">{formatCurrency(lot.estimate.low)} – {formatCurrency(lot.estimate.high)}</span>
            </div>
          ) : null}
          {lot.status === 'sold' && lot.realizedPrice ? (
            <div>
              <span className="block text-xs font-semibold text-stone-500">{isRtl ? 'מחיר מימוש' : 'Realized Price'}</span>
              <span dir="ltr" className="text-2xl font-black text-[#b08948]">{formatCurrency(lot.realizedPrice)}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mb-8 border-t border-[#ead9b8] pt-6">
        <h2 className="mb-2 text-sm font-bold text-stone-800">{isRtl ? 'מקורות וראיות' : 'Sources & Evidence'}</h2>
        <div className="rounded-lg border border-[#ead9b8] bg-[#f7f1e6] p-4 text-sm text-stone-600">
          <p className="mb-2"><strong>{isRtl ? 'ספק נתונים:' : 'Provider:'}</strong> {lot.source.provider}</p>
          <p className="mb-3"><strong>{isRtl ? 'מזהה רשומה:' : 'Record ID:'}</strong> <code>{lot.source.recordId}</code></p>
          <a href={lot.source.url} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-medium text-[#b08948] underline underline-offset-2 hover:text-[#9a753c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">
            {isRtl ? 'צפייה בפריט המקורי באתר המכירה' : 'View Original Lot on Auction Site'}
          </a>
        </div>
      </section>

      <PriceHistory sales={historicalSales} lang={lang} loading={historyLoading} error={historyError} />

      {onOpenChat ? (
        <section className="mb-8 border-t border-gray-100 pt-6 text-center">
          <button
            type="button"
            onClick={onOpenChat}
            className="w-full rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 md:w-auto"
          >
            {isRtl ? 'שאלי את העוזרת על הפריט' : 'Ask the assistant about this lot'}
          </button>
        </section>
      ) : null}

      <section className="border-t border-[#ead9b8] pt-6 text-center">
        {!showHelpForm ? (
          <button type="button" onClick={() => setShowHelpForm(true)} className="w-full rounded-full bg-[#2b2438] px-6 py-3 text-sm font-semibold text-white hover:bg-[#3a314d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 md:w-auto">
            {isRtl ? 'זקוקה לעזרה נוספת ממומחה מונאביד?' : 'Need Manual Help From a Monabid Specialist?'}
          </button>
        ) : (
          <div className={isRtl ? 'text-right' : 'text-left'}>
            <h3 className="mb-2 font-bold text-stone-950">{isRtl ? 'בקשת סיוע ממומחה' : 'Request Specialist Assistance'}</h3>
            <p className="mb-4 text-xs text-stone-500">{isRtl ? 'אפשר לנסח שאלה. שליחת בקשה תתאפשר לאחר חיבור שירות ההסכמה.' : 'You can write a question. Submission will be available when the consent service is connected.'}</p>
            <textarea aria-label={isRtl ? 'שאלת עזרה' : 'Help request message'} className="mb-3 w-full rounded-xl border border-[#ead9b8] bg-white p-2 text-sm" rows={3} placeholder={isRtl ? 'מה תרצי לדעת על פריט זה?' : 'What would you like to verify about this lot?'} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowHelpForm(false)} className="px-3 py-1 text-xs text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">{isRtl ? 'ביטול' : 'Cancel'}</button>
              <button type="button" disabled className="cursor-not-allowed rounded-full bg-[#2b2438] px-4 py-2 text-xs text-white opacity-60">{isRtl ? 'שליחת בקשה והסכמה' : 'Submit Request'}</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
