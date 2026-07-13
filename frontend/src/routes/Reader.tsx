import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Type, Sparkles, Highlighter, Loader2, Minus, Plus } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api } from "@/api/mock";
import type { Block, Book, Highlight } from "@/api/types";
import { useLibrary } from "@/store/library";
import { useSettings } from "@/store/settings";
import { TypographyControls } from "@/components/reader/TypographyControls";
import { AiPanel } from "@/components/reader/AiPanel";
import { HL_HEX, HL_ORDER } from "@/lib/highlight";

const HL_COLORS = HL_HEX;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;

interface SelInfo { text: string; blockIndex: number; x: number; y: number }

/** Extra vertical rhythm per block type, in em (scales with zoom/size). */
function rowPad(type: Block["type"]): React.CSSProperties {
  switch (type) {
    case "h1": return { paddingTop: "0.7em", paddingBottom: "0.35em" };
    case "h2": return { paddingTop: "0.85em", paddingBottom: "0.3em" };
    case "h3": return { paddingTop: "0.6em", paddingBottom: "0.25em" };
    case "quote": return { paddingTop: "0.3em", paddingBottom: "0.95em" };
    default: return { paddingBottom: "0.95em" };
  }
}

export function Reader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetBlock = searchParams.get("block");
  const setProgress = useLibrary((s) => s.setProgress);
  const addHighlight = useLibrary((s) => s.addHighlight);
  const removeHighlight = useLibrary((s) => s.removeHighlight);
  const highlightsMap = useLibrary((s) => s.highlights);
  const { prefs } = useSettings();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [showType, setShowType] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [sel, setSel] = useState<SelInfo | null>(null);
  const [aiSelection, setAiSelection] = useState("");
  const [zoom, setZoom] = useState(1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    restored.current = false;
    api.getBook(id!).then((b) => {
      if (!alive) return;
      setBook(b ?? null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [id]);

  const blocks = book?.blocks ?? [];
  const fontSize = prefs.size * zoom;

  // Windowing: only the ~visible blocks are ever in the DOM, so a 1M-block
  // book costs the same as a short one. Heights are measured per item.
  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => Math.round(56 * fontSize * prefs.leading),
    overscan: 12,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // Re-measure when typography/zoom changes the intrinsic heights.
  useEffect(() => { virtualizer.measure(); }, [fontSize, prefs.leading, prefs.measure, prefs.font, virtualizer]);

  // Restore position, or jump to a cited block and flash it.
  useEffect(() => {
    if (!book || restored.current || blocks.length === 0) return;
    restored.current = true;
    requestAnimationFrame(() => {
      if (targetBlock !== null) {
        const idx = Math.min(blocks.length - 1, Math.max(0, Number(targetBlock)));
        virtualizer.scrollToIndex(idx, { align: "center" });
        setTimeout(() => {
          const node = scrollRef.current?.querySelector<HTMLElement>(`[data-block="${idx}"]`);
          if (node) { node.classList.add("cite-flash"); setTimeout(() => node.classList.remove("cite-flash"), 2000); }
        }, 120);
        return;
      }
      const idx = Math.floor(book.progress * (blocks.length - 1));
      if (idx > 0) virtualizer.scrollToIndex(idx, { align: "start" });
    });
  }, [book, targetBlock, blocks.length, virtualizer]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !book) return;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;
    setProgress(book.id, Math.min(1, Math.max(0, el.scrollTop / max)));
  }, [book, setProgress]);

  // Zoom controls (Cmd/Ctrl + =/-/0) and helpers.
  const changeZoom = useCallback((next: number) => {
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next * 100) / 100)));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "=" || e.key === "+") { e.preventDefault(); changeZoom(zoom + ZOOM_STEP); }
      else if (e.key === "-") { e.preventDefault(); changeZoom(zoom - ZOOM_STEP); }
      else if (e.key === "0") { e.preventDefault(); setZoom(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, changeZoom]);

  const bookHls = book ? highlightsMap[book.id] ?? [] : [];
  const hlByBlock = useMemo(() => {
    const map = new Map<number, Highlight[]>();
    for (const h of bookHls) {
      const arr = map.get(h.blockIndex);
      if (arr) arr.push(h); else map.set(h.blockIndex, [h]);
    }
    return map;
  }, [bookHls]);

  function captureSelection() {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) { setSel(null); return; }
    const text = s.toString().trim();
    if (text.length < 2) { setSel(null); return; }
    const range = s.getRangeAt(0);
    let node: Node | null = range.startContainer;
    let blockIndex = -1;
    while (node) {
      if (node instanceof HTMLElement && node.dataset.block) { blockIndex = Number(node.dataset.block); break; }
      node = node.parentNode;
    }
    const rect = range.getBoundingClientRect();
    setSel({ text, blockIndex, x: rect.left + rect.width / 2, y: rect.top });
  }

  function makeHighlight(color: Highlight["color"]) {
    if (!book || !sel) return;
    addHighlight({ bookId: book.id, blockIndex: sel.blockIndex, text: sel.text, color });
    window.getSelection()?.removeAllRanges();
    setSel(null);
  }
  function askAboutSelection() {
    if (!sel) return;
    setAiSelection(sel.text);
    setShowAi(true);
    window.getSelection()?.removeAllRanges();
    setSel(null);
  }

  const renderInline = useCallback((text: string, blockIndex: number): React.ReactNode => {
    const hls = (hlByBlock.get(blockIndex) ?? []).filter((h) => text.includes(h.text));
    if (hls.length === 0) return text;
    const ranges = hls
      .map((h) => ({ start: text.indexOf(h.text), end: text.indexOf(h.text) + h.text.length, h }))
      .filter((r) => r.start >= 0)
      .sort((a, b) => a.start - b.start);
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    ranges.forEach((r, i) => {
      if (r.start < cursor) return;
      if (r.start > cursor) nodes.push(text.slice(cursor, r.start));
      nodes.push(
        <mark key={i} title="Remove highlight"
          onClick={() => book && removeHighlight(book.id, r.h.id)}
          style={{ background: `color-mix(in srgb, ${HL_COLORS[r.h.color]} 32%, transparent)` }}>
          {text.slice(r.start, r.end)}
        </mark>,
      );
      cursor = r.end;
    });
    if (cursor < text.length) nodes.push(text.slice(cursor));
    return nodes;
  }, [hlByBlock, book, removeHighlight]);

  function renderBlockEl(b: Block, i: number) {
    const content = renderInline(b.text, i);
    const common = { "data-block": i, className: "reader-block", style: { margin: 0 } } as const;
    switch (b.type) {
      case "h1": return <h1 {...common}>{content}</h1>;
      case "h2": return <h2 {...common}>{content}</h2>;
      case "h3": return <h3 {...common}>{content}</h3>;
      case "quote": return <blockquote {...common}>{content}</blockquote>;
      default: return <p {...common}>{content}</p>;
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-[var(--color-text-3)]" /></div>;
  }
  if (!book) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[var(--color-text-2)]">This book could not be found.</p>
        <button onClick={() => navigate("/")} className="btn btn-ghost"><ArrowLeft size={15} /> Back to library</button>
      </div>
    );
  }

  const pct = Math.round(book.progress * 100);
  const items = virtualizer.getVirtualItems();

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Reader top bar */}
        <header className="relative z-20 flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-3">
          <button onClick={() => navigate("/")} className="btn btn-ghost !px-2"><ArrowLeft size={16} /></button>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold">{book.title}</div>
            <div className="truncate text-[12px] text-[var(--color-text-2)]">{book.author} · {pct}% · {blocks.length.toLocaleString()} blocks · {bookHls.length} highlights</div>
          </div>
          <div className="relative ml-auto flex items-center gap-1.5">
            {/* Zoom control */}
            <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <button onClick={() => changeZoom(zoom - ZOOM_STEP)} className="icon-btn !h-8 !w-8 !rounded-r-none" title="Zoom out (⌘−)"><Minus size={15} /></button>
              <button onClick={() => setZoom(1)} className="w-11 text-center text-[12px] tabular-nums text-[var(--color-text-2)] hover:text-[var(--color-text)]" title="Reset zoom (⌘0)">{Math.round(zoom * 100)}%</button>
              <button onClick={() => changeZoom(zoom + ZOOM_STEP)} className="icon-btn !h-8 !w-8 !rounded-l-none" title="Zoom in (⌘+)"><Plus size={15} /></button>
            </div>
            <button onClick={() => setShowType((v) => !v)} className="btn btn-ghost !px-2.5" title="Typography"><Type size={16} /></button>
            <button
              onClick={() => setShowAi((v) => !v)}
              className="btn !px-2.5"
              style={showAi ? { background: "#f4f4f5", color: "#101013", borderColor: "transparent" } : { background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              title="AI copilot"
            ><Sparkles size={16} /></button>
            {showType && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowType(false)} />
                <div className="surface absolute right-0 top-11 z-20 animate-in !rounded-2xl p-4 shadow-2xl"><TypographyControls /></div>
              </>
            )}
          </div>
        </header>

        {/* Progress rail */}
        <div className="h-0.5 w-full bg-[var(--color-border)]">
          <div className="h-full bg-[var(--color-signal)]" style={{ width: `${pct}%` }} />
        </div>

        {/* Reading surface (virtualized) */}
        <div ref={scrollRef} onScroll={onScroll} onMouseUp={captureSelection} className="reader-surface flex-1 overflow-y-auto" data-theme={prefs.theme}>
          <div
            className="reader-prose reader-virtual px-8 py-14"
            style={{
              ["--reader-size" as string]: `${fontSize}rem`,
              ["--reader-leading" as string]: prefs.leading,
              ["--reader-measure" as string]: `${prefs.measure}ch`,
              ["--reader-font" as string]: prefs.font === "serif" ? "var(--font-serif)" : "var(--font-sans)",
            }}
          >
            <div style={{ position: "relative", height: `${virtualizer.getTotalSize()}px` }}>
              {items.map((vi) => {
                const b = blocks[vi.index];
                return (
                  <div
                    key={vi.key}
                    data-index={vi.index}
                    ref={virtualizer.measureElement}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)`, ...rowPad(b.type) }}
                  >
                    {renderBlockEl(b, vi.index)}
                  </div>
                );
              })}
            </div>
            <div className="mt-10 border-t border-current/10 pt-6 text-center text-[13px]" style={{ color: "var(--r-muted)" }}>
              End of available content · {book.wordCount.toLocaleString()} words
            </div>
          </div>
        </div>

        {/* Selection toolbar */}
        {sel && (
          <div className="surface fixed z-40 flex animate-in items-center gap-1 !rounded-full px-1.5 py-1 shadow-2xl" style={{ left: sel.x, top: sel.y - 48, transform: "translateX(-50%)" }}>
            {HL_ORDER.map((c) => (
              <button key={c} onClick={() => makeHighlight(c)} className="h-6 w-6 rounded-full border border-white/10 transition hover:scale-110" style={{ background: HL_COLORS[c] }} title={`Highlight ${c}`} />
            ))}
            <span className="mx-1 h-5 w-px bg-[var(--color-border)]" />
            <button onClick={askAboutSelection} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium hover:bg-[var(--color-surface-2)]">
              <Sparkles size={13} className="text-[var(--color-text-2)]" /> Ask AI
            </button>
            <button onClick={() => makeHighlight("violet")} className="flex items-center gap-1 rounded-full px-2 py-1 text-[12px] hover:bg-[var(--color-surface-2)]" title="Quick highlight"><Highlighter size={13} /></button>
          </div>
        )}
      </div>

      {showAi && (
        <AiPanel book={book} selection={aiSelection} onClose={() => setShowAi(false)} onClearSelection={() => setAiSelection("")} />
      )}
    </div>
  );
}
