/**
 * ThinkingIndicator — small dot in the topbar that glows when the system is
 * actively thinking. Hover to see the current task label. Click to open the
 * AI Assistant.
 */
'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useThinkingStore } from '@/lib/thinking'
import { useAppStore } from '@/lib/store'
import { Orb } from './orb'

export function ThinkingIndicator() {
  const tasks = useThinkingStore((s) => s.tasks)
  const setAssistantOpen = useAppStore((s) => s.setAssistantOpen)

  const active = tasks.length > 0
  const foreground = tasks[tasks.length - 1]

  return (
    <button
      onClick={() => setAssistantOpen(true)}
      className="relative flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-colors hover:bg-muted/60"
      aria-label={active ? `System is ${foreground?.label?.toLowerCase() || 'working'}` : 'Open AI Assistant'}
      title={active ? foreground?.label : 'Open AI Assistant'}
    >
      <AnimatePresence mode="wait">
        {active ? (
          <motion.div
            key="active"
            className="flex items-center gap-1.5"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            <Orb size="xs" variant="trio" theme="rainbow" animated />
            <span className="text-muted-foreground hidden sm:inline max-w-[160px] truncate">
              {foreground?.label}
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            className="flex items-center gap-1.5 text-muted-foreground/70"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z" />
              <path d="M5 20h14M7 20a5 5 0 0 1 10 0" />
            </svg>
            <span className="hidden sm:inline">Assistant</span>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  )
}

