import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, ChevronDown, ArrowDownUp, LayoutGrid, Link2, FileText, Upload } from "lucide-react";
import { useLibrary } from "@/store/library";
import { BookRow } from "@/components/library/BookRow";
import { GroupCard } from "@/components/library/GroupCard";
import { IconTile } from "@/components/IconTile";
import { ImportDialog, type Tab } from "@/components/ImportDialog";

type Sort = "recent" | "title" | "progress";
const SORT_LABEL: Record<Sort, string> = { recent: "Recent", title: "A–Z", progress: "Progress" };

export function Library() {
  const { books, collections, loaded } = useLibrary();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [importing, setImporting] = useState<Tab | null>(null);
  const [addMenu, setAddMenu] = useState(false);
  const [sortMenu, setSortMenu] = useState(false);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    let list = books;
    if (activeCollection) list = list.filter((b) => b.collectionId === activeCollection);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.tags.some((t) => t.includes(q)));
    }
    const sorted = [...list];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "progress") sorted.sort((a, b) => b.progress - a.progress);
    else sorted.sort((a, b) => b.addedAt - a.addedAt);
    return sorted;
  }, [books, query, sort, activeCollection]);

  const addMenuItems: { tab: Tab; label: string; icon: typeof Link2 }[] = [
    { tab: "url", label: "From URL", icon: Link2 },
    { tab: "text", label: "Paste text", icon: FileText },
    { tab: "file", label: "Upload file", icon: Upload },
    { tab: "notion", label: "From Notion", icon: FileText },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="shrink-0 px-6 pt-5">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-3)]" />
          <input
            ref={searchRef}
            className="field !h-11 !pl-10 !text-[14px]"
            placeholder="Search your library…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--color-text-3)] sm:flex">
            ⌘K
          </kbd>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          {/* Split add button */}
          <div className="relative flex">
            <button className="btn btn-primary !rounded-r-none !pr-2.5" onClick={() => setImporting("url")}>
              <Plus size={16} /> Add book
            </button>
            <button
              className="btn btn-primary !rounded-l-none !border-l !border-l-black/15 !px-1.5"
              onClick={() => setAddMenu((v) => !v)}
              aria-label="More add options"
            >
              <ChevronDown size={15} />
            </button>
            {addMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAddMenu(false)} />
                <div className="card animate-scale-in absolute left-0 top-[38px] z-40 w-44 origin-top-left p-1 shadow-2xl">
                  {addMenuItems.map(({ tab, label, icon: Icon }) => (
                    <button
                      key={tab}
                      onClick={() => { setAddMenu(false); setImporting(tab); }}
                      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-[var(--color-text)] transition hover:bg-[var(--color-surface-2)]"
                    >
                      <Icon size={15} className="text-[var(--color-text-2)]" /> {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Sort */}
          <div className="relative">
            <button className="btn btn-quiet" onClick={() => setSortMenu((v) => !v)}>
              <ArrowDownUp size={15} /> {SORT_LABEL[sort]} <ChevronDown size={14} />
            </button>
            {sortMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setSortMenu(false)} />
                <div className="card animate-scale-in absolute right-0 top-[38px] z-40 w-36 origin-top-right p-1 shadow-2xl">
                  {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSort(s); setSortMenu(false); }}
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] transition hover:bg-[var(--color-surface-2)]"
                      style={{ color: sort === s ? "var(--color-text)" : "var(--color-text-2)" }}
                    >
                      {SORT_LABEL[s]}
                      {sort === s && <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-signal)]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Scroll area */}
      <div className="mt-4 flex-1 overflow-y-auto px-6 pb-8">
        {/* Collections */}
        <section className="mb-6">
          <div className="mb-2.5 section-label">Collections</div>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            <div
              onClick={() => setActiveCollection(null)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setActiveCollection(null)}
              className="card card-hover flex cursor-pointer items-center gap-3 p-3"
              style={activeCollection === null ? { borderColor: "var(--color-border-2)", background: "var(--color-surface-2)" } : undefined}
            >
              <IconTile gradient={{ from: "#3a3a3f", to: "#1c1c20" }} size={38}>
                <LayoutGrid size={17} strokeWidth={2} />
              </IconTile>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-semibold leading-tight">All books</div>
                <div className="mt-0.5 text-[12.5px] text-[var(--color-text-2)]">{books.length} books</div>
              </div>
            </div>
            {collections.map((c) => (
              <GroupCard
                key={c.id}
                collection={c}
                active={activeCollection === c.id}
                onClick={() => setActiveCollection(activeCollection === c.id ? null : c.id)}
              />
            ))}
          </div>
        </section>

        {/* Books */}
        <section>
          <div className="mb-2.5 flex items-center gap-2">
            <span className="section-label">
              {activeCollection ? collections.find((c) => c.id === activeCollection)?.name : "All books"}
            </span>
            <span className="text-[12.5px] text-[var(--color-text-3)]">{filtered.length}</span>
          </div>

          {!loaded ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="card flex items-center gap-3 p-3">
                  <div className="h-[38px] w-[38px] shrink-0 animate-pulse rounded-[11px] bg-[var(--color-surface-2)]" />
                  <div className="flex-1">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--color-surface-2)]" />
                    <div className="mt-2 h-2.5 w-1/4 animate-pulse rounded bg-[var(--color-surface-2)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card flex flex-col items-center justify-center gap-2 py-14 text-center">
              <p className="text-[14px] font-medium">Nothing here yet</p>
              <p className="text-[13px] text-[var(--color-text-2)]">Add a book, article, PDF, or paste text to begin.</p>
              <button onClick={() => setImporting("url")} className="btn btn-primary mt-2"><Plus size={15} /> Add your first</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((b) => <BookRow key={b.id} book={b} />)}
            </div>
          )}
        </section>
      </div>

      {importing && <ImportDialog initialTab={importing} onClose={() => setImporting(null)} />}
    </div>
  );
}
