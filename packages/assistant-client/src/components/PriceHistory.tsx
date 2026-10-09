import type { Money } from '@monabid/shared';
import type { HistoricalSale } from './price-history';

interface PriceHistoryProps {
  sales: HistoricalSale[];
  lang: 'he' | 'en';
}

const chartWidth = 560;
const chartHeight = 220;
const chartPadding = 42;

/**
 * מציג תרשים ורשימה של מכירות עבר שכבר סוננו עבור פריט אחד.
 * אם אין לפחות שתי מכירות באותו מטבע, מציג הודעה ישרה במקום תרשים מטעה.
 */
export function PriceHistory({ sales, lang }: PriceHistoryProps) {
  const isRtl = lang === 'he';
  // הגנה נוספת: גם אם הועברו בטעות מטבעות שונים, התרשים משתמש רק במטבע הראשון.
  const validSales = sales.filter((sale) => sale.realizedPrice.currency === sales[0]?.realizedPrice.currency);

  if (validSales.length < 2) {
    return (
      <section className="mb-8 border-t border-slate-200 pt-6" aria-labelledby="price-history-heading">
        <h2 id="price-history-heading" className="mb-2 text-sm font-bold text-slate-800">
          {isRtl ? 'היסטוריית מחירים' : 'Price History'}
        </h2>
        <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600" role="status">
          {isRtl
            ? 'אין עדיין מספיק מכירות עבר מאומתות כדי להציג תרשים מחירים.'
            : 'There are not enough verified past sales to show a price chart yet.'}
        </p>
      </section>
    );
  }

  // הופך סכום כספי לטקסט קריא, בלי לבצע המרת מטבע.
  const formatCurrency = (money: Money) => {
    const amount = new Intl.NumberFormat(isRtl ? 'he-IL' : 'en-US', {
      style: 'currency',
      currency: money.currency,
      maximumFractionDigits: 0,
    }).format(money.amount);

    return `${money.currency} ${amount}`;
  };

  // מצמצם תאריך לחודש ושנה, כי זהו הציר האופקי של התרשים.
  const formatDate = (saleDate: string) => new Intl.DateTimeFormat(
    isRtl ? 'he-IL' : 'en-US',
    { month: 'short', year: 'numeric' },
  ).format(new Date(`${saleDate}T00:00:00`));

  // מחשב את מיקום כל נקודה לפי סכום המחיר והסדר הכרונולוגי של המכירות.
  const values = validSales.map((sale) => sale.realizedPrice.amount);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const usableWidth = chartWidth - chartPadding * 2;
  const usableHeight = chartHeight - chartPadding * 2;
  const chartPoints = validSales.map((sale, index) => {
    const x = chartPadding + (usableWidth * index) / (validSales.length - 1);
    const y = chartHeight - chartPadding - ((sale.realizedPrice.amount - min) / range) * usableHeight;
    return { sale, x, y };
  });
  const points = chartPoints.map(({ x, y }) => `${x},${y}`).join(' ');

  return (
    <section className="mb-8 border-t border-slate-200 pt-6" aria-labelledby="price-history-heading">
      <h2 id="price-history-heading" className="mb-2 text-sm font-bold text-slate-800">
        {isRtl ? 'היסטוריית מחירים' : 'Price History'}
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        {isRtl ? 'מחירי מימוש מקוריים במטבע אחיד.' : 'Original realized prices in one currency.'}
      </p>

      <svg
        className="mb-5 w-full rounded-lg border border-slate-100 bg-slate-50 p-2"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label={isRtl ? 'תרשים היסטוריית מחירים' : 'Price history chart'}
      >
        <line x1={chartPadding} y1={chartHeight - chartPadding} x2={chartWidth - chartPadding} y2={chartHeight - chartPadding} stroke="#cbd5e1" />
        <line x1={chartPadding} y1={chartPadding} x2={chartPadding} y2={chartHeight - chartPadding} stroke="#cbd5e1" />
        <polyline fill="none" stroke="#047857" strokeWidth="3" points={points} />
        {chartPoints.map(({ sale, x, y }, index) => {
          const labelY = y < chartPadding + 20 ? y + 22 : y - 12;
          const dateY = chartHeight - chartPadding + 22;
          const textAnchor = index === 0 ? 'start' : index === chartPoints.length - 1 ? 'end' : 'middle';

          return (
            <g key={sale.id}>
              <title>{`${formatDate(sale.saleDate)}: ${formatCurrency(sale.realizedPrice)}`}</title>
              <circle cx={x} cy={y} r="5" fill="#047857" />
              <text x={x} y={labelY} textAnchor={textAnchor} fill="#0f172a" fontSize="13" fontWeight="700">
                {formatCurrency(sale.realizedPrice)}
              </text>
              <text x={x} y={dateY} textAnchor={textAnchor} fill="#475569" fontSize="12">
                {formatDate(sale.saleDate)}
              </text>
            </g>
          );
        })}
      </svg>

      <ul className="space-y-2" aria-label={isRtl ? 'רשומות היסטוריית מחירים' : 'Price history records'}>
        {validSales.map((sale) => (
          <li key={sale.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3 text-sm">
            <span><strong>{sale.saleDate}</strong> · {formatCurrency(sale.realizedPrice)} · {sale.auctionHouse.name}</span>
            <a href={sale.source.url} target="_blank" rel="noopener noreferrer" className="rounded text-xs font-medium text-amber-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2">
              {isRtl ? 'מקור המכירה' : 'Sale source'}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
