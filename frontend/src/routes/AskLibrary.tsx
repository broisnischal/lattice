import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2, CornerDownLeft, Quote, ArrowUpRight } from "lucide-react";
import { api } from "@/api/mock";
import type { LibraryAnswer } from "@/api/types";

const EXAMPLES = [
  "What does my library say about attention?",
  "How should I read more slowly?",
  "Summarize the case for rereading",
  "What do these books say about systems?",
];

export function AskLibrary() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState("");
  const [result, setResult] = useState<LibraryAnswer | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function ask(question: string) {
    const query = question.trim();
    if (!query || busy) return;
    setBusy(true);
    setAsked(query);
    setResult(null);
    try {
      setResult(await api.askLibrary(query));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pt-10">
        <div className="mb-1 flex items-center gap-2 text-[var(--color-text-2)]">
          <Sparkles size={15} />
          <span className="text-[12.5px] font-medium">Ask your library</span>
          <kbd className="ml-auto hidden items-center gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--color-text-3)] sm:flex">
            ⌘J
          </kbd>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); ask(q); }}
          className="relative"
        >
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask a question across every book you've read…"
            className="field !h-14 !rounded-2xl !pl-5 !pr-14 !text-[16px]"
          />
          <button
            type="submit"
            disabled={busy || !q.trim()}
            className="icon-btn absolute right-3 top-1/2 -translate-y-1/2 !h-9 !w-9"
            title="Ask"
          >
            {busy ? <Loader2 size={17} className="animate-spin" /> : <CornerDownLeft size={17} />}
          </button>
        </form>

        {!result && !busy && (
          <div className="mt-6">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-3)]">Try</div>
            <div className="flex flex-col gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setQ(ex); ask(ex); }}
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-left text-[13.5px] text-[var(--color-text-2)] transition hover:border-[var(--color-border-2)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                >
                  <Sparkles size={14} className="text-[var(--color-text-3)]" />
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {busy && (
          <div className="mt-8 flex items-center gap-2 text-[13px] text-[var(--color-text-2)]">
            <Loader2 size={15} className="animate-spin" /> Searching every book…
          </div>
        )}

        {result && (
          <div className="mt-7 flex-1 animate-in overflow-y-auto pb-10">
            <div className="text-[12px] text-[var(--color-text-3)]">You asked</div>
            <div className="mb-4 text-[14px] font-medium">{asked}</div>

            <div className="surface rounded-2xl p-5">
              <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-[var(--color-text)]">{result.answer}</p>
            </div>

            {result.citations.length > 0 && (
              <>
                <div className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-3)]">
                  Grounded in {result.citations.length} passage{result.citations.length > 1 ? "s" : ""}
                </div>
                <div className="flex flex-col gap-2">
                  {result.citations.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => navigate(`/read/${c.bookId}?block=${c.blockIndex}`)}
                      className="card card-hover group flex items-start gap-3 p-3.5 text-left"
                    >
                      <Quote size={15} className="mt-0.5 shrink-0 text-[var(--color-text-3)]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] leading-relaxed text-[var(--color-text)]">“{c.quote}”</p>
                        <div className="mt-1.5 flex items-center gap-1 text-[12px] text-[var(--color-text-3)]">
                          <span className="truncate">{c.bookTitle}</span>
                          <ArrowUpRight size={13} className="opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
