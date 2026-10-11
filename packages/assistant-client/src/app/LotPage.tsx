import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState, PageShell } from '@monabid/ui';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ItemDetail } from '../components/ItemDetail';
import { itemHistoryLotFixtures, upcomingLotWithHistoryFixture } from './local-history-demo.fixture';
import { getLotById } from './api';

const liveBuyerFlowEnabled = import.meta.env.VITE_BUYER_LIVE_FLOW === 'true';

export function LotPage() {
  const { i18n, t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const language = i18n.language.startsWith('he') ? 'he' : 'en';
  const isLocalHistoryDemo = import.meta.env.VITE_LOCAL_HISTORY_DEMO === 'true'
    && id === upcomingLotWithHistoryFixture.id;
  const query = useQuery({
    queryKey: ['lot', id, language],
    queryFn: ({ signal }) => getLotById(id ?? '', language, signal),
    enabled: Boolean(id) && !isLocalHistoryDemo,
  });
  const lot = isLocalHistoryDemo ? upcomingLotWithHistoryFixture : query.data;

  return (
    <PageShell>
      {query.isPending && !isLocalHistoryDemo ? <LoadingState label={t('sample.loading')} /> : null}
      {query.isError ? <ErrorState title={t('sample.error')} retryLabel={t('sample.retry')} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && !lot ? <EmptyState title={t('sample.empty')} /> : null}
      {lot ? (
        <ItemDetail
          lot={lot}
          lang={language}
          historyLots={isLocalHistoryDemo ? itemHistoryLotFixtures : undefined}
          onBack={() => navigate('/results')}
          onOpenChat={
            liveBuyerFlowEnabled
              ? () => navigate(`/chat?selectedLotId=${encodeURIComponent(lot.id)}`)
              : undefined
          }
        />
      ) : null}
    </PageShell>
  );
}
