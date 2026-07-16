/**
 * i18next init for the staff app. Keys + translations come from @stoliq/core
 * (pl default, en fallback — §9.5). Import this module once (in Providers).
 */
import { fallbackLng, resources, supportedLngs } from '@stoliq/core';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: 'pl',
    fallbackLng,
    supportedLngs: [...supportedLngs],
    interpolation: { escapeValue: false },
  });
}

export default i18n;
