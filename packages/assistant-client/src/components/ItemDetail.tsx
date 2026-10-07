import { useState } from 'react';
import type { Money } from '@monabid/shared';
import { PriceHistory } from './PriceHistory';
import { getComparableSaleHistory, type ItemHistoryLot } from './price-history';

interface ItemDetailProps {
  lot: ItemHistoryLot;
  lang: 'he' | 'en';
  onBack: () => void;
  historyLots?: ItemHistoryLot[];
}

export function ItemDetail({ lot, lang, onBack, historyLots = [] }: ItemDetailProps) {
  const isRtl = lang === 'he';
  const [showHelpForm, setShowHelpForm] = useState(false);
  const title = lot.title[lang] ?? lot.title.en;
  const description = lot.description[lang] ?? lot.description.en;
  const historicalSales = getComparableSaleHistory(lot, historyLots);
  const formatCurrency = (money: Money) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', {
    style: 'currency',
    currency: money.currency,
    maximumFractionDigits: 0,
  }).format(money.amount);

  return (
    <div className={`mx-auto max-w-3xl rounded-xl border border-gray-100 bg-white p-6 shadow-sm ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <button type="button" onClick={onBack} className="mb-6 flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-950">
        {isRtl ? 'חזרה לתוצאות החיפוש' : 'Back to Results'}
      </button>

      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-amber-700">{lot.auctionTitle}</span>
      <h1 className="mb-2 text-2xl font-extrabold text-slate-900">{title}</h1>

      <div className="mb-6 flex flex-wrap gap-4 border-b border-gray-100 pb-4 text-sm text-slate-500">
        <div><span className="font-semibold">{isRtl ? 'בית מכירות:' : 'Auction House:'}</span> {lot.auctionHouse.name}</div>
        <div><span className="font-semibold">{isRtl ? 'מספר לוט:' : 'Lot Number:'}</span> {lot.lotNumber}</div>
        <div><span className="font-semibold">{isRtl ? 'תאריך מכירה:' : 'Sale Date:'}</span> {lot.saleDate}</div>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-slate-800">{isRtl ? 'תיאור הפריט' : 'Description'}</h2>
        <p className="rounded-lg bg-slate-50 p-4 leading-relaxed text-slate-600">{description}</p>
      </section>

      {lot.estimate || (lot.status === 'sold' && lot.realizedPrice) ? (
        <section className="mb-8 grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-2">
          {lot.estimate ? (
            <div>
              <span className="block text-xs font-medium text-slate-400">{isRtl ? 'הערכת שווי מקורית' : 'Original Estimate'}</span>
              <span className="text-lg font-bold text-slate-700">{formatCurrency(lot.estimate.low)} – {formatCurrency(lot.estimate.high)}</span>
            </div>
          ) : null}
          {lot.status === 'sold' && lot.realizedPrice ? (
            <div>
              <span className="block text-xs font-semibold text-green-600">{isRtl ? 'מחיר מימוש' : 'Realized Price'}</span>
              <span className="text-2xl font-black text-green-700">{formatCurrency(lot.realizedPrice)}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mb-8 border-t border-gray-100 pt-6">
        <h2 className="mb-2 text-sm font-bold text-slate-800">{isRtl ? 'מקורות וראיות' : 'Sources & Evidence'}</h2>
        <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-4 text-sm text-slate-600">
          <p className="mb-2"><strong>{isRtl ? 'ספק נתונים:' : 'Provider:'}</strong> {lot.source.provider}</p>
          <p className="mb-3"><strong>{isRtl ? 'מזהה רשומה:' : 'Record ID:'}</strong> <code>{lot.source.recordId}</code></p>
          <a href={lot.source.url} target="_blank" rel="noopener noreferrer" className="inline-block rounded bg-amber-700 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800">
            {isRtl ? 'צפייה בפריט המקורי באתר המכירה' : 'View Original Lot on Auction Site'}
          </a>
        </div>
      </section>

      <PriceHistory sales={historicalSales} lang={lang} />

      <section className="border-t border-slate-200 pt-6 text-center">
        {!showHelpForm ? (
          <button type="button" onClick={() => setShowHelpForm(true)} className="w-full rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 md:w-auto">
            {isRtl ? 'זקוקה לעזרה נוספת ממומחה מונאביד?' : 'Need Manual Help From a Monabid Specialist?'}
          </button>
        ) : (
          <div className={isRtl ? 'text-right' : 'text-left'}>
            <h3 className="mb-2 font-bold text-slate-900">{isRtl ? 'בקשת סיוע ממומחה' : 'Request Specialist Assistance'}</h3>
            <p className="mb-4 text-xs text-slate-500">{isRtl ? 'אפשר לנסח שאלה. שליחת בקשה תתאפשר לאחר חיבור שירות ההסכמה.' : 'You can write a question. Submission will be available when the consent service is connected.'}</p>
            <textarea aria-label={isRtl ? 'שאלת עזרה' : 'Help request message'} className="mb-3 w-full rounded-md border border-gray-300 p-2 text-sm" rows={3} placeholder={isRtl ? 'מה תרצי לדעת על פריט זה?' : 'What would you like to verify about this lot?'} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowHelpForm(false)} className="px-3 py-1 text-xs text-slate-500">{isRtl ? 'ביטול' : 'Cancel'}</button>
              <button type="button" disabled className="cursor-not-allowed rounded bg-green-700 px-4 py-2 text-xs text-white opacity-60">{isRtl ? 'שליחת בקשה והסכמה' : 'Submit Request'}</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
