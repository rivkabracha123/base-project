import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function applyDocumentLanguage(language: string): void {
  const normalized = language.startsWith('he') ? 'he' : 'en';
  document.documentElement.lang = normalized;
  document.documentElement.dir = normalized === 'he' ? 'rtl' : 'ltr';
}

applyDocumentLanguage(i18n.language);
i18n.on('languageChanged', applyDocumentLanguage);

export default i18n;
