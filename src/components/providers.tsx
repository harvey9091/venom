'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster } from 'sonner'
import { useThemeStore, applyTheme } from '@/lib/theme'
import { useAppStore } from '@/lib/store'
import { useRealtime } from '@/lib/realtime'
import { useAuth } from '@/hooks/use-auth'
import { ThinkingState } from '@/components/crm/thinking'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'error'

function IdentityBootstrap({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { session, isAuthenticated } = useAuth()
  const setUser = useAppStore((s) => s.setUser)
  const setWorkspace = useAppStore((s) => s.setWorkspace)
  const setTags = useAppStore((s) => s.setTags)
  const setWorkspaces = useAppStore((s) => s.setWorkspaces)
  const [status, setStatus] = useState<BootstrapStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const didBootstrapRef = useRef(false)
  const MAX_RETRIES = 2

  const isReady = !isAuthenticated || status === 'ready' || status === 'error'

  useEffect(() => {
    if (!isAuthenticated) {
      didBootstrapRef.current = false
      return
    }

    if (didBootstrapRef.current) return
    didBootstrapRef.current = true

    let cancelled = false
    setRetryCount(0)
    setStatus('loading')
    setError(null)

    const doBootstrap = async (isRetry = false) => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }

        const r = await fetch('/api/crm/bootstrap', {
          headers,
          ...(isRetry ? { cache: 'no-store' } : {}),
        })

        if (!r.ok) {
          const j = await r.json().catch(() => ({ ok: false, error: 'Unknown error' }))
          throw new Error(j.error || `HTTP ${r.status}`)
        }

        const j = await r.json()
        if (j.data?.user) setUser(j.data.user)
        if (j.data?.workspace) setWorkspace(j.data.workspace)
        if (j.data?.tags) setTags(j.data.tags)
        if (j.data?.memberships?.length) setWorkspaces(j.data.memberships)

        if (!cancelled) {
          setStatus('ready')
          setRetryCount(0)
        }
      } catch (e) {
        console.error('Bootstrap failed:', e)
        const err = e instanceof Error ? e : new Error(String(e))

        if (!cancelled && retryCount < MAX_RETRIES && !err.message.includes('Authentication required')) {
          const nextRetry = retryCount + 1
          setRetryCount(nextRetry)
          setTimeout(() => doBootstrap(true), 1000 * nextRetry)
          return
        }

        if (!cancelled) {
          setError(err.message || 'Failed to load workspace')
          setStatus('error')
        }
      }
    }

    doBootstrap()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, session?.access_token, setUser, setWorkspace, setTags, setWorkspaces, retryCount])

  useRealtime()

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <AnimatePresence mode="wait">
          <motion.div
            key="bootstrap-loading"
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <ThinkingState
              label={retryCount > 0 ? 'Retrying…' : 'Preparing workspace…'}
              size="xl"
              variant="orbit"
              theme="primary"
              progress={retryCount > 0 ? 50 : undefined}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  if (status === 'error' && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-4 px-4">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-white">Couldn't finish setting up your workspace</h1>
            <p className="text-sm text-zinc-400">{error}</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                didBootstrapRef.current = false
                setStatus('loading')
                setError(null)
                setRetryCount(0)
              }}
              className="flex-1 bg-primary hover:bg-primary/90 text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <Button
              onClick={() => router.push('/login')}
              variant="outline"
              className="flex-1"
            >
              Sign out
            </Button>
          </div>
        </div>
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
