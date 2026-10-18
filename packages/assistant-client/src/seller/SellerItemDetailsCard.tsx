import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SellerItemDraft } from '@monabid/shared';
import {
  correctSellerDraftField,
  getCurrentSellerDraft,
  removeSellerPhoto,
  type SellerDraftCorrectionValue,
} from './connect-seller-correction';
import { connectSellerPhotos } from './connect-seller-photos';
import { evidenceUrl } from '../app/api';

type Item = SellerItemDraft['item'];
type EditableField = 'title' | 'category' | 'description' | 'materials' | 'dimensions' | 'condition' | 'marks' | 'signatures' | 'provenance';
type EditValues = Record<EditableField, string>;

const editableFields: EditableField[] = [
  'title', 'category', 'materials', 'dimensions', 'condition', 'marks', 'signatures', 'provenance',
];

function measurementLabel(label: string, language: 'he' | 'en'): string {
  const labels: Record<string, { he: string; en: string }> = {
    width: { he: 'רוחב', en: 'width' },
    height: { he: 'גובה', en: 'height' },
    depth: { he: 'עומק', en: 'depth' },
    'ring size': { he: 'מידת טבעת', en: 'ring size' },
  };
  return labels[label.trim().toLowerCase()]?.[language] ?? label;
}

function dimensionsText(item: Item, language: 'he' | 'en'): string {
  if (item.dimensions.values.length) {
    return item.dimensions.values
      .map(({ label, value, unit }) => `${measurementLabel(label, language)}: ${value} ${unit}`)
      .join('\n');
  }
  if (item.dimensions.widthCm !== undefined && item.dimensions.heightCm !== undefined) {
    return `${measurementLabel('width', language)}: ${item.dimensions.widthCm} cm\n${measurementLabel('height', language)}: ${item.dimensions.heightCm} cm`;
  }
  return '';
}

function valuesForItem(item: Item, language: 'he' | 'en'): EditValues {
  return {
    title: displayTitle(item, language),
    category: item.category,
    description: item.description[language],
    materials: item.materials.join(', '),
    dimensions: dimensionsText(item, language),
    condition: item.condition ?? '',
    marks: item.markings ?? '',
    signatures: item.signatures ?? '',
    provenance: item.provenance ?? '',
  };
}

function displayTitle(item: Item, language: 'he' | 'en'): string {
  if (item.title === 'Rare Hebrew book from seller intake') {
    return language === 'he' ? 'כתב יד או ספר נדיר' : 'Rare Hebrew book';
  }
  if (item.title === 'כתב יד או ספר נדיר') {
    return language === 'he' ? item.title : 'Rare Hebrew book';
  }
  if (item.title === 'Painting from seller intake') {
    return language === 'he' ? 'ציור' : 'Painting';
  }
  if (item.title === 'ציור') return language === 'he' ? item.title : 'Painting';
  return item.titleTranslations?.[language] ?? item.title;
}

function parseDimensions(value: string): { label: string; value: number; unit: string }[] | null {
  if (!value.trim()) return [];
  const measurements = value.split(/\r?\n/).map((line) => {
    const match = line.trim().match(/^([^:]+):\s*(\d+(?:\.\d+)?)\s+(\S+)$/);
    return match ? { label: match[1]!.trim(), value: Number(match[2]), unit: match[3]! } : null;
  });
  return measurements.every((measurement) => measurement !== null) ? measurements : null;
}

function correctionValue(field: EditableField, value: string, language: 'he' | 'en'): SellerDraftCorrectionValue {
  if (field === 'title' || field === 'description') return { [language]: value };
  if (field === 'materials') return value.split(',').map((material) => material.trim()).filter(Boolean);
  if (field === 'dimensions') return parseDimensions(value) ?? [];
  if (field === 'marks') return value;
  return value;
}

export function SellerItemDetailsCard({ item: initialItem, language, evidence = [] }: { item: Item; language: 'he' | 'en'; evidence?: SellerItemDraft['evidence'] }) {
  const { t } = useTranslation();
  const [item, setItem] = useState(initialItem);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState(evidence.filter(entry => entry.type === 'photo'));
  const [photoBusy, setPhotoBusy] = useState(false);

  function applyPhotoDraft(draft: SellerItemDraft) {
    setPhotos(draft.evidence.filter(entry => entry.type === 'photo'));
  }

  async function addPhotos(files: File[]) {
    if (!files.length) return;
    setPhotoBusy(true);
    setError('');
    try {
      if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)) throw new Error('Invalid photo');
      await connectSellerPhotos(files, () => undefined);
      const draft = await getCurrentSellerDraft();
      if (draft) applyPhotoDraft(draft);
    } catch { setError(language === 'he' ? 'לא ניתן להוסיף תמונה. יש לבחור JPG, PNG או WebP עד 10MB.' : 'Could not add photos. Choose JPG, PNG or WebP up to 10MB.'); }
    finally { setPhotoBusy(false); }
  }

  async function removePhoto(id: string) {
    setPhotoBusy(true);
    setError('');
    try { applyPhotoDraft(await removeSellerPhoto(id)); }
    catch { setError(language === 'he' ? 'לא ניתן להסיר את התמונה.' : 'Could not remove the photo.'); }
    finally { setPhotoBusy(false); }
  }
  const [values, setValues] = useState(() => valuesForItem(initialItem, language));
  const [savedValues, setSavedValues] = useState(() => valuesForItem(initialItem, language));
  const displayFields = ([
    ['category', t(`chat.itemEdit.categories.${item.category}`, { defaultValue: item.category })],
    ['materials', item.materials.join(', ')],
    ['dimensions', dimensionsText(item, language)],
    ['condition', item.condition],
    ['marks', item.markings],
    ['signatures', item.signatures],
    ['provenance', item.provenance],
  ] as [EditableField, string | undefined][]).filter(([, value]) => value);

  useEffect(() => {
    const nextValues = valuesForItem(item, language);
    setValues(nextValues);
    setSavedValues(nextValues);
  }, [item, language]);

  async function saveChanges() {
    if (!values.title.trim() || !values.category.trim()) {
      setError(t('chat.itemEdit.required'));
      return;
    }
    if (parseDimensions(values.dimensions) === null) {
      setError(t('chat.itemEdit.invalidDimensions'));
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      let updatedItem = item;
      for (const field of editableFields) {
        if (values[field] === savedValues[field]) continue;
        const draft = await correctSellerDraftField(
          field,
          correctionValue(field, values[field], language),
        );
        updatedItem = draft.item;
        setItem(updatedItem);
        setSavedValues((previous) => ({ ...previous, [field]: values[field] }));
      }
      setValues(valuesForItem(updatedItem, language));
      setIsEditing(false);
    } catch {
      setError(t('chat.itemEdit.saveError'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mt-4 w-full rounded-xl border border-neutral-300 bg-white p-4 text-start text-neutral-900">
      <h2 className="mb-3 text-lg font-semibold">{t('chat.itemEdit.title')}</h2>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold">{displayTitle(item, language)}</h3>
        {!isEditing && (
          <button type="button" className="rounded-lg border border-neutral-400 px-3 py-1 text-sm" onClick={() => setIsEditing(true)}>
            {t('chat.itemEdit.edit')}
          </button>
        )}
      </div>
      <div className="mb-4 space-y-3">
        <ul className="flex flex-wrap gap-3">
          {photos.map(photo => <li key={photo.id}>
            <img src={evidenceUrl(photo.previewUri ?? photo.uri ?? '')} alt={photo.originalName ?? (language === 'he' ? 'תמונת הפריט' : 'Item photo')} className="h-32 w-32 rounded-lg object-contain" />
            {isEditing && <button type="button" disabled={photoBusy || isSaving} onClick={() => void removePhoto(photo.id)} className="mt-1 block text-sm underline">{language === 'he' ? 'הסרת תמונה' : 'Remove photo'}</button>}
          </li>)}
        </ul>
        {isEditing && <label className="block text-sm">
          {language === 'he' ? 'הוספת תמונות' : 'Add photos'}
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={photoBusy || isSaving} onChange={event => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = '';
            void addPhotos(files);
          }} />
        </label>}
      </div>
      {isEditing ? (
        <div className="space-y-3">
          {editableFields.map((field) => (
            <label key={field} className="block text-sm font-medium">
              {t(`chat.itemEdit.fields.${field}`)}
              {field === 'dimensions' ? (
                <textarea
                  className="mt-1 block w-full rounded-lg border border-neutral-300 p-2"
                  rows={3}
                  value={values[field]}
                  onChange={(event) => setValues((previous) => ({ ...previous, [field]: event.target.value }))}
                  placeholder={t('chat.itemEdit.dimensionsHint')}
                />
              ) : (
                <input
                  className="mt-1 block w-full rounded-lg border border-neutral-300 p-2"
                  value={values[field]}
                  onChange={(event) => setValues((previous) => ({ ...previous, [field]: event.target.value }))}
                />
              )}
            </label>
          ))}
          {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={isSaving || photoBusy} className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => void saveChanges()}>
              {isSaving ? t('chat.itemEdit.saving') : t('chat.itemEdit.save')}
            </button>
            <button type="button" disabled={isSaving} className="rounded-lg border border-neutral-400 px-3 py-2 text-sm" onClick={() => {
              setValues(savedValues);
              setError('');
              setIsEditing(false);
            }}>
              {t('chat.itemEdit.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {displayFields.map(([field, value]) => (
            <div key={field}>
              <dt className="font-medium">{t(`chat.itemEdit.fields.${field}`)}</dt>
              <dd className="whitespace-pre-line">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
