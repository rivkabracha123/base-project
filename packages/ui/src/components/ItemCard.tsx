import type { AuctionLot } from '@monabid/shared';
import { Link } from 'react-aria-components';
import { formatMoney } from '../format-money';

export interface ItemCardLabels {
  estimate: string;
  realized: string;
  source: string;
  sold: string;
  unsold: string;
  upcoming: string;
  withdrawn: string;
  unknown: string;
}

export function ItemCard({ lot, locale, labels }: { lot: AuctionLot; locale: string; labels: ItemCardLabels }) {
  const language = locale.startsWith('he') ? 'he' : 'en';
  const title = lot.title[language] ?? lot.title.en;
  const description = lot.description[language] ?? lot.description.en;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <span>{lot.auctionHouse.name} · {lot.lotNumber}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">{labels[lot.status]}</span>
        </div>
        <h2 className="mt-4 text-xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-2 text-slate-600">{description}</p>
        <dl className="mt-6 grid gap-4 border-y border-slate-100 py-4 sm:grid-cols-2">
          {lot.estimate ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{labels.estimate}</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {formatMoney(lot.estimate.low, locale)}–{formatMoney(lot.estimate.high, locale)}
              </dd>
            </div>
          ) : null}
          {lot.realizedPrice ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{labels.realized}</dt>
              <dd className="mt-1 font-medium text-slate-900">{formatMoney(lot.realizedPrice, locale)}</dd>
            </div>
          ) : null}
        </dl>
        <Link href={lot.source.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex text-sm font-semibold text-indigo-700 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {labels.source}
        </Link>
      </div>
    </article>
  );
}
