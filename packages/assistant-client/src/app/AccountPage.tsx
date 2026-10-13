import { useState, type FormEvent } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2';

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

  if (profileQuery.isPending) return <p className="p-6">{t('account.loading')}</p>;
  if (profileQuery.isError) return <p role="alert" className="p-6">{t('account.error')}</p>;
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
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('account.title')}</h1>
      <p className="mt-1 text-sm text-slate-600">{t('account.intro')}</p>

      <form onSubmit={handleSave} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          {t('account.preferredName')}
          <input name="preferredName" defaultValue={profile.preferredName ?? ''} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t('account.grammaticalForm')}
          <select name="grammaticalForm" defaultValue={profile.grammaticalForm ?? 'unspecified'} className={inputClass}>
            {grammaticalForms.map(form => (
              <option key={form} value={form}>{t(`account.forms.${form}`)}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          {t('account.email')}
          <input name="email" type="email" defaultValue={profile.email ?? ''} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t('account.phone')}
          <input name="phone" type="tel" defaultValue={profile.phone ?? ''} className={inputClass} />
        </label>

        {/* Service and marketing consent are separate choices by product decision. */}
        <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium">{t('account.consents')}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="serviceConsent" defaultChecked={profile.serviceConsent.granted} />
            {t('account.serviceConsent')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="marketingConsent" defaultChecked={profile.marketingConsent.granted} />
            {t('account.marketingConsent')}
          </label>
        </fieldset>

        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {t('account.save')}
        </button>
        {saveMutation.isSuccess && <p role="status" className="text-sm text-green-700">{t('account.saved')}</p>}
        {saveMutation.isError && <p role="alert" className="text-sm text-red-700">{t('account.saveError')}</p>}
      </form>

      <section className="mt-10 rounded-lg border border-red-200 p-4">
        <h2 className="font-semibold text-red-700">{t('account.deleteTitle')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('account.deleteWarning')}</p>
        {/* Deletion is never automatic: it opens a modal that must be answered explicitly. */}
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {t('account.deleteButton')}
        </button>

        {/* Not dismissable by clicking the backdrop; only the two buttons (or Esc) close it. */}
        <ModalOverlay
          isOpen={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          isDismissable={false}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <Modal className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <Dialog role="alertdialog" className="outline-none">
              <Heading slot="title" className="text-lg font-semibold text-red-700">{t('account.deleteModalTitle')}</Heading>
              <p className="mt-2 text-sm text-slate-700">{t('account.deleteModalBody')}</p>
              {deleteMutation.isError && <p role="alert" className="mt-2 text-sm text-red-700">{t('account.deleteError')}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  onPress={() => setConfirmingDelete(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {t('account.cancel')}
                </Button>
                <Button
                  onPress={() => deleteMutation.mutate()}
                  isDisabled={deleteMutation.isPending}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {t('account.deleteYes')}
                </Button>
              </div>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </section>
    </main>
  );
}
