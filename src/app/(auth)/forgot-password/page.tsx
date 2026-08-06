'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { SymbioteLogo } from '@/components/auth/symbiote-logo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { resetPassword, isLoading: authLoading } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await resetPassword(email)
      if (error) {
        setError(error.message || 'Failed to send reset email')
        setLoading(false)
        return
      }
      setSuccess(true)
      setLoading(false)
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full space-y-6 animate-fade-in-up">
        <div className="text-center space-y-2 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Check your email</h1>
          <p className="text-sm text-zinc-400">
            We&apos;ve sent a password reset link to <span className="text-white">{email}</span>
          </p>
        </div>

        <Alert className="bg-zinc-900/50 border-zinc-800 text-zinc-300 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <AlertDescription>
            Click the link in the email to reset your password. The link will expire in 1 hour.
          </AlertDescription>
        </Alert>

        <div className="text-center text-sm text-zinc-400 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <Link href="/login" className="text-white hover:text-white/80 transition-colors duration-200">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 animate-fade-in-up">
      <div className="text-center space-y-2 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mb-4">
          <SymbioteLogo className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Forgot password?</h1>
        <p className="text-sm text-zinc-400">
          Enter your email and we&apos;ll send you a reset link
        </p>
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

        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary/90 text-white font-medium transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]"
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send Reset Link
        </Button>
      </form>

      <div className="text-center text-sm text-zinc-400 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        <Link href="/login" className="text-white hover:text-white/80 transition-colors duration-200">
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
