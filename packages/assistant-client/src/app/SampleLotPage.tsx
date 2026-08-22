import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, ItemCard, LoadingState, PageShell, type ItemCardLabels } from '@monabid/ui';
import { useTranslation } from 'react-i18next';
import { getSampleLot } from './api';

export function SampleLotPage() {
  const { i18n, t } = useTranslation();
  const language = i18n.language.startsWith('he') ? 'he' : 'en';
  const query = useQuery({
    queryKey: ['sample-lot', language],
    queryFn: ({ signal }) => getSampleLot(language, signal),
  });
  const labels: ItemCardLabels = {
    estimate: t('card.estimate'),
    realized: t('card.realized'),
    source: t('card.source'),
    sold: t('card.sold'),
    unsold: t('card.unsold'),
    upcoming: t('card.upcoming'),
    withdrawn: t('card.withdrawn'),
    unknown: t('card.unknown'),
  };

  return (
    <PageShell>
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">{t('sample.eyebrow')}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{t('sample.title')}</h1>
      <p className="mb-8 mt-3 max-w-2xl text-slate-600">{t('sample.intro')}</p>

      {query.isPending ? <LoadingState label={t('sample.loading')} /> : null}
      {query.isError ? <ErrorState title={t('sample.error')} retryLabel={t('sample.retry')} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && !query.data ? <EmptyState title={t('sample.empty')} /> : null}
      {query.data ? <ItemCard lot={query.data} locale={language === 'he' ? 'he-IL' : 'en-US'} labels={labels} /> : null}
    </PageShell>
  );
}
