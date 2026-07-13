import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Highlighter, ArrowUpRight } from "lucide-react";
import { useLibrary } from "@/store/library";
import { IconTile } from "@/components/IconTile";
import type { Highlight } from "@/api/types";

const DOT: Record<Highlight["color"], string> = {
  violet: "#7c7bff",
  amber: "#ffd60a",
  green: "#30d158",
  rose: "#ff453a",
  cyan: "#64d2ff",
};

export function Highlights() {
  const { books, highlights } = useLibrary();
  const navigate = useNavigate();

  const groups = useMemo(() => {
    return books
      .map((b) => ({ book: b, items: (highlights[b.id] ?? []).slice().sort((a, z) => z.createdAt - a.createdAt) }))
      .filter((g) => g.items.length > 0);
  }, [books, highlights]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-6 pt-5">
        <h1 className="text-[19px] font-semibold tracking-tight">Highlights</h1>
        <p className="mt-0.5 text-[13px] text-[var(--color-text-2)]">{total} saved passages across {groups.length} books</p>
      </div>

      <div className="mt-5 flex-1 overflow-y-auto px-6 pb-8">
        {groups.length === 0 ? (
          <div className="card flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Highlighter size={22} className="text-[var(--color-text-3)]" />
            <p className="text-[14px] font-medium">No highlights yet</p>
            <p className="text-[13px] text-[var(--color-text-2)]">Select text while reading and pick a color to save it here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map(({ book, items }) => (
              <section key={book.id}>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <IconTile gradient={book.gradient} size={30}><Highlighter size={14} strokeWidth={2} /></IconTile>
                  <span className="section-label">{book.title}</span>
                  <span className="text-[12.5px] text-[var(--color-text-3)]">{items.length}</span>
                  <button onClick={() => navigate(`/read/${book.id}`)} className="btn btn-quiet ml-auto !h-8">
                    Open <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((h) => (
                    <div key={h.id} className="card flex gap-3 p-3.5">
                      <span className="mt-1 h-3 w-1 shrink-0 rounded-full" style={{ background: DOT[h.color] }} />
                      <div className="min-w-0">
                        <p className="text-[14px] leading-relaxed text-[var(--color-text)]">{h.text}</p>
                        {h.note && <p className="mt-1.5 text-[12.5px] text-[var(--color-text-2)]">{h.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
