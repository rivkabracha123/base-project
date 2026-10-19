import { useState } from 'react';
import type { SellerActionResult } from './seller-action-result';

export function SellerActionCard({ action, language, summary, onContinue }: {
  action: SellerActionResult;
  language: 'he' | 'en';
  summary?: string;
  onContinue?: (enquiryText: string) => void;
}) {
  const he = language === 'he';
  if (action.kind === 'catalog') return (
    <article className="rounded-[1.5rem] border border-[#eadfd0] bg-white px-8 py-8 text-center shadow-sm">
      <h2 className="sr-only">{he ? 'טיוטת תיאור לקטלוג' : 'Catalog description draft'}</h2>
      <h3 className="text-xl font-semibold leading-snug text-stone-950">{action.title}</h3>
      {action[language]
        ? <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-stone-700" lang={language} dir={he ? 'rtl' : 'ltr'}>{action[language]}</p>
        : <p className="mt-4 text-sm text-stone-600">{he ? 'טרם נשמר תיאור בשפה זו.' : 'No description is saved in this language yet.'}</p>}
      {action.generatedByAi ? <p className="mt-4 text-xs text-stone-500">{he
        ? 'התיאור נכתב בעזרת AI על סמך הפרטים שמסרת. כדאי לעבור עליו לפני שימוש.'
        : 'This description was written with AI from the details you provided. Please review it before use.'}</p> : null}
    </article>
  );
  if (action.kind === 'enquiry') return <SellerEnquiryActionCard action={action} language={language} onContinue={onContinue} />;
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

function SellerEnquiryActionCard({ action, language, onContinue }: {
  action: Extract<SellerActionResult, { kind: 'enquiry' }>;
  language: 'he' | 'en';
  onContinue?: (enquiryText: string) => void;
}) {
  const he = language === 'he';
  const [enquiryText, setEnquiryText] = useState(action.enquiryText);
  const [approved, setApproved] = useState(false);

  return (
    <article className="rounded-[1.5rem] border border-[#eadfd0] bg-white p-5 shadow-sm" dir={he ? 'rtl' : 'ltr'}>
      <h2 className="text-lg font-semibold text-stone-950">{he ? 'טיוטת פנייה לבית מכירות' : 'Auction enquiry draft'}</h2>
      <p className="mt-1 text-sm text-stone-600">{he ? 'אפשר לערוך את הטיוטה לפני שממשיכים. הפנייה תישלח לצוות Monabid בלבד.' : 'Edit the draft before continuing. The enquiry will be sent to the Monabid team only.'}</p>
      {!action.generatedByAi && <p className="mt-2 text-xs text-stone-500">{he ? 'הטיוטה נוסחה על סמך הפרטים שנמסרו.' : 'This draft was prepared from the details provided.'}</p>}
      <label className="mt-5 block text-sm font-medium text-stone-700">
        {he ? 'נוסח הפנייה' : 'Enquiry text'}
        <textarea
          aria-label={he ? 'נוסח הפנייה' : 'Enquiry text'}
          value={enquiryText}
          onChange={(event) => { setEnquiryText(event.target.value); setApproved(false); }}
          rows={8}
          className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-3 text-sm leading-relaxed"
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => setApproved(true)} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700">
          {approved ? (he ? 'הטיוטה אושרה' : 'Draft approved') : (he ? 'אישור טיוטה' : 'Approve draft')}
        </button>
        <button type="button" disabled={!enquiryText.trim()} onClick={() => onContinue?.(enquiryText.trim())} className="rounded-full bg-[#b08948] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {he ? 'המשך להגשת פנייה פנימית למונביד' : 'Continue with internal Monabid enquiry'}
        </button>
      </div>
    </article>
  );
}
