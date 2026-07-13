import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import type { Book } from "@/api/types";
import { IconTile } from "@/components/IconTile";
import { FORMAT_META } from "@/lib/format";
import { useLibrary } from "@/store/library";

function ProgressRing({ value }: { value: number }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <svg width={22} height={22} viewBox="0 0 22 22" className="shrink-0 -rotate-90">
      <circle cx="11" cy="11" r={r} fill="none" stroke="var(--color-border-2)" strokeWidth="2.5" />
      <circle
        cx="11" cy="11" r={r} fill="none"
        stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value)}
      />
    </svg>
  );
}

export function BookRow({ book }: { book: Book }) {
  const navigate = useNavigate();
  const deleteBook = useLibrary((s) => s.deleteBook);
  const { label, Icon } = FORMAT_META[book.format];
  const pct = Math.round(book.progress * 100);

  return (
    <div
      onClick={() => navigate(`/read/${book.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter") && navigate(`/read/${book.id}`)}
      className="card card-hover group flex cursor-pointer items-center gap-3 px-3 py-2.5"
    >
      <IconTile gradient={book.gradient} size={38}>
        <Icon size={17} strokeWidth={2} />
      </IconTile>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold leading-tight">{book.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[var(--color-text-2)]">
          <span className="truncate">{book.author}</span>
          <span className="text-[var(--color-text-3)]">·</span>
          <span className="truncate text-[var(--color-text-3)]">{book.source}</span>
        </div>
      </div>

      <span className="chip hidden sm:inline-flex">{label}</span>

      {pct > 0 ? (
        <div className="flex items-center gap-1.5">
          <ProgressRing value={book.progress} />
          <span className="w-8 text-[12px] tabular-nums text-[var(--color-text-2)]">{pct}%</span>
        </div>
      ) : (
        <span className="w-[70px] text-right text-[12px] text-[var(--color-text-3)]">New</span>
      )}

      <button
        className="icon-btn opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        onClick={(e) => { e.stopPropagation(); deleteBook(book.id); }}
        title="Remove"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
