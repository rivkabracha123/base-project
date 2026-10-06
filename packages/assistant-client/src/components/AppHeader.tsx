import { Button } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function AppHeader() {
  const { i18n, t } = useTranslation();
  const nextLanguage = i18n.language.startsWith('he') ? 'en' : 'he';

  return (
    <header className="border-b border-stone-200 bg-[#f6f1e8]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <nav className="flex items-center gap-4">
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
        <Button
          onPress={() => void i18n.changeLanguage(nextLanguage)}
          className="rounded-full border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:bg-[#f3ead8] focus:outline-none focus:ring-2 focus:ring-amber-700"
        >
          {t('language')}
        </Button>
      </div>
    </header>
  );
}
