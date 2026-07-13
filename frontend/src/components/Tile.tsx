import type { Gradient } from "@/api/types";
import { cn } from "@/lib/cn";

interface TileProps {
  gradient: Gradient;
  glyph: string;
  size?: number;
  radius?: number;
  className?: string;
}

/** The colored, gradient icon used for books, collections, feeds, avatars. */
export function Tile({ gradient, glyph, size = 44, radius = 12, className }: TileProps) {
  const isImageGlyph = glyph.length <= 2 && /[A-Za-z]/.test(glyph);
  return (
    <div
      className={cn("tile", className)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(140deg, ${gradient.from}, ${gradient.to})`,
        fontSize: isImageGlyph ? size * 0.42 : size * 0.5,
        fontWeight: 700,
      }}
    >
      <span style={{ filter: "drop-shadow(0 1px 1px rgb(0 0 0 / 0.3))" }}>{glyph}</span>
    </div>
  );
}
