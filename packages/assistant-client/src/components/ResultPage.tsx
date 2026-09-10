import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  resultsSearchOutcomeFixture,
  type BuyerSearchOutcomeFixture,
} from '../app/buyer-search-outcome.fixture';
import { ResultCard } from './ResultCard';

interface ResultsPageProps {
  outcome?: BuyerSearchOutcomeFixture;
}

export function ResultsPage({ outcome = resultsSearchOutcomeFixture }: ResultsPageProps) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language.startsWith('he') ? 'he' : 'en';

  if (outcome.kind === 'unmatched') {
    return (
      <div className="mx-auto max-w-3xl p-6" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm" role="status">
          <h1 className="mb-2 text-xl font-bold text-slate-900">
            {lang === 'he' ? 'לא נמצאו התאמות' : 'No matches found'}
          </h1>
          <p className="text-sm text-slate-600">
            {lang === 'he'
              ? 'לא נמצאו פריטים המתאימים לחיפוש שבוצע.'
              : 'No auction items matched this search.'}
          </p>
        </div>
      </div>
    );
  }

  const currentLots = outcome.items.filter((lot) => lot.status !== 'sold');
  const pastSales = outcome.items.filter((lot) => lot.status === 'sold');

  const renderLotGroup = (title: string, lots: typeof outcome.items) => (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-bold text-slate-800">{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lots.map((lot) => (
          <ResultCard key={lot.id} lot={lot} lang={lang} onSelect={(id) => navigate(`/lots/${id}`)} />
        ))}
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-6xl p-6" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <h1 className="mb-4 text-xl font-bold text-slate-900">
        {lang === 'he' ? 'תוצאות מכירות מונאביד' : 'Auction matches'}
      </h1>
      {currentLots.length > 0
        ? renderLotGroup(lang === 'he' ? 'תוצאות נוכחיות' : 'Current results', currentLots)
        : null}
      {pastSales.length > 0
        ? renderLotGroup(lang === 'he' ? 'מכירות עבר' : 'Past sales', pastSales)
        : null}
    </div>
  );
}
