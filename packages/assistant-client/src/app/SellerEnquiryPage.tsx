import { useMutation, useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState, PageShell } from '@monabid/ui';
import type { HouseRanking, RankedHouse } from '@monabid/shared';
import { sellerContactFromP3Profile } from '@monabid/shared';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createSellerLead,
  finalHandoffFromS1,
  getCurrentP3Profile,
  getS1SellerDraft,
  grantP3ServiceConsent,
  rankHouses,
  rankHousesForLead,
  rankingItemFromS1Draft,
  saveSellerHouseChoice,
  sellerFinalLeadFixture,
  submitFinalSellerLead,
} from './api';
import { HouseJourneyCard, JourneyBubble } from './SellerJourneyChrome';

function selectableHouses(ranking: HouseRanking): RankedHouse[] {
  return [ranking.recommendation, ...ranking.alternatives].filter(
    (row): row is RankedHouse => Boolean(row?.house.active),
  );
}

function hasContact(name: string, email: string, phone: string): boolean {
  return Boolean(name.trim() && (email.trim() || phone.trim()));
}

/**
 * S5 Week 5: review catalog draft, evidence, and valuation before contact,
 * choose an active house, then submit one internal Monabid enquiry.
 * Layout follows the seller-journey video (chat, house cards, catalog, enquiry card).
 */
export function SellerEnquiryPage() {
  const { t } = useTranslation();
  const [selectedHouseId, setSelectedHouseId] = useState<string>();
  const [preferredName, setPreferredName] = useState(sellerFinalLeadFixture.request.contact.preferredName);
  const [email, setEmail] = useState(sellerFinalLeadFixture.request.contact.email ?? '');
  const [phone, setPhone] = useState('');

  const profileQuery = useQuery({
    queryKey: ['p3-current-profile'],
    queryFn: ({ signal }) => getCurrentP3Profile(signal),
  });
  const s1DraftQuery = useQuery({
    queryKey: ['s1-seller-draft'],
    queryFn: ({ signal }) => getS1SellerDraft(signal),
  });
  const rankingItem = useMemo(() => rankingItemFromS1Draft(s1DraftQuery.data), [s1DraftQuery.data]);
  const rankingQuery = useQuery({
    queryKey: ['seller-enquiry-ranking', rankingItem],
    enabled: s1DraftQuery.isFetched,
    queryFn: ({ signal }) => rankHouses(signal, rankingItem),
  });
  const p3Contact = useMemo(
    () => (profileQuery.data ? sellerContactFromP3Profile(profileQuery.data) : null),
    [profileQuery.data],
  );

  useEffect(() => {
    if (!p3Contact) return;
    if (p3Contact.preferredName) setPreferredName(p3Contact.preferredName);
    if (p3Contact.email) setEmail(p3Contact.email);
    if (p3Contact.phone) setPhone(p3Contact.phone);
  }, [p3Contact]);

  const ranking = rankingQuery.data;
  const options = ranking ? selectableHouses(ranking) : [];
  const handoff = finalHandoffFromS1(s1DraftQuery.data ?? null);
  const catalogDraft = handoff.catalogDraft;
  const item = handoff.item;
  const missingCatalog = !catalogDraft.he.trim() || !catalogDraft.en.trim();
  const houseId = selectedHouseId ?? ranking?.recommendation?.house.id;
  const selectedHouse = options.find((row) => row.house.id === houseId);
  const canSubmit = !missingCatalog && Boolean(houseId) && hasContact(preferredName, email, phone);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!houseId) throw new Error('Choose an active house');
      if (!hasContact(preferredName, email, phone)) {
        throw new Error('Lead requires a name and email or phone');
      }
      const granted = await grantP3ServiceConsent();
      if (!granted) throw new Error('P3 service consent is required');
      const leadId = await createSellerLead(
        undefined,
        {
          preferredName: preferredName.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
        granted
          ? { profileId: sellerContactFromP3Profile(granted).profileId, serviceConsent: true }
          : p3Contact
            ? { profileId: p3Contact.profileId, serviceConsent: true }
            : undefined,
      );
      await rankHousesForLead(leadId, undefined, rankingItem);
      await saveSellerHouseChoice(leadId, houseId);
      return submitFinalSellerLead(leadId, handoff);
    },
  });

  const valuationLabel = useMemo(() => {
    const valuation = handoff.valuation;
    if (valuation.status === 'refusal') return t('enquiry.valuationRefusal');
    const range = valuation.valuationRange;
    return range ? t('enquiry.valuationRange', { min: range.min, max: range.max }) : t('enquiry.valuationSupported');
  }, [handoff.valuation, t]);

  const estimateShort = useMemo(() => {
    const valuation = handoff.valuation;
    if (valuation.status !== 'supported' || !valuation.valuationRange) return null;
    return `$${valuation.valuationRange.min.toLocaleString()}–$${valuation.valuationRange.max.toLocaleString()}`;
  }, [handoff.valuation]);

  return (
    <div className="min-h-screen bg-[#f6f1e8]">
      <PageShell>
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-800/80">{t('enquiry.eyebrow')}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">{t('enquiry.title')}</h1>
          <p className="mb-4 mt-3 text-stone-600">{t('enquiry.intro')}</p>
          <p className="mb-8 text-sm text-stone-500">{t('enquiry.internalOnly')}</p>

          {s1DraftQuery.isPending || rankingQuery.isFetching ? <LoadingState label={t('enquiry.loading')} /> : null}
          {rankingQuery.isError ? (
            <ErrorState
              title={t('enquiry.error')}
              retryLabel={t('enquiry.retry')}
              onRetry={() => void rankingQuery.refetch()}
            />
          ) : null}

          {ranking ? (
            <form
              className="space-y-6"
              onSubmit={(event) => {
                event.preventDefault();
                if (canSubmit) submitMutation.mutate();
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

              <JourneyBubble>{t('enquiry.promptCatalog')}</JourneyBubble>
              <section className="rounded-2xl border border-stone-200 bg-white px-6 py-6 shadow-sm">
                <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-stone-400">
                  {t('enquiry.catalog')}
                </p>
                {missingCatalog ? (
                  <p role="status" className="mt-4 text-center text-stone-600">{t('enquiry.missingCatalog')}</p>
                ) : (
                  <>
                    <h2 className="mt-3 text-center text-lg font-semibold leading-snug text-stone-950">{item.title}</h2>
                    {catalogDraft.en !== item.title ? (
                      <p className="mt-4 text-center text-sm text-stone-600">{catalogDraft.en}</p>
                    ) : null}
                    <p className="mt-3 text-center text-sm leading-relaxed text-stone-700" lang="he" dir="rtl">
                      {catalogDraft.he}
                    </p>
                  </>
                )}
              </section>

              <section className="rounded-2xl border border-stone-200 bg-white px-6 py-5 shadow-sm">
                <h2 className="text-sm font-semibold text-stone-950">{t('enquiry.evidence')}</h2>
                <ul className="mt-2 list-disc ps-5 text-sm text-stone-600">
                  {handoff.evidence.map((row) => (
                    <li key={row.id}>{row.id}</li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-stone-600">{valuationLabel}</p>
              </section>

              <JourneyBubble>{t('enquiry.promptSend')}</JourneyBubble>
              <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-stone-500">{t('enquiry.to')}</dt>
                    <dd className="font-semibold text-stone-950">{selectedHouse?.house.name ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-stone-500">{t('enquiry.item')}</dt>
                    <dd className="max-w-[70%] text-end text-stone-800">{item.title}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-stone-500">{t('enquiry.estimate')}</dt>
                    <dd className="text-stone-800">{estimateShort ?? valuationLabel}</dd>
                  </div>
                </dl>
                <div className="mt-4 rounded-xl bg-[#f3ead8] px-4 py-3 text-sm leading-relaxed text-stone-800">
                  {missingCatalog ? t('enquiry.missingCatalog') : `${catalogDraft.en} ${catalogDraft.he}`}
                </div>

                <h3 className="mt-5 text-sm font-semibold text-stone-950">{t('enquiry.contact')}</h3>
                <p className="mt-1 text-xs text-stone-500">{t('enquiry.contactHint')}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm text-stone-700">
                    {t('enquiry.name')}
                    <input
                      className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2"
                      value={preferredName}
                      onChange={(event) => setPreferredName(event.target.value)}
                      autoComplete="name"
                    />
                  </label>
                  <label className="block text-sm text-stone-700">
                    {t('enquiry.email')}
                    <input
                      className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      type="email"
                    />
                  </label>
                  <label className="block text-sm text-stone-700 sm:col-span-2">
                    {t('enquiry.phone')}
                    <input
                      className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      autoComplete="tel"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitMutation.isPending || !canSubmit || options.length === 0}
                  className="mt-5 w-full rounded-full bg-[#b08948] px-4 py-3 text-sm font-medium text-white hover:bg-[#9a753c] focus:outline-none focus:ring-2 focus:ring-amber-700 disabled:opacity-50"
                >
                  {t('enquiry.submit')}
                </button>
                <p className="mt-3 text-center text-xs text-amber-800/80">{t('enquiry.internalOnly')}</p>
              </section>
            </form>
          ) : null}

          {submitMutation.isSuccess ? (
            <p role="status" className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-900">
              {t('enquiry.submitted', { house: submitMutation.data.sellerChoice?.houseName ?? '' })}
            </p>
          ) : null}
          {submitMutation.isError ? (
            <p role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
              {t('enquiry.submitError')}
            </p>
          ) : null}
          <p className="sr-only">{rankingItem.category}</p>
        </div>
      </PageShell>
    </div>
  );
}
