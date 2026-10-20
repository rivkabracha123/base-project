import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState, ErrorState, LoadingState, PageShell } from '@monabid/ui';
import i18n from '../i18n';
import {
  getStaffOperationLeadDetail,
  getStaffOperationLeads,
  getStaffLeadPipeline,
  StaffOperationLeadRequestError,
  updateStaffLeadPipeline,
} from '../app/api';
import type { BuyerHardConstraint, StaffBuyerLeadDetail, StaffLead, StaffLeadPipeline, StaffPipelineStatus, StaffSellerLeadDetail } from './staff-operations.types';

export const dashboardTermKeys: Record<string, string> = {
  new: 'statusNew', pending: 'statusPending', in_progress: 'statusInProgress', completed: 'statusCompleted',
  draft: 'statusDraft', drafted: 'statusDrafted', reviewing: 'statusReviewing', ranked: 'statusRanked',
  contacted: 'statusContacted', qualified: 'statusQualified', item_found: 'statusItemFound', negotiating: 'statusNegotiating',
  won: 'statusWon', lost: 'statusLost', closed: 'statusClosed', chose_house: 'statusChoseHouse', submitted: 'statusSubmitted', supported: 'valuationSupported',
  refusal: 'valuationRefusal', no_results: 'noResults', current: 'current', historical: 'historical',
  image: 'evidenceImage', provenance: 'evidenceProvenance', seller_statement: 'evidenceSellerStatement',
  system: 'actorSystem', seller: 'actorSeller', low: 'confidenceLow', category: 'fieldCategory',
  format: 'fieldFormat', title: 'fieldTitle', id: 'fieldId', evidenceIds: 'fieldEvidenceIds',
  'budget.max': 'fieldBudgetMax', max: 'fieldMax', currency: 'fieldCurrency', original: 'formatOriginal',
  lte: 'operatorAtMost', equals: 'operatorEquals', rare_hebrew_manuscript: 'categoryRareHebrewManuscript',
  judaica: 'categoryJudaica', manuscripts: 'categoryManuscripts', paintings: 'categoryPaintings', rare_books: 'categoryRareBooks',
  'buyer budget': 'reasonBuyerBudget', 'buyer request': 'reasonBuyerRequest',
  'Source unavailable': 'sourceUnavailable', 'public sale record': 'sourcePublicSaleRecord',
  insufficient_comparables: 'insufficientComparables',
};

const hebrewTerms: Record<string, string> = {
  new: 'חדשה', pending: 'ממתינה לטיפול', in_progress: 'בטיפול', completed: 'הושלמה',
  draft: 'טיוטה', drafted: 'טיוטה נוצרה', reviewing: 'בבדיקה', ranked: 'דורגה',
  chose_house: 'נבחר בית מכירות', submitted: 'נשלחה', supported: 'נתמכת בראיות',
  refusal: 'נדרשת בדיקה מקצועית', no_results: 'לא נמצאו תוצאות מתאימות',
  current: 'עדכני', historical: 'היסטורי', image: 'תמונה', provenance: 'מסמך מקור',
  seller_statement: 'הצהרת מוכר/ת', system: 'המערכת', seller: 'המוכר/ת', low: 'נמוכה',
  category: 'קטגוריה', format: 'סוג פריט', title: 'כותרת', id: 'מזהה',
  evidenceIds: 'ראיות מצורפות', 'budget.max': 'תקציב מרבי', max: 'מקסימום',
  currency: 'מטבע', original: 'מקורי', lte: 'עד', equals: 'שווה ל',
  USD: '$', EUR: '€', ILS: '₪',
  rare_hebrew_manuscript: 'כתב יד עברי נדיר', 'buyer budget': 'תקציב הקונה',
  'buyer request': 'בקשת הקונה',
  he: 'עברית', en: 'אנגלית', 'Source unavailable': 'מקור לא זמין',
  'public sale record': 'רישום מכירה פומבית', insufficient_comparables: 'אין מספיק מכירות להשוואה',
};

export function displayTerm(value: string, language: string): string {
  const translationKey = dashboardTermKeys[value];
  if (translationKey) return i18n.t(`dashboard.terms.${translationKey}`);
  if (!language.startsWith('he')) return value.replaceAll('_', ' ');
  return hebrewTerms[value] ?? value.replaceAll('_', ' ');
}

function replaceCurrencyCodes(text: string): string {
  return text
    .replace(/\bUSD\b/g, '$')
    .replace(/\bEUR\b/g, '€')
    .replace(/\bILS\b/g, '₪');
}

function displayLeadText(value: string, language: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!language.startsWith('he')) return replaceCurrencyCodes(value);

  const demoTextKeys: Record<string, string> = {
    'Synthetic Buyer': 'dashboard.syntheticBuyer',
    'Synthetic Seller': 'dashboard.syntheticSeller',
    'Anonymous Buyer': 'dashboard.anonymousBuyer',
    'Anonymous Demand': 'dashboard.anonymousDemand',
  };
  const demoKey = demoTextKeys[value];
  if (demoKey) return t(demoKey);

  const rareManuscriptRequest = /^Rare Hebrew manuscript, maximum budget (\d+) USD\.$/.exec(value);
  if (rareManuscriptRequest) {
    return t('dashboard.demoRareManuscriptRequest', {
      amount: formatMoney(Number(rareManuscriptRequest[1]), 'USD', language),
    });
  }

  if (value === 'Original manuscript request with no matching result.') {
    return t('dashboard.demoNoMatchRequest');
  }

  return replaceCurrencyCodes(value);
}

const localizedDemoLeadKeys: Record<string, string> = {
  'lead-1': 'lead1',
  'lead-2': 'lead2',
  'lead-3': 'lead3',
  'lead-4': 'lead4',
};

function displayLeadField(lead: StaffLead, field: 'name' | 'summary', language: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  const demoLeadKey = localizedDemoLeadKeys[lead.id];
  if (demoLeadKey) return t(`dashboard.demoLeads.${demoLeadKey}.${field}`);
  const value = field === 'name' ? lead.clientName : lead.requestDetails;
  return displayLeadText(value, language, t);
}

function displayValue(value: unknown, language: string): string {
  if (Array.isArray(value)) return value.map((item) => displayValue(item, language)).join(', ');
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${displayTerm(key, language)}: ${displayValue(item, language)}`)
      .join(', ');
  }
  return typeof value === 'string' ? replaceCurrencyCodes(displayTerm(value, language)) : String(value);
}

function formatMoney(amount: number, currency: string, language: string): string {
  const locale = language.startsWith('he') ? 'he-IL' : 'en-US';
  const symbol = { USD: '$', EUR: '€', ILS: '₪' }[currency] ?? currency;
  const formattedAmount = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount);
  return language.startsWith('he') ? `${formattedAmount} ${symbol}` : `${symbol}${formattedAmount}`;
}

export function StaffOperationsDashboard() {
  const { i18n, t } = useTranslation();
  const [selectedLead, setSelectedLead] = useState<StaffLead | null>(null);
  const [filters, setFilters] = useState<LeadFilters>(emptyLeadFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = useQuery({ queryKey: ['staff-operations-leads'], queryFn: ({ signal }) => getStaffOperationLeads(signal) });
  const filteredLeads = query.data?.filter((lead) => leadMatchesFilters(lead, filters)) ?? [];
  const visibleSelectedLead = selectedLead && filteredLeads.some((lead) => lead.id === selectedLead.id) ? selectedLead : null;

  useEffect(() => {
    if (selectedLead && !visibleSelectedLead) setSelectedLead(null);
  }, [selectedLead, visibleSelectedLead]);

  const detailQuery = useQuery({
    queryKey: ['staff-operations-lead-detail', visibleSelectedLead?.id, visibleSelectedLead?.type],
    queryFn: ({ signal }) => getStaffOperationLeadDetail(visibleSelectedLead!.id, visibleSelectedLead!.type, signal),
    enabled: visibleSelectedLead !== null,
  });

  return (
    <PageShell>
      <section aria-labelledby="staff-operations-heading">
        <p className="text-sm font-semibold text-[#b08948]">{t('dashboard.synthetic')}</p>
        <h1 id="staff-operations-heading" className="mt-2 text-3xl font-bold tracking-tight text-stone-950">{t('dashboard.title')}</h1>
        <p className="mt-3 text-stone-600">{t('dashboard.intro')}</p>
        <div className="mt-8">
          {query.isPending ? <LoadingState label={t('dashboard.loading')} /> : null}
          {query.isError ? <ErrorState title={t('dashboard.error')} retryLabel={t('dashboard.retry')} onRetry={() => void query.refetch()} /> : null}
          {query.isSuccess && query.data.length === 0 ? <EmptyState title={t('dashboard.empty')} /> : null}
          {query.data?.length ? <>
            <button type="button" className="mb-4 rounded-lg border border-[#ead9b8] bg-white px-4 py-2 font-semibold text-stone-800 shadow-sm" aria-expanded={filtersOpen} aria-controls="lead-filters" onClick={() => setFiltersOpen((isOpen) => !isOpen)}>
              {t('dashboard.filters')}
            </button>
            {filtersOpen ? <LeadFiltersForm leads={query.data} filters={filters} language={i18n.language} onChange={setFilters} onClear={() => setFilters(emptyLeadFilters)} /> : null}
            {filteredLeads.length === 0 ? <EmptyState title={t('dashboard.filteredEmpty')} /> : <ul className="grid gap-4" aria-label={t('dashboard.leads')}>{filteredLeads.map((lead) => {
              const isSelected = visibleSelectedLead?.id === lead.id;
              return <li key={lead.id}>
                <button type="button" className={`w-full border border-[#ead9b8] bg-white p-5 text-start shadow-sm ${isSelected ? 'rounded-t-xl rounded-b-none border-b-0' : 'rounded-xl'}`} onClick={() => setSelectedLead((current) => current?.id === lead.id ? null : lead)} aria-pressed={isSelected} aria-expanded={isSelected} aria-controls={isSelected ? `lead-detail-${lead.id}` : undefined}>
                  <LeadSummary lead={lead} />
                </button>
                {isSelected ? <div id={`lead-detail-${lead.id}`}>
                  {detailQuery.isPending ? <LoadingState label={t('dashboard.loading')} /> : null}
                  {detailQuery.isError && isMissingLeadError(detailQuery.error) ? <EmptyState title={t('dashboard.missingLead')} /> : null}
                  {detailQuery.isError && !isMissingLeadError(detailQuery.error) ? <ErrorState title={t('dashboard.error')} retryLabel={t('dashboard.retry')} onRetry={() => void detailQuery.refetch()} /> : null}
                  {detailQuery.data?.type === 'buyer' ? <BuyerLeadDetail detail={detailQuery.data} embedded /> : null}
                  {detailQuery.data?.type === 'seller' ? <SellerLeadDetail detail={detailQuery.data} embedded /> : null}
                  {detailQuery.data ? <StaffPipelinePanel leadId={lead.id} /> : null}
                </div> : null}
              </li>;
            })}</ul>}
          </> : null}
        </div>
      </section>
    </PageShell>
  );
}

const pipelineNextStatuses: Record<StaffPipelineStatus, StaffPipelineStatus[]> = {
  new: ['reviewing'], reviewing: ['contacted'], contacted: ['qualified'], qualified: ['item_found'],
  item_found: ['negotiating'], negotiating: ['won', 'lost', 'closed'], won: [], lost: [], closed: [],
};

function StaffPipelinePanel({ leadId }: { leadId: string }) {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const pipelineQuery = useQuery({ queryKey: ['staff-lead-pipeline', leadId], queryFn: ({ signal }) => getStaffLeadPipeline(leadId, signal) });
  const updateMutation = useMutation({
    mutationFn: (update: Parameters<typeof updateStaffLeadPipeline>[1]) => updateStaffLeadPipeline(leadId, update),
    onSuccess: (pipeline) => {
      queryClient.setQueryData(['staff-lead-pipeline', leadId], pipeline);
      void queryClient.invalidateQueries({ queryKey: ['staff-operations-leads'] });
      void queryClient.invalidateQueries({ queryKey: ['staff-operations-lead-detail', leadId] });
    },
  });
  const [nextStatus, setNextStatus] = useState<StaffPipelineStatus | ''>('');
  const [nextAction, setNextAction] = useState('');
  const [saveNotice, setSaveNotice] = useState('');

  useEffect(() => {
    setNextAction(pipelineQuery.data?.nextAction ?? '');
  }, [leadId, pipelineQuery.data?.nextAction]);

  if (pipelineQuery.isPending) return <LoadingState label={t('dashboard.loading')} />;
  if (pipelineQuery.isError || !pipelineQuery.data) return <ErrorState title={t('dashboard.pipelineError')} retryLabel={t('dashboard.retry')} onRetry={() => void pipelineQuery.refetch()} />;

  const pipeline = pipelineQuery.data;
  const availableStatuses = pipelineNextStatuses[pipeline.status];
  const locale = i18n.language.startsWith('he') ? 'he-IL' : 'en-US';
  const saveNextAction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateMutation.mutate({ nextAction }, { onSuccess: () => setSaveNotice(t('dashboard.pipelineSaved')) });
  };
  const saveNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note = new FormData(event.currentTarget).get('note');
    if (typeof note === 'string' && note.trim()) {
      updateMutation.mutate({ note }, { onSuccess: () => setSaveNotice(t('dashboard.pipelineSaved')) });
    }
    event.currentTarget.reset();
  };

  return <article className="mt-4 rounded-xl border border-[#ead9b8] bg-white p-5 shadow-sm">
    <h2 className="text-xl font-semibold text-stone-950">{t('dashboard.pipeline')}</h2>
    <p className="mt-2 text-stone-700">{t('dashboard.status')}: {displayTerm(pipeline.status, i18n.language)}</p>
    <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => {
      event.preventDefault();
      if (nextStatus) updateMutation.mutate({ status: nextStatus }, {
        onSuccess: () => {
          setNextStatus('');
          setSaveNotice(t('dashboard.pipelineSaved'));
        },
      });
    }}>
      <label className="grid gap-1 text-sm font-medium text-stone-700" htmlFor="pipeline-status">{t('dashboard.updateStatus')}
        <select id="pipeline-status" className="rounded border border-[#ead9b8] bg-white p-2 font-normal" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as StaffPipelineStatus | '')}>
          <option value="">{t('dashboard.chooseStatus')}</option>
          {availableStatuses.map((status) => <option key={status} value={status}>{displayTerm(status, i18n.language)}</option>)}
        </select>
      </label>
      <button type="submit" className="rounded-full bg-[#2b2438] px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={!nextStatus || updateMutation.isPending}>{t('dashboard.saveStatus')}</button>
    </form>
    <form className="mt-5 grid gap-2" onSubmit={saveNextAction}>
      <label className="text-sm font-medium text-stone-700" htmlFor="pipeline-next-action">{t('dashboard.nextAction')}</label>
      <input id="pipeline-next-action" name="nextAction" className="rounded border border-[#ead9b8] p-2" value={nextAction} onChange={(event) => setNextAction(event.target.value)} maxLength={280} />
      <button type="submit" className="justify-self-start rounded border border-[#ead9b8] px-4 py-2 font-semibold text-stone-800" disabled={updateMutation.isPending}>{t('dashboard.saveNextAction')}</button>
    </form>
    <form className="mt-5 grid gap-2" onSubmit={saveNote}>
      <label className="text-sm font-medium text-stone-700" htmlFor="pipeline-note">{t('dashboard.activityNote')}</label>
      <textarea id="pipeline-note" name="note" className="rounded border border-[#ead9b8] p-2" maxLength={500} rows={3} />
      <button type="submit" className="justify-self-start rounded border border-[#ead9b8] px-4 py-2 font-semibold text-stone-800" disabled={updateMutation.isPending}>{t('dashboard.saveNote')}</button>
    </form>
    <h3 className="mt-5 font-semibold text-stone-950">{t('dashboard.statusHistory')}</h3>
    <ul className="mt-2 space-y-1 text-stone-700">{pipeline.statusHistory.map((entry) => <li key={`${entry.at}-${entry.to}`}>{new Date(entry.at).toLocaleString(locale)} · {entry.from ? `${displayTerm(entry.from, i18n.language)} → ` : ''}{displayTerm(entry.to, i18n.language)}</li>)}</ul>
    <h3 className="mt-5 font-semibold text-stone-950">{t('dashboard.activityNotes')}</h3>
    {pipeline.activityNotes.length ? <ul className="mt-2 space-y-1 text-stone-700">{pipeline.activityNotes.map((note) => <li key={`${note.at}-${note.text}`}>{new Date(note.at).toLocaleString(locale)} · {note.text}</li>)}</ul> : <p className="mt-2 text-stone-600">{t('dashboard.noActivityNotes')}</p>}
    {saveNotice ? <p className="mt-3 text-sm text-emerald-700" role="status">{saveNotice}</p> : null}
    {updateMutation.isError ? <p className="mt-3 text-sm text-red-700" role="alert">{t('dashboard.pipelineError')}</p> : null}
  </article>;
}

type LeadFilters = {
  type: '' | StaffLead['type'];
  status: string;
  category: string;
  from: string;
  to: string;
};

const emptyLeadFilters: LeadFilters = { type: '', status: '', category: '', from: '', to: '' };

function leadMatchesFilters(lead: StaffLead, filters: LeadFilters): boolean {
  const date = lead.createdAt.slice(0, 10);
  return (!filters.type || lead.type === filters.type)
    && (!filters.status || lead.status === filters.status)
    && (!filters.category || lead.category === filters.category)
    && (!filters.from || date >= filters.from)
    && (!filters.to || date <= filters.to);
}

function LeadFiltersForm({ leads, filters, language, onChange, onClear }: {
  leads: StaffLead[];
  filters: LeadFilters;
  language: string;
  onChange: (filters: LeadFilters) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const statuses = [...new Set(leads.map((lead) => lead.status))];
  const categories = [...new Set(leads.flatMap((lead) => lead.category ? [lead.category] : []))];
  const update = <Key extends keyof LeadFilters>(key: Key, value: LeadFilters[Key]) => onChange({ ...filters, [key]: value });

  return <fieldset id="lead-filters" className="mb-6 grid gap-4 rounded-xl border border-[#ead9b8] bg-white p-5 sm:grid-cols-2 lg:grid-cols-5">
    <legend className="px-1 font-semibold text-stone-950">{t('dashboard.filters')}</legend>
    <button type="button" className="justify-self-start rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-800 shadow-sm" onClick={onClear}>
      {t('dashboard.clearFilters')}
    </button>
    <label className="grid gap-1 text-sm font-medium text-stone-700" htmlFor="lead-type-filter">{t('dashboard.filterLeadType')}
      <select id="lead-type-filter" className="rounded border border-[#ead9b8] bg-white p-2 font-normal" value={filters.type} onChange={(event) => update('type', event.target.value as LeadFilters['type'])}>
        <option value="">{t('dashboard.allLeadTypes')}</option>
        <option value="buyer">{t('dashboard.buyerLead')}</option>
        <option value="seller">{t('dashboard.sellerLead')}</option>
      </select>
    </label>
    <label className="grid gap-1 text-sm font-medium text-stone-700" htmlFor="lead-status-filter">{t('dashboard.filterStatus')}
      <select id="lead-status-filter" className="rounded border border-[#ead9b8] bg-white p-2 font-normal" value={filters.status} onChange={(event) => update('status', event.target.value)}>
        <option value="">{t('dashboard.allStatuses')}</option>
        {statuses.map((status) => <option key={status} value={status}>{displayTerm(status, language)}</option>)}
      </select>
    </label>
    <label className="grid gap-1 text-sm font-medium text-stone-700" htmlFor="lead-category-filter">{t('dashboard.filterCategory')}
      <select id="lead-category-filter" className="rounded border border-[#ead9b8] bg-white p-2 font-normal" value={filters.category} onChange={(event) => update('category', event.target.value)}>
        <option value="">{t('dashboard.allCategories')}</option>
        {categories.map((category) => <option key={category} value={category}>{displayTerm(category, language)}</option>)}
      </select>
    </label>
    <label className="grid gap-1 text-sm font-medium text-stone-700" htmlFor="lead-from-date-filter">{t('dashboard.filterFromDate')}
      <input id="lead-from-date-filter" className="rounded border border-[#ead9b8] bg-white p-2 font-normal" type="date" value={filters.from} onChange={(event) => update('from', event.target.value)} />
    </label>
    <label className="grid gap-1 text-sm font-medium text-stone-700" htmlFor="lead-to-date-filter">{t('dashboard.filterToDate')}
      <input id="lead-to-date-filter" className="rounded border border-[#ead9b8] bg-white p-2 font-normal" type="date" value={filters.to} onChange={(event) => update('to', event.target.value)} />
    </label>
  </fieldset>;
}

function isMissingLeadError(error: unknown): boolean { return error instanceof StaffOperationLeadRequestError && error.status === 404; }

function LeadSummary({ lead }: { lead: StaffLead }) {
  const { i18n, t } = useTranslation();
  const locale = i18n.language.startsWith('he') ? 'he-IL' : 'en-US';
  const leadTitle = lead.type === 'buyer' ? t('dashboard.buyerLead') : t('dashboard.sellerLead');
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-stone-950">{leadTitle}</h2>
          <p className="mt-1 text-sm text-stone-600">{t('dashboard.requester')}: {displayLeadField(lead, 'name', i18n.language, t)}</p>
        </div>
        <span className="rounded-full bg-[#f7f1e6] px-3 py-1 text-sm text-stone-700">{lead.type === 'buyer' ? t('dashboard.buyer') : t('dashboard.seller')}</span>
      </div>
      <p className="mt-3 text-stone-700">{displayLeadField(lead, 'summary', i18n.language, t)}</p>
      <p className="mt-4 text-sm text-stone-500">{t('dashboard.status')}: {displayTerm(lead.status, i18n.language)} · {t('dashboard.created')}: {new Date(lead.createdAt).toLocaleString(locale)}</p>
    </>
  );
}

function BuyerLeadDetail({ detail, embedded = false }: { detail: StaffBuyerLeadDetail; embedded?: boolean }) {
  const { i18n, t } = useTranslation();
  const followUpKey = detail.contact.followUpStatus === 'ready' ? 'dashboard.ready' : detail.contact.followUpStatus === 'consent_required' ? 'dashboard.consentRequired' : 'dashboard.contactMissing';
  return <article className={embedded ? 'rounded-b-xl border border-t-0 border-[#ead9b8] bg-[#fffcf7] p-5 shadow-sm' : 'mt-4 rounded-xl border border-[#ead9b8] bg-white p-5 shadow-sm'}><h2 className="text-xl font-semibold text-stone-950">{t('dashboard.criteria')}</h2><DetailFields fields={detail.criteria} language={i18n.language} /><h3 className="mt-5 font-semibold text-stone-950">{t('dashboard.hardConstraints')}</h3><HardConstraints constraints={detail.hardConstraints} language={i18n.language} /><h3 className="mt-5 font-semibold text-stone-950">{t('dashboard.results')}</h3><SimpleItems items={detail.results.map((result) => `${result.id} · ${t(`dashboard.${result.group}`)}`)} />{detail.unmatchedDemand ? <section className="mt-5 text-stone-700"><p>{t('dashboard.unmatchedDemand')}: {displayTerm(detail.unmatchedDemand.reason, i18n.language)}</p><DetailFields fields={detail.unmatchedDemand.originalCriteria} language={i18n.language} /></section> : null}<h3 className="mt-5 font-semibold text-stone-950">{t('dashboard.contact')}</h3><p className="mt-2 text-stone-700">{t(followUpKey)}</p>{detail.contact.followUpStatus === 'ready' ? <div className="mt-2 text-stone-700">{detail.contact.email ? <p>{detail.contact.email}</p> : null}{detail.contact.phone ? <p>{detail.contact.phone}</p> : null}</div> : null}</article>;
}

function describeConstraint(constraint: BuyerHardConstraint, language: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (constraint.field === 'budget.max' && typeof constraint.value === 'number') {
    return t('dashboard.constraintBudget', { amount: formatMoney(constraint.value, 'USD', language) });
  }
  if (constraint.field === 'format') {
    return t('dashboard.constraintFormat', { format: displayValue(constraint.value, language) });
  }
  if (language.startsWith('he')) {
    if (constraint.field === 'budget.max' && typeof constraint.value === 'number') {
      return `תקציב הקונה הוא עד ${formatMoney(constraint.value, 'USD', language)}`;
    }
    if (constraint.field === 'format') {
      return `הפריט המבוקש צריך להיות ${displayValue(constraint.value, language)}`;
    }
  }

  return `${displayTerm(constraint.field, language)}: ${displayValue(constraint.value, language)}`;
}

function HardConstraints({ constraints, language }: { constraints: BuyerHardConstraint[]; language: string }) {
  const { t } = useTranslation();
  return <ul className="mt-2 space-y-2 list-none p-0 text-stone-700">{constraints.map((constraint) => <li key={`${constraint.field}-${constraint.operator}`}>{describeConstraint(constraint, language, t)}</li>)}</ul>;
}
function DetailFields({ fields, language }: { fields: Record<string, unknown>; language: string }) { return <dl className="mt-2 space-y-1 text-stone-700">{Object.entries(fields).map(([key, value]) => <div key={key} className="flex flex-wrap gap-2"><dt className="font-medium">{displayTerm(key, language)}:</dt><dd>{displayValue(value, language)}</dd></div>)}</dl>; }

function SellerLeadDetail({ detail, embedded = false }: { detail: StaffSellerLeadDetail; embedded?: boolean }) {
  const { i18n, t } = useTranslation();
  const canShowContact = detail.contact.serviceConsentGranted;
  const locale = i18n.language.startsWith('he') ? 'he-IL' : 'en-US';
  return <article className={embedded ? 'rounded-b-xl border border-t-0 border-[#ead9b8] bg-[#fffcf7] p-5 shadow-sm' : 'mt-4 rounded-xl border border-[#ead9b8] bg-white p-5 shadow-sm'}><h2 className="text-xl font-semibold text-stone-950">{t('dashboard.sellerItem')}</h2>{detail.item ? <DetailFields fields={detail.item} language={i18n.language} /> : <p className="mt-2 text-stone-700">{t('dashboard.unavailable')}</p>}<h3 className="mt-5 font-semibold text-stone-950">{t('dashboard.evidence')}</h3><SimpleItems items={detail.evidence.map(({ id, type }) => `${id} • ${displayTerm(type, i18n.language)}`)} /><h3 className="mt-5 font-semibold text-stone-950">{t('dashboard.comparables')}</h3><SimpleItems items={detail.comparables.map(({ id, source }) => `${id}${source ? ` • ${displayTerm(source.label, i18n.language)}` : ''}`)} /><SellerValuation valuation={detail.valuation} language={i18n.language} />{detail.catalogDraft ? <section className="mt-5"><h3 className="font-semibold text-stone-950">{t('dashboard.catalogDraft')}</h3><DetailFields fields={detail.catalogDraft} language={i18n.language} /></section> : null}<h3 className="mt-5 font-semibold text-stone-950">{t('dashboard.contact')}</h3><p className="mt-2 text-stone-700">{canShowContact ? t('dashboard.ready') : t('dashboard.consentRequired')}</p>{canShowContact ? <div className="mt-2 text-stone-700">{detail.contact.email ? <p>{detail.contact.email}</p> : null}{detail.contact.phone ? <p>{detail.contact.phone}</p> : null}</div> : null}<h3 className="mt-5 font-semibold text-stone-950">{t('dashboard.history')}</h3><SimpleItems items={detail.history.map(({ at, event, actor }) => `${new Date(at).toLocaleString(locale)} • ${displayTerm(event, i18n.language)} • ${displayTerm(actor, i18n.language)}`)} /></article>;
}

function SellerValuation({ valuation, language }: { valuation: StaffSellerLeadDetail['valuation']; language: string }) {
  const { t } = useTranslation();
  if (!valuation) return <section className="mt-5 text-stone-700"><h3 className="font-semibold text-stone-950">{t('dashboard.valuation')}</h3><p>{t('dashboard.valuationPending')}</p></section>;
  if (valuation.status === 'refusal') return <section className="mt-5 text-stone-700"><h3 className="font-semibold text-stone-950">{t('dashboard.valuation')}</h3><p>{t('dashboard.refusal')}: {valuation.reason ? displayTerm(valuation.reason, language) : t('dashboard.unavailable')}</p></section>;
  const range = valuation.valuationRange;
  return <section className="mt-5 text-stone-700"><h3 className="font-semibold text-stone-950">{t('dashboard.valuation')}</h3>{range ? <p>{formatMoney(range.min, range.currency, language)}–{formatMoney(range.max, range.currency, language)}</p> : <p>{t('dashboard.unavailable')}</p>}{valuation.confidence ? <p>{language.startsWith('he') ? 'רמת ביטחון' : 'Confidence'}: {displayTerm(valuation.confidence.level, language)}{valuation.confidence.explanation ? ` — ${replaceCurrencyCodes(valuation.confidence.explanation)}` : ''}</p> : null}</section>;
}

function SimpleItems({ items }: { items: string[] }) { return <ul className="mt-2 space-y-1 text-stone-700">{items.map((item) => <li key={item}>{item}</li>)}</ul>; }
