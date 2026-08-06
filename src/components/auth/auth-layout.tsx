import { cn } from '@/lib/utils'
import { SymbioteLogo } from './symbiote-logo'

export function AuthLayout({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-h-screen flex items-center justify-center relative overflow-hidden bg-black', className)}>
      {/* Symbiote animated background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* Primary flowing organic shape */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[900px] animate-liquid-morph opacity-40"
          style={{
            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.06), transparent 60%)',
          }}
        />

        {/* Secondary organic shape */}
        <div
          className="absolute bottom-0 right-0 w-[700px] h-[700px] animate-liquid-morph opacity-25"
          style={{
            background: 'radial-gradient(circle at 70% 70%, rgba(255,255,255,0.04), transparent 60%)',
            animationDelay: '-4s',
          }}
        />

        {/* Glowing accent orbs */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full blur-[120px] animate-glow-pulse bg-white/[0.03]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[120px] animate-glow-pulse bg-white/[0.03]" style={{ animationDelay: '-2s' }} />

        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Glassmorphism card */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-fade-in-up">
        <div className="bg-black/60 backdrop-blur-2xl border border-white/[0.07] rounded-3xl p-8 shadow-premium">
          {/* Symbiote brand */}
          <div className="flex justify-center mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="relative">
              <div className="absolute inset-0 bg-white/5 rounded-2xl blur-xl animate-glow-pulse" />
              <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/10">
                <SymbioteLogo className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
