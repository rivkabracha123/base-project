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
    // sticky top-0: הכותרת נשארת בראש המסך בזמן גלילה; z-10 מעל תוכן הדף (למשל כרטיסי תוצאות).
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-[#f6f1e8]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link to="/sample" className="font-semibold text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {t('appName')}
        </Link>
        <nav className="flex items-center gap-4">
          <Link to="/chat/buyer" className="text-sm font-medium text-slate-700 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {t('navigation.buyer')}
          </Link>
          <Link to="/chat/seller" className="text-sm font-medium text-slate-700 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {t('navigation.seller')}
          </Link>
          <Link
            to="/staff-operations"
            className="text-sm font-medium text-stone-700 hover:text-stone-950 focus:outline-none focus:ring-2 focus:ring-amber-700"
          >
            {t('navigation.dashboard')}
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

          {import.meta.env.DEV && (
            <Link
              to="/seller/gallery"
              className="text-sm font-medium text-slate-700 hover:text-slate-950"
            >
              {t('navigation.gallery')}
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {/* Entry point to the personal area (profile update and deletion) */}
          <Link
            to="/account"
            className="text-sm font-medium text-stone-700 hover:text-stone-950 focus:outline-none focus:ring-2 focus:ring-amber-700"
          >
            {t('navigation.account')}
          </Link>
          <Button
            onPress={() => {
              // A language control must respond immediately, even if saving the preference is unavailable.
              void i18n.changeLanguage(nextLanguage);
              languageMutation.mutate(nextLanguage);
            }}
            isDisabled={languageMutation.isPending}
            className="text-sm font-medium text-stone-700 hover:text-stone-950 focus:outline-none focus:ring-2 focus:ring-amber-700"
          >
            {t('language')}
          </Button>
        </div>
      </div>
    </header>
  );
}
