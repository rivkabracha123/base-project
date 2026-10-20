import type { AuctionLot } from '@monabid/shared';
import { formatMoney } from '@monabid/ui';

export interface BuyerLotCardLabels {
  estimate: string;
  realized: string;
  source: string;
  lot: string;
  matchReasons: string;
  status: Record<AuctionLot['status'], string>;
}

// One reason the search reported for this lot: what part of the request matched (label) and the value sent (detail).
export interface BuyerLotCardReason {
  label: string;
  detail: string;
}

interface BuyerLotCardProps {
  lot: AuctionLot;
  locale: string;
  labels: BuyerLotCardLabels;
  // The lot's category, already worded for the buyer's language.
  categoryLabel: string;
  reasons: BuyerLotCardReason[];
}

// Buyer chat card for a lot found in another category: shows the category up front and why the lot matched.
// Every value comes from the lot or the reported reasons; a missing image, price or reason is simply left out.
export function BuyerLotCard({ lot, locale, labels, categoryLabel, reasons }: BuyerLotCardProps) {
  const language = locale.startsWith('he') ? 'he' : 'en';
  const title = lot.title[language] ?? lot.title.en;
  const description = lot.description[language] ?? lot.description.en;
  const shownReasons = reasons.filter((reason) => reason.label || reason.detail);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
      <header className="flex flex-wrap items-center justify-between gap-2 bg-blue-800 px-4 py-3 text-white">
        <span data-testid="lot-category" className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
          {categoryLabel}
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-900">{labels.status[lot.status]}</span>
      </header>
      {lot.imageUrl ? (
        <img src={lot.imageUrl} alt={title} loading="lazy" className="h-40 w-full bg-slate-100 object-cover" />
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-xs text-slate-500">
          {lot.auctionHouse.name} · {labels.lot} {lot.lotNumber}
        </p>
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        {description ? <p className="line-clamp-3 text-sm text-slate-600">{description}</p> : null}
        {lot.estimate || lot.realizedPrice ? (
          <dl className="grid grid-cols-2 gap-3 border-y border-slate-100 py-3">
            {lot.estimate ? (
              <div>
                <dt className="text-xs font-medium text-slate-500">{labels.estimate}</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {formatMoney(lot.estimate.low, locale)}–{formatMoney(lot.estimate.high, locale)}
                </dd>
              </div>
            ) : null}
            {lot.realizedPrice ? (
              <div>
                <dt className="text-xs font-medium text-slate-500">{labels.realized}</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(lot.realizedPrice, locale)}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {shownReasons.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-slate-500">{labels.matchReasons}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {shownReasons.map((reason, index) => (
                <li key={index} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-900">
                  {reason.label && reason.detail ? `${reason.label}: ${reason.detail}` : reason.label || reason.detail}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <a
          href={lot.source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-auto inline-flex text-sm font-semibold text-blue-800 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {labels.source}
        </a>
      </div>
    </article>
  );
}
