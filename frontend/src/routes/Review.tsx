import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Repeat, RotateCcw, Check, Sparkles, ArrowUpRight } from "lucide-react";
import { useLibrary } from "@/store/library";
import { useReview, type Grade, schedule } from "@/store/review";
import type { Book, Highlight } from "@/api/types";
import { HL_HEX } from "@/lib/highlight";

interface Card {
  hl: Highlight;
  book?: Book;
}

const DAY = 86_400_000;
function dueLabel(days: number): string {
  if (days < 1) return "<1d";
  if (days < 30) return `${Math.round(days)}d`;
  return `${Math.round(days / 30)}mo`;
}

export function Review() {
  const { books, highlights } = useLibrary();
  const cards = useReview((s) => s.cards);
  const grade = useReview((s) => s.grade);
  const isDue = useReview((s) => s.isDue);
  const navigate = useNavigate();

  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);

  // The full ordered queue of due highlights (recomputed as cards change).
  const queue = useMemo<Card[]>(() => {
    const all: Card[] = Object.values(highlights)
      .flat()
      .map((hl) => ({ hl, book: books.find((b) => b.id === hl.bookId) }));
    return all.filter((c) => isDue(c.hl.id)).sort((a, z) => a.hl.createdAt - z.hl.createdAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlights, books, cards]);

  const current = queue[0];
  const total = useMemo(() => Object.values(highlights).flat().length, [highlights]);

  function onGrade(g: Grade) {
    if (!current) return;
    grade(current.hl.id, g);
    setFlipped(false);
    setDone((d) => d + 1);
  }

  // Preview of the next intervals for the grade buttons.
  const intervals = current
    ? {
        again: schedule(cards[current.hl.id], current.hl.id, "again"),
        good: schedule(cards[current.hl.id], current.hl.id, "good"),
        easy: schedule(cards[current.hl.id], current.hl.id, "easy"),
      }
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 pt-5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[19px] font-semibold tracking-tight">Review</h1>
          <span className="text-[12.5px] text-[var(--color-text-3)]">
            {queue.length} due · {total} total
          </span>
        </div>
        <p className="mt-0.5 text-[13px] text-[var(--color-text-2)]">
          Spaced repetition turns your highlights into durable memory.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 pb-10">
        {!current ? (
          <div className="card flex max-w-md flex-col items-center gap-2 px-10 py-14 text-center">
            <div className="tile mb-1 grid place-items-center" style={{ width: 44, height: 44, borderRadius: 12 }}>
              <Check size={20} className="text-[var(--color-text-2)]" />
            </div>
            <p className="text-[15px] font-semibold">
              {total === 0 ? "No highlights yet" : "You're all caught up"}
            </p>
            <p className="text-[13px] text-[var(--color-text-2)]">
              {total === 0
                ? "Highlight passages while reading — they'll show up here as review cards."
                : done > 0
                ? `Reviewed ${done} card${done > 1 ? "s" : ""} this session. Come back when more are due.`
                : "Nothing is due right now. New highlights become due immediately."}
            </p>
          </div>
        ) : (
          <div className="w-full max-w-xl">
            <div className="mb-3 flex items-center justify-between text-[12px] text-[var(--color-text-3)]">
              <span>{done} reviewed · {queue.length} remaining</span>
              {current.book && (
                <button onClick={() => navigate(`/read/${current.book!.id}?block=${current.hl.blockIndex}`)} className="btn btn-quiet !h-7">
                  Open source <ArrowUpRight size={13} />
                </button>
              )}
            </div>

            <div
              className="card flex min-h-[240px] cursor-pointer flex-col p-7"
              onClick={() => setFlipped((f) => !f)}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="h-3 w-1 rounded-full" style={{ background: HL_HEX[current.hl.color] }} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-3)]">
                  {flipped ? "Source & note" : "Recall this passage"}
                </span>
              </div>

              <p className="text-[17px] leading-relaxed text-[var(--color-text)]">“{current.hl.text}”</p>

              {flipped && (
                <div className="mt-4 animate-in border-t border-[var(--color-border)] pt-4">
                  {current.hl.note && (
                    <p className="mb-2 flex items-start gap-2 text-[13.5px] text-[var(--color-text)]">
                      <Sparkles size={14} className="mt-0.5 shrink-0 text-[var(--color-text-3)]" />
                      {current.hl.note}
                    </p>
                  )}
                  <p className="text-[12.5px] text-[var(--color-text-2)]">
                    From <span className="text-[var(--color-text)]">{current.book?.title ?? "a book"}</span>
                    {current.book ? ` · ${current.book.author}` : ""}
                  </p>
                </div>
              )}

              {!flipped && (
                <div className="mt-auto pt-6 text-[12.5px] text-[var(--color-text-3)]">
                  Click the card to reveal the source and note.
                </div>
              )}
            </div>

            {flipped ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <GradeButton label="Again" hint={intervals ? dueLabel(Math.max(0.01, (intervals.again.due - Date.now()) / DAY)) : ""} onClick={() => onGrade("again")} icon={RotateCcw} />
                <GradeButton label="Good" hint={intervals ? dueLabel((intervals.good.due - Date.now()) / DAY) : ""} onClick={() => onGrade("good")} />
                <GradeButton label="Easy" hint={intervals ? dueLabel((intervals.easy.due - Date.now()) / DAY) : ""} onClick={() => onGrade("easy")} />
              </div>
            ) : (
              <button onClick={() => setFlipped(true)} className="btn btn-primary mt-3 w-full !h-11">
                Reveal answer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GradeButton({ label, hint, onClick, icon: Icon }: { label: string; hint: string; onClick: () => void; icon?: typeof Repeat }) {
  return (
    <button onClick={onClick} className="btn !h-auto flex-col !gap-0.5 !py-2.5">
      <span className="flex items-center gap-1 text-[13px] font-semibold">
        {Icon && <Icon size={13} />} {label}
      </span>
      <span className="text-[11px] font-normal text-[var(--color-text-3)]">{hint}</span>
    </button>
  );
}
