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
import { getLotById } from './api';

/**
 * קורא את מזהה הלוט מהכתובת /lots/:id ומציג את תבנית דף הפריט.
 * במצב רגיל הוא מבקש את הפריט מה-backend; מצב ההדגמה המקומי פעיל רק בדגל מפורש.
 */
export function LotPage() {
  const { i18n, t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const language = i18n.language.startsWith('he') ? 'he' : 'en';
  // הדגמת ההיסטוריה מותרת רק עבור עטרת זקנים ורק כשמפעילים את הדגל המקומי במפורש.
  const isLocalHistoryDemo = import.meta.env.VITE_LOCAL_HISTORY_DEMO === 'true'
    && id === localHistoryDemoLotId;
  // React Query מפעיל את getLotById, שיביא את פרטי הלוט מה-backend לפי ה-id שבכתובת.
  const query = useQuery({
    queryKey: ['lot', id, language],
    queryFn: ({ signal }) => getLotById(id ?? '', language, signal),
    enabled: Boolean(id) && !isLocalHistoryDemo,
  });
  // בהדגמה משתמשים בפריט המקומי עם היסטוריה; אחרת משתמשים בתשובת השרת.
  const lot = isLocalHistoryDemo ? localHistoryDemoSelectedLot : query.data;

  return (
    <PageShell>
      {query.isPending && !isLocalHistoryDemo ? <LoadingState label={t('sample.loading')} /> : null}
      {query.isError ? <ErrorState title={t('sample.error')} retryLabel={t('sample.retry')} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && !lot ? <EmptyState title={t('sample.empty')} /> : null}
      {lot ? (
        <ItemDetail
          lot={lot}
          lang={language}
          historyLots={isLocalHistoryDemo ? localHistoryDemoLots : undefined}
          onBack={() => navigate('/results')}
        />
      ) : null}
    </PageShell>
  );
}
