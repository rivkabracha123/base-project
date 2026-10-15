import { Link } from 'react-router-dom';
import type { SellerActionResult } from './seller-action-result';

export function SellerActionCard({ action, language, summary }: { action: SellerActionResult; language: 'he' | 'en'; summary?: string }) {
  const he = language === 'he';
  if (action.kind === 'catalog') return (
    <article className="rounded-[1.5rem] border border-[#eadfd0] bg-white px-8 py-8 text-center shadow-sm">
      <h2 className="sr-only">{he ? 'טיוטת תיאור לקטלוג' : 'Catalog description draft'}</h2>
      <h3 className="text-xl font-semibold leading-snug text-stone-950">{action.title}</h3>
      {action.en ? <p className="mt-4 text-sm leading-relaxed text-stone-500">{action.en}</p> : null}
      {action.he ? <p className="mt-4 text-sm leading-relaxed text-stone-700" lang="he" dir="rtl">{action.he}</p> : null}
      {!action[language] ? <p className="mt-4 text-sm text-stone-600">{he ? 'טרם נשמר תיאור בשפה זו.' : 'No description is saved in this language yet.'}</p> : null}
    </article>
  );
  if (action.kind === 'enquiry') {
    const houseName = action.ranking.recommendation?.house.name || (he ? 'יש לבחור בית מכירות' : 'Choose an auction house');
    return (
      <article className="rounded-[1.5rem] border border-[#eadfd0] bg-white p-5 shadow-sm" dir={he ? 'rtl' : 'ltr'}>
        <h2 className="sr-only">{he ? 'טיוטת פנייה לבית מכירות' : 'Auction-house enquiry draft'}</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">{he ? 'אל' : 'To'}</dt>
            <dd className="font-semibold text-stone-950">{houseName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">{he ? 'פריט' : 'Item'}</dt>
            <dd className="max-w-[70%] text-start font-medium text-stone-800">{action.draft.item.title}</dd>
          </div>
        </dl>
        <div className="mt-4 rounded-xl bg-[#f3ead8] px-4 py-3 text-sm leading-relaxed text-stone-800">
          {action.draft.item.catalogDraft[language]}
        </div>
        <Link to="/seller/enquiry" state={{ draft: action.draft }} className="mt-4 block rounded-full bg-[#b08948] px-4 py-3 text-center text-sm font-medium text-white hover:bg-[#9a753c]">
          {he ? 'שלח פנייה' : 'Send enquiry'}
        </Link>
        <p className="mt-3 text-center text-sm text-[#b08948]">
          {he ? `צפה במכירות הדומות אצל ${houseName}` : `View similar sales at ${houseName}`}
        </p>
        <p className="mt-2 text-center text-xs text-stone-500">{he ? 'הטיוטה לא נשלחה לבית המכירות.' : 'The draft has not been sent to the auction house.'}</p>
      </article>
    );
  }
  const money = (amount: number) => new Intl.NumberFormat(language, { style: 'currency', currency: action.valuationRange!.currency }).format(amount);
  return <section className="rounded-[1.5rem] border border-[#eadfd0] bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h2 className="text-lg font-semibold">{he ? 'הערכת שווי' : 'Estimated value'}</h2>
      {action.status === 'supported' && action.valuationRange && <p dir="ltr" className="text-2xl font-semibold">{money(action.valuationRange.min)} - {money(action.valuationRange.max)}</p>}
    </div>
    {action.confidence && <p className="mt-3">{he ? 'רמת ביטחון' : 'Confidence'}: {action.confidence.level}</p>}
    {action.lots.some(lot => /demo/i.test(lot.source.provider)) && <p className="mt-3 text-red-800">{he ? 'הדגמה בלבד: מבוסס על נתוני דמה, לא על ראיות שוק מאומתות.' : 'DEMO ONLY: synthetic data, not verified market evidence.'}</p>}
    <p className="my-3">{action.status === 'supported'
      ? he ? `מבוסס על ${action.comparableCount} מכירות השוואה. נדרשת בדיקת מומחה לפריט.` : `Based on ${action.comparableCount} comparable sales. Expert review of the item is required.`
      : summary ?? (he ? 'אין מספיק ראיות להערכת שווי מבוססת. לא יוצג מחיר משוער.' : 'There is insufficient evidence for a reliable valuation. No estimated price is shown.')}</p>
  </section>;
}
