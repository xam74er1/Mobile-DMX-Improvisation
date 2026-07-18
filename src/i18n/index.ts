import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import fr from './locales/fr.json'

export type AppLanguage = 'fr' | 'en'

// Both locale bundles are static imports (no async loading), so init can run
// synchronously at module load — before the first component renders.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: 'fr',          // app default — overridden below once settingsStore rehydrates
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
