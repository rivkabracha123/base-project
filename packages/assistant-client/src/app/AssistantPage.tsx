import { useEffect, useState } from 'react';
import { PageShell } from '@monabid/ui';
import { useTranslation } from 'react-i18next';
import { generateAi, getAiConversation, getAiHistory, type AiExchange, type AiHistoryPage, type AiRole } from './api';

type Draft = { prompt: string; role: AiRole };

export function AssistantPage() {
  const { i18n, t } = useTranslation();
  const language = i18n.language.startsWith('he') ? 'he' : 'en';
  const defaults: Draft = { prompt: t('assistant.request'), role: 'buyer' };
  const [draft, setDraft] = useState<Draft>(defaults);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<AiHistoryPage | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [historyError, setHistoryError] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string>();
  const [exchanges, setExchanges] = useState<AiExchange[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);

  async function openConversation(id: string) {
    setConversationLoading(true);
    setError(null);
    try {
      const conversation = await getAiConversation(id);
      setConversationId(id);
      setExchanges(conversation.entries);
      setDraft({ prompt: '', role: conversation.entries[0]?.role ?? 'buyer' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed');
    } finally {
      setConversationLoading(false);
    }
  }

  function newConversation() {
    setConversationId(undefined);
    setExchanges([]);
    setError(null);
    setDraft(current => ({ ...current, prompt: '' }));
  }

  useEffect(() => {
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError(false);
    void getAiHistory(historyPage, controller.signal).then(result => {
      if (!controller.signal.aborted) setHistory(result);
    }).catch(() => {
      if (!controller.signal.aborted) setHistoryError(true);
    }).finally(() => {
      if (!controller.signal.aborted) setHistoryLoading(false);
    });
    return () => controller.abort();
  }, [historyPage, historyVersion]);

  async function submit() {
    setIsSending(true);
    setError(null);
    try {
      const answer = await generateAi(draft.prompt, draft.role, language, conversationId);
      setConversationId(answer.conversationId);
      setExchanges(current => [...current, {
        id: answer.exchangeId, conversationId: answer.conversationId, userId: '',
        prompt: draft.prompt, role: draft.role, language, response: answer, createdAt: new Date().toISOString(),
      }]);
      setDraft(current => ({ ...current, prompt: '' }));
      setHistoryPage(1);
      setHistoryVersion(current => current + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">{t('assistant.eyebrow')}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{t('assistant.title')}</h1>
        <p className="mt-3 text-slate-600">{t('assistant.intro')}</p>

        <div className="mt-5 flex justify-end">
          <button type="button" disabled={isSending || conversationLoading} onClick={newConversation} className="text-sm font-semibold underline disabled:opacity-50">{t('assistant.newConversation')}</button>
        </div>
        {conversationLoading ? <p role="status">{t('assistant.saving')}</p> : null}
        <ol className="mt-4 space-y-5" aria-label={t('assistant.dialogue')}>
          {exchanges.map(entry => <li key={entry.id} className="border-b border-slate-200 pb-5 break-words">
            <p className="text-sm font-semibold">{t(`assistant.${entry.role}`)}</p>
            <p className="mt-1 whitespace-pre-wrap" dir="auto">{entry.prompt}</p>
            <div className="mt-3 border-s-2 border-indigo-400 ps-4" dir={entry.language === 'he' ? 'rtl' : 'ltr'}>
              <p className="text-sm font-semibold">{t('navigation.assistant')}</p>
              <p className="mt-1 whitespace-pre-wrap">{entry.response.summary}</p>
              {entry.response.recommendation.trim() !== entry.response.summary.trim() && entry.response.recommendation.trim() !== entry.response.nextAction.trim()
                ? <p className="mt-2 whitespace-pre-wrap">{entry.response.recommendation}</p> : null}
              {entry.response.nextAction.trim() !== entry.response.summary.trim() ? <p className="mt-2 whitespace-pre-wrap">{entry.response.nextAction}</p> : null}
              {entry.response.error ? <p className="mt-2 text-red-800">{entry.response.error}</p> : null}
              {entry.response.isRelevant && entry.response.fallbackMode === 'guided' ? <p className="mt-2 text-amber-800">{t('assistant.fallback')}</p> : null}
              {(() => {
                if (!entry.response.isRelevant) return null;
                const price = entry.response.structuredAnswer.price as { min?: number; max?: number; currency?: string } | undefined;
                const amounts = [price?.min, price?.max].filter((amount): amount is number => typeof amount === 'number');
                return amounts.length ? <p className="mt-2">{t('assistant.budget')}: {amounts.map(amount => amount.toLocaleString()).join(' - ')} {price?.currency}</p> : null;
              })()}
              {entry.response.isRelevant && Array.isArray(entry.response.structuredAnswer.missingFacts) ? <ul className="mt-2 list-disc ps-5">{entry.response.structuredAnswer.missingFacts.filter((fact): fact is string => typeof fact === 'string').map((fact, index) => <li key={index}>{t(`assistant.facts.${fact}`, { defaultValue: fact })}</li>)}</ul> : null}
            </div>
          </li>)}
        </ol>
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
          {/* Let the visitor choose the buyer or seller flow. */}
          <div className="flex gap-2" role="group" aria-label="role">
            {(['buyer', 'seller'] as const).map(role => (
              <button
                key={role}
                type="button"
                disabled={isSending || conversationLoading || Boolean(conversationId)}
                onClick={() => setDraft(current => ({ ...current, role }))}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${draft.role === role ? 'bg-indigo-700 text-white' : 'border border-slate-300 text-slate-700'}`}
              >
                {t(`assistant.${role}`)}
              </button>
            ))}
          </div>
          {/* The visitor can correct the request before sending it again. */}
          <label className="mt-5 block text-sm font-semibold text-slate-800" htmlFor="assistant-prompt">{t('assistant.prompt')}</label>
          <textarea
            id="assistant-prompt"
            disabled={isSending || conversationLoading}
            value={draft.prompt}
            onChange={event => setDraft(current => ({ ...current, prompt: event.target.value }))}
            rows={5}
            className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">{t('assistant.saved')}</span>
            {/* Submit the first request or retry after correcting it. */}
            <button type="button" onClick={() => void submit()} disabled={isSending || conversationLoading || !draft.prompt.trim()} className="rounded-lg bg-indigo-700 px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {isSending ? t('assistant.saving') : t('assistant.send')}
            </button>
          </div>
        </div>

        {error ? <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div> : null}
        {!error && !exchanges.length ? <p className="mt-6 text-slate-500">{t('assistant.empty')}</p> : null}
        <section className="mt-8 border-t border-slate-200 pt-5" aria-labelledby="history-heading">
          <h2 id="history-heading" className="text-lg font-semibold">{t('assistant.history')}</h2>
          {historyLoading ? <p role="status" className="mt-3">{t('assistant.saving')}</p> : null}
          {historyError ? <div role="alert" className="mt-3 text-red-800">
            {t('assistant.historyError')}
            <button type="button" className="ms-3 underline" onClick={() => setHistoryVersion(current => current + 1)}>{t('assistant.retry')}</button>
          </div> : null}
          {!historyLoading && !historyError && history?.items.length === 0 ? <p className="mt-3 text-slate-500">{t('assistant.historyEmpty')}</p> : null}
          {!historyLoading && !historyError && history ? <>
            <ul className="mt-3 divide-y divide-slate-200">
              {history.items.map(entry => <li key={entry.id}>
                <button type="button" disabled={isSending || conversationLoading} className="w-full py-3 text-start disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600" onClick={() => void openConversation(entry.conversationId)}>
                  <span className="block text-xs text-slate-500">{t(`assistant.${entry.role}`)} · {new Date(entry.createdAt).toLocaleString(language === 'he' ? 'he-IL' : 'en-US')}</span>
                  <span className="mt-1 block break-words whitespace-pre-wrap">{entry.prompt}</span>
                </button>
              </li>)}
            </ul>
            {history.total > history.pageSize ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <button type="button" className="underline disabled:opacity-40" disabled={historyPage === 1} onClick={() => setHistoryPage(current => current - 1)}>{t('assistant.newer')}</button>
              <span>{historyPage} / {Math.ceil(history.total / history.pageSize)}</span>
              <button type="button" className="underline disabled:opacity-40" disabled={historyPage * history.pageSize >= history.total} onClick={() => setHistoryPage(current => current + 1)}>{t('assistant.older')}</button>
            </div> : null}
          </> : null}
        </section>
      </section>
    </PageShell>
  );
}
