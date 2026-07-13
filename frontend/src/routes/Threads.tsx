import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layers3, ArrowUpRight } from "lucide-react";
import { useLibrary } from "@/store/library";
import { IconTile } from "@/components/IconTile";
import { HL_HEX } from "@/lib/highlight";
import type { Book, Highlight } from "@/api/types";

interface Passage {
  hl: Highlight;
  book?: Book;
}
interface Thread {
  label: string;
  passages: Passage[];
  bookCount: number;
}

const STOP = new Set([
  "the", "a", "an", "of", "to", "in", "on", "and", "or", "is", "are", "was", "were", "be", "been",
  "it", "its", "that", "this", "these", "those", "you", "your", "we", "our", "they", "their", "not",
  "but", "for", "with", "as", "at", "by", "from", "so", "than", "then", "when", "what", "how", "why",
  "more", "most", "much", "less", "into", "about", "out", "up", "do", "does", "did", "can", "will",
  "always", "never", "own", "makes", "make", "made", "small", "best", "each", "almost", "back",
]);

function keywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP.has(w)),
    ),
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Cluster highlights across books into topical threads. Two signals:
 *  - shared book tags (clean, cross-book labels), and
 *  - shared keywords in the highlight text.
 * Threads that span more than one book rank first.
 */
function buildThreads(highlights: Record<string, Highlight[]>, books: Book[]): Thread[] {
  const bookById = new Map(books.map((b) => [b.id, b]));
  const all: Passage[] = Object.values(highlights)
    .flat()
    .map((hl) => ({ hl, book: bookById.get(hl.bookId) }));

  const groups = new Map<string, Passage[]>();
  const add = (label: string, p: Passage) => {
    const arr = groups.get(label);
    if (arr) {
      if (!arr.includes(p)) arr.push(p);
    } else groups.set(label, [p]);
  };

  for (const p of all) {
    for (const tag of p.book?.tags ?? []) add(`#${tag}`, p);
    for (const kw of keywords(p.hl.text)) add(kw, p);
  }

  const threads: Thread[] = [];
  for (const [label, passages] of groups) {
    if (passages.length < 2) continue;
    const bookCount = new Set(passages.map((p) => p.hl.bookId)).size;
    threads.push({ label: label.startsWith("#") ? cap(label.slice(1)) : cap(label), passages, bookCount });
  }

  // Prefer threads that connect multiple books, then larger threads.
  threads.sort((a, b) => b.bookCount - a.bookCount || b.passages.length - a.passages.length);

  // Drop near-duplicate threads (same passage set) and cap.
  const seen = new Set<string>();
  const unique: Thread[] = [];
  for (const t of threads) {
    const sig = t.passages.map((p) => p.hl.id).sort().join(",");
    if (seen.has(sig)) continue;
    seen.add(sig);
    unique.push(t);
    if (unique.length >= 6) break;
  }
  return unique;
}

export function Threads() {
  const { books, highlights } = useLibrary();
  const navigate = useNavigate();
  const threads = useMemo(() => buildThreads(highlights, books), [highlights, books]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 pt-5">
        <h1 className="text-[19px] font-semibold tracking-tight">Threads</h1>
        <p className="mt-0.5 text-[13px] text-[var(--color-text-2)]">
          Concepts that recur across your books — passages, grouped and connected.
        </p>
      </div>

      <div className="mt-5 flex-1 overflow-y-auto px-6 pb-10">
        {threads.length === 0 ? (
          <div className="card flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Layers3 size={22} className="text-[var(--color-text-3)]" />
            <p className="text-[14px] font-medium">No threads yet</p>
            <p className="text-[13px] text-[var(--color-text-2)]">
              Save a few highlights across different books and Reader will connect the recurring ideas.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {threads.map((t) => (
              <section key={t.label} className="card p-4">
                <div className="mb-3 flex items-center gap-2.5">
                  <IconTile size={30}><Layers3 size={14} strokeWidth={2} /></IconTile>
                  <span className="section-label">{t.label}</span>
                  <span className="text-[12px] text-[var(--color-text-3)]">
                    {t.passages.length} passages · {t.bookCount} book{t.bookCount > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {t.passages.slice(0, 4).map((p) => (
                    <button
                      key={p.hl.id}
                      onClick={() => navigate(`/read/${p.hl.bookId}?block=${p.hl.blockIndex}`)}
                      className="group flex items-start gap-2.5 rounded-xl border border-[var(--color-border)] p-3 text-left transition hover:border-[var(--color-border-2)] hover:bg-[var(--color-surface-2)]"
                    >
                      <span className="mt-1 h-3 w-1 shrink-0 rounded-full" style={{ background: HL_HEX[p.hl.color] }} />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13px] leading-relaxed text-[var(--color-text)]">“{p.hl.text}”</p>
                        <div className="mt-1 flex items-center gap-1 text-[11.5px] text-[var(--color-text-3)]">
                          <span className="truncate">{p.book?.title ?? "Unknown"}</span>
                          <ArrowUpRight size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </div>
                    </button>
                  ))}
                  {t.passages.length > 4 && (
                    <span className="px-1 text-[12px] text-[var(--color-text-3)]">+{t.passages.length - 4} more</span>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
