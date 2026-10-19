import type { AuctionLot, SellerLeadValuation } from '@monabid/shared';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ResultCard } from '../components/ResultCard';

export function SimilarSaleCard({ lot }: { lot: AuctionLot; locale?: string }) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language.startsWith('he') ? 'he' : 'en';
  return (
    <ResultCard
      lot={lot}
      lang={lang}
      onSelect={(id) => navigate(`/lots/${encodeURIComponent(id)}`, { state: { returnTo: '/seller/enquiry' } })}
    />
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
      className="px-1 py-2"
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
