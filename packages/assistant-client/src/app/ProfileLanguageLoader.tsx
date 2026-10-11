import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentProfile } from './api';

// Load the saved language preference as soon as the application starts.
export function ProfileLanguageLoader() {
  const { i18n } = useTranslation();
  const profileQuery = useQuery({
    queryKey: ['current-profile'],
    queryFn: ({ signal }) => getCurrentProfile(signal),
  });

  useEffect(() => {
    // The server is the source of truth for the saved language preference.
    if (profileQuery.data && i18n.language !== profileQuery.data.language) {
      void i18n.changeLanguage(profileQuery.data.language);
    }
  }, [i18n, profileQuery.data]);

  return null;
}