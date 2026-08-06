/**
 * Realtime client — connects to Supabase Realtime in production,
 * falls back to socket.io mini-service in development.
 */
'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from './store'
import { useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from './supabase'

let supabaseChannel: ReturnType<ReturnType<typeof createSupabaseBrowserClient>['channel']> | null = null

function useSupabaseRealtime() {
  const workspaceId = useAppStore((s) => s.workspace?.id)
  const userId = useAppStore((s) => s.user?.id)
  const qc = useQueryClient()

  useEffect(() => {
    if (!workspaceId || !userId) return

    const supabase = createSupabaseBrowserClient()

    supabaseChannel = supabase
      .channel(`workspace:${workspaceId}`)
      .on('broadcast', { event: 'entity:event' }, (payload) => {
        qc.invalidateQueries({ queryKey: [payload.payload.type] })
      })
      .on('broadcast', { event: 'activity:new' }, () => {
        qc.invalidateQueries({ queryKey: ['activities'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        useAppStore.getState().addNotification(payload.new as any)
      })
      .subscribe()

    return () => {
      if (supabaseChannel) {
        supabase.removeChannel(supabaseChannel)
        supabaseChannel = null
      }
    }
  }, [workspaceId, userId, qc])
}

export function getSocket() {
  return null
}

export function ensureSocket() {
  return null as any
}

export function useRealtime() {
  useSupabaseRealtime()
}

export function broadcastEntityEvent(payload: { workspaceId: string; type: string; entity: any; action: string }) {
  if (process.env.NODE_ENV !== 'production') {
    const socket = (window as any).__socket
    if (socket && socket.connected) {
      socket.emit('entity:event', payload)
    }
  }
}

export function broadcastActivity(payload: { workspaceId: string; activity: any }) {
  if (process.env.NODE_ENV !== 'production') {
    const socket = (window as any).__socket
    if (socket && socket.connected) {
      socket.emit('activity:new', payload)
    }
  }
}
