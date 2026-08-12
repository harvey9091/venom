'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { SymbioteLogo } from '@/components/auth/symbiote-logo'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message || 'Invalid email or password')
        setLoading(false)
        return
      }
      router.push(redirect)
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="w-full space-y-6 animate-fade-in-up">
      <div className="text-center space-y-2 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mb-4">
          <SymbioteLogo className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back</h1>
        <p className="text-sm text-zinc-400">Sign in to your Venom CRM workspace</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        {error && (
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-red-400 backdrop-blur-sm animate-fade-in-up">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-zinc-300">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-primary focus:ring-primary/20 focus:ring-2 focus:shadow-[0_0_15px_rgba(255,255,255,0.03)] transition-all duration-300"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-zinc-300">Password</Label>
            <Link href="/forgot-password" className="text-xs text-zinc-400 hover:text-white transition-colors duration-200">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-primary focus:ring-primary/20 focus:ring-2 focus:shadow-[0_0_15px_rgba(255,255,255,0.03)] transition-all duration-300 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary/90 text-white font-medium transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]"
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </form>

      <div className="text-center text-sm text-zinc-400 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-white hover:text-white/80 transition-colors duration-200">
          Sign up
        </Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full space-y-6"><div className="h-8 bg-zinc-800/50 rounded animate-pulse" /></div>}>
      <LoginForm />
    </Suspense>
  )
}
