import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState, PageShell } from '@monabid/ui';
import { fetchDemoLot } from './api';

export function DemoLotPage() {
  const query = useQuery({
    queryKey: ['aloma-shilat-demo'],
    queryFn: ({ signal }) => fetchDemoLot(signal),
  });

  if (query.isPending) {
    return (
      <PageShell>
        <LoadingState label="Loading demo lot..." />
      </PageShell>
    );
  }

  if (query.isError) {
    return (
      <PageShell>
        <ErrorState title="Error loading demo lot." retryLabel="Retry" onRetry={() => void query.refetch()} />
      </PageShell>
    );
  }

  if (!query.data) {
    return (
      <PageShell>
        <EmptyState title="No demo lot available." />
      </PageShell>
    );
  }

  const statusClasses = {
    upcoming: 'bg-sky-100 text-sky-700',
    sold: 'bg-emerald-100 text-emerald-700',
    unsold: 'bg-amber-100 text-amber-700',
  } as const;

  return (
    <PageShell>
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Demo task</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{query.data.title}</h1>
      <p className="mb-8 mt-3 max-w-2xl text-slate-600">{query.data.description}</p>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            {query.data.category}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusClasses[query.data.status]}`}>
            {query.data.status}
          </span>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</dt>
            <dd className="mt-2 text-lg font-semibold text-slate-900">{query.data.category}</dd>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</dt>
            <dd className="mt-2 text-lg font-semibold text-slate-900">{query.data.status}</dd>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sale date</dt>
            <dd className="mt-2 text-lg font-semibold text-slate-900">{query.data.saleDate}</dd>
          </div>
        </dl>
      </section>
    </PageShell>
  );
}
