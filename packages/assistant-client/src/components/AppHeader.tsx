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

      // Change the visible language only after the backend saved the preference.
      void i18n.changeLanguage(profile.language);
    },
  });

  return (
    <header className="border-b border-stone-200 bg-[#f6f1e8]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <nav className="flex items-center gap-4">
          <Link to="/assistant" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
            {t('navigation.assistant')}
          </Link>
          {/* S5 Week 4: open the house recommendation / choice screen */}
          <Link
            to="/seller/houses"
            className="text-sm font-medium text-stone-700 hover:text-stone-950 focus:outline-none focus:ring-2 focus:ring-amber-700"
          >
            {t('navigation.houses')}
          </Link>
          <Link
            to="/seller/enquiry"
            className="text-sm font-medium text-stone-700 hover:text-stone-950 focus:outline-none focus:ring-2 focus:ring-amber-700"
          >
            {t('navigation.enquiry')}
          </Link>
          <Link to="/sample" className="font-semibold text-stone-950 focus:outline-none focus:ring-2 focus:ring-amber-700">
            {t('appName')}
          </Link>
        </nav>
        {/* Save the user's choice before changing the visible interface. */}
        <Button
          onPress={() => languageMutation.mutate(nextLanguage)}
          isDisabled={languageMutation.isPending}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {t('language')}
        </Button>
      </div>
    </header>
  );
}
