import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageShell } from '@monabid/ui';
import { rankHouses } from '../app/api';

export function BuyerHousesPage() {
  const [params] = useSearchParams();
  const { i18n } = useTranslation();
  const he = i18n.language.startsWith('he');
  const category = params.get('category')?.trim() ?? '';
  const query = useQuery({
    queryKey: ['buyer-houses', category, i18n.language],
    enabled: Boolean(category),
    queryFn: ({ signal }) => rankHouses(signal, { category, preferredLanguage: he ? 'he' : 'en' }, false),
  });
  const houses = query.data ? [query.data.recommendation, ...query.data.alternatives]
    .filter(entry => entry?.house.active && entry.house.categories.includes(category)) : [];
  return <PageShell><section className="mx-auto max-w-5xl" dir={he ? 'rtl' : 'ltr'}>
    <h1 className="mb-4 text-xl font-semibold">{he ? 'בתי מכירות מתמחים' : 'Specialist auction houses'}</h1>
    {query.isPending && category && <p role="status">{he ? 'טוען...' : 'Loading...'}</p>}
    {query.isError && <button type="button" onClick={() => void query.refetch()}>{he ? 'נסה שוב' : 'Retry'}</button>}
    {(!category || query.isSuccess && !houses.length) && <p role="status">{he ? 'לא נמצאו בתי מכירות מתאימים.' : 'No matching auction houses were found.'}</p>}
    <ul className="divide-y divide-neutral-200">{houses.map(entry => <li key={entry!.house.id} className="py-4">
      <h2 className="font-semibold">{entry!.house.name}</h2><p className="text-sm">{entry!.house.categories.join(', ')}</p>
    </li>)}</ul>
    <Link className="mt-4 inline-block underline" to="/chat/buyer">{he ? 'חזרה לשיחה' : 'Back to conversation'}</Link>
  </section></PageShell>;
}
