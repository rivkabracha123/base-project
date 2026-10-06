import { Button } from 'react-aria-components';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { updateProfileLanguage } from '../app/api';

export function AppHeader() {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const nextLanguage = i18n.language.startsWith('he') ? 'en' : 'he';
  const languageMutation = useMutation({
    mutationFn: updateProfileLanguage,
    onSuccess: profile => {
      // Replace the cached profile so the loader keeps the saved language.
      queryClient.setQueryData(['current-profile'], profile);

      // Reconcile with the saved preference in case it differs from the local choice.
      if (i18n.language !== profile.language) {
        void i18n.changeLanguage(profile.language);
      }
    },
  });

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <nav className="flex items-center gap-4">
          <Link
            to="/staff-operations"
            className="text-sm font-medium text-slate-700 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {t('navigation.dashboard')}
          </Link>
          {/* S5 Week 4: open the house recommendation / choice screen */}
          <Link
            to="/seller/houses"
            className="text-sm font-medium text-slate-700 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {t('navigation.houses')}
          </Link>
          <Link to="/sample" className="font-semibold text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {t('appName')}
          </Link>
        </nav>
        <Button
          onPress={() => {
            // A language control must respond immediately, even if saving the preference is unavailable.
            void i18n.changeLanguage(nextLanguage);
            languageMutation.mutate(nextLanguage);
          }}
          isDisabled={languageMutation.isPending}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {t('language')}
        </Button>
      </div>
    </header>
  );
}
