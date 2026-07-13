import type { ReactNode } from "react";
import type { Gradient } from "@/api/types";
import { cn } from "@/lib/cn";

interface IconTileProps {
  gradient: Gradient;
  children: ReactNode;
  size?: number;
  className?: string;
}

/**
 * The colored squircle used for collections, books, feeds and connections.
 * Color is confined here by design — the rest of the chrome stays neutral.
 */
export function IconTile({ gradient, children, size = 40, className }: IconTileProps) {
  return (
    <div
      className={cn("tile", className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: `linear-gradient(150deg, ${gradient.from}, ${gradient.to})`,
      }}
    >
      <span className="relative z-10 grid place-items-center" style={{ filter: "drop-shadow(0 1px 1px rgb(0 0 0 / 0.35))" }}>
        {children}
      </span>
    </div>
  );
}
