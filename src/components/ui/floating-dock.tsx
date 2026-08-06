"use client";
/**
 * Aceternity Floating Dock — official implementation, adapted for Venom CRM.
 *
 * Changes from upstream:
 *   - All hardcoded `bg-gray-*` / `dark:bg-neutral-*` colors replaced with
 *     theme CSS variables (var(--card), var(--popover), var(--muted), etc.)
 *     so the dock adapts to every theme + accent color + glass intensity.
 *   - Added optional `onClick` prop per item so the dock can drive the
 *     SPA router (the upstream `<a href>` is kept as a fallback).
 *   - Mobile dock widened to full-width bottom navigation per Phase 3 spec
 *     (instead of the upstream FAB + collapsible column).
 *
 * Source: https://ui.aceternity.com/components/floating-dock
 * Installed via: npx shadcn@latest add @aceternity/floating-dock-demo
 */

import { cn } from "@/lib/utils";
import { IconLayoutNavbarCollapse } from "@tabler/icons-react";
import {
  AnimatePresence,
  MotionValue,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";

import { useRef, useState } from "react";

export interface FloatingDockItem {
  title: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}

export const FloatingDock = ({
  items,
  desktopClassName,
  mobileClassName,
}: {
  items: FloatingDockItem[];
  desktopClassName?: string;
  mobileClassName?: string;
}) => {
  return (
    <>
      <FloatingDockMobile items={items} className={mobileClassName} />
      <FloatingDockDesktop items={items} className={desktopClassName} />
    </>
  );
};

/**
 * Mobile: full-width bottom navigation bar (Phase 3 spec).
 * Icons only, equal width, theme-aware glassmorphism.
 */
const FloatingDockMobile = ({
  items,
  className,
}: {
  items: FloatingDockItem[];
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex md:hidden items-center justify-around h-16 px-2 pb-2",
        className,
      )}
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "blur(var(--glass-blur, 12px))",
        WebkitBackdropFilter: "blur(var(--glass-blur, 12px))",
        borderTop: "1px solid var(--border)",
      }}
    >
      {items.map((item) => (
        <button
          key={item.title}
          onClick={item.onClick}
          aria-label={item.title}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
            item.active
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          <div className="h-[18px] w-[18px]">{item.icon}</div>
        </button>
      ))}
    </div>
  );
};

/**
 * Desktop: bottom-center floating dock with magnification spring animation.
 * Theme-aware glassmorphism + premium shadow.
 */
const FloatingDockDesktop = ({
  items,
  className,
}: {
  items: FloatingDockItem[];
  className?: string;
}) => {
  let mouseX = useMotionValue(Infinity);
  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 mx-auto hidden h-16 items-end gap-3 px-4 pb-3 md:flex",
        className,
      )}
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "blur(var(--glass-blur, 12px))",
        WebkitBackdropFilter: "blur(var(--glass-blur, 12px))",
        border: "1px solid var(--border)",
        borderRadius: "calc(var(--radius) + 8px)",
        boxShadow:
          "0 8px 32px -4px hsl(var(--shadow-color, 220deg 30% 50%) / 0.18), 0 2px 8px -2px hsl(var(--shadow-color, 220deg 30% 50%) / 0.12)",
      }}
    >
      {items.map((item) => (
        <IconContainer mouseX={mouseX} key={item.title} {...item} />
      ))}
    </motion.div>
  );
};

function IconContainer({
  mouseX,
  title,
  icon,
  href,
  onClick,
  active,
}: {
  mouseX: MotionValue;
  title: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  let ref = useRef<HTMLDivElement>(null);

  let distance = useTransform(mouseX, (val) => {
    let bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  let widthTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
  let heightTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);

  let widthTransformIcon = useTransform(distance, [-150, 0, 150], [20, 36, 20]);
  let heightTransformIcon = useTransform(
    distance,
    [-150, 0, 150],
    [20, 36, 20],
  );

  let width = useSpring(widthTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });
  let height = useSpring(heightTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  let widthIcon = useSpring(widthTransformIcon, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });
  let heightIcon = useSpring(heightTransformIcon, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  const [hovered, setHovered] = useState(false);

  const handleActivate = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <a href={href || "#"} onClick={handleActivate} aria-label={title} aria-current={active ? "page" : undefined}>
      <motion.div
        ref={ref}
        style={{ width, height }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "relative flex aspect-square items-center justify-center rounded-full transition-colors",
          active
            ? "bg-primary/15 text-primary"
            : "bg-muted/60 text-foreground hover:bg-muted",
        )}
      >
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 10, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 2, x: "-50%" }}
              className="absolute -top-8 left-1/2 w-fit rounded-md border px-2 py-0.5 text-xs whitespace-pre"
              style={{
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                borderColor: "var(--border)",
              }}
            >
              {title}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          style={{ width: widthIcon, height: heightIcon }}
          className="flex items-center justify-center"
        >
          {icon}
        </motion.div>
      </motion.div>
    </a>
  );
}
