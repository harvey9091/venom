'use client'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useThemeStore, THEME_PRESETS } from '@/lib/theme'
import { useAppStore } from '@/lib/store'
import { Palette, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export function ThemeSwitcher() {
  const { config, setTheme } = useThemeStore()
  const navigate = useAppStore((s) => s.navigate)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Themes">
          <Palette size={15} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-3">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Themes</div>
          <div className="grid grid-cols-2 gap-1.5">
            {THEME_PRESETS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  'group flex items-center gap-2 p-2 rounded-lg border transition-all text-left',
                  config.theme === t.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:bg-muted/50'
                )}
              >
                <div className="flex shrink-0 -space-x-1.5">
                  {t.swatch.map((c, i) => (
                    <span key={i} className="w-3.5 h-3.5 rounded-full ring-1 ring-background" style={{ background: c }} />
                  ))}
                </div>
                <span className="text-[11px] font-medium truncate flex-1">{t.name}</span>
                {config.theme === t.id && <Check size={12} className="text-primary shrink-0" />}
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate('settings')}
            className="w-full mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            Customize accent, radius, density →
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
