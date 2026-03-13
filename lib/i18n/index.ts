import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import ta from './ta.json';

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: { translation: en },
    ta: { translation: ta },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
