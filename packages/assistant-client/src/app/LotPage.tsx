import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState, PageShell } from '@monabid/ui';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { selectBuyerLot } from '../buyer/buyer-chat-flow';
import { ItemDetail } from '../components/ItemDetail';
import {
  localHistoryDemoLotId,
  localHistoryDemoLots,
  localHistoryDemoSelectedLot,
} from './local-history-demo.fixture';
import { getLotById, getLotSaleHistory } from './api';

/**
 * קורא את מזהה הלוט מהכתובת /lots/:id ומציג את תבנית דף הפריט.
 * במצב רגיל הוא מבקש את הפריט מה-backend; מצב ההדגמה המקומי פעיל רק בדגל מפורש.
 */
export function LotPage() {
  const { i18n, t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const origin = location.state?.returnTo;
  const returnTo = ['/chat/buyer', '/chat/seller', '/results'].includes(origin) ? origin : '/results';
  const language = i18n.language.startsWith('he') ? 'he' : 'en';
  // הדגמת ההיסטוריה מותרת רק עבור עטרת זקנים ורק כשמפעילים את הדגל המקומי במפורש.
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
          onBack={() => navigate(returnTo)}
          backLabel={returnTo.startsWith('/chat/') ? (language === 'he' ? 'חזרה לשיחה' : 'Back to conversation') : undefined}
          onOpenChat={() => { selectBuyerLot(lot); navigate('/chat/buyer'); }}
        />
      ) : null}
    </PageShell>
  );
}
