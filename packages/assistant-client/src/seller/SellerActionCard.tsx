import { Link, useNavigate } from 'react-router-dom';
import { ResultCard } from '../components/ResultCard';
import type { SellerActionResult } from './seller-action-result';

export function SellerActionCard({ action, language, summary }: { action: SellerActionResult; language: 'he' | 'en'; summary?: string }) {
  const navigate = useNavigate();
  const he = language === 'he';
  if (action.kind === 'catalog') return <article className="rounded-lg border border-stone-300 p-5">
    <h2 className="mb-4 text-lg font-semibold">{he ? 'טיוטת תיאור לקטלוג' : 'Catalog description draft'}</h2>
    <h3 className="mb-3 font-semibold">{action.title}</h3>
    <p className="whitespace-pre-wrap leading-relaxed">{action[language] || (he ? 'טרם נשמר תיאור בשפה זו.' : 'No description is saved in this language yet.')}</p>
  </article>;
  if (action.kind === 'enquiry') return <article className="rounded-lg border border-stone-300 p-5">
    <h2 className="mb-4 text-lg font-semibold">{he ? 'טיוטת פנייה לבית מכירות' : 'Auction-house enquiry draft'}</h2>
    <h3 className="mb-3 font-semibold">{action.ranking.recommendation?.house.name || (he ? 'יש לבחור בית מכירות' : 'Choose an auction house')}</h3>
    <p className="mb-3">{action.draft.item.title}</p>
    <p className="whitespace-pre-wrap leading-relaxed">{action.draft.item.catalogDraft[language]}</p>
    <Link to="/seller/enquiry" state={{ draft: action.draft }} className="mt-4 inline-block rounded-lg bg-[#a58147] px-4 py-2 text-white">
      {he ? 'בדיקה ואישור הפנייה' : 'Review and confirm enquiry'}
    </Link>
    <p className="mt-3 text-sm text-stone-600">{he ? 'הטיוטה לא נשלחה לבית המכירות.' : 'The draft has not been sent to the auction house.'}</p>
  </article>;
  const money = (amount: number) => new Intl.NumberFormat(language, { style: 'currency', currency: action.valuationRange!.currency }).format(amount);
  return <section className="rounded-lg border border-stone-300 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h2 className="text-lg font-semibold">{he ? 'הערכת שווי' : 'Estimated value'}</h2>
      {action.status === 'supported' && action.valuationRange && <p dir="ltr" className="text-2xl font-semibold">{money(action.valuationRange.min)} - {money(action.valuationRange.max)}</p>}
    </div>
    {action.confidence && <p className="mt-3">{he ? 'רמת ביטחון' : 'Confidence'}: {action.confidence.level}</p>}
    {action.lots.some(lot => /demo/i.test(lot.source.provider)) && <p className="mt-3 text-red-800">{he ? 'הדגמה בלבד: מבוסס על נתוני דמה, לא על ראיות שוק מאומתות.' : 'DEMO ONLY: synthetic data, not verified market evidence.'}</p>}
    <p className="my-3">{action.status === 'supported'
      ? he ? `מבוסס על ${action.comparableCount} מכירות השוואה. נדרשת בדיקת מומחה לפריט.` : `Based on ${action.comparableCount} comparable sales. Expert review of the item is required.`
      : summary ?? (he ? 'אין מספיק ראיות להערכת שווי מבוססת. לא יוצג מחיר משוער.' : 'There is insufficient evidence for a reliable valuation. No estimated price is shown.')}</p>
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {action.lots.filter(lot => lot.status === 'sold').map(lot => <li key={lot.id} className="min-w-0">
        <ResultCard lot={lot} lang={language} onSelect={id => navigate(`/lots/${encodeURIComponent(id)}`, { state: { returnTo: '/chat/seller' } })} />
      </li>)}
    </ul>
  </section>;
}
