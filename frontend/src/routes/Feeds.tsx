import { useMemo, useState } from "react";
import { Plus, Rss, BookmarkPlus, Check, Loader2, Circle } from "lucide-react";
import { useLibrary } from "@/store/library";
import { Tile } from "@/components/Tile";
import type { FeedItem } from "@/api/types";

function timeAgo(ts: number) {
  const h = Math.round((Date.now() - ts) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function Feeds() {
  const { feeds, feedItems, addFeed, markRead, addBook } = useLibrary();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(feedItems[0]?.id ?? null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const selected = useMemo(() => feedItems.find((i) => i.id === selectedId) ?? feedItems[0] ?? null, [feedItems, selectedId]);
  const feedFor = (id: string) => feeds.find((f) => f.id === id);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    try { await addFeed(url.trim()); setUrl(""); } finally { setBusy(false); }
  }

  function open(item: FeedItem) {
    setSelectedId(item.id);
    if (!item.read) markRead(item.id);
  }

  async function save(item: FeedItem) {
    const feed = feedFor(item.feedId);
    await addBook({
      id: uid(),
      title: item.title,
      author: feed?.title ?? "Feed",
      format: "feed",
      gradient: feed?.gradient ?? { from: "#7c7bff", to: "#22d3ee" },
      glyph: "📰",
      progress: 0,
      addedAt: Date.now(),
      source: feed?.title ?? "Feed",
      tags: ["saved"],
      blocks: item.blocks,
      wordCount: item.blocks.reduce((n, b) => n + b.text.split(/\s+/).length, 0),
    });
    setSavedIds((s) => new Set(s).add(item.id));
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-4">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">Feeds</h1>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">{feeds.length} sources · save any article as a book</p>
        </div>
        <form onSubmit={onAdd} className="ml-auto flex w-full max-w-md gap-2">
          <div className="relative flex-1">
            <Rss size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
            <input className="input !pl-9" placeholder="Add RSS feed or site URL…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Subscribe</button>
        </form>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,380px)_1fr]">
        {/* List */}
        <div className="overflow-y-auto border-r border-[var(--color-border)]">
          {feedItems.map((item) => {
            const feed = feedFor(item.feedId);
            const active = selected?.id === item.id;
            return (
              <button
                key={item.id}
                onClick={() => open(item)}
                className="flex w-full items-start gap-3 border-b border-[var(--color-border)] px-4 py-3.5 text-left transition"
                style={active ? { background: "var(--color-surface-hover)" } : undefined}
              >
                {feed && <Tile gradient={feed.gradient} glyph={feed.glyph} size={38} />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {!item.read && <Circle size={7} className="fill-[var(--color-primary)] text-[var(--color-primary)]" />}
                    <span className="truncate text-[11.5px] font-medium text-[var(--color-text-muted)]">{feed?.title}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-[var(--color-text-faint)]">{timeAgo(item.publishedAt)}</span>
                  </div>
                  <div className={`mt-0.5 line-clamp-1 text-[13.5px] font-semibold ${item.read ? "text-[var(--color-text-muted)]" : ""}`}>{item.title}</div>
                  <div className="mt-0.5 line-clamp-2 text-[12px] text-[var(--color-text-muted)]">{item.excerpt}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Reading pane */}
        <div className="reader-surface overflow-y-auto" data-theme="dark">
          {selected ? (
            <div className="mx-auto max-w-2xl px-10 py-12">
              <div className="mb-5 flex items-center justify-between">
                <span className="chip">{feedFor(selected.feedId)?.title}</span>
                <button
                  onClick={() => save(selected)}
                  disabled={savedIds.has(selected.id)}
                  className="btn btn-ghost"
                >
                  {savedIds.has(selected.id) ? <><Check size={15} /> Saved</> : <><BookmarkPlus size={15} /> Save to library</>}
                </button>
              </div>
              <article className="reader-prose !mx-0" style={{ ["--reader-measure" as string]: "62ch" }}>
                {selected.blocks.map((b, i) =>
                  b.type === "h1" ? <h1 key={i}>{b.text}</h1> : b.type === "h2" ? <h2 key={i}>{b.text}</h2> : <p key={i}>{b.text}</p>,
                )}
              </article>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">Select an article to read</div>
          )}
        </div>
      </div>
    </div>
  );
}
