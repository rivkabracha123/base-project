import type { ReactNode } from 'react';
import type { Money } from '@monabid/shared';
import type { HistoricalSale } from './price-history';

interface PriceHistoryProps {
  sales: HistoricalSale[];
  lang: 'he' | 'en';
  loading?: boolean;
  error?: boolean;
}

function HistoryState({ children, heading, error = false }: {
  children: ReactNode;
  heading: string;
  error?: boolean;
}) {
  return (
    <section className={`mb-8 rounded-2xl border p-5 ${error ? 'border-red-200 bg-red-50' : 'border-[#e3d6bf] bg-[#fffaf0]'}`} aria-labelledby="price-history-heading">
      <h2 id="price-history-heading" className="mb-2 text-base font-bold text-slate-900">{heading}</h2>
      <p className={`text-sm ${error ? 'text-red-800' : 'text-slate-600'}`} role="status">{children}</p>
    </section>
  );
}

/** Presents verified past sales of one item. It never decides similarity or creates price evidence. */
export function PriceHistory({ sales, lang, loading = false, error = false }: PriceHistoryProps) {
  const isRtl = lang === 'he';
  const heading = isRtl ? 'היסטוריית מכירות קודמות' : 'Price History';
  const question = isRtl ? 'יש לפריט הזה היסטוריית מכירות קודמות?' : 'Does this item have previous sale history?';
  const searching = isRtl ? 'מחפש מופעים קודמים של הפריט…' : 'Looking for earlier appearances of this item…';
  const lastSaleMessage = isRtl ? 'המכירה האחרונה שלו — נתון אמיתי מהארכיון שלנו.' : 'Its most recent sale — verified archive evidence.';
  const disclaimer = isRtl ? 'הנתונים מבוססים על מכירות מאומתות בלבד.' : 'This history is based on verified sales only.';

  if (loading) return <HistoryState heading={heading}>{isRtl ? 'טוען היסטוריית מכירות מאומתת…' : 'Loading verified sale history…'}</HistoryState>;
  if (error) return <HistoryState heading={heading} error>{isRtl ? 'לא ניתן היה לטעון כרגע את היסטוריית המכירות.' : 'Price history could not be loaded right now.'}</HistoryState>;

  const currency = sales[0]?.realizedPrice.currency;
  const validSales = currency ? sales.filter((sale) => sale.realizedPrice.currency === currency) : [];
  if (validSales.length < 2) {
    return <HistoryState heading={heading}>{isRtl ? 'אין עדיין מספיק מכירות עבר מאומתות להצגת ההיסטוריה.' : 'There are not enough verified past sales to show a price history yet.'}</HistoryState>;
  }

  const formatCurrency = (money: Money) => {
    const amount = new Intl.NumberFormat(isRtl ? 'he-IL' : 'en-US', { style: 'currency', currency: money.currency, maximumFractionDigits: 0 }).format(money.amount);
    return `${money.currency} ${amount}`;
  };
  const formatYear = (saleDate: string) => new Intl.DateTimeFormat(isRtl ? 'he-IL' : 'en-US', { year: 'numeric' }).format(new Date(`${saleDate}T00:00:00`));
  // validSales contains at least two entries here, because of the early return above.
  const latestSale = validSales[validSales.length - 1]!;

  return (
    <section className="mb-8 bg-[#fffaf0] px-0 py-5 sm:px-5" aria-labelledby="price-history-heading">
      <div className="mb-7 flex justify-start" dir="ltr"><p className="rounded-full bg-[#080613] px-4 py-2 text-sm font-semibold text-white shadow-sm">{question}</p></div>
      <p className={`mb-6 text-sm text-[#aca396] ${isRtl ? 'text-right' : 'text-left'}`}>{searching}</p>
      <div className="rounded-2xl border border-[#e1d4bd] bg-[#fffaf0] px-4 py-5 shadow-[0_1px_2px_rgba(74,55,28,0.06)] sm:px-8">
        <h2 id="price-history-heading" className="mb-4 text-center text-sm font-bold leading-6 text-[#111019] sm:text-base">{latestSale.title[lang] ?? latestSale.title.en}</h2>
        <ol className="relative mb-4 before:absolute before:right-[0.55rem] before:top-5 before:bottom-5 before:w-px before:bg-[#d8cfbf] sm:before:right-[0.68rem]">
          {validSales.map((sale, index) => {
            const isLatest = index === validSales.length - 1;
            return <li key={sale.id} className="grid grid-cols-[6.75rem_1fr_1.25rem] items-center gap-2 py-2 text-sm sm:grid-cols-[8rem_1fr_1.5rem]">
              <strong className="text-left text-[#9b783e]">{formatCurrency(sale.realizedPrice)}</strong>
              <p className={isRtl ? 'text-right font-semibold text-[#17131b]' : 'text-left font-semibold text-[#17131b]'}>{sale.auctionHouse.name} <span className="text-[#655f64]">• {formatYear(sale.saleDate)}</span></p>
              <span className={`h-3 w-3 rounded-full border-2 ${isLatest ? 'border-[#ad8545] bg-[#ad8545]' : 'border-[#aaa6a2] bg-[#fffaf0]'}`} aria-label={isLatest ? (isRtl ? 'המכירה האחרונה' : 'Most recent sale') : undefined} />
            </li>;
          })}
        </ol>
        <div className={`flex items-center gap-4 rounded-xl bg-[#f1e7d0] px-4 py-3 ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
          <div className="min-w-0 flex-1"><p className="text-sm text-[#625b52]">{lastSaleMessage}</p><a href={latestSale.source.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-[#8a6a36] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ad8545] focus-visible:ring-offset-2">{isRtl ? 'צפה ברישום המכירה' : 'View sale record'}</a></div>
          {latestSale.imageUrl ? <img src={latestSale.imageUrl} alt="" className="h-16 w-20 rounded-lg object-cover" /> : null}
        </div>
      </div>
      <p className={`mt-4 text-xs text-[#aca396] ${isRtl ? 'text-right' : 'text-left'}`}>{disclaimer}</p>
    </section>
  );
}
