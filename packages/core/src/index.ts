/**
 * @stoliq/core — the shared brain. Zod schemas, constants, the visit state
 * machine, wait-time model, SMS-segment analysis, rank math, and templates.
 * Imported by the staff app, the web app, and the edge functions — never copied.
 */
export * from './constants';
export * from './schemas';
export * from './state-machine';
export * from './wait-time';
export * from './sms-segments';
export * from './rank';
export * from './templates';
export { resources, supportedLngs, fallbackLng, defaultNS } from './i18n/index';
export type { Translation } from './i18n/index';
