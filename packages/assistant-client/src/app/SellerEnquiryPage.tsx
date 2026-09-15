import { useMutation, useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState, PageShell } from '@monabid/ui';
import type { HouseRanking, RankedHouse } from '@monabid/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createSellerLead,
  rankHouses,
  rankHousesForLead,
  saveSellerHouseChoice,
  sellerFinalLeadFixture,
  sellerRankingItem,
  submitFinalSellerLead,
} from './api';

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
 */
export function SellerEnquiryPage() {
  const { t, i18n } = useTranslation();
  const catalogLanguage = i18n.language.startsWith('he') ? 'he' : 'en';
  const [selectedHouseId, setSelectedHouseId] = useState<string>();
  const [preferredName, setPreferredName] = useState(sellerFinalLeadFixture.request.contact.preferredName);
  const [email, setEmail] = useState(sellerFinalLeadFixture.request.contact.email ?? '');
  const [phone, setPhone] = useState('');

  const rankingQuery = useQuery({
    queryKey: ['seller-enquiry-ranking'],
    queryFn: ({ signal }) => rankHouses(signal),
  });

  const ranking = rankingQuery.data;
  const options = ranking ? selectableHouses(ranking) : [];
  const catalogDraft = sellerFinalLeadFixture.handoff.catalogDraft;
  const missingCatalog = !catalogDraft.he.trim() || !catalogDraft.en.trim();
  const houseId = selectedHouseId ?? ranking?.recommendation?.house.id;
  const canSubmit = !missingCatalog && Boolean(houseId) && hasContact(preferredName, email, phone);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!houseId) throw new Error('Choose an active house');
      if (!hasContact(preferredName, email, phone)) {
        throw new Error('Lead requires a name and email or phone');
      }
      const leadId = await createSellerLead(undefined, {
        preferredName: preferredName.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      await rankHousesForLead(leadId);
      await saveSellerHouseChoice(leadId, houseId);
      return submitFinalSellerLead(leadId);
    },
  });

  const valuationLabel = useMemo(() => {
    const valuation = sellerFinalLeadFixture.handoff.valuation;
    if (valuation.status === 'refusal') return t('enquiry.valuationRefusal');
    const range = valuation.valuationRange;
    return range ? t('enquiry.valuationRange', { min: range.min, max: range.max }) : t('enquiry.valuationSupported');
  }, [t]);

  return (
    <PageShell>
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">{t('enquiry.eyebrow')}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{t('enquiry.title')}</h1>
      <p className="mb-4 mt-3 max-w-2xl text-slate-600">{t('enquiry.intro')}</p>
      <p className="mb-8 max-w-2xl text-sm text-slate-500">{t('enquiry.internalOnly')}</p>

      {rankingQuery.isPending ? <LoadingState label={t('enquiry.loading')} /> : null}
      {rankingQuery.isError ? (
        <ErrorState
          title={t('enquiry.error')}
          retryLabel={t('enquiry.retry')}
          onRetry={() => void rankingQuery.refetch()}
        />
      ) : null}

      {ranking ? (
        <form
          className="space-y-8"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) submitMutation.mutate();
          }}
        >
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">{t('enquiry.catalog')}</h2>
            {missingCatalog ? (
              <p role="status" className="mt-2 text-slate-600">{t('enquiry.missingCatalog')}</p>
            ) : (
              <p className="mt-2 whitespace-pre-wrap text-slate-700">{catalogDraft[catalogLanguage]}</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">{t('enquiry.evidence')}</h2>
            <ul className="mt-2 list-disc ps-5 text-sm text-slate-600">
              {sellerFinalLeadFixture.handoff.evidence.map((item) => (
                <li key={item.id}>{item.id}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-600">{valuationLabel}</p>
          </section>

          <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
            <h2 className="text-lg font-semibold text-slate-950">{t('houses.recommended')}</h2>
            {ranking.recommendation ? (
              <HouseOption
                row={ranking.recommendation}
                selectedId={houseId}
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
                    <HouseOption row={row} selectedId={houseId} onSelect={setSelectedHouseId} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">{t('enquiry.contact')}</h2>
            <p className="mt-2 text-sm text-slate-500">{t('enquiry.contactHint')}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-700">
                {t('enquiry.name')}
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={preferredName}
                  onChange={(event) => setPreferredName(event.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="block text-sm text-slate-700">
                {t('enquiry.email')}
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  type="email"
                />
              </label>
              <label className="block text-sm text-slate-700 sm:col-span-2">
                {t('enquiry.phone')}
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="tel"
                />
              </label>
            </div>
          </section>

          <button
            type="submit"
            disabled={submitMutation.isPending || !canSubmit || options.length === 0}
            className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {t('enquiry.submit')}
          </button>
        </form>
      ) : null}

      {submitMutation.isSuccess ? (
        <p role="status" className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">
          {t('enquiry.submitted', { house: submitMutation.data.sellerChoice?.houseName ?? '' })}
        </p>
      ) : null}
      {submitMutation.isError ? (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          {t('enquiry.submitError')}
        </p>
      ) : null}
      <p className="sr-only">{sellerRankingItem.category}</p>
    </PageShell>
  );
}

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
  const inputId = `enquiry-house-${row.house.id}`;

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
