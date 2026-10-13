import { useState, type FormEvent } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@monabid/ui';
import {
  deleteCurrentProfile,
  getCurrentProfile,
  resetAnonymousSession,
  updateCurrentProfile,
  type UpdateCurrentProfileInput,
} from './api';

const grammaticalForms = ['unspecified', 'masculine', 'feminine', 'neutral'] as const;
type GrammaticalForm = (typeof grammaticalForms)[number];

// Placeholder values recorded as consent evidence; the real policy version is
// still to be confirmed with the team.
const CONSENT_CHANNEL = 'account-page';
const CONSENT_POLICY_VERSION = '1';

// Same look as the chat composer and the rest of the app: cream page, white bordered cards, amber focus.
const inputClass =
  'mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-stone-950 focus:outline-none focus:ring-2 focus:ring-amber-700';
const cardClass = 'rounded-2xl border border-[#ead9b8] bg-white p-6 shadow-sm';

// Personal area: lets the visitor review, update, and delete their own profile.
export function AccountPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Same cache key as the app-wide profile loader, so the profile is fetched once.
  const profileQuery = useQuery({
    queryKey: ['current-profile'],
    queryFn: ({ signal }) => getCurrentProfile(signal),
  });

  const saveMutation = useMutation({
    mutationFn: updateCurrentProfile,
    // Replace the cached profile so every screen sees the saved values.
    onSuccess: profile => queryClient.setQueryData(['current-profile'], profile),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCurrentProfile,
    // Runs only after the server confirmed the deletion.
    onSuccess: () => {
      resetAnonymousSession();
      queryClient.clear();
      navigate('/results', { replace: true });
    },
  });

  if (profileQuery.isPending) return <div className="min-h-screen bg-[#f7efe2]"><PageShell><p role="status" className="rounded-xl border border-[#ead9b8] bg-white p-8 text-center text-stone-600">{t('account.loading')}</p></PageShell></div>;
  if (profileQuery.isError) return <div className="min-h-screen bg-[#f7efe2]"><PageShell><p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">{t('account.error')}</p></PageShell></div>;
  const profile = profileQuery.data;

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    const update: UpdateCurrentProfileInput = {
      grammaticalForm: text('grammaticalForm') as GrammaticalForm,
    };
    // Empty fields are not sent, so the server keeps the stored value.
    if (text('preferredName')) update.preferredName = text('preferredName');
    if (text('email')) update.email = text('email');
    if (text('phone')) update.phone = text('phone');

    // Send a consent record only when the choice changed, so the original
    // consent timestamp is not overwritten by an unrelated edit.
    const serviceGranted = data.get('serviceConsent') === 'on';
    const marketingGranted = data.get('marketingConsent') === 'on';
    const now = new Date().toISOString();
    if (serviceGranted !== profile.serviceConsent.granted) {
      update.serviceConsent = {
        granted: serviceGranted,
        grantedAt: now,
        channel: CONSENT_CHANNEL,
        policyVersion: CONSENT_POLICY_VERSION,
      };
    }
    if (marketingGranted !== profile.marketingConsent.granted) {
      update.marketingConsent = {
        granted: marketingGranted,
        grantedAt: now,
        channel: CONSENT_CHANNEL,
        policyVersion: CONSENT_POLICY_VERSION,
      };
    }
    saveMutation.mutate(update);
  }

  return (
    <div className="min-h-screen bg-[#f7efe2]">
    <PageShell>
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-2xl font-semibold text-stone-950">{t('account.title')}</h1>
      <p className="mt-1 text-sm text-stone-600">{t('account.intro')}</p>

      <form onSubmit={handleSave} className={`mt-6 space-y-4 ${cardClass}`}>
        <label className="block text-sm font-medium text-stone-800">
          {t('account.preferredName')}
          <input name="preferredName" defaultValue={profile.preferredName ?? ''} className={inputClass} />
        </label>
        <label className="block text-sm font-medium text-stone-800">
          {t('account.grammaticalForm')}
          <select name="grammaticalForm" defaultValue={profile.grammaticalForm ?? 'unspecified'} className={inputClass}>
            {grammaticalForms.map(form => (
              <option key={form} value={form}>{t(`account.forms.${form}`)}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-stone-800">
          {t('account.email')}
          <input name="email" type="email" defaultValue={profile.email ?? ''} className={inputClass} />
        </label>
        <label className="block text-sm font-medium text-stone-800">
          {t('account.phone')}
          <input name="phone" type="tel" defaultValue={profile.phone ?? ''} className={inputClass} />
        </label>

        {/* Service and marketing consent are separate choices by product decision. */}
        <fieldset className="space-y-2 rounded-xl border border-[#ead9b8] bg-[#f7f1e6] p-3">
          <legend className="px-1 text-sm font-medium text-stone-800">{t('account.consents')}</legend>
          <label className="flex items-center gap-2 text-sm text-stone-800">
            <input type="checkbox" className="accent-amber-700" name="serviceConsent" defaultChecked={profile.serviceConsent.granted} />
            {t('account.serviceConsent')}
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-800">
            <input type="checkbox" className="accent-amber-700" name="marketingConsent" defaultChecked={profile.marketingConsent.granted} />
            {t('account.marketingConsent')}
          </label>
        </fieldset>

        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-amber-700 disabled:opacity-50"
        >
          {t('account.save')}
        </button>
        {saveMutation.isSuccess && <p role="status" className="text-sm text-[#b08948]">{t('account.saved')}</p>}
        {saveMutation.isError && <p role="alert" className="text-sm text-red-900">{t('account.saveError')}</p>}
      </form>

      <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
        <h2 className="font-semibold text-red-900">{t('account.deleteTitle')}</h2>
        <p className="mt-1 text-sm text-stone-600">{t('account.deleteWarning')}</p>
        {/* Deletion is never automatic: it opens a modal that must be answered explicitly. */}
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="mt-3 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {t('account.deleteButton')}
        </button>

        {/* Not dismissable by clicking the backdrop; only the two buttons (or Esc) close it. */}
        <ModalOverlay
          isOpen={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          isDismissable={false}
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4"
        >
          <Modal className="w-full max-w-md rounded-2xl border border-[#ead9b8] bg-white p-6 shadow-2xl">
            <Dialog role="alertdialog" className="outline-none">
              <Heading slot="title" className="text-lg font-semibold text-red-900">{t('account.deleteModalTitle')}</Heading>
              <p className="mt-2 text-sm text-stone-700">{t('account.deleteModalBody')}</p>
              {deleteMutation.isError && <p role="alert" className="mt-2 text-sm text-red-900">{t('account.deleteError')}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  onPress={() => setConfirmingDelete(false)}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-700"
                >
                  {t('account.cancel')}
                </Button>
                <Button
                  onPress={() => deleteMutation.mutate()}
                  isDisabled={deleteMutation.isPending}
                  className="rounded-xl bg-red-900 px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                >
                  {t('account.deleteYes')}
                </Button>
              </div>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </section>
    </div>
    </PageShell>
    </div>
  );
}
