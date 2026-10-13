import type { AuctionLot, ComparableEvidence, Money, ScoredComparable } from '@monabid/shared';
import { formatMoney } from '../format-money';

export interface ComparableSalesLabels {
  includedHeading: string;
  excludedHeading: string;
  excludedNote: string;
  estimate: string;
  realized: string;
  whyIncluded: string;
  whyExcluded: string;
  noImage: string;
  status: Record<AuctionLot['status'], string>;
}

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

function PriceRow({ label, money, locale, emphasize }: { label: string; money: Money; locale: string; emphasize?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className={emphasize ? 'font-serif text-lg font-semibold text-[#b08948]' : 'text-sm text-[#b08948]'}>
        {formatMoney(money, locale)}
      </dd>
    </div>
  );
}

export function ComparableSaleCard({
  comparable,
  locale,
  labels,
}: {
  comparable: ScoredComparable;
  locale: string;
  labels: ComparableSalesLabels;
}) {
  const { lot } = comparable;
  const language = locale.startsWith('he') ? 'he' : 'en';
  const title = lot.title[language] ?? lot.title.en;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[#ead9b8] bg-white shadow-sm">
      <div className="aspect-[4/3] border-b border-[#ead9b8] bg-[#f7f1e6]">
        {lot.imageUrl ? (
          <img src={lot.imageUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-stone-300">
            <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="8" width="40" height="30" rx="2" />
              <circle cx="15" cy="18" r="3.2" />
              <path d="M4 32l11-10 8 7 9-9 12 12" />
            </svg>
            <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">{labels.noImage}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-xs font-semibold text-stone-600">{lot.auctionHouse.name}</p>
        <h3 className="line-clamp-3 font-serif text-base font-semibold leading-snug text-stone-950">{title}</h3>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-400">
          <span className="font-medium text-stone-600">{labels.status[lot.status]}</span>
          <span>&middot;</span>
          <span>{formatDate(lot.saleDate, locale)}</span>
        </div>
        <dl className="flex flex-col gap-1.5 border-t border-[#ead9b8] pt-3">
          {lot.estimate ? (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{labels.estimate}</dt>
              <dd className="text-sm text-stone-600">
                {formatMoney(lot.estimate.low, locale)}&ndash;{formatMoney(lot.estimate.high, locale)}
              </dd>
            </div>
          ) : null}
          {lot.realizedPrice ? <PriceRow label={labels.realized} money={lot.realizedPrice} locale={locale} emphasize /> : null}
        </dl>
        <p className="rounded-lg bg-[#f7f1e6] px-3 py-2 text-xs text-stone-700">
          <span className="font-semibold text-[#b08948]">{labels.whyIncluded}: </span>
          {comparable.matchReason}
        </p>
      </div>
    </article>
  );
}

function ExcludedComparableRow({
  comparable,
  locale,
  labels,
}: {
  comparable: ScoredComparable;
  locale: string;
  labels: ComparableSalesLabels;
}) {
  const { lot } = comparable;

  return (
    <div className="grid gap-3 rounded-xl border border-dashed border-stone-300 bg-[#f7f1e6] p-4 sm:grid-cols-[1.4fr_1fr]">
      <div>
        <h4 className="text-sm font-semibold text-stone-700">{lot.title.en}</h4>
        <p className="mt-1 text-xs text-stone-400">
          {lot.auctionHouse.name} &middot; {formatDate(lot.saleDate, locale)} &middot; {labels.status[lot.status]}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{labels.whyExcluded}</p>
        <p className="mt-1 text-xs text-stone-600">{comparable.exclusionReason ?? comparable.matchReason}</p>
      </div>
    </div>
  );
}

// Renders S3's ComparableEvidence handoff: included lots as evidence cards, excluded lots as a
// visually quieter, separate list with their exclusionReason — never mixed into the evidence grid.
export function ComparableEvidencePanel({
  evidence,
  locale,
  labels,
}: {
  evidence: ComparableEvidence;
  locale: string;
  labels: ComparableSalesLabels;
}) {
  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="mb-4 border-b border-[#ead9b8] pb-3 font-serif text-lg font-semibold text-stone-950">
          {labels.includedHeading}
        </h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
          {evidence.included.map(comparable => (
            <ComparableSaleCard key={comparable.lot.id} comparable={comparable} locale={locale} labels={labels} />
          ))}
        </div>
      </section>
      {evidence.excluded.length > 0 ? (
        <section>
          <h2 className="mb-1 border-b border-[#ead9b8] pb-3 font-serif text-lg font-semibold text-stone-950">
            {labels.excludedHeading}
          </h2>
          <p className="mb-4 mt-2 text-xs text-stone-500">{labels.excludedNote}</p>
          <div className="flex flex-col gap-2.5">
            {evidence.excluded.map(comparable => (
              <ExcludedComparableRow key={comparable.lot.id} comparable={comparable} locale={locale} labels={labels} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
