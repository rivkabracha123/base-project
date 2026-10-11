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

/** Renders B3's already-grouped search result without changing its search outcome. */
export function ResultsPage({ outcome = resultsSearchOutcomeFixture }: ResultsPageProps) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language.startsWith('he') ? 'he' : 'en';
  const isRtl = lang === 'he';

  if (outcome.kind === 'unmatched') {
    return (
      <div className="mx-auto max-w-3xl p-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="rounded-xl border border-[#ead9b8] bg-white p-6 text-center shadow-sm" role="status">
          <h1 className="mb-2 text-xl font-bold text-stone-950">
            {isRtl ? 'לא נמצאו התאמות' : 'No matches found'}
          </h1>
          <p className="text-sm text-stone-600">
            {isRtl ? 'לא נמצאו פריטים המתאימים לחיפוש שבוצע.' : 'No auction items matched this search.'}
          </p>
        </div>
      </div>
    );
  }

  const renderLotGroup = (title: string, entries: typeof outcome.results.current) => (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-bold text-stone-800">{title}</h2>
      <div dir="ltr" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {entries.map((entry) => (
          <ResultCard
            key={entry.lot.id}
            lot={entry.lot}
            lang={lang}
            matchReasons={entry.matchReasons}
            selected={entry.lot.id === outcome.selectedLotId}
            onSelect={(id) => navigate(`/lots/${id}`)}
          />
        ))}
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-7xl p-6" dir={isRtl ? 'rtl' : 'ltr'}>
      <h1 className="mb-4 text-xl font-bold text-stone-950">
        {isRtl ? 'תוצאות מכירות מונאביד' : 'Auction matches'}
      </h1>
      {outcome.approvedRefinements.length > 0 ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          {isRtl
            ? `החיפוש הורחב ללא: ${outcome.approvedRefinements.join(', ')}`
            : `Search was expanded without: ${outcome.approvedRefinements.join(', ')}`}
        </p>
      ) : null}
      {outcome.results.current.length > 0
        ? renderLotGroup(isRtl ? 'מכירות קרובות' : 'Current results', outcome.results.current)
        : null}
      {outcome.results.historical.length > 0
        ? renderLotGroup(isRtl ? 'מכירות עבר' : 'Past sales', outcome.results.historical)
        : null}
    </div>
  );
}
