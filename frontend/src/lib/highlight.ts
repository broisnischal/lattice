import type { Highlight } from "@/api/types";

/**
 * Muted marker palette. Highlights are user content, so a little hue is
 * allowed here — but every value is deliberately low-saturation so the app
 * still reads monochrome. These map to the --hl-* tokens in index.css.
 */
export const HL_COLORS: Record<Highlight["color"], string> = {
  violet: "var(--hl-violet)",
  amber: "var(--hl-amber)",
  green: "var(--hl-green)",
  rose: "var(--hl-rose)",
  cyan: "var(--hl-cyan)",
};

/** Resolved hex values (for contexts where CSS vars can't reach, e.g. SVG). */
export const HL_HEX: Record<Highlight["color"], string> = {
  violet: "#9b93c4",
  amber: "#c6ab73",
  green: "#86b48c",
  rose: "#c58f95",
  cyan: "#82abbd",
};

export const HL_ORDER: Highlight["color"][] = ["violet", "amber", "green", "rose", "cyan"];
