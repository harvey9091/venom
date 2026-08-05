/**
 * Navigation preferences store.
 *
 * Persists the user's chosen navigation mode (sidebar vs floating dock) to
 * localStorage. Designed to be portable to Supabase `workspace_preferences`
 * table in production — the shape mirrors what would be a JSONB column.
 *
 * Production migration path:
 *   1. Add `nav_mode TEXT DEFAULT 'sidebar'` to `workspace_preferences` table
 *      (or a `preferences JSONB` column).
 *   2. On login, fetch the workspace preference and hydrate this store.
 *   3. On change, PATCH `/api/crm/settings { action: 'updateNavMode', navMode }`
 *      which writes to the DB. Keep the localStorage write as a fallback for
 *      offline / fast UI.
 */
'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NavMode = 'sidebar' | 'dock'

export interface NavPreferences {
  navMode: NavMode
}

interface NavStore extends NavPreferences {
  setNavMode: (mode: NavMode) => void
  toggleNavMode: () => void
}

const DEFAULT_PREFS: NavPreferences = {
  navMode: 'sidebar',
}

export const useNavStore = create<NavStore>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS,
      setNavMode: (navMode) => set({ navMode }),
      toggleNavMode: () => set((s) => ({ navMode: s.navMode === 'sidebar' ? 'dock' : 'sidebar' })),
    }),
    {
      name: 'venom-nav-preferences',
      // Only persist the shape we'd send to Supabase
      partialize: (s) => ({ navMode: s.navMode }) as NavPreferences,
    }
  )
)

/**
 * Server-side mirror of the nav preferences shape.
 * When you create the `workspace_preferences` table in Supabase, use:
 *
 *   create table public.workspace_preferences (
 *     workspace_id uuid primary key references public.workspaces(id) on delete cascade,
 *     nav_mode text default 'sidebar' check (nav_mode in ('sidebar','dock')),
 *     updated_at timestamptz default now()
 *   );
 *
 * And expose it via the settings API:
 *   GET  /api/crm/settings?section=navPreferences
 *   PATCH /api/crm/settings { action: 'updateNavMode', navMode }
 */
