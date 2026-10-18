import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ResultCard } from '../components/ResultCard';
import { correctSellerDraftField, type SellerDraftCorrectionValue } from './connect-seller-correction';
import type { SellerComparisonResult } from './seller-comparison-result';

export function SellerComparisonResults({ result, language }: { result: SellerComparisonResult; language: 'he' | 'en' }) {
  const navigate = useNavigate();
  const he = language === 'he';
  const locale = he ? 'he-IL' : 'en-US';
  if (result.mode === 'details') return <SellerItemDetailsCard item={result.item} language={language} />;
  const lots = result.lots.filter((lot) => result.mode === 'search'
    ? lot.status === 'upcoming'
    : lot.status === 'sold');
  const groups = new Map<string, typeof lots>();
  for (const lot of lots) {
    if (lot.status === 'sold' && lot.realizedPrice && lot.realizedPrice.amount > 0) {
      const currency = lot.realizedPrice.currency;
      groups.set(currency, [...(groups.get(currency) ?? []), lot]);
    }
  }
  const money = (amount: number, currency: string) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  return <div className="mt-3 min-w-0 space-y-3">
    <p className="text-sm">{he ? '\u05d4\u05e9\u05d5\u05d5\u05d0\u05d4 \u05dc\u05e4\u05e8\u05d9\u05d8\u05d9\u05dd \u05d3\u05d5\u05de\u05d9\u05dd, \u05dc\u05d0 \u05d4\u05d9\u05e1\u05d8\u05d5\u05e8\u05d9\u05d9\u05ea \u05d4\u05e4\u05e8\u05d9\u05d8 \u05e9\u05dc\u05da \u05d5\u05dc\u05d0 \u05d4\u05e2\u05e8\u05db\u05ea \u05e9\u05d5\u05d5\u05d9.' : 'Similar-item comparison, not your item\'s sale history or a valuation.'}</p>
    <p className="text-xs text-neutral-600">{he ? '\u05e7\u05e8\u05d9\u05d8\u05e8\u05d9\u05d5\u05e0\u05d9\u05dd' : 'Criteria'}: {result.criteria.category}{result.criteria.materials?.length ? ` / ${result.criteria.materials.join(', ')}` : ''}</p>
    {result.mode === 'trend' && lots.some(lot => lot.source.provider === 'synthetic-development-demo') && <strong className="block text-red-800">{he ? '\u05e0\u05ea\u05d5\u05e0\u05d9 \u05d4\u05d3\u05d2\u05de\u05d4 \u05d1\u05dc\u05d1\u05d3' : 'DEMO data only'}</strong>}
    {lots.length === 0 && <p role="status">{he ? '\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d5 \u05ea\u05d5\u05e6\u05d0\u05d5\u05ea \u05de\u05ea\u05d0\u05d9\u05de\u05d5\u05ea.' : 'No matching records were found.'}</p>}
    {result.mode === 'trend' && ![...groups.values()].some((sales) => sales.length >= 2) && <p role="status">{he ? '\u05d0\u05d9\u05df \u05de\u05e1\u05e4\u05d9\u05e7 \u05de\u05db\u05d9\u05e8\u05d5\u05ea \u05d1\u05d0\u05d5\u05ea\u05d5 \u05de\u05d8\u05d1\u05e2 \u05dc\u05d4\u05e6\u05d2\u05ea \u05d2\u05e8\u05e3.' : 'Not enough completed sales in the same currency to draw a chart.'}</p>}
    {result.mode === 'trend' && [...groups].filter(([, sales]) => sales.length >= 2).map(([currency, records]) => {
      const sales = [...records].sort((a, b) => a.saleDate.localeCompare(b.saleDate));
      const maximum = Math.max(...sales.map((lot) => lot.realizedPrice!.amount), 1) * 1.1;
      const dates = sales.map((lot) => Date.parse(lot.saleDate));
      const start = Math.min(...dates), span = Math.max(...dates) - start;
      const x = (index: number) => 100 + (span ? (dates[index]! - start) / span : index / Math.max(sales.length - 1, 1)) * 650;
      const y = (index: number) => 145 - sales[index]!.realizedPrice!.amount / maximum * 125;
      const labels = sales.reduce<number[]>((indices, _, index) => {
        if (index === 0 || index === sales.length - 1 || x(index) - x(indices[indices.length - 1]!) >= 130 && x(sales.length - 1) - x(index) >= 130) indices.push(index);
        return indices;
      }, []);
      return <figure key={currency} className="border border-[#dfd5c5] bg-[#faf5ec] px-2 pt-3 pb-4">
        <div className="overflow-x-auto">
        <svg direction="ltr" role="img" aria-label={`${he ? '\u05de\u05d7\u05d9\u05e8\u05d9 \u05de\u05db\u05d9\u05e8\u05d5\u05ea \u05e9\u05dc \u05e4\u05e8\u05d9\u05d8\u05d9\u05dd \u05d3\u05d5\u05de\u05d9\u05dd' : 'Similar-item sale prices'} (${currency})`} viewBox="0 0 800 195" className="h-auto w-full min-w-[500px]">
          <line x1="100" y1="145" x2="750" y2="145" stroke="#888888" />
          <line x1="100" y1="15" x2="100" y2="145" stroke="#888888" />
          {[0, maximum / 2, maximum].map(value => {
            const axisY = 145 - value / maximum * 125;
            return <g key={value}><line x1="94" y1={axisY} x2="100" y2={axisY} stroke="#888888" />
              <text x="89" y={axisY + 4} textAnchor="end" fill="#888888" fontSize="12">{money(Math.round(value), currency)}</text>
            </g>;
          })}
          <polyline points={sales.map((_, i) => `${x(i)},${y(i)}`).join(' ')} fill="none" stroke="#a58147" strokeWidth="2.5" strokeLinejoin="round" />
          {sales.map((lot, i) => <circle key={lot.id} cx={x(i)} cy={y(i)} r="3.5" fill="#faf5ec" stroke="#a58147" strokeWidth="2"><title>{`${lot.saleDate}: ${money(lot.realizedPrice!.amount, currency)}`}</title></circle>)}
          {labels.map(index => <g key={sales[index]!.id}>
            <line x1={x(index)} y1="145" x2={x(index)} y2="152" stroke="#888888" />
            <text x={x(index)} y="169" textAnchor="middle" fill="#888888" fontSize="12">{sales[index]!.saleDate.slice(0, 7)}</text>
          </g>)}
        </svg>
        </div>
        <figcaption className="px-3 text-center text-xs leading-5 text-neutral-500">{he ? 'מגמת מחירים ממכירות של פריטים דומים — לא מחיר של פריט בודד לאורך זמן.' : 'Prices from sales of similar items, not one item tracked over time.'}</figcaption>
      </figure>;
    })}
    {result.mode !== 'trend' && <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lots.map((lot) => <li key={lot.id} className="min-w-0 space-y-2">
        <ResultCard lot={lot} lang={language} onSelect={(id) => navigate(`/lots/${encodeURIComponent(id)}`, { state: { returnTo: '/chat/seller' } })} />
        {lot.source.provider === 'synthetic-development-demo' && <strong className="block text-sm text-red-800">{he ? 'נתוני הדגמה בלבד' : 'DEMO data only'}</strong>}
      </li>)}
    </ul>}
  </div>;
}

type SellerItemDetails = Extract<SellerComparisonResult, { mode: 'details' }>['item'];
type EditableField = 'title' | 'category' | 'description' | 'materials' | 'dimensions' | 'condition' | 'marks' | 'signatures' | 'provenance';
type EditableValues = Record<EditableField, string>;

const editableFields: EditableField[] = [
  'title', 'category', 'description', 'materials', 'dimensions', 'condition', 'marks', 'signatures', 'provenance',
];

function SellerItemDetailsCard({ item, language }: { item: SellerItemDetails; language: 'he' | 'en' }) {
  const he = language === 'he';
  const { t } = useTranslation();
  const [editedItem, setEditedItem] = useState(item);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editValues, setEditValues] = useState<EditableValues>(() => valuesForItem(item, language));
  const [savedValues, setSavedValues] = useState<EditableValues>(() => valuesForItem(item, language));
  const displayTitle = editedItem.titleTranslations?.[language] ?? editedItem.title;
  const facts = [
    [t('chat.itemEdit.fields.category'), editedItem.category],
    [t('chat.itemEdit.fields.description'), editedItem.description[language]],
    [t('chat.itemEdit.fields.materials'), editedItem.materials.join(', ')],
    [t('chat.itemEdit.fields.dimensions'), dimensionsText(editedItem.dimensions.values)],
    [t('chat.itemEdit.fields.condition'), editedItem.condition],
    [t('chat.itemEdit.fields.marks'), editedItem.markings],
    [t('chat.itemEdit.fields.signatures'), editedItem.signatures],
    [t('chat.itemEdit.fields.provenanceLong'), editedItem.provenance],
  ].filter(([, value]) => value);

  function beginEditing() {
    const currentValues = valuesForItem(editedItem, language);
    setEditValues(currentValues);
    setSavedValues(currentValues);
    setEditError('');
    setIsEditing(true);
  }

  function updateEditValue(field: EditableField, value: string) {
    setEditValues((current) => ({ ...current, [field]: value }));
  }

  async function saveEdits() {
    setEditError('');
    setIsSaving(true);
    let latestItem = editedItem;
    let latestSavedValues = savedValues;
    try {
      for (const field of editableFields) {
        if (editValues[field] === latestSavedValues[field]) continue;
        if ((field === 'title' || field === 'category' || field === 'description') && !editValues[field].trim()) {
          throw new Error('Required item fields cannot be empty');
        }
        const correctedDraft = await correctSellerDraftField(field, correctionValue(field, editValues[field], language));
        latestItem = correctedDraft.item;
        latestSavedValues = { ...latestSavedValues, [field]: editValues[field] };
      }
      setEditedItem(latestItem);
      setSavedValues(latestSavedValues);
      setIsEditing(false);
    } catch (error) {
      setEditedItem(latestItem);
      setSavedValues(latestSavedValues);
      setEditError(error instanceof Error && error.message === 'Invalid dimensions'
        ? t('chat.itemEdit.dimensionsError')
        : t('chat.itemEdit.saveError'));
    } finally {
      setIsSaving(false);
    }
  }

  return <article className="mt-3 w-full max-w-lg overflow-hidden rounded-2xl border border-[#eadfd0] bg-white shadow-[0_1px_2px_rgba(80,60,20,0.06)]" dir={he ? 'rtl' : 'ltr'}>
    <div className="relative aspect-[4/3] bg-[#d9cbb3]">
      <img src="/history-lot.jpg" alt="" className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 top-0 flex justify-end bg-[#1b365d] px-2 py-1.5">
        <span className="rounded-full bg-[#111827] px-2.5 py-0.5 text-[10px] leading-4 text-white">{editedItem.category}</span>
      </div>
      <span className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-center text-xs text-white">{he ? 'תמונת הדגמה זמנית' : 'Temporary demo image'}</span>
    </div>
    <div className="px-4 pb-4 pt-3">
      <h3 className="mb-4 break-words text-center text-base font-semibold text-[#1c1917]">{displayTitle}</h3>
      {!isEditing
        ? <button type="button" className="mb-4 rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-50" onClick={beginEditing}>
            {t('chat.itemEdit.button')}
          </button>
        : <section aria-label={t('chat.itemEdit.title')} className="mb-4 space-y-3">
            {editableFields.map((field) => <label key={field} className="block text-sm font-medium">
              {t(field === 'provenance' ? 'chat.itemEdit.fields.provenanceLong' : `chat.itemEdit.fields.${field}`)}
              {field === 'description' || field === 'dimensions'
                ? <textarea
                    dir={field === 'description' && he ? 'rtl' : field === 'description' ? 'ltr' : undefined}
                    className="mt-1 w-full rounded-md border border-stone-300 p-2"
                    rows={field === 'description' ? 3 : 2}
                    value={editValues[field]}
                    onChange={(event) => updateEditValue(field, event.target.value)}
                    placeholder={field === 'dimensions' ? t('chat.itemEdit.dimensionsHint') : undefined}
                  />
                : <input
                    dir={he ? 'rtl' : 'ltr'}
                    className="mt-1 w-full rounded-md border border-stone-300 p-2"
                    value={editValues[field]}
                    onChange={(event) => updateEditValue(field, event.target.value)}
                    placeholder={field === 'materials' ? t('chat.itemEdit.materialsHint') : undefined}
                  />}
            </label>)}
            {editError && <p role="alert" className="text-sm text-red-800">{editError}</p>}
            <div className="flex gap-2">
              <button type="button" disabled={isSaving || !editValues.title.trim() || !editValues.category.trim() || !editValues.description.trim()} className="rounded-lg bg-[#a58147] px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => void saveEdits()}>
                {isSaving ? t('chat.itemEdit.saving') : t('chat.itemEdit.saveShort')}
              </button>
              <button type="button" disabled={isSaving} className="rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:opacity-50" onClick={() => setIsEditing(false)}>
                {t('chat.itemEdit.cancel')}
              </button>
            </div>
          </section>}
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 border-t border-[#eadfd0] pt-4 text-sm">
        {facts.map(([label, value]) => <div key={label} className="contents"><dt className="font-semibold text-stone-500">{label}</dt><dd className="min-w-0 break-words text-stone-800">{value}</dd></div>)}
      </dl>
    </div>
  </article>;
}

function valuesForItem(item: SellerItemDetails, language: 'he' | 'en'): EditableValues {
  return {
    title: item.titleTranslations?.[language] ?? item.title,
    category: item.category,
    description: item.description[language],
    materials: item.materials.join(', '),
    dimensions: dimensionsText(item.dimensions.values),
    condition: item.condition ?? '',
    marks: item.markings ?? '',
    signatures: item.signatures ?? '',
    provenance: item.provenance ?? '',
  };
}

function dimensionsText(values: Array<{ label: string; value: number; unit: string }>): string {
  return values.map(({ label, value, unit }) => `${label}: ${value} ${unit}`).join('\n');
}

function correctionValue(field: EditableField, value: string, language: 'he' | 'en'): SellerDraftCorrectionValue {
  if (field === 'title' || field === 'description') return { [language]: value.trim() };
  if (field === 'materials') return value.split(',').map((material) => material.trim()).filter(Boolean);
  if (field !== 'dimensions') return value.trim();

  const values = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = /^(.+?)\s*:\s*(\d+(?:\.\d+)?)\s+(.+)$/.exec(line);
    if (!match) throw new Error('Invalid dimensions');
    return { label: match[1]!.trim(), value: Number(match[2]), unit: match[3]!.trim() };
  });
  if (value.trim() && values.length === 0) throw new Error('Invalid dimensions');
  return { values };
}
