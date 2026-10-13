import type { ReactNode } from 'react';
import { Button } from 'react-aria-components';

export function LoadingState({ label }: { label: string }) {
  return <p role="status" className="rounded-xl border border-[#ead9b8] bg-white p-8 text-center text-stone-600">{label}</p>;
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <section className="rounded-xl border border-dashed border-[#ead9b8] bg-white p-8 text-center">
      <h2 className="font-semibold text-stone-950">{title}</h2>
      {detail ? <p className="mt-2 text-sm text-stone-600">{detail}</p> : null}
    </section>
  );
}

export function ErrorState({ title, retryLabel, onRetry }: { title: string; retryLabel: string; onRetry: () => void }) {
  return (
    <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
      <p>{title}</p>
      <Button onPress={onRetry} className="mt-4 rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
        {retryLabel}
      </Button>
    </section>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">{children}</main>;
}
