import { useCallback } from 'react';
import { useSettings } from '../hooks/useSettings';
import {
  translations,
  type TranslationKey,
} from './translations';

export function useTranslation() {
  const settings = useSettings();
  const language = settings?.languageMode ?? 'en';
  const t = useCallback(
    (key: TranslationKey): string =>
      translations[language]?.[key] ?? translations.en[key] ?? key,
    [language],
  );
  return { t, language, settings };
}
