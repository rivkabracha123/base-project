import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState, PageShell } from '@monabid/ui';
import { getStaffOperationLeads } from './app/api';

const labels = {
  title: 'לוח בקרה תפעולי',
  intro: 'ניהול ומעקב אחר פניות קונים ומוכרים במערכת.',
  loading: 'טוען את לוח הבקרה התפעולי…',
  error: 'לא ניתן לטעון את הפניות כרגע.',
  retry: 'נסו שוב',
  empty: 'אין פניות להצגה כרגע.',
  buyer: 'קונה',
  seller: 'מוכר',
};

export function StaffOperationsDashboard() {
  const query = useQuery({
    queryKey: ['staff-operations-leads'],
    queryFn: ({ signal }) => getStaffOperationLeads(signal),
  });

  return (
    <PageShell>
      <section dir="rtl" aria-labelledby="staff-operations-heading">
        <p className="text-sm font-semibold text-indigo-700">נתוני הדגמה סינתטיים בלבד</p>
        <h1 id="staff-operations-heading" className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{labels.title}</h1>
        <p className="mt-3 text-slate-600">{labels.intro}</p>

        <div className="mt-8">
          {query.isPending ? <LoadingState label={labels.loading} /> : null}
          {query.isError ? <ErrorState title={labels.error} retryLabel={labels.retry} onRetry={() => void query.refetch()} /> : null}
          {query.isSuccess && query.data.length === 0 ? <EmptyState title={labels.empty} /> : null}
          {query.data?.length ? (
            <ul className="grid gap-4" aria-label="פניות">
              {query.data.map((lead) => (
                <li key={lead.id}>
                  <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="font-semibold text-slate-950">{lead.clientName}</h2>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                        {lead.type === 'buyer' ? labels.buyer : labels.seller}
                      </span>
                    </div>
                    <p className="mt-3 text-slate-700">{lead.requestDetails}</p>
                    <p className="mt-4 text-sm text-slate-500">
                      סטטוס: {lead.status} · נוצר: {new Date(lead.createdAt).toLocaleString('he-IL')}
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </PageShell>
  );
}
