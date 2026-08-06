import { cn } from '@/lib/utils'

interface SymbioteLogoProps {
  className?: string
  size?: number
}

export function SymbioteLogo({ className, size = 48 }: SymbioteLogoProps) {
  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        {/* Outer ring */}
        <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1" opacity="0.2" className="text-primary" />
        {/* Middle ring */}
        <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.4" className="text-primary" />
        {/* Inner ring */}
        <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="2" opacity="0.6" className="text-primary" />
        {/* Core */}
        <circle cx="24" cy="24" r="6" fill="currentColor" opacity="0.8" className="text-primary" />
        {/* Accent dots */}
        <circle cx="24" cy="10" r="2" fill="currentColor" opacity="0.6" className="text-primary" />
        <circle cx="24" cy="38" r="2" fill="currentColor" opacity="0.6" className="text-primary" />
        <circle cx="10" cy="24" r="2" fill="currentColor" opacity="0.6" className="text-primary" />
        <circle cx="38" cy="24" r="2" fill="currentColor" opacity="0.6" className="text-primary" />
      </svg>
    </div>
  )
}
