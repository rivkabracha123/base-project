import { useMutation, useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState, PageShell } from '@monabid/ui';
import type { HouseRanking, RankedHouse } from '@monabid/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createSellerLead, rankHousesForLead, saveSellerHouseChoice } from './api';

/**
 * S5 Week 4 screen: recommended house + alternatives, then save a seller pick.
 * Inactive / excluded houses never appear — the seller can only choose an active ranked house.
 */
function selectableHouses(ranking: HouseRanking): RankedHouse[] {
  return [ranking.recommendation, ...ranking.alternatives].filter(
    (row): row is RankedHouse => Boolean(row?.house.active),
  );
}

export function SellerHouseChoicePage() {
  const { t } = useTranslation();
  // S5: which radio is selected. Undefined means “keep the S5 recommendation”.
  const [selectedHouseId, setSelectedHouseId] = useState<string>();

  // S5 load path: draft internal lead (Week 2), then rank houses for that lead (Week 3).
  const rankingQuery = useQuery({
    queryKey: ['seller-house-ranking'],
    queryFn: async ({ signal }) => {
      const leadId = await createSellerLead(signal);
      const ranking = await rankHousesForLead(leadId, signal);
      return { leadId, ranking };
    },
  });

  // S5 Week 4: POST /choice. Internal only — does not email or contact a house.
  const choiceMutation = useMutation({
    mutationFn: (houseId: string) => {
      const leadId = rankingQuery.data?.leadId;
      if (!leadId) throw new Error('Draft enquiry is not ready');
      return saveSellerHouseChoice(leadId, houseId);
    },
  });

  const ranking = rankingQuery.data?.ranking;
  const options = ranking ? selectableHouses(ranking) : [];

  return (
    <PageShell>
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">{t('houses.eyebrow')}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{t('houses.title')}</h1>
      <p className="mb-4 mt-3 max-w-2xl text-slate-600">{t('houses.intro')}</p>
      {/* S5 durable rule: internal Monabid enquiry only — never auto-contact a house. */}
      <p className="mb-8 max-w-2xl text-sm text-slate-500">{t('houses.internalOnly')}</p>

      {rankingQuery.isPending ? <LoadingState label={t('houses.loading')} /> : null}
      {rankingQuery.isError ? (
        <ErrorState
          title={t('houses.error')}
          retryLabel={t('houses.retry')}
          onRetry={() => void rankingQuery.refetch()}
        />
      ) : null}

      {ranking ? (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            // If they never clicked a radio, S5 saves the recommended house as their choice.
            const houseId = selectedHouseId ?? ranking.recommendation?.house.id;
            if (houseId) choiceMutation.mutate(houseId);
          }}
        >
          <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
            <h2 className="text-lg font-semibold text-slate-950">{t('houses.recommended')}</h2>
            {ranking.recommendation ? (
              <HouseOption
                row={ranking.recommendation}
                selectedId={selectedHouseId ?? ranking.recommendation.house.id}
                onSelect={setSelectedHouseId}
              />
            ) : (
              <p className="mt-2 text-slate-600">{t('houses.none')}</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">{t('houses.alternatives')}</h2>
            {ranking.alternatives.length === 0 ? (
              <p className="mt-2 text-slate-600">{t('houses.noAlternatives')}</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {ranking.alternatives.map((row) => (
                  <li key={row.house.id}>
                    <HouseOption
                      row={row}
                      selectedId={selectedHouseId ?? ranking.recommendation?.house.id}
                      onSelect={setSelectedHouseId}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-sm text-slate-500">{t('houses.choiceHint')}</p>
          <button
            type="submit"
            disabled={choiceMutation.isPending || options.length === 0}
            className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {t('houses.saveChoice')}
          </button>
        </form>
      ) : null}

      {choiceMutation.isSuccess ? (
        <p role="status" className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">
          {t('houses.saved', { house: choiceMutation.data.houseName })}
        </p>
      ) : null}
      {choiceMutation.isError ? (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          {t('houses.saveError')}
        </p>
      ) : null}
    </PageShell>
  );
}

/** S5: one radio — house name plus ranking reasons (why this house was scored). */
function HouseOption({
  row,
  selectedId,
  onSelect,
}: {
  row: RankedHouse;
  selectedId?: string;
  onSelect: (houseId: string) => void;
}) {
  const { t } = useTranslation();
  const inputId = `house-${row.house.id}`;

  return (
    <div className="mt-3">
      <label htmlFor={inputId} className="flex cursor-pointer items-start gap-3">
        <input
          id={inputId}
          type="radio"
          name="seller-house"
          value={row.house.id}
          checked={selectedId === row.house.id}
          onChange={() => onSelect(row.house.id)}
          className="mt-1"
        />
        <span>
          <span className="block font-medium text-slate-950">{row.house.name}</span>
          <span className="mt-1 block text-sm text-slate-600">{t('houses.reasons')}</span>
          <ul className="mt-1 list-disc ps-5 text-sm text-slate-600">
            {row.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </span>
      </label>
    </div>
  );
}
