import { useState } from "react";
import { X, Link2, FileText, Upload, Loader2 } from "lucide-react";
import { api } from "@/api/mock";
import { useLibrary } from "@/store/library";
import type { Block, Book } from "@/api/types";

export type Tab = "url" | "text" | "file" | "notion";

const TABS: { id: Tab; label: string; icon: typeof Link2 }[] = [
  { id: "url", label: "From URL", icon: Link2 },
  { id: "text", label: "Paste text", icon: FileText },
  { id: "file", label: "Upload file", icon: Upload },
  { id: "notion", label: "Notion", icon: FileText },
];

const uid = () => Math.random().toString(36).slice(2, 10);

export function ImportDialog({ onClose, initialTab = "url" }: { onClose: () => void; initialTab?: Tab }) {
  const addBook = useLibrary((s) => s.addBook);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function convert() {
    setBusy(true);
    try {
      let book: Book;
      if (tab === "url") book = await api.convert({ kind: "url", value: url || "example.com", title });
      else if (tab === "notion") book = await api.convert({ kind: "notion", value: title || "page", title });
      else book = await api.convert({ kind: "text", value: text, title: title || "Pasted note" });
      await addBook(book);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const content = await file.text().catch(() => "");
      const ext = file.name.split(".").pop()?.toLowerCase();
      const format: Book["format"] = ext === "pdf" ? "pdf" : ext === "epub" ? "epub" : ext === "md" ? "markdown" : "text";
      const blocks: Block[] = content
        ? [{ type: "h1", text: file.name.replace(/\.[^.]+$/, "") }, ...content.split(/\n{2,}/).slice(0, 200).filter(Boolean).map((t) => ({ type: "p" as const, text: t }))]
        : [{ type: "h1", text: file.name }, { type: "p", text: "Binary document imported. Full rendering for this format is wired to the native pipeline." }];
      await addBook({
        id: uid(),
        title: file.name.replace(/\.[^.]+$/, ""),
        author: "You",
        format,
        gradient: { from: "#fbbf24", to: "#f97316" },
        glyph: format === "pdf" ? "📄" : "📃",
        progress: 0,
        addedAt: Date.now(),
        source: "Upload",
        tags: [],
        blocks,
        wordCount: blocks.reduce((n, b) => n + b.text.split(/\s+/).length, 0),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg animate-in surface !rounded-2xl p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold">Add to library</h3>
            <p className="text-[12px] text-[var(--color-text-muted)]">Turn anything into a clean, readable book.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-text-faint)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-4">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition"
              style={tab === id ? { background: "var(--color-primary-soft)", color: "var(--color-primary)" } : { color: "var(--color-text-muted)" }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div className="space-y-3 p-5">
          <input className="input" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
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
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border-strong)] p-8 text-center transition hover:border-[var(--color-primary)]">
              <Upload size={22} className="text-[var(--color-text-muted)]" />
              <span className="text-[13px] font-medium">Choose an EPUB, PDF, TXT or Markdown file</span>
              <span className="text-[11px] text-[var(--color-text-faint)]">Stored locally via the native bridge</span>
              <input type="file" accept=".epub,.pdf,.txt,.md,.markdown" className="hidden" onChange={onFile} />
            </label>
          )}
        </div>

        {tab !== "file" && (
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
            <button onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button onClick={convert} disabled={busy} className="btn btn-primary">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              Convert &amp; add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
