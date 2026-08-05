/**
 * Realtime client — connects to socket.io mini-service on port 3003.
 * Path is always "/" so Caddy can forward via /?XTransformPort=3003.
 */
'use client'

import { io, Socket } from 'socket.io-client'
import { useEffect, useRef } from 'react'
import { useAppStore } from './store'
import { useQueryClient } from '@tanstack/react-query'

let socket: Socket | null = null

export function getSocket(): Socket | null {
  return socket
}

export function ensureSocket(workspaceId?: string, userId?: string): Socket {
  if (socket && socket.connected) return socket
  if (!socket) {
    socket = io('/?XTransformPort=3003', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
    })
    socket.on('connect', () => {
      useAppStore.getState().setRealtimeConnected(true)
      if (workspaceId || userId) {
        socket!.emit('join', { workspaceId, userId })
      }
    })
    socket.on('disconnect', () => {
      useAppStore.getState().setRealtimeConnected(false)
    })
    socket.on('notification', (notif: any) => {
      useAppStore.getState().addNotification(notif)
    })
    socket.on('entity:event', (payload: any) => {
      // Invalidate the relevant query
      const qc = (window as any).__queryClient
      if (qc) {
        qc.invalidateQueries({ queryKey: [payload.type] })
      }
    })
    socket.on('activity:new', () => {
      const qc = (window as any).__queryClient
      if (qc) qc.invalidateQueries({ queryKey: ['activities'] })
    })
  } else {
    socket.connect()
  }
  return socket
}

export function useRealtime() {
  const workspaceId = useAppStore((s) => s.workspace?.id)
  const userId = useAppStore((s) => s.user?.id)
  const qc = useQueryClient()
  const initRef = useRef(false)

  useEffect(() => {
    // Expose query client globally for socket handler
    ;(window as any).__queryClient = qc
    if (!workspaceId || !userId) return
    const s = ensureSocket(workspaceId, userId)
    if (!initRef.current) {
      initRef.current = true
      s.emit('join', { workspaceId, userId })
    }
  }, [workspaceId, userId, qc])
}

export function broadcastEntityEvent(payload: { workspaceId: string; type: string; entity: any; action: string }) {
  const s = getSocket()
  if (s && s.connected) s.emit('entity:event', payload)
}

export function broadcastActivity(payload: { workspaceId: string; activity: any }) {
  const s = getSocket()
  if (s && s.connected) s.emit('activity:new', payload)
}
