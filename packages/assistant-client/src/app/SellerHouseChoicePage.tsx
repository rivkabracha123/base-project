import { useMutation, useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState, PageShell } from '@monabid/ui';
import type { HouseRanking, RankedHouse } from '@monabid/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createSellerLead,
  getS1SellerDraft,
  grantP3ServiceConsent,
  rankHouses,
  rankHousesForLead,
  rankingItemFromS1Draft,
  saveSellerHouseChoice,
} from './api';
import { HouseJourneyCard, JourneyBubble } from './SellerJourneyChrome';

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

  // Show ranking without storing a lead (P3 consent is only required when saving).
  const rankingQuery = useQuery({
    queryKey: ['seller-house-ranking'],
    queryFn: async ({ signal }) => {
      const draft = await getS1SellerDraft(signal);
      const ranking = await rankHouses(signal, rankingItemFromS1Draft(draft));
      return { ranking };
    },
  });

  // S5 Week 4: POST /choice. Internal only — does not email or contact a house.
  const choiceMutation = useMutation({
    mutationFn: async (houseId: string) => {
      const granted = await grantP3ServiceConsent();
      if (!granted) throw new Error('P3 service consent is required');
      const draft = await getS1SellerDraft();
      const item = rankingItemFromS1Draft(draft);
      const leadId = await createSellerLead();
      await rankHousesForLead(leadId, undefined, item);
      return saveSellerHouseChoice(leadId, houseId);
    },
  });

  const ranking = rankingQuery.data?.ranking;
  const options = ranking ? selectableHouses(ranking) : [];
  const houseId = selectedHouseId ?? ranking?.recommendation?.house.id;

  return (
    <div className="min-h-screen bg-[#f6f1e8]">
      <PageShell>
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-800/80">{t('houses.eyebrow')}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">{t('houses.title')}</h1>
          <p className="mb-4 mt-3 text-stone-600">{t('houses.intro')}</p>
          <p className="mb-8 text-sm text-stone-500">{t('houses.internalOnly')}</p>

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
                if (houseId) choiceMutation.mutate(houseId);
              }}
            >
              <JourneyBubble>{t('enquiry.promptHouses')}</JourneyBubble>
              <div className="grid gap-4 sm:grid-cols-2">
                {ranking.recommendation ? (
                  <HouseJourneyCard
                    row={ranking.recommendation}
                    selectedId={houseId}
                    recommended
                    onSelect={setSelectedHouseId}
                  />
                ) : (
                  <p className="text-stone-600">{t('houses.none')}</p>
                )}
                {ranking.alternatives.map((row) => (
                  <HouseJourneyCard
                    key={row.house.id}
                    row={row}
                    selectedId={houseId}
                    onSelect={setSelectedHouseId}
                  />
                ))}
              </div>
              {ranking.alternatives.length === 0 ? (
                <p className="text-sm text-stone-500">{t('houses.noAlternatives')}</p>
              ) : null}

              <p className="text-sm text-stone-500">{t('houses.choiceHint')}</p>
              <button
                type="submit"
                disabled={choiceMutation.isPending || options.length === 0}
                className="w-full rounded-full bg-[#b08948] px-4 py-3 text-sm font-medium text-white hover:bg-[#9a753c] focus:outline-none focus:ring-2 focus:ring-amber-700 disabled:opacity-50"
              >
                {t('houses.saveChoice')}
              </button>
            </form>
          ) : null}

          {choiceMutation.isSuccess ? (
            <p role="status" className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-900">
              {t('houses.saved', { house: choiceMutation.data.houseName })}
            </p>
          ) : null}
          {choiceMutation.isError ? (
            <p role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
              {t('houses.saveError')}
            </p>
          ) : null}
        </div>
      </PageShell>
    </div>
  );
}
