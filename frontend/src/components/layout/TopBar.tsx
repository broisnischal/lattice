import { BookOpen, Check, ChevronsUpDown } from "lucide-react";
import { useAuth } from "@/store/auth";
import { Tile } from "@/components/Tile";

/**
 * Custom title bar spanning the full window width. On macOS the OS draws the
 * traffic lights over the reserved left inset; we never fake them. The whole
 * bar is a drag region except the interactive controls.
 */
export function TopBar() {
  const user = useAuth((s) => s.user);

  return (
    <header className="drag flex h-[52px] shrink-0 items-center gap-3 border-b border-[var(--color-hairline)] bg-[var(--color-titlebar)] px-3">
      {/* reserve space for macOS traffic lights */}
      <div className="w-[64px] shrink-0" />

      {/* app pill */}
      <div className="no-drag flex h-[30px] items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5">
        <div
          className="tile"
          style={{ width: 18, height: 18, borderRadius: 5, background: "linear-gradient(150deg,#6ea8ff,#4c8dff)" }}
        >
          <BookOpen size={11} strokeWidth={2.5} className="relative z-10" />
        </div>
        <span className="text-[13px] font-semibold">Reader</span>
      </div>

      <div className="flex-1" />

      {/* workspace + account */}
      <button className="no-drag flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-[var(--color-text-2)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]">
        <Check size={14} className="text-[var(--color-green)]" strokeWidth={3} />
        {user?.plan === "pro" ? "Pro" : "Personal"}
        <ChevronsUpDown size={13} className="text-[var(--color-text-3)]" />
      </button>

      {user && (
        <button className="no-drag rounded-full transition active:scale-90">
          <Tile gradient={user.gradient} glyph={user.name.slice(0, 1).toUpperCase()} size={28} radius={999} />
        </button>
      )}
    </header>
  );
}
