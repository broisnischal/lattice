import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Type, Sparkles, Highlighter, Loader2 } from "lucide-react";
import { api } from "@/api/mock";
import type { Book, Highlight } from "@/api/types";
import { useLibrary } from "@/store/library";
import { useSettings } from "@/store/settings";
import { TypographyControls } from "@/components/reader/TypographyControls";
import { AiPanel } from "@/components/reader/AiPanel";

const HL_COLORS: Record<Highlight["color"], string> = {
  violet: "#7c7bff",
  amber: "#fbbf24",
  green: "#34d399",
  rose: "#fb7185",
  cyan: "#22d3ee",
};

interface SelInfo {
  text: string;
  blockIndex: number;
  x: number;
  y: number;
}

export function Reader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.getBook(id!).then((b) => {
      if (!alive) return;
      setBook(b ?? null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [id]);

  // Restore reading position once content is laid out.
  useEffect(() => {
    if (!book || restored.current || !scrollRef.current) return;
    restored.current = true;
    requestAnimationFrame(() => {
      const el = scrollRef.current!;
      el.scrollTop = book.progress * (el.scrollHeight - el.clientHeight);
    });
  }, [book]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !book) return;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;
    const p = Math.min(1, Math.max(0, el.scrollTop / max));
    setProgress(book.id, p);
  }, [book, setProgress]);

  const bookHls = book ? highlightsMap[book.id] ?? [] : [];

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

  const renderBlock = useMemo(() => {
    return (text: string, blockIndex: number) => {
      const hls = bookHls.filter((h) => h.blockIndex === blockIndex && text.includes(h.text));
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
          <mark
            key={i}
            title="Remove highlight"
            onClick={() => book && removeHighlight(book.id, r.h.id)}
            style={{ background: `color-mix(in srgb, ${HL_COLORS[r.h.color]} 32%, transparent)` }}
          >
            {text.slice(r.start, r.end)}
          </mark>,
        );
        cursor = r.end;
      });
      if (cursor < text.length) nodes.push(text.slice(cursor));
      return nodes;
    };
  }, [bookHls, book, removeHighlight]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-[var(--color-text-faint)]" />
      </div>
    );
  }
  if (!book) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[var(--color-text-muted)]">This book could not be found.</p>
        <button onClick={() => navigate("/")} className="btn btn-ghost"><ArrowLeft size={15} /> Back to library</button>
      </div>
    );
  }

  const pct = Math.round(book.progress * 100);

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Reader top bar */}
        <header className="relative z-20 flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-3">
          <button onClick={() => navigate("/")} className="btn btn-ghost !px-2"><ArrowLeft size={16} /></button>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold">{book.title}</div>
            <div className="truncate text-[12px] text-[var(--color-text-muted)]">{book.author} · {pct}% · {bookHls.length} highlights</div>
          </div>
          <div className="relative ml-auto flex items-center gap-1.5">
            <button onClick={() => setShowType((v) => !v)} className="btn btn-ghost !px-2.5" title="Typography"><Type size={16} /></button>
            <button
              onClick={() => setShowAi((v) => !v)}
              className="btn !px-2.5"
              style={showAi ? { background: "var(--color-primary)", color: "#0b0b12" } : { background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              title="AI copilot"
            >
              <Sparkles size={16} />
            </button>
            {showType && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowType(false)} />
                <div className="surface absolute right-0 top-11 z-20 animate-in !rounded-2xl p-4 shadow-2xl">
                  <TypographyControls />
                </div>
              </>
            )}
          </div>
        </header>

        {/* Progress rail */}
        <div className="h-0.5 w-full bg-[var(--color-border)]">
          <div className="h-full bg-[var(--color-primary)] transition-all" style={{ width: `${pct}%` }} />
        </div>

        {/* Reading surface */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          onMouseUp={captureSelection}
          className="reader-surface flex-1 overflow-y-auto"
          data-theme={prefs.theme}
        >
          <article
            className="reader-prose px-8 py-14"
            style={{
              // @ts-expect-error custom props
              "--reader-size": `${prefs.size}rem`,
              "--reader-leading": prefs.leading,
              "--reader-measure": `${prefs.measure}ch`,
              "--reader-font": prefs.font === "serif" ? "var(--font-serif)" : "var(--font-sans)",
            }}
          >
            {book.blocks.map((b, i) => {
              const content = renderBlock(b.text, i);
              if (b.type === "h1") return <h1 key={i} data-block={i}>{content}</h1>;
              if (b.type === "h2") return <h2 key={i} data-block={i}>{content}</h2>;
              if (b.type === "h3") return <h3 key={i} data-block={i}>{content}</h3>;
              if (b.type === "quote") return <blockquote key={i} data-block={i}>{content}</blockquote>;
              return <p key={i} data-block={i}>{content}</p>;
            })}
            <div className="mt-16 border-t border-current/10 pt-6 text-center text-[13px]" style={{ color: "var(--r-muted)" }}>
              End of available content · {book.wordCount.toLocaleString()} words
            </div>
          </article>
        </div>

        {/* Selection toolbar */}
        {sel && (
          <div
            className="surface fixed z-40 flex animate-in items-center gap-1 !rounded-full px-1.5 py-1 shadow-2xl"
            style={{ left: sel.x, top: sel.y - 48, transform: "translateX(-50%)" }}
          >
            {(Object.keys(HL_COLORS) as Highlight["color"][]).map((c) => (
              <button
                key={c}
                onClick={() => makeHighlight(c)}
                className="h-6 w-6 rounded-full border border-white/10 transition hover:scale-110"
                style={{ background: HL_COLORS[c] }}
                title={`Highlight ${c}`}
              />
            ))}
            <span className="mx-1 h-5 w-px bg-[var(--color-border)]" />
            <button onClick={askAboutSelection} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium hover:bg-[var(--color-surface-hover)]">
              <Sparkles size={13} className="text-[var(--color-primary)]" /> Ask AI
            </button>
            <button onClick={() => makeHighlight("violet")} className="flex items-center gap-1 rounded-full px-2 py-1 text-[12px] hover:bg-[var(--color-surface-hover)]" title="Quick highlight">
              <Highlighter size={13} />
            </button>
          </div>
        )}
      </div>

      {showAi && (
        <AiPanel
          book={book}
          selection={aiSelection}
          onClose={() => setShowAi(false)}
          onClearSelection={() => setAiSelection("")}
        />
      )}
    </div>
  );
}
