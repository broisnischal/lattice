import { useState } from "react";
import { X, Link2, FileText, Upload, Loader2, ArrowLeft, Check } from "lucide-react";
import { api } from "@/api/mock";
import { useLibrary } from "@/store/library";
import { parseFile } from "@/lib/import";
import { FORMAT_META } from "@/lib/format";
import type { Book } from "@/api/types";

export type Tab = "url" | "text" | "file" | "notion";

const TABS: { id: Tab; label: string; icon: typeof Link2 }[] = [
  { id: "url", label: "From URL", icon: Link2 },
  { id: "text", label: "Paste text", icon: FileText },
  { id: "file", label: "Upload file", icon: Upload },
  { id: "notion", label: "Notion", icon: FileText },
];

const uid = () => Math.random().toString(36).slice(2, 10);
const NEUTRAL = { from: "#26262a", to: "#171719" };
const wordsOf = (book: Book) => book.blocks.reduce((n, b) => n + b.text.split(/\s+/).length, 0);

export function ImportDialog({ onClose, initialTab = "url" }: { onClose: () => void; initialTab?: Tab }) {
  const addBook = useLibrary((s) => s.addBook);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Book | null>(null);

  async function convert() {
    setBusy(true);
    setError("");
    try {
      let book: Book;
      if (tab === "url") book = await api.convert({ kind: "url", value: url || "example.com", title });
      else if (tab === "notion") book = await api.convert({ kind: "notion", value: title || "page", title });
      else book = await api.convert({ kind: "text", value: text, title: title || "Pasted note" });
      setPreview(book);
    } catch {
      setError("Couldn't extract readable content. Check the address and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    setProgress(0);
    try {
      const parsed = await parseFile(file, (v) => setProgress(v));
      const format = parsed.format;
      const glyph = format === "pdf" ? "📄" : format === "epub" ? "📖" : format === "markdown" ? "📝" : "📃";
      const book: Book = {
        id: uid(),
        title: parsed.title || file.name.replace(/\.[^.]+$/, ""),
        author: parsed.author || "You",
        format,
        gradient: NEUTRAL,
        glyph,
        progress: 0,
        addedAt: Date.now(),
        source: "Upload",
        tags: [],
        blocks: parsed.blocks,
        wordCount: parsed.blocks.reduce((n, b) => n + b.text.split(/\s+/).length, 0),
      };
      setPreview(book);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function commit() {
    if (!preview) return;
    setBusy(true);
    try {
      await addBook(preview);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg animate-in surface !rounded-2xl p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            {preview && (
              <button onClick={() => { setPreview(null); setError(""); }} className="icon-btn -ml-1.5" title="Back">
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <h3 className="text-[15px] font-semibold">{preview ? "Preview" : "Add to library"}</h3>
              <p className="text-[12px] text-[var(--color-text-muted)]">
                {preview ? "Review the extracted content, then add it." : "Turn anything into a clean, readable book."}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-text-faint)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]">
            <X size={18} />
          </button>
        </div>

        {preview ? (
          <PreviewPane book={preview} />
        ) : (
          <>
            <div className="flex gap-1 px-4 pt-4">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setTab(id); setError(""); }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition"
                  style={tab === id ? { background: "var(--color-surface-2)", color: "var(--color-text)", border: "1px solid var(--color-border-2)" } : { color: "var(--color-text-muted)" }}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>

            <div className="space-y-3 p-5">
              {tab !== "file" && (
                <input className="input" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
              )}
              {tab === "url" && (
                <input className="input" placeholder="https://article-to-read.com/…" value={url} onChange={(e) => setUrl(e.target.value)} />
              )}
              {tab === "text" && (
                <textarea className="input min-h-32 resize-y" placeholder="Paste an article, notes, or a chapter…" value={text} onChange={(e) => setText(e.target.value)} />
              )}
              {tab === "notion" && (
                <p className="rounded-xl border border-dashed border-[var(--color-border-strong)] p-4 text-[13px] text-[var(--color-text-muted)]">
                  Connect Notion in <b>Connect</b> to browse pages. For now, type a page title above to import a sample page.
                </p>
              )}
              {tab === "file" && (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border-strong)] p-8 text-center transition hover:border-[var(--color-border-2)]">
                  {busy ? <Loader2 size={22} className="animate-spin text-[var(--color-text-muted)]" /> : <Upload size={22} className="text-[var(--color-text-muted)]" />}
                  <span className="text-[13px] font-medium">
                    {busy ? "Extracting…" : "Choose an EPUB, PDF, TXT or Markdown file"}
                  </span>
                  <span className="text-[11px] text-[var(--color-text-faint)]">EPUB & PDF are parsed properly — never as raw bytes</span>
                  <input type="file" accept=".epub,.pdf,.txt,.md,.markdown" className="hidden" onChange={onFile} disabled={busy} />
                </label>
              )}

              {progress !== null && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                  <div className="h-full bg-[var(--color-signal)] transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              )}
              {error && <p className="text-[13px] text-[var(--color-text-2)]">{error}</p>}
            </div>

            {tab !== "file" && (
              <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
                <button onClick={onClose} className="btn btn-ghost">Cancel</button>
                <button onClick={convert} disabled={busy} className="btn btn-primary">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                  Extract &amp; preview
                </button>
              </div>
            )}
          </>
        )}

        {preview && (
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
            <button onClick={() => setPreview(null)} className="btn btn-ghost">Back</button>
            <button onClick={commit} disabled={busy} className="btn btn-primary">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Add to library
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewPane({ book }: { book: Book }) {
  const { Icon, label } = FORMAT_META[book.format];
  const first = book.blocks.slice(0, 9);
  return (
    <div className="p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="tile grid place-items-center" style={{ width: 40, height: 40, borderRadius: 11 }}>
          <Icon size={18} className="text-[var(--color-text-2)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold">{book.title}</div>
          <div className="mt-0.5 text-[12.5px] text-[var(--color-text-2)]">
            {book.author} · {label} · {book.blocks.length.toLocaleString()} blocks · {wordsOf(book).toLocaleString()} words
          </div>
        </div>
      </div>
      <div className="reader-surface max-h-72 overflow-y-auto rounded-xl border border-[var(--color-border)] px-5 py-4" data-theme="dark">
        <div className="reader-prose !mx-0 !max-w-none" style={{ ["--reader-size" as string]: "1rem", ["--reader-leading" as string]: 1.6 }}>
          {first.map((b, i) =>
            b.type === "h1" ? <h1 key={i} style={i === 0 ? { marginTop: 0 } : undefined}>{b.text}</h1>
            : b.type === "h2" ? <h2 key={i}>{b.text}</h2>
            : b.type === "h3" ? <h3 key={i}>{b.text}</h3>
            : b.type === "quote" ? <blockquote key={i}>{b.text}</blockquote>
            : <p key={i}>{b.text}</p>,
          )}
          {book.blocks.length > first.length && (
            <p className="text-[var(--r-muted)]">…and {(book.blocks.length - first.length).toLocaleString()} more blocks.</p>
          )}
        </div>
      </div>
    </div>
  );
}
