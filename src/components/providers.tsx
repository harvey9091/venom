'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useEffect, useRef, useState } from 'react'
import { Toaster } from 'sonner'
import { useThemeStore, applyTheme } from '@/lib/theme'
import { useAppStore } from '@/lib/store'
import { useRealtime } from '@/lib/realtime'
import { useAuth } from '@/hooks/use-auth'
import { ThinkingState } from '@/components/crm/thinking'
import { AnimatePresence, motion } from 'framer-motion'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function IdentityBootstrap({ children }: { children: React.ReactNode }) {
  const setUser = useAppStore((s) => s.setUser)
  const setWorkspace = useAppStore((s) => s.setWorkspace)
  const setTags = useAppStore((s) => s.setTags)
  const [ready, setReady] = useState(false)
  const [label, setLabel] = useState('Preparing workspace…')
  const [progress, setProgress] = useState(0)
  const { isLoading, isAuthenticated } = useAuth()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!isAuthenticated) {
          setReady(true)
          return
        }

        setLabel('Preparing workspace…')
        setProgress(10)
        await new Promise((r) => setTimeout(r, 350))

        const r = await fetch('/api/crm/bootstrap')
        setLabel('Loading members…')
        setProgress(40)
        await new Promise((r) => setTimeout(r, 200))
        if (cancelled) return
        const j = await r.json()
        if (j.data?.user) setUser(j.data.user)
        if (j.data?.workspace) setWorkspace(j.data.workspace)
        if (j.data?.tags) setTags(j.data.tags)

        setLabel('Syncing data…')
        setProgress(75)
        await new Promise((r) => setTimeout(r, 250))
        if (cancelled) return
        setLabel('Ready')
        setProgress(100)
        await new Promise((r) => setTimeout(r, 150))
        if (cancelled) return
        setReady(true)
      } catch (e) {
        console.error('Bootstrap failed', e)
        setReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [setUser, setWorkspace, setTags, isAuthenticated])

  useRealtime()

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <AnimatePresence mode="wait">
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <ThinkingState
              label={label}
              size="xl"
              variant="orbit"
              theme="primary"
              progress={progress}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }
  return <>{children}</>
}

function ThemeApplier({ children }: { children: React.ReactNode }) {
  const config = useThemeStore((s) => s.config)
  const [thinking, setThinking] = useState(false)
  const prevTheme = useRef(config.theme)
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (config.theme !== prevTheme.current) {
      Promise.resolve().then(() => setThinking(true))
      applyTheme(config)
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
      pendingTimer.current = setTimeout(() => setThinking(false), 420)
      prevTheme.current = config.theme
      return () => {
        if (pendingTimer.current) clearTimeout(pendingTimer.current)
      }
    }
    applyTheme(config)
  }, [config])

  return (
    <>
      {children}
      <AnimatePresence>
        {thinking && (
          <motion.div
            className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <ThinkingState size="sm" variant="pulse" theme="primary" compact animated />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <ThemeApplier>
          <IdentityBootstrap>{children}</IdentityBootstrap>
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeApplier>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
