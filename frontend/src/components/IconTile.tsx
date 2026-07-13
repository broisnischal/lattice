import type { ReactNode } from "react";
import type { Gradient } from "@/api/types";
import { cn } from "@/lib/cn";

interface IconTileProps {
  /** Retained for call-site compatibility; no longer rendered. The tile is
   *  a neutral graphite squircle — identity comes from the glyph, not hue. */
  gradient?: Gradient;
  children: ReactNode;
  size?: number;
  className?: string;
}

/**
 * The neutral graphite squircle used for collections, books, feeds and
 * connections. Fully monochrome by design — no gradients, no color.
 */
export function IconTile({ children, size = 40, className }: IconTileProps) {
  return (
    <div
      className={cn("tile", className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
    >
      <span className="relative z-10 grid place-items-center">{children}</span>
    </div>
  );
}
