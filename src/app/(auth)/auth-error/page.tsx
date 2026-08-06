'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SymbioteLogo } from '@/components/auth/symbiote-logo'

export default function AuthErrorPage() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/login')
    }, 5000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="w-full space-y-6 text-center">
      <div className="flex justify-center">
        <SymbioteLogo size={48} />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-white">Authentication Error</h1>
        <p className="text-sm text-zinc-400">
          Something went wrong during authentication. Please try again.
        </p>
      </div>
      <Button
        onClick={() => router.push('/login')}
        className="bg-primary hover:bg-primary/90 text-white font-medium"
      >
        Return to Login
      </Button>
    </div>
  )
}
