import { useState } from 'react';
import type { AuctionLot, Money } from '@monabid/shared';
import type { MatchReasonFixture } from '../app/buyer-search-outcome.fixture';

interface ResultCardProps {
  lot: AuctionLot;
  lang: 'he' | 'en';
  onSelect: (id: string) => void;
  matchReasons?: MatchReasonFixture[];
  selected?: boolean;
}

/**
 * מציג כרטיס קצר של לוט אחד מתוצאת החיפוש.
 * לחיצה על הכפתור מחזירה להורה את מזהה הלוט, כדי שההורה יעבור לדף הפריט.
 */
export function ResultCard({ lot, lang, onSelect, matchReasons = [], selected = false }: ResultCardProps) {
  const isRtl = lang === 'he';
  const matchReasonLabels: Record<string, string> = isRtl
    ? {
        categories: 'קטגוריה',
        creators: 'יוצר',
        price: 'מחיר',
        keywords: 'מילות חיפוש',
        auctionHouseIds: 'בית מכירות',
        dateRange: 'טווח תאריכים',
        statuses: 'סטטוס',
        query: 'התאמה לטקסט החיפוש',
      }
    : {
        categories: 'Category',
        creators: 'Creator',
        price: 'Price',
        keywords: 'Keywords',
        auctionHouseIds: 'Auction house',
        dateRange: 'Date range',
        statuses: 'Status',
        query: 'Search-text match',
      };
  // מתחיל במצב "אין תמונה" אם לא התקבלה כתובת תמונה, ומתעדכן גם אם טעינת התמונה נכשלת.
  const [imageUnavailable, setImageUnavailable] = useState(!lot.imageUrl);
  const statusLabel = {
    sold: isRtl ? 'נמכר' : 'Sold',
    unsold: isRtl ? 'לא נמכר' : 'Unsold',
    upcoming: isRtl ? 'צפוי להימכר' : 'Upcoming',
    withdrawn: isRtl ? 'נמשך מהמכירה' : 'Withdrawn',
    unknown: isRtl ? 'לא ידוע' : 'Unknown',
  }[lot.status];
  // שומר את המטבע המקורי של הלוט ומציג אותו לפי השפה הנוכחית.
  const formatCurrency = (money: Money) => {
    const amount = new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', {
      style: 'currency',
      currency: money.currency,
      maximumFractionDigits: 0,
    }).format(money.amount);

    return `${money.currency} ${amount}`;
  };

  return (
    <article
      className={`rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${selected ? 'border-amber-500 ring-2 ring-amber-200' : 'border-gray-200'} ${isRtl ? 'text-right' : 'text-left'}`}
      dir={isRtl ? 'rtl' : 'ltr'}
      aria-label={selected ? (isRtl ? 'פריט שנבחר' : 'Selected item') : undefined}
    >
      {imageUnavailable ? (
        <div
          className="mb-4 flex aspect-[4/3] items-center justify-center rounded-md bg-slate-100 px-4 text-center text-sm text-slate-500"
          role="img"
          aria-label={isRtl ? 'אין תמונה זמינה לפריט זה' : 'No image available for this lot'}
        >
          {isRtl ? 'אין תמונה זמינה' : 'No image available'}
        </div>
      ) : (
        <img
          className="mb-4 aspect-[4/3] w-full rounded-md object-cover"
          src={lot.imageUrl}
          alt={lot.title[lang] ?? lot.title.en}
          onError={() => setImageUnavailable(true)}
        />
      )}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span className="font-semibold">{lot.auctionHouse.name}</span>
        <span>{isRtl ? 'סטטוס:' : 'Status:'} {statusLabel}</span>
        <span>{isRtl ? 'לוט' : 'Lot'} #{lot.lotNumber}</span>
      </div>
      <h2 className="mb-1 text-base font-bold text-gray-900">{lot.title[lang] ?? lot.title.en}</h2>
      <p className="mb-4 line-clamp-2 text-sm text-gray-600">{lot.description[lang] ?? lot.description.en}</p>

      {matchReasons.length > 0 ? (
        <section className="mb-4 rounded-md bg-slate-50 p-3" aria-label={isRtl ? 'למה הפריט מתאים' : 'Why this matches'}>
          <h3 className="mb-1 text-xs font-bold text-slate-700">{isRtl ? 'למה הפריט מתאים' : 'Why this matches'}</h3>
          <ul className="list-inside list-disc text-xs text-slate-600">
            {matchReasons.map((reason) => (
              <li key={`${reason.field}-${reason.detail}`}>
                {matchReasonLabels[reason.field] ?? reason.field}: {reason.detail}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-2 border-t border-gray-100 pt-3">
        {lot.estimate ? (
          <div>
            <span className="block text-xs text-gray-400">{isRtl ? 'הערכה' : 'Estimate'}</span>
            <span className="text-sm font-medium text-gray-700">
              {formatCurrency(lot.estimate.low)} – {formatCurrency(lot.estimate.high)}
            </span>
          </div>
        ) : null}
        {lot.status === 'sold' && lot.realizedPrice ? (
          <div className="text-right">
            <span className="block text-xs font-medium text-green-600">{isRtl ? 'מחיר מימוש' : 'Realized price'}</span>
            <span className="text-lg font-bold text-green-700">{formatCurrency(lot.realizedPrice)}</span>
          </div>
        ) : null}
      </div>

      <button type="button" onClick={() => onSelect(lot.id)} className="mt-4 w-full rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2">
        {isRtl ? 'לפרטי הפריט' : 'View item details'}
      </button>
    </article>
  );
}
