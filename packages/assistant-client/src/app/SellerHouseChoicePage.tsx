import { useMutation, useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState, PageShell } from '@monabid/ui';
import { useMemo, useState } from 'react';
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
import { HouseRankingPicker, JourneyBubble, selectableHouses } from './SellerJourneyChrome';

export function SellerHouseChoicePage() {
  const { t } = useTranslation();
  // S5: which radio is selected. Undefined means “keep the S5 recommendation”.
  const [selectedHouseId, setSelectedHouseId] = useState<string>();

  // Show ranking without storing a lead (P3 consent is only required when saving).
  const s1DraftQuery = useQuery({
    queryKey: ['s1-seller-draft'],
    queryFn: ({ signal }) => getS1SellerDraft(signal),
  });
  const rankingItem = useMemo(() => rankingItemFromS1Draft(s1DraftQuery.data), [s1DraftQuery.data]);
  const rankingQuery = useQuery({
    queryKey: ['seller-house-ranking', rankingItem],
    enabled: s1DraftQuery.isFetched,
    queryFn: ({ signal }) => rankHouses(signal, rankingItem),
  });

  // S5 Week 4: POST /choice. Internal only — does not email or contact a house.
  const choiceMutation = useMutation({
    mutationFn: async (houseId: string) => {
      const granted = await grantP3ServiceConsent();
      if (!granted) throw new Error('P3 service consent is required');
      const leadId = await createSellerLead();
      await rankHousesForLead(leadId, undefined, rankingItem);
      return saveSellerHouseChoice(leadId, houseId);
    },
  });

      const ranking = rankingQuery.data;
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

          {s1DraftQuery.isPending || rankingQuery.isFetching ? <LoadingState label={t('houses.loading')} /> : null}
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
              <HouseRankingPicker ranking={ranking} houseId={houseId} onSelect={setSelectedHouseId} />

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
