'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useEffect, useRef, useState } from 'react'
import { Toaster } from 'sonner'
import { useThemeStore, applyTheme } from '@/lib/theme'
import { useAppStore } from '@/lib/store'
import { useRealtime } from '@/lib/realtime'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

/** Bootstrap identity: pick the first user + their primary workspace from DB. */
function IdentityBootstrap({ children }: { children: React.ReactNode }) {
  const setUser = useAppStore((s) => s.setUser)
  const setWorkspace = useAppStore((s) => s.setWorkspace)
  const setTags = useAppStore((s) => s.setTags)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch('/api/crm/bootstrap')
        const j = await r.json()
        if (j.data?.user) setUser(j.data.user)
        if (j.data?.workspace) setWorkspace(j.data.workspace)
        if (j.data?.tags) setTags(j.data.tags)
        setReady(true)
      } catch (e) {
        console.error('Bootstrap failed', e)
        setReady(true)
      }
    })()
  }, [setUser, setWorkspace, setTags])

  useRealtime()

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-xl bg-primary/20 animate-ping" />
            <div className="absolute inset-0 rounded-xl bg-primary/60" />
          </div>
          <div className="text-sm text-muted-foreground">Loading Pulse CRM…</div>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

function ThemeApplier({ children }: { children: React.ReactNode }) {
  const config = useThemeStore((s) => s.config)
  useEffect(() => { applyTheme(config) }, [config])
  return <>{children}</>
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
