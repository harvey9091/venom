'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import type { User, Session } from '@supabase/supabase-js'
import type { Membership } from '@/lib/types'

type AuthState = {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (password: string) => Promise<{ error: Error | null }>
  switchWorkspace: (workspaceId: string) => Promise<void>
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const setUserStore = useAppStore((s) => s.setUser)
  const setWorkspaceStore = useAppStore((s) => s.setWorkspace)
  const setWorkspacesStore = useAppStore((s) => s.setWorkspaces)
  const addWorkspaceStore = useAppStore((s) => s.addWorkspace)
  const switchWorkspaceStore = useAppStore((s) => s.switchWorkspace)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        setUserStore(session.user as unknown as import('@/lib/types').User)
      } else {
        setIsLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        setUserStore(session.user as unknown as import('@/lib/types').User)
      } else {
        setUserStore(null)
        setWorkspaceStore(null)
        setWorkspacesStore([])
      }
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [setUserStore, setWorkspaceStore, setWorkspacesStore])

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error: error as Error | null }
  }, [])

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: error as Error | null }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setUserStore(null)
    setWorkspaceStore(null)
    setWorkspacesStore([])
  }, [setUserStore, setWorkspaceStore, setWorkspacesStore])

  const resetPassword = useCallback(async (email: string) => {
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error as Error | null }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.updateUser({
      password,
    })
    return { error: error as Error | null }
  }, [])

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    try {
      const r = await fetch('/api/crm/workspaces/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspaceId }),
      })
      const j = await r.json()
      if (j.ok && j.data) {
        switchWorkspaceStore(j.data.id)
      }
    } catch {
      // ignore switch errors
    }
  }, [user, switchWorkspaceStore])

  return {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    switchWorkspace,
  }
}
