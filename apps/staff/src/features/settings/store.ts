/**
 * Settings state for the staff app (§9.3D). Seeded from DEFAULT_SETTINGS; when a
 * live backend is configured it hydrates from / persists to venues.settings,
 * otherwise it lives purely in memory on demo data.
 *
 * Message-template edits are held here too (keyed by TemplateKey, PL locale) so
 * the live segment counter (§7.5) always reflects the venue's current body.
 */
import type { Settings, TemplateKey } from '@stoliq/core';
import {
  DEFAULT_SETTINGS,
  DEFAULT_TEMPLATES,
  SettingsSchema,
  TEMPLATE_KEYS,
} from '@stoliq/core';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { hasBackend } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/** A venue's editable message bodies (PL), keyed by template. */
export type TemplateBodies = Record<TemplateKey, string>;

/** The slice of venue identity the settings screen edits / displays. */
export interface VenueBasics {
  name: string;
  city: string;
  /** prepaid SMS wallet, integer grosz (§4) */
  smsBalanceGrosz: number;
  /** the signed-in staff member's role — gates privileged sections (§4.2) */
  role: 'owner' | 'manager' | 'staff';
}

function seedTemplates(): TemplateBodies {
  const out = {} as TemplateBodies;
  for (const key of TEMPLATE_KEYS) {
    out[key] = DEFAULT_TEMPLATES[key].pl;
  }
  return out;
}

/** Demo venue used when there is no backend (mirrors the „Trattoria Demo" seed §12.6). */
const DEMO_VENUE: VenueBasics = {
  name: 'Trattoria Demo',
  city: 'Warszawa',
  smsBalanceGrosz: 5000,
  role: 'owner',
};

interface SettingsState {
  settings: Settings;
  venue: VenueBasics;
  templates: TemplateBodies;
  hydrated: boolean;
  /** venue row id, when backed by Supabase (used for persistence) */
  venueId: string | null;

  hydrate: () => Promise<void>;
  /** Patch venues.settings (partial merge + persist). */
  patchSettings: (patch: Partial<Settings>) => void;
  patchVenue: (patch: Partial<VenueBasics>) => void;
  setTemplate: (key: TemplateKey, body: string) => void;
  resetTemplate: (key: TemplateKey) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS as Settings,
  venue: DEMO_VENUE,
  templates: seedTemplates(),
  hydrated: !hasBackend,
  venueId: null,

  hydrate: async () => {
    if (!hasBackend) {
      set({ hydrated: true });
      return;
    }
    const { data, error } = await supabase
      .from('venues')
      .select('id, name, city, settings, sms_balance_grosz')
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      // Fall back to defaults but mark hydrated so the UI is usable offline.
      set({ hydrated: true });
      return;
    }

    const parsed = SettingsSchema.safeParse(data.settings ?? {});
    set({
      venueId: data.id,
      venue: {
        name: data.name ?? '',
        city: data.city ?? '',
        smsBalanceGrosz: data.sms_balance_grosz ?? 0,
        role: get().venue.role,
      },
      settings: parsed.success ? parsed.data : (DEFAULT_SETTINGS as Settings),
      hydrated: true,
    });
  },

  patchSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    if (hasBackend && get().venueId) {
      void supabase.from('venues').update({ settings: next }).eq('id', get().venueId);
    }
  },

  patchVenue: (patch) => {
    const next = { ...get().venue, ...patch };
    set({ venue: next });
    if (hasBackend && get().venueId) {
      void supabase
        .from('venues')
        .update({ name: next.name, city: next.city })
        .eq('id', get().venueId);
    }
  },

  setTemplate: (key, body) => {
    set({ templates: { ...get().templates, [key]: body } });
    // Persistence of message_templates is owned by the notification pipeline;
    // here we keep the edited body live for the counter + preview.
  },

  resetTemplate: (key) => {
    set({ templates: { ...get().templates, [key]: DEFAULT_TEMPLATES[key].pl } });
  },
}));

/** Mount effect: hydrate venue settings once. */
export function useHydrateSettings(): boolean {
  const hydrated = useSettingsStore((s) => s.hydrated);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // `hydrate` is a stable zustand action — read it off the store at call time.
    void useSettingsStore.getState().hydrate();
  }, []);
  return hydrated;
}
