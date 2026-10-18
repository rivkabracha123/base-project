import { useMutation, useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState, PageShell } from '@monabid/ui';
import { sellerContactFromP3Profile } from '@monabid/shared';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { confirmedItemDraftSchema } from '@monabid/shared';
import { useTranslation } from 'react-i18next';
import {
  completeSellerEnquiry,
  finalHandoffFromS1,
  getAuctionLot,
  getCurrentP3Profile,
  getS1SellerDraft,
  grantP3ServiceConsent,
  rankHouses,
  rankingItemFromS1Draft,
  receiveS1SellerHandoff,
  sellerFinalLeadFixture,
} from './api';
import { HouseRankingPicker, JourneyBubble, selectableHouses } from './SellerJourneyChrome';
import { SellerValuationBoard, SimilarSaleCard } from './SellerValuationBoard';

function hasContact(name: string, email: string, phone: string): boolean {
  return Boolean(name.trim() && (email.trim() || phone.trim()));
}

/**
 * S5 Week 5: review catalog draft, evidence, and valuation before contact,
 * choose an active house, then submit one internal Monabid enquiry.
 * Layout follows the seller-journey video (chat, house cards, catalog, enquiry card).
 */
export function SellerEnquiryPage() {
  const location = useLocation();
  const chatDraft = useMemo(() => {
    const parsed = confirmedItemDraftSchema.safeParse(location.state?.draft);
    return parsed.success ? parsed.data : null;
  }, [location.state]);
  const { i18n, t } = useTranslation();
  const language = i18n.language.startsWith('he') ? 'he' : 'en';
  const [selectedHouseId, setSelectedHouseId] = useState<string>();
  const [preferredName, setPreferredName] = useState(chatDraft ? '' : sellerFinalLeadFixture.request.contact.preferredName);
  const [email, setEmail] = useState(chatDraft ? '' : sellerFinalLeadFixture.request.contact.email ?? '');
  const [phone, setPhone] = useState('');
  const [sellerMessage, setSellerMessage] = useState('');
  const [intakeInput, setIntakeInput] = useState('');
  const [intakeNonce, setIntakeNonce] = useState(0);
  const started = Boolean(intakeInput || chatDraft);

  const profileQuery = useQuery({
    queryKey: ['p3-current-profile'],
    queryFn: ({ signal }) => getCurrentP3Profile(signal),
  });
  const s1DraftQuery = useQuery({
    queryKey: ['s1-seller-draft', intakeInput, intakeNonce, chatDraft],
    enabled: started,
    queryFn: ({ signal, queryKey }) => chatDraft ?? getS1SellerDraft(signal, String(queryKey[1])),
  });
  const rankingItem = useMemo(() => rankingItemFromS1Draft(s1DraftQuery.data), [s1DraftQuery.data]);
  const journeyQuery = useQuery({
    queryKey: ['s1-seller-handoff', intakeInput, intakeNonce, s1DraftQuery.data],
    enabled: started && s1DraftQuery.isFetched && Boolean(s1DraftQuery.data),
    queryFn: ({ signal }) => receiveS1SellerHandoff(s1DraftQuery.data!, signal),
  });
  const rankingQuery = useQuery({
    queryKey: ['seller-enquiry-ranking', rankingItem],
    enabled: started && s1DraftQuery.isFetched && !s1DraftQuery.data,
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

  const ranking = journeyQuery.data?.ranking ?? rankingQuery.data;
  const options = ranking ? selectableHouses(ranking) : [];
  const handoff = finalHandoffFromS1(
    s1DraftQuery.data ?? null,
    journeyQuery.data?.valuation,
    journeyQuery.data?.comparables,
  );
  const catalogDraft = handoff.catalogDraft;
  const item = handoff.item;
  const missingCatalog = !catalogDraft.he.trim() || !catalogDraft.en.trim();
  const valuation = journeyQuery.data?.valuation ?? handoff.valuation;
  const similarSales = valuation.comparables.length
    ? valuation.comparables
    : (journeyQuery.data?.comparables ?? []).map((row) => ({ id: row.id }));
  const showJourney =
    started && !s1DraftQuery.isFetching && !journeyQuery.isFetching && !rankingQuery.isFetching;
  const similarLotIds = similarSales.map((row) => row.id);
  const similarLotsQuery = useQuery({
    queryKey: ['similar-sale-lots', similarLotIds],
    enabled: similarLotIds.length > 0,
    queryFn: async ({ signal }) => {
      const lots = await Promise.all(similarLotIds.map((id) => getAuctionLot(id, signal)));
      return lots.filter((lot): lot is NonNullable<typeof lot> => Boolean(lot));
    },
  });
  const closestSaleId = similarSales[0]?.id;
  const closestLot =
    similarLotsQuery.data?.find((lot) => lot.id === closestSaleId) ?? similarLotsQuery.data?.[0];
  const closestTitle = closestLot ? (closestLot.title[language] ?? closestLot.title.en) : closestSaleId;
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
      const fromP3 = sellerContactFromP3Profile(granted);
      return completeSellerEnquiry({
        houseId,
        handoff,
        contact: {
          preferredName: preferredName.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
        profileId: fromP3.profileId,
        preferredLanguage: rankingItem.preferredLanguage,
        geography: rankingItem.geography,
      });
    },
  });

  const valuationLabel = useMemo(() => {
    if (valuation.status === 'refusal') return t('enquiry.valuationRefusal');
    const range = valuation.valuationRange;
    return range ? t('enquiry.valuationRange', { min: range.min, max: range.max }) : t('enquiry.valuationSupported');
  }, [valuation, t]);

  const estimateShort = useMemo(() => {
    if (valuation.status !== 'supported' || !valuation.valuationRange) return null;
    return `$${valuation.valuationRange.min.toLocaleString()}–$${valuation.valuationRange.max.toLocaleString()}`;
  }, [valuation]);

  return (
    <div className="min-h-screen bg-[#f6f1e8]">
      <PageShell>
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-800/80">{t('enquiry.eyebrow')}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">{t('enquiry.title')}</h1>
          <p className="mb-4 mt-3 text-stone-600">{t('enquiry.intro')}</p>
          <p className="mb-8 text-sm text-stone-500">{t('enquiry.internalOnly')}</p>

          <div className="mb-6 space-y-3">
            <JourneyBubble>{t('enquiry.promptItem')}</JourneyBubble>
          </div>

          <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <label className="block text-sm font-medium text-stone-800" htmlFor="seller-intake-message">
              {t('enquiry.chatLabel')}
            </label>
            <p className="mt-1 text-xs text-stone-500">{t('enquiry.chatHint')}</p>
            <textarea
              id="seller-intake-message"
              className="mt-3 min-h-[6rem] w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
              value={sellerMessage}
              onChange={(event) => setSellerMessage(event.target.value)}
              placeholder={t('enquiry.chatPlaceholder')}
            />
            <button
              type="button"
              className="mt-3 rounded-full bg-[#2b2438] px-4 py-2 text-sm font-medium text-white hover:bg-[#3a314d] focus:outline-none focus:ring-2 focus:ring-amber-700 disabled:opacity-50"
              disabled={!sellerMessage.trim() || s1DraftQuery.isFetching}
              onClick={() => {
                setSelectedHouseId(undefined);
                setIntakeInput(sellerMessage.trim());
                setIntakeNonce((count) => count + 1);
              }}
            >
              {t('enquiry.chatSend')}
            </button>
          </section>

          {started && (s1DraftQuery.isFetching || journeyQuery.isFetching || rankingQuery.isFetching) ? (
            <LoadingState label={t('enquiry.loading')} />
          ) : null}
          {journeyQuery.isError || rankingQuery.isError ? (
            <ErrorState
              title={t('enquiry.error')}
              retryLabel={t('enquiry.retry')}
              onRetry={() => {
                void journeyQuery.refetch();
                void rankingQuery.refetch();
              }}
            />
          ) : null}

          {showJourney ? (
            <form
              className="space-y-6"
              onSubmit={(event) => {
                event.preventDefault();
                if (canSubmit) submitMutation.mutate();
              }}
            >
              <p className="max-w-[90%] rounded-2xl bg-white px-4 py-2 text-sm text-stone-800 shadow-sm">
                {intakeInput}
              </p>

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
                    <p className="mt-2 text-center text-xs uppercase tracking-wide text-stone-500">{item.category}</p>
                    <p className="mt-4 text-center text-sm text-stone-600">{catalogDraft.en}</p>
                    <p className="mt-3 text-center text-sm leading-relaxed text-stone-700" lang="he" dir="rtl">
                      {catalogDraft.he}
                    </p>
                  </>
                )}
              </section>

              <JourneyBubble>{t('enquiry.promptSimilarSales')}</JourneyBubble>
              <p className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800">
                {t('enquiry.similarSalesCountAnswer', {
                  count: similarLotsQuery.data?.length || valuation.comparableCount,
                })}
              </p>
              <section>
                <h2 className="mb-3 text-sm font-semibold text-stone-950">{t('enquiry.evidence')}</h2>
                <SellerValuationBoard
                  valuation={valuation}
                  lots={similarLotsQuery.data ?? []}
                  locale={language === 'he' ? 'he-IL' : 'en-US'}
                />
                {similarSales.length > 0 && (!similarLotsQuery.data || similarLotsQuery.data.length === 0) ? (
                  <ul className="mt-2 list-disc ps-5 text-sm text-stone-600">
                    {similarSales.map((row) => (
                      <li key={row.id}>
                        {row.id}
                        {'saleDate' in row && row.saleDate ? ` · ${row.saleDate}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-2 text-xs text-stone-500">
                  {t('enquiry.reportId')}: <span className="break-all font-mono">{valuation.reportId}</span>
                </p>
                {valuation.excludedComparables.length > 0 ? (
                  <p className="mt-2 text-xs text-stone-500">
                    {t('enquiry.excludedSales', { count: valuation.excludedComparables.length })}
                  </p>
                ) : null}
                <h3 className="mt-4 text-sm font-semibold text-stone-800">{t('enquiry.sellerEvidence')}</h3>
                <ul className="mt-2 list-disc ps-5 text-sm text-stone-600">
                  {handoff.evidence.map((row) => (
                    <li key={row.id}>{row.id}</li>
                  ))}
                </ul>
              </section>

              <JourneyBubble>{t('enquiry.promptClosestComparable')}</JourneyBubble>
              {closestLot ? (
                <div className="max-w-sm">
                  <p className="mb-3 text-sm text-stone-800">
                    {t('enquiry.closestComparableAnswer', { title: closestTitle })}
                  </p>
                  <SimilarSaleCard
                    lot={closestLot}
                    locale={language === 'he' ? 'he-IL' : 'en-US'}
                  />
                </div>
              ) : (
                <p className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800">
                  {closestTitle
                    ? t('enquiry.closestComparableAnswer', { title: closestTitle })
                    : t('enquiry.closestComparableNone')}
                </p>
              )}

              {ranking ? (
                <>
              <JourneyBubble>{t('enquiry.promptHouses')}</JourneyBubble>
              <HouseRankingPicker ranking={ranking} houseId={houseId} onSelect={setSelectedHouseId} />
              {selectedHouse ? (
                <p className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800">
                  {t('enquiry.houseChosen', { house: selectedHouse.house.name })}
                </p>
              ) : null}
                </>
              ) : null}

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
