import type { Gradient } from "@/api/types";
import { cn } from "@/lib/cn";

interface TileProps {
  /** Retained for call-site compatibility; no longer rendered. */
  gradient?: Gradient;
  glyph: string;
  size?: number;
  radius?: number;
  className?: string;
}

/** The neutral graphite squircle used for feeds, avatars, connections. */
export function Tile({ glyph, size = 44, radius = 12, className }: TileProps) {
  const isInitial = glyph.length <= 2 && /[A-Za-z]/.test(glyph);
  return (
    <div
      className={cn("tile", className)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: isInitial ? size * 0.4 : size * 0.46,
        fontWeight: 600,
        color: "var(--color-text-2)",
      }}
    >
      <span className="relative z-10">{glyph}</span>
    </div>
  );
}
