import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState, PageShell } from '@monabid/ui';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ItemDetail } from '../components/ItemDetail';
import { getLotById } from './api';

export function LotPage() {
  const { i18n, t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const language = i18n.language.startsWith('he') ? 'he' : 'en';
  const query = useQuery({
    queryKey: ['lot', id, language],
    queryFn: ({ signal }) => getLotById(id ?? '', language, signal),
    enabled: Boolean(id),
  });
  return (
    <PageShell>
      {query.isPending ? <LoadingState label={t('sample.loading')} /> : null}
      {query.isError ? <ErrorState title={t('sample.error')} retryLabel={t('sample.retry')} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && !query.data ? <EmptyState title={t('sample.empty')} /> : null}
      {query.data ? <ItemDetail lot={query.data} lang={language} onBack={() => navigate('/results')} /> : null}
    </PageShell>
  );
}
