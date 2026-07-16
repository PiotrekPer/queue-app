/**
 * Auth store — Supabase Auth session + the staff member's venue membership.
 *
 * The staff app is gated behind login only when a backend is configured
 * (`hasBackend`); in the demo build there's no auth and the queue runs on seeded
 * data. Once signed in, RLS + the SECURITY DEFINER RPCs scope every read/write to
 * the member's venue via `auth.uid()` (§4.2), and `venueId` here is what the add
 * flow stamps onto new visits.
 */
import type { Role } from '@stoliq/core';
import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { hasBackend } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { useQueueStore } from '@/features/queue/store';

export interface Membership {
  venue_id: string;
  role: Role;
  display_name: string | null;
}

interface AuthState {
  /** initial session check complete (gate waits on this) */
  ready: boolean;
  session: Session | null;
  user: User | null;
  membership: Membership | null;
  signingIn: boolean;
  error: string | null;

  /** the signed-in member's venue (null in demo / before login) */
  venueId: string | null;

  init: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadMembership: () => Promise<void>;
}

let listenerBound = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  ready: false,
  session: null,
  user: null,
  membership: null,
  signingIn: false,
  error: null,
  venueId: null,

  init: () => {
    // No backend → skip auth entirely (demo build).
    if (!hasBackend) {
      set({ ready: true });
      return;
    }
    if (listenerBound) return;
    listenerBound = true;

    void supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null, ready: true });
      if (data.session) void get().loadMembership();
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, ready: true });
      if (session) void get().loadMembership();
      else set({ membership: null, venueId: null });
    });
  },

  signIn: async (email, password) => {
    set({ signingIn: true, error: null });
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      set({ signingIn: false, error: error.message });
      return;
    }
    // session + membership arrive via onAuthStateChange; clear the busy flag.
    set({ signingIn: false });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, membership: null, venueId: null });
    // Drop the previous member's queue so a fresh login re-hydrates cleanly.
    useQueueStore.getState().reset();
  },

  loadMembership: async () => {
    const { data, error } = await supabase
      .from('memberships')
      .select('venue_id, role, display_name')
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('[auth] membership load failed', error.message);
      return;
    }
    if (data) {
      const m = data as Membership;
      set({ membership: m, venueId: m.venue_id });
    }
  },
}));
