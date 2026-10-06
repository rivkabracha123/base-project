import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState, ErrorState, LoadingState, PageShell } from '@monabid/ui';
import {
  getStaffOperationLeadDetail,
  getStaffOperationLeads,
  StaffOperationLeadRequestError,
} from '../app/api';
import type { BuyerHardConstraint, StaffBuyerLeadDetail, StaffLead, StaffSellerLeadDetail } from './staff-operations.types';

function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

export function StaffOperationsDashboard() {
  const { t } = useTranslation();
  const [selectedLead, setSelectedLead] = useState<StaffLead | null>(null);
  const query = useQuery({
    queryKey: ['staff-operations-leads'],
    queryFn: ({ signal }) => getStaffOperationLeads(signal),
  });
  const detailQuery = useQuery({
    queryKey: ['staff-operations-lead-detail', selectedLead?.id, selectedLead?.type],
    queryFn: ({ signal }) => getStaffOperationLeadDetail(selectedLead!.id, selectedLead!.type, signal),
    enabled: selectedLead !== null,
  });

  return (
    <PageShell>
      <section aria-labelledby="staff-operations-heading">
        <p className="text-sm font-semibold text-indigo-700">{t('dashboard.synthetic')}</p>
        <h1 id="staff-operations-heading" className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{t('dashboard.title')}</h1>
        <p className="mt-3 text-slate-600">{t('dashboard.intro')}</p>

        <div className="mt-8">
          {query.isPending ? <LoadingState label={t('dashboard.loading')} /> : null}
          {query.isError ? <ErrorState title={t('dashboard.error')} retryLabel={t('dashboard.retry')} onRetry={() => void query.refetch()} /> : null}
          {query.isSuccess && query.data.length === 0 ? <EmptyState title={t('dashboard.empty')} /> : null}
          {query.data?.length ? (
            <ul className="grid gap-4" aria-label={t('dashboard.leads')}>
              {query.data.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-slate-200 bg-white p-5 text-start shadow-sm"
                    onClick={() => setSelectedLead(lead)}
                    aria-pressed={selectedLead?.id === lead.id}
                  >
                    <LeadSummary lead={lead} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {selectedLead && detailQuery.isPending ? <LoadingState label={t('dashboard.loading')} /> : null}
          {detailQuery.isError && isMissingLeadError(detailQuery.error) ? <EmptyState title={t('dashboard.missingLead')} /> : null}
          {detailQuery.isError && !isMissingLeadError(detailQuery.error) ? <ErrorState title={t('dashboard.error')} retryLabel={t('dashboard.retry')} onRetry={() => void detailQuery.refetch()} /> : null}
          {detailQuery.data?.type === 'buyer' ? <BuyerLeadDetail detail={detailQuery.data} /> : null}
          {detailQuery.data?.type === 'seller' ? <SellerLeadDetail detail={detailQuery.data} /> : null}
        </div>
      </section>
    </PageShell>
  );
}

function isMissingLeadError(error: unknown): boolean {
  return error instanceof StaffOperationLeadRequestError && error.status === 404;
}

function LeadSummary({ lead }: { lead: { clientName: string; type: 'buyer' | 'seller'; requestDetails: string; status: string; createdAt: string } }) {
  const { i18n, t } = useTranslation();
  const locale = i18n.language.startsWith('he') ? 'he-IL' : 'en-US';

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-950">{lead.clientName}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
          {lead.type === 'buyer' ? t('dashboard.buyer') : t('dashboard.seller')}
        </span>
      </div>
      <p className="mt-3 text-slate-700">{lead.requestDetails}</p>
      <p className="mt-4 text-sm text-slate-500">
        {t('dashboard.status')}: {lead.status} · {t('dashboard.created')}: {new Date(lead.createdAt).toLocaleString(locale)}
      </p>
    </>
  );
}

function BuyerLeadDetail({ detail }: { detail: StaffBuyerLeadDetail }) {
  const { t } = useTranslation();
  const followUpKey = detail.contact.followUpStatus === 'ready'
    ? 'dashboard.ready'
    : detail.contact.followUpStatus === 'consent_required'
      ? 'dashboard.consentRequired'
      : 'dashboard.contactMissing';

  return (
    <article className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">{t('dashboard.criteria')}</h2>
      <DetailFields fields={detail.criteria} />
      <h3 className="mt-5 font-semibold text-slate-950">{t('dashboard.hardConstraints')}</h3>
      <HardConstraints constraints={detail.hardConstraints} />
      <h3 className="mt-5 font-semibold text-slate-950">{t('dashboard.results')}</h3>
      <ul className="mt-2 space-y-2">
        {detail.results.map((result) => (
          <li key={result.id} className="text-slate-700">
            {result.id} · {t(`dashboard.${result.group}`)}
          </li>
        ))}
      </ul>
      {detail.unmatchedDemand ? (
        <section className="mt-5 text-slate-700">
          <p>{t('dashboard.unmatchedDemand')}: {detail.unmatchedDemand.reason}</p>
          <DetailFields fields={detail.unmatchedDemand.originalCriteria} />
        </section>
      ) : null}
      <h3 className="mt-5 font-semibold text-slate-950">{t('dashboard.contact')}</h3>
      <p className="mt-2 text-slate-700">{t(followUpKey)}</p>
      {detail.contact.followUpStatus === 'ready' ? (
        <div className="mt-2 text-slate-700">
          {detail.contact.email ? <p>{detail.contact.email}</p> : null}
          {detail.contact.phone ? <p>{detail.contact.phone}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

function HardConstraints({ constraints }: { constraints: BuyerHardConstraint[] }) {
  return (
    <ul className="mt-2 space-y-1 text-slate-700">
      {constraints.map((constraint) => (
        <li key={`${constraint.field}-${constraint.operator}`}>
          {constraint.field}: {displayValue(constraint.value)} · {constraint.reason}
        </li>
      ))}
    </ul>
  );
}

function DetailFields({ fields }: { fields: Record<string, unknown> }) {
  return (
    <dl className="mt-2 space-y-1 text-slate-700">
      {Object.entries(fields).map(([key, value]) => (
        <div key={key} className="flex flex-wrap gap-2">
          <dt className="font-medium">{key}:</dt>
          <dd>{displayValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function SellerLeadDetail({ detail }: { detail: StaffSellerLeadDetail }) {
  const { t } = useTranslation();
  const canShowContact = detail.contact.serviceConsentGranted;

  return (
    <article className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">{t('dashboard.sellerItem')}</h2>
      {detail.item ? <DetailFields fields={detail.item} /> : <p className="mt-2 text-slate-700">{t('dashboard.unavailable')}</p>}
      <h3 className="mt-5 font-semibold text-slate-950">{t('dashboard.evidence')}</h3>
      <SimpleItems items={detail.evidence.map(({ id, type }) => `${id} · ${type}`)} />
      <h3 className="mt-5 font-semibold text-slate-950">{t('dashboard.comparables')}</h3>
      <SimpleItems items={detail.comparables.map(({ id, source }) => `${id}${source ? ` · ${source.label}` : ''}`)} />
      <SellerValuation valuation={detail.valuation} />
      {detail.catalogDraft ? (
        <section className="mt-5">
          <h3 className="font-semibold text-slate-950">{t('dashboard.catalogDraft')}</h3>
          <DetailFields fields={detail.catalogDraft} />
        </section>
      ) : null}
      <h3 className="mt-5 font-semibold text-slate-950">{t('dashboard.contact')}</h3>
      <p className="mt-2 text-slate-700">{canShowContact ? t('dashboard.ready') : t('dashboard.consentRequired')}</p>
      {canShowContact ? (
        <div className="mt-2 text-slate-700">
          {detail.contact.email ? <p>{detail.contact.email}</p> : null}
          {detail.contact.phone ? <p>{detail.contact.phone}</p> : null}
        </div>
      ) : null}
      <h3 className="mt-5 font-semibold text-slate-950">{t('dashboard.history')}</h3>
      <SimpleItems items={detail.history.map(({ at, event, actor }) => `${at} · ${event} · ${actor}`)} />
    </article>
  );
}

function SellerValuation({ valuation }: { valuation: StaffSellerLeadDetail['valuation'] }) {
  const { t } = useTranslation();
  if (!valuation) return null;

  if (valuation.status === 'refusal') {
    return (
      <section className="mt-5 text-slate-700">
        <h3 className="font-semibold text-slate-950">{t('dashboard.valuation')}</h3>
        <p>{t('dashboard.refusal')}: {valuation.reason ?? t('dashboard.unavailable')}</p>
      </section>
    );
  }

  const range = valuation.valuationRange;
  return (
    <section className="mt-5 text-slate-700">
      <h3 className="font-semibold text-slate-950">{t('dashboard.valuation')}</h3>
      {range ? <p>{range.min}–{range.max} {range.currency}</p> : <p>{t('dashboard.unavailable')}</p>}
      {valuation.confidence ? <p>{valuation.confidence.level}: {valuation.confidence.explanation}</p> : null}
    </section>
  );
}

function SimpleItems({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 space-y-1 text-slate-700">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}
