import type { AuctionLot, SellerLeadValuation } from '@monabid/shared';
import { formatMoney } from '@monabid/ui';
import { useTranslation } from 'react-i18next';
import { categoryLabels } from './SellerJourneyChrome';

function saleMonth(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

export function SimilarSaleCard({ lot, locale }: { lot: AuctionLot; locale: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('he') ? 'he' : 'en';
  const title = lot.title[lang] ?? lot.title.en;
  const category = categoryLabels[lot.category]?.[lang] ?? lot.category;
  const moneyLocale = 'en-US';
  const sold = lot.realizedPrice ? formatMoney(lot.realizedPrice, moneyLocale) : null;

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-[#d9cbb3]">
        {lot.imageUrl ? (
          <img src={lot.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[linear-gradient(160deg,#cbb892_0%,#e8dcc4_55%,#b9a57a_100%)]">
            <span className="max-w-[80%] text-center text-xs font-medium text-amber-950/70">{category}</span>
          </div>
        )}
        <span className="absolute right-2 top-2 max-w-[70%] truncate rounded-full bg-black/65 px-2 py-1 text-[10px] text-white">
          {category}
        </span>
        {sold ? (
          <span dir="ltr" className="absolute left-2 top-2 rounded bg-black/55 px-2 py-1 text-[11px] text-white">
            {t('enquiry.soldFor', { price: sold })}
          </span>
        ) : null}
      </div>
      <div className="space-y-2 px-4 py-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-stone-950">{title}</h3>
        <p className="text-xs text-stone-500">{lot.auctionHouse.name}</p>
        {lot.estimate ? (
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-stone-500">{t('card.estimate')}</span>
            <span dir="ltr" className="font-medium text-stone-900">
              {formatMoney(lot.estimate.low, moneyLocale)}–{formatMoney(lot.estimate.high, moneyLocale)}
            </span>
          </div>
        ) : null}
        {lot.realizedPrice ? (
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-stone-500">{t('card.realized')}</span>
            <span dir="ltr" className="font-semibold text-[#b08948]">
              {formatMoney(lot.realizedPrice, moneyLocale)}
            </span>
          </div>
        ) : null}
        <p className="text-xs text-stone-400">{saleMonth(lot.saleDate, locale)}</p>
        <a
          href={lot.source.url}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-xs font-medium text-[#b08948] underline-offset-2 hover:underline"
        >
          {t('enquiry.viewListing')}
        </a>
      </div>
    </article>
  );
}

export function SellerValuationBoard({
  valuation,
  lots,
  locale,
}: {
  valuation: SellerLeadValuation;
  lots: AuctionLot[];
  locale: string;
}) {
  const { t, i18n } = useTranslation();
  const confidence = 'confidence' in valuation ? valuation.confidence : undefined;
  const range = valuation.status === 'supported' ? valuation.valuationRange : undefined;
  const rtl = i18n.language.startsWith('he');

  return (
    <section
      dir={rtl ? 'rtl' : 'ltr'}
      className="rounded-[1.5rem] border border-[#ead9b8] bg-[#f7f1e6] px-5 py-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" dir="ltr">
        <span
          dir={rtl ? 'rtl' : 'ltr'}
          className="inline-flex w-fit items-center gap-1 rounded-full bg-[#efe4cc] px-3 py-1 text-sm text-stone-800"
        >
          {confidence ? (
            <>
              <span>{t('enquiry.confidenceLabel')}:</span>
              <span
                dir="ltr"
                className={
                  confidence.level === 'high'
                    ? 'font-semibold text-[#6f8f71]'
                    : confidence.level === 'medium'
                      ? 'font-semibold text-[#b08948]'
                      : 'font-semibold text-[#c17a6a]'
                }
              >
                {confidence.level}
              </span>
            </>
          ) : (
            t('enquiry.confidenceUnavailable')
          )}
        </span>
        {range ? (
          <p className="text-3xl font-bold tracking-tight text-stone-950">
            ${range.min.toLocaleString()}–${range.max.toLocaleString()}
          </p>
        ) : (
          <p className="text-lg font-semibold text-stone-800">{t('enquiry.valuationRefusal')}</p>
        )}
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-stone-600">
        {range
          ? t('enquiry.valuationSummary', { count: lots.length || valuation.comparableCount })
          : t('enquiry.noSimilarSales')}
      </p>
      <p className="sr-only">{range ? t('enquiry.valuationRange', { min: range.min, max: range.max }) : null}</p>
      {lots.length > 0 ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {lots.map((lot) => (
            <SimilarSaleCard key={lot.id} lot={lot} locale={locale} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
