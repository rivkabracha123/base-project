import type { HouseRanking, RankedHouse } from '@monabid/shared';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export const categoryLabels: Record<string, { en: string; he: string }> = {
  rare_books: { en: 'Rare books', he: 'ספרים וכתבי יד נדירים' },
  judaica: { en: 'Judaica', he: 'יודיאיקה' },
  paintings: { en: 'Paintings', he: 'ציורים' },
  rings: { en: 'Rings', he: 'טבעות' },
  jewelry: { en: 'Jewelry', he: 'תכשיטים' },
  watches: { en: 'Watches', he: 'שעונים' },
  furniture: { en: 'Furniture', he: 'רהיטים' },
};

export function selectableHouses(ranking: HouseRanking): RankedHouse[] {
  return [ranking.recommendation, ...ranking.alternatives].filter(
    (row): row is RankedHouse => Boolean(row?.house.active),
  );
}

export function HouseRankingPicker({
  ranking,
  houseId,
  onSelect,
}: {
  ranking: HouseRanking;
  houseId?: string;
  onSelect: (houseId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {ranking.recommendation ? (
          <HouseJourneyCard
            row={ranking.recommendation}
            selectedId={houseId}
            recommended
            onSelect={onSelect}
          />
        ) : (
          <p className="text-stone-600">{t('houses.none')}</p>
        )}
        {ranking.alternatives.map((row) => (
          <HouseJourneyCard
            key={row.house.id}
            row={row}
            selectedId={houseId}
            onSelect={onSelect}
          />
        ))}
      </div>
      {ranking.alternatives.length === 0 ? (
        <p className="text-sm text-stone-500">{t('houses.noAlternatives')}</p>
      ) : null}
    </>
  );
}

export function JourneyBubble({ children }: { children: ReactNode }) {
  return (
    <p className="ms-auto max-w-[90%] rounded-full bg-[#2b2438] px-4 py-2 text-sm text-white">
      {children}
    </p>
  );
}

export function HouseJourneyCard({
  row,
  selectedId,
  recommended = false,
  onSelect,
}: {
  row: RankedHouse;
  selectedId?: string;
  recommended?: boolean;
  onSelect?: (houseId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('he') ? 'he' : 'en';
  const instanceId = useId();
  const inputId = `${instanceId}-journey-house-${row.house.id}`;
  const selected = selectedId === row.house.id;
  const location = row.house.geography
    ? row.house.geography.toLowerCase() === 'israel'
      ? t('houses.locationIsrael')
      : ['united states', 'usa', 'us'].includes(row.house.geography.toLowerCase()) ? t('houses.locationUs') : row.house.geography
    : null;

  return (
    <label
      htmlFor={onSelect ? inputId : undefined}
      className={`relative flex ${onSelect ? 'cursor-pointer' : ''} flex-col rounded-2xl border px-5 py-5 shadow-sm ${
        recommended || selected
          ? 'border-[#c4a574] bg-[#f3ead8]'
          : 'border-stone-200 bg-white'
      }`}
    >
      {onSelect && <input
        id={inputId}
        type="radio"
        name="seller-house"
        value={row.house.id}
        checked={selected}
        onChange={() => onSelect(row.house.id)}
        className="sr-only"
        aria-label={row.house.name}
      />}
      {recommended ? (
        <span className="absolute start-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-[#e6d7b8] text-sm text-amber-900" aria-hidden>
          ★
        </span>
      ) : null}
      <h3 className={`block text-lg font-semibold text-stone-950 ${recommended ? 'ps-8' : ''}`}>
        {row.house.name}
      </h3>
      {location ? <span className="mt-1 text-sm text-stone-500">{location}</span> : null}
      <span className="mt-3 flex flex-wrap gap-2">
        {row.house.categories.map((category) => (
          <span key={category} className="rounded-full bg-[#efe6d4] px-3 py-1 text-xs text-stone-700">
            {categoryLabels[category]?.[lang] ?? category}
          </span>
        ))}
      </span>
      <span className="mt-3 text-sm leading-relaxed text-stone-700">
        <span className="font-medium">{t('houses.reasons')}: </span>
        {row.reasons.join(' ')}
      </span>
    </label>
  );
}
