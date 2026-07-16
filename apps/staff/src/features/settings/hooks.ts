/**
 * Public surface for the settings feature — the store, its hydrate hook, and the
 * role gate re-exported from core so the screen imports from one place.
 */
export { PRIVILEGED_ROLES } from '@stoliq/core';
export { useHydrateSettings, useSettingsStore } from './store';
export type { TemplateBodies, VenueBasics } from './store';
