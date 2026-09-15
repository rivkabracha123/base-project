import { Button } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function AppHeader() {
  const { i18n, t } = useTranslation();
  const nextLanguage = i18n.language.startsWith('he') ? 'en' : 'he';

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <nav className="flex items-center gap-4">
          {/* S5 Week 4: open the house recommendation / choice screen */}
          <Link
            to="/seller/houses"
            className="text-sm font-medium text-slate-700 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {t('navigation.houses')}
          </Link>
          <Link
            to="/seller/enquiry"
            className="text-sm font-medium text-slate-700 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {t('navigation.enquiry')}
          </Link>
          <Link to="/sample" className="font-semibold text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {t('appName')}
          </Link>
        </nav>
        <Button
          onPress={() => void i18n.changeLanguage(nextLanguage)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {t('language')}
        </Button>
      </div>
    </header>
  );
}
