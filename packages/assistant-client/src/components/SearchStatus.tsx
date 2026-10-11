import { useTranslation } from 'react-i18next';

function SearchIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.2 13.2 17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Shown only while the backend is searching for prior sales of this item. */
export function SearchStatus() {
  const { t } = useTranslation();

  return (
    <p role="status" className="mb-5 flex items-center justify-end gap-2 text-sm text-stone-400">
      <SearchIcon />
      <span>{t('history.searching')}</span>
    </p>
  );
}
