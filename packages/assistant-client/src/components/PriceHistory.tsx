import type { ReactNode } from 'react';
import type { Money } from '@monabid/shared';
import type { HistoricalSale } from './price-history';
import { SearchStatus } from './SearchStatus';

interface PriceHistoryProps {
  sales: HistoricalSale[];
  lang: 'he' | 'en';
  loading?: boolean;
  error?: boolean;
}

const HISTORY_IMAGE = '/history-lot.jpg';

function HistoryState({ children, heading, error = false }: {
  children: ReactNode;
  heading: string;
  error?: boolean;
}) {
  return (
    <section
      className={`mb-8 rounded-2xl border p-5 ${error ? 'border-red-200 bg-red-50' : 'border-[#ead9b8] bg-white'}`}
      aria-labelledby="price-history-heading"
    >
      <h2 id="price-history-heading" className="mb-2 text-base font-bold text-stone-950">{heading}</h2>
      <p className={`text-sm ${error ? 'text-red-800' : 'text-stone-600'}`} role="status">{children}</p>
    </section>
  );
}

function formatSalePrice(money: Money) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currency,
    maximumFractionDigits: 0,
  }).format(money.amount);
}

/** Presents verified past sales of one item. It never decides similarity or creates price evidence. */
export function PriceHistory({ sales, lang, loading = false, error = false }: PriceHistoryProps) {
  const isRtl = lang === 'he';
  const heading = isRtl ? 'היסטוריית מכירות קודמות' : 'Price History';
  const question = isRtl ? 'יש לפריט הזה היסטוריית מכירות קודמות?' : 'Does this item have previous sale history?';
  const lastSaleMessage = isRtl
    ? 'המכירה האחרונה שלו — נתון אמיתי מהארכיון שלנו.'
    : 'Its most recent sale — verified archive evidence.';
  const disclaimer = isRtl
    ? 'התחנה האחרונה מבוססת על מכירה אמיתית מהארכיון, התחנות הקודמות להמחשה בלבד.'
    : 'The latest stop is a verified archive sale; earlier stops are for illustration only.';

  if (loading) {
    return (
      <section className="mb-8 px-0 py-5 sm:px-5" dir="ltr" aria-labelledby="price-history-heading">
        <h2 id="price-history-heading" className="sr-only">{heading}</h2>
        <div className="mb-6">
          <p className="inline-block rounded-full bg-[#2b2438] px-4 py-2 text-sm font-semibold text-white">{question}</p>
        </div>
        <SearchStatus />
      </section>
    );
  }

  if (error) {
    return <HistoryState heading={heading} error>{isRtl ? 'לא ניתן היה לטעון כרגע את היסטוריית המכירות.' : 'Price history could not be loaded right now.'}</HistoryState>;
  }

  const currency = sales[0]?.realizedPrice.currency;
  const validSales = currency ? sales.filter((sale) => sale.realizedPrice.currency === currency) : [];

  if (validSales.length < 2) {
    return (
      <HistoryState heading={heading}>
        {isRtl ? 'אין עדיין מספיק מכירות עבר מאומתות להצגת ההיסטוריה.' : 'There are not enough verified past sales to show a price history yet.'}
      </HistoryState>
    );
  }

  const latestSale = validSales[validSales.length - 1];
  const title = latestSale.title.en;

  return (
    <section className="mb-8 px-0 py-5 sm:px-5" dir="ltr" aria-labelledby="price-history-heading">
      <h2 id="price-history-heading" className="sr-only">{heading}</h2>
      <div className="mb-6">
        <p className="inline-block rounded-full bg-[#2b2438] px-4 py-2 text-sm font-semibold text-white">{question}</p>
      </div>

      <div className="rounded-[1.25rem] border border-[#e4d6b8] bg-white px-6 py-6 sm:px-10">
        <p className="mb-8 text-center text-[15px] font-bold leading-snug text-stone-950">{title}</p>

        <ol dir="ltr" className="relative mb-6 before:absolute before:right-[5px] before:top-3 before:bottom-3 before:w-px before:bg-[#d9d0c3]">
          {validSales.map((sale, index) => {
            const isLatest = index === validSales.length - 1;
            const year = new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(new Date(`${sale.saleDate}T00:00:00`));
            return (
              <li key={sale.id} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-x-4 py-[0.55rem] text-[15px]">
                <strong dir="ltr" className="text-left font-semibold text-[#c4a36a]">{formatSalePrice(sale.realizedPrice)}</strong>
                <a
                  href={sale.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-right font-semibold text-stone-950 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                >
                  {sale.auctionHouse.name}
                  <span className="font-normal text-stone-500"> · {year}</span>
                </a>
                <span
                  className={`h-[14px] w-[14px] rounded-full border-2 ${isLatest ? 'border-[#8d6b32] bg-[#8d6b32]' : 'border-[#c8c2ba] bg-white'}`}
                  aria-label={isLatest ? (isRtl ? 'המכירה האחרונה' : 'Most recent sale') : undefined}
                />
              </li>
            );
          })}
        </ol>

        <div className="flex items-center gap-4 rounded-xl bg-[#f3ead8] px-5 py-4" dir="ltr">
          <p className="min-w-0 flex-1 text-right text-sm leading-6 text-stone-600" dir="rtl">
            {lastSaleMessage}
          </p>
          <img
            src={HISTORY_IMAGE}
            alt={title}
            className="h-[4.75rem] w-[4.75rem] shrink-0 rounded-lg object-cover"
          />
        </div>
      </div>

      <p className="mt-4 text-right text-xs leading-5 text-stone-400">{disclaimer}</p>
    </section>
  );
}
