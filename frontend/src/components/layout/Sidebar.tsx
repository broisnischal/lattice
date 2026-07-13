import { NavLink } from "react-router-dom";
import {
  Library,
  Rss,
  Highlighter,
  Blocks,
  Settings as SettingsIcon,
  Sparkles,
  Layers3,
  Repeat,
} from "lucide-react";
import { useMemo } from "react";
import { useLibrary } from "@/store/library";
import { useReview, dueCount } from "@/store/review";

interface NavDef {
  to: string;
  label: string;
  icon: typeof Library;
  end?: boolean;
  badge?: "unread" | "due" | "count";
}

const PRIMARY: NavDef[] = [
  { to: "/", label: "Library", icon: Library, end: true },
  { to: "/feeds", label: "Feeds", icon: Rss, badge: "unread" },
  { to: "/highlights", label: "Highlights", icon: Highlighter, badge: "count" },
];

const AI: NavDef[] = [
  { to: "/ask", label: "Ask library", icon: Sparkles },
  { to: "/review", label: "Review", icon: Repeat, badge: "due" },
  { to: "/threads", label: "Threads", icon: Layers3 },
];

const FOOTER: NavDef[] = [
  { to: "/connections", label: "Connect", icon: Blocks },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar() {
  const feeds = useLibrary((s) => s.feeds);
  const highlights = useLibrary((s) => s.highlights);
  const cards = useReview((s) => s.cards);

  const unread = feeds.reduce((n, f) => n + f.unread, 0);
  const hlIds = useMemo(() => Object.values(highlights).flat().map((h) => h.id), [highlights]);
  const hlCount = hlIds.length;
  const due = dueCount(cards, hlIds);

  function renderItem({ to, label, icon: Icon, end, badge }: NavDef) {
    return (
      <NavLink
        key={to}
        to={to}
        end={end}
        className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
      >
        <Icon size={16.5} strokeWidth={1.9} />
        <span className="flex-1">{label}</span>
        {badge === "unread" && unread > 0 && <span className="badge-neutral">{unread}</span>}
        {badge === "due" && due > 0 && <span className="badge-neutral">{due}</span>}
        {badge === "count" && hlCount > 0 && (
          <span className="text-[12px] tabular-nums text-[var(--color-text-3)]">{hlCount}</span>
        )}
      </NavLink>
    );
  }

  return (
    <aside className="flex w-[224px] shrink-0 flex-col bg-[var(--color-sidebar)]">
      <nav className="flex flex-1 flex-col gap-0.5 px-2.5 py-3">
        {PRIMARY.map(renderItem)}

        <div className="px-2.5 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-3)]">
          Intelligence
        </div>
        {AI.map(renderItem)}

        <div className="flex-1" />
        {FOOTER.map(renderItem)}
      </nav>

      <div className="flex items-center justify-between px-4 py-3 text-[11.5px] text-[var(--color-text-3)]">
        <span className="font-medium">Reader</span>
        <span className="font-mono">v0.1.0</span>
      </div>
    </aside>
  );
}
