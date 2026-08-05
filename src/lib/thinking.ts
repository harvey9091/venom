/**
 * Thinking Orbs — global state store.
 *
 * Tracks all active "thinking" tasks across the app so the topbar indicator
 * and any orchestrating UI can react. Inline `<ThinkingState />` components
 * don't need to register here — they render where they're mounted. This store
 * is for cross-cutting indicators (topbar dot, fullscreen overlays, AI assistant).
 */
'use client'

import { create } from 'zustand'

export type ThinkingVariant = 'single' | 'trio' | 'orbit' | 'pulse'
export type ThinkingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type ThinkingPriority = 'background' | 'foreground' | 'critical'

export interface ThinkingTask {
  id: string
  label: string
  variant?: ThinkingVariant
  size?: ThinkingSize
  priority?: ThinkingPriority
  startedAt: number
  progress?: number
}

interface ThinkingStore {
  tasks: ThinkingTask[]
  startTask: (task: Omit<ThinkingTask, 'id' | 'startedAt'> & { id?: string }) => string
  updateTask: (id: string, patch: Partial<ThinkingTask>) => void
  stopTask: (id: string) => void
  stopAll: () => void
  hasActive: () => boolean
  hasCritical: () => boolean
  foregroundTask: () => ThinkingTask | undefined
}

export const useThinkingStore = create<ThinkingStore>((set, get) => ({
  tasks: [],
  startTask: (task) => {
    const id = task.id || `think_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    set((s) => {
      // Replace any existing task with the same id; otherwise append.
      const filtered = s.tasks.filter((t) => t.id !== id)
      return { tasks: [...filtered, { ...task, id, startedAt: Date.now() }] }
    })
    return id
  },
  updateTask: (id, patch) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  stopTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
  stopAll: () => set({ tasks: [] }),
  hasActive: () => get().tasks.length > 0,
  hasCritical: () => get().tasks.some((t) => t.priority === 'critical'),
  foregroundTask: () => {
    const tasks = get().tasks
    return (
      tasks.find((t) => t.priority === 'critical') ||
      tasks.find((t) => t.priority === 'foreground') ||
      tasks[tasks.length - 1]
    )
  },
}))

/**
 * Convenience hook for starting a transient thinking task that auto-stops.
 * Returns [start, stop, update] helpers.
 */
export function useThinkingTask() {
  const startTask = useThinkingStore((s) => s.startTask)
  const stopTask = useThinkingStore((s) => s.stopTask)
  const updateTask = useThinkingStore((s) => s.updateTask)

  return {
    start: (label: string, opts?: Partial<ThinkingTask>) => startTask({ label, ...opts }),
    update: (id: string, patch: Partial<ThinkingTask>) => updateTask(id, patch),
    stop: (id: string) => stopTask(id),
    startSequence: async (
      labels: string[],
      opts?: { duration?: number; variant?: ThinkingVariant; size?: ThinkingSize; priority?: ThinkingPriority }
    ) => {
      const duration = opts?.duration ?? 1500
      const id = startTask({
        label: labels[0],
        variant: opts?.variant,
        size: opts?.size,
        priority: opts?.priority,
      })
      for (let i = 1; i < labels.length; i++) {
        await new Promise((r) => setTimeout(r, duration))
        updateTask(id, { label: labels[i], progress: Math.round((i / labels.length) * 100) })
      }
      await new Promise((r) => setTimeout(r, duration))
      stopTask(id)
      return id
    },
  }
}
