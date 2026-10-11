import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState, PageShell } from '@monabid/ui';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ItemDetail } from '../components/ItemDetail';
import {
  localHistoryDemoLotId,
  localHistoryDemoLots,
  localHistoryDemoSelectedLot,
} from './local-history-demo.fixture';
import { getLotById, getLotSaleHistory } from './api';

export function LotPage() {
  const { i18n, t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const language = i18n.language.startsWith('he') ? 'he' : 'en';
  const isLocalHistoryDemo = import.meta.env.VITE_LOCAL_HISTORY_DEMO === 'true'
    && id === localHistoryDemoLotId;
  const query = useQuery({
    queryKey: ['lot', id, language],
    queryFn: ({ signal }) => getLotById(id ?? '', language, signal),
    enabled: Boolean(id) && !isLocalHistoryDemo,
  });
  const lot = isLocalHistoryDemo ? localHistoryDemoSelectedLot : query.data;
  const historyQuery = useQuery({
    queryKey: ['lot-sale-history', lot?.itemKey],
    queryFn: ({ signal }) => getLotSaleHistory(lot?.itemKey ?? '', signal),
    enabled: Boolean(lot?.itemKey) && !isLocalHistoryDemo,
  });
  const historyLots = isLocalHistoryDemo ? localHistoryDemoLots : historyQuery.data;

  return (
    <PageShell>
      {query.isPending && !isLocalHistoryDemo ? <LoadingState label={t('sample.loading')} /> : null}
      {query.isError ? <ErrorState title={t('sample.error')} retryLabel={t('sample.retry')} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && !lot ? <EmptyState title={t('sample.empty')} /> : null}
      {lot ? (
        <ItemDetail
          lot={lot}
          lang={language}
          historyLots={historyLots}
          historyLoading={historyQuery.isPending && !isLocalHistoryDemo}
          historyError={historyQuery.isError}
          onBack={() => navigate('/results')}
        />
      ) : null}
    </PageShell>
  );
}
