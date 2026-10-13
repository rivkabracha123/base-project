import { Link, useNavigate } from 'react-router-dom';
import type { HouseRanking } from '@monabid/shared';
import { HouseJourneyCard } from '../app/SellerJourneyChrome';

export function SellerHouseCards({ ranking, category, language }: { ranking: HouseRanking; category?: string; language: 'he' | 'en' }) {
  const navigate = useNavigate();
  const he = language === 'he';
  const houses = [ranking.recommendation, ...ranking.alternatives].filter(entry => entry?.house.active && (!category || entry.house.categories.includes(category)));
  return <div dir={he ? 'rtl' : 'ltr'}>
    {!houses.length && <p role="status">{he ? 'לא נמצאו בתי מכירות מתאימים.' : 'No matching auction houses were found.'}</p>}
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {houses.map(entry => <li key={entry!.house.id} className="min-w-0">
        <HouseJourneyCard row={entry!} recommended={entry === ranking.recommendation}
          onSelect={selectedHouseId => navigate('/seller/houses', { state: { selectedHouseId } })} />
        {entry!.house.id.startsWith('demo-') && <p className="mt-2 text-xs font-semibold text-red-800">{he ? 'נתוני הדגמה בלבד' : 'DEMO data only'}</p>}
      </li>)}
    </ul>
    {houses.length > 0 && <Link to="/seller/houses" className="mt-4 inline-block underline">{he ? 'בחירת בית מכירות' : 'Choose auction house'}</Link>}
  </div>;
}
