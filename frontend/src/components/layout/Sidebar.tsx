import { NavLink } from "react-router-dom";
import { Library, Rss, Highlighter, Blocks, Settings as SettingsIcon } from "lucide-react";
import { useLibrary } from "@/store/library";

const NAV = [
  { to: "/", label: "Library", icon: Library, end: true },
  { to: "/feeds", label: "Feeds", icon: Rss },
  { to: "/highlights", label: "Highlights", icon: Highlighter },
  { to: "/connections", label: "Connect", icon: Blocks },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar() {
  const feeds = useLibrary((s) => s.feeds);
  const highlights = useLibrary((s) => s.highlights);
  const unread = feeds.reduce((n, f) => n + f.unread, 0);
  const hlCount = Object.values(highlights).reduce((n, arr) => n + arr.length, 0);

  return (
    <aside className="flex w-[224px] shrink-0 flex-col bg-[var(--color-sidebar)]">
      <nav className="flex flex-1 flex-col gap-0.5 px-2.5 py-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
          >
            <Icon size={17} strokeWidth={1.9} />
            <span className="flex-1">{label}</span>
            {label === "Feeds" && unread > 0 && (
              <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--color-accent)] px-1 text-[11px] font-semibold text-white">
                {unread}
              </span>
            )}
            {label === "Highlights" && hlCount > 0 && (
              <span className="text-[12px] tabular-nums text-[var(--color-text-3)]">{hlCount}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* footer */}
      <div className="flex items-center justify-between px-4 py-3 text-[11.5px] text-[var(--color-text-3)]">
        <span className="font-medium">Reader</span>
        <span className="font-mono">v0.1.0</span>
      </div>
    </aside>
  );
}
