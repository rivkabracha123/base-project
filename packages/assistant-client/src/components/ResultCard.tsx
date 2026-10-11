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

const categoryLabels: Record<string, { en: string; he: string }> = {
  rare_books: { en: 'Rare books', he: 'ספרים וכתבי יד נדירים' },
  judaica: { en: 'Judaica', he: 'יודיאיקה' },
  paintings: { en: 'Paintings', he: 'ציורים' },
};

const FALLBACK_IMAGE = '/history-lot.jpg';

function formatCardPrice(money: Money) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currency,
    maximumFractionDigits: 0,
  }).format(money.amount);
}

/**
 * מציג כרטיס קצר של לוט אחד מתוצאת החיפוש, בסגנון מסע הקונה.
 * לחיצה על הכרטיס מחזירה להורה את מזהה הלוט, כדי שההורה יעבור לדף הפריט.
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
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const imageSrc = !imageUnavailable && lot.imageUrl ? lot.imageUrl : FALLBACK_IMAGE;
  const category = categoryLabels[lot.category]?.[lang] ?? lot.category;
  const title = lot.title.en;
  const saleMonth = new Intl.DateTimeFormat(isRtl ? 'he-IL' : 'en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${lot.saleDate}T00:00:00Z`));

  return (
    <article
      className={`cursor-pointer overflow-hidden rounded-2xl border border-[#eadfd0] bg-white shadow-[0_1px_2px_rgba(80,60,20,0.06)] ${selected ? 'ring-2 ring-amber-700' : ''}`}
      dir="ltr"
      aria-label={selected ? (isRtl ? 'פריט שנבחר' : 'Selected item') : undefined}
      onClick={() => onSelect(lot.id)}
    >
      <div className="relative aspect-[4/3] bg-[#d9cbb3]">
        <img
          className="h-full w-full object-cover"
          src={imageSrc}
          alt={title}
          onError={() => {
            if (lot.imageUrl && !imageUnavailable) setImageUnavailable(true);
          }}
        />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-[#1b365d] px-2 py-1.5">
          {lot.status === 'sold' && lot.realizedPrice ? (
            <span className="shrink-0 text-[12px] font-medium text-white">
              Sold for: {formatCardPrice(lot.realizedPrice)}
            </span>
          ) : (
            <span />
          )}
          <span className="max-w-[70%] truncate rounded-full bg-[#111827] px-2.5 py-0.5 text-[10px] leading-4 text-white">
            {category}
          </span>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        <h2 className="line-clamp-2 min-h-[2.5rem] text-center text-[15px] font-semibold leading-snug text-[#1c1917]">{title}</h2>
        <p className="mt-1 text-center text-[13px] text-stone-500">{lot.auctionHouse.name}</p>

        {matchReasons.length > 0 ? (
          <section className="mt-3 rounded-md bg-[#f7f1e6] p-3" aria-label={isRtl ? 'למה הפריט מתאים' : 'Why this matches'}>
            <h3 className="mb-1 text-xs font-bold text-stone-700">{isRtl ? 'למה הפריט מתאים' : 'Why this matches'}</h3>
            <ul className="list-inside list-disc text-xs text-stone-600">
              {matchReasons.map((reason) => (
                <li key={`${reason.field}-${reason.detail}`}>
                  {matchReasonLabels[reason.field] ?? reason.field}: {reason.detail}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {lot.estimate ? (
          <div className="mt-3 flex items-baseline justify-between gap-2 text-[14px]">
            <span dir="ltr" className="font-semibold text-[#c4a36a]">
              {formatCardPrice(lot.estimate.low)}–{formatCardPrice(lot.estimate.high)}
            </span>
            <span className="text-stone-500">{isRtl ? 'הערכה' : 'Estimate'}</span>
          </div>
        ) : null}
        {lot.status === 'sold' && lot.realizedPrice ? (
          <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[14px]">
            <span dir="ltr" className="font-semibold text-[#c4a36a]">{formatCardPrice(lot.realizedPrice)}</span>
            <span className="text-stone-500">{isRtl ? 'נמכר תמורת' : 'Realized price'}</span>
          </div>
        ) : null}
        <p className="mt-1 text-right text-[12px] text-stone-400">{saleMonth}</p>
        <a
          href={lot.source.url}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="mt-1 block text-right text-[13px] font-medium text-[#c4a36a] underline underline-offset-2"
        >
          {isRtl ? 'צפה ברישום המקורי' : 'View original listing'}
        </a>
      </div>
    </article>
  );
}
