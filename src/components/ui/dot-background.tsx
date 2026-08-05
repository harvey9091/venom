/**
 * Aceternity Dot Background — official implementation, adapted for Venom CRM.
 *
 * Changes from upstream:
 *   - Hardcoded `#d4d4d4` / `#404040` dot colors replaced with
 *     `color-mix(in oklch, var(--muted-foreground) 18%, transparent)` so the
 *     dots automatically adapt to every theme (light + dark).
 *   - The radial mask uses `var(--background)` instead of `bg-white`/`bg-black`.
 *   - Exported as a composable `<DotBackground />` (no demo content).
 *
 * Source: https://ui.aceternity.com/components/dot-background
 * Installed via: npx shadcn@latest add @aceternity/dot-background-demo
 */
import { cn } from "@/lib/utils";

export function DotBackground({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {/* Dot pattern — theme-aware via color-mix on muted-foreground */}
      <div
        className={cn(
          "absolute inset-0 pointer-events-none",
          "[background-size:20px_20px]",
          "[background-image:radial-gradient(color-mix(in_oklch,var(--muted-foreground)_22%,transparent)_1px,transparent_1px)]",
        )}
      />
      {/* Radial mask for a faded look at the edges */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "var(--background)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, transparent 20%, black 80%)",
          maskImage:
            "radial-gradient(ellipse at center, transparent 20%, black 80%)",
        }}
      />
    </div>
  );
}
