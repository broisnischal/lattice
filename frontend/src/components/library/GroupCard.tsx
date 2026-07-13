import { Layers, Trash2, PencilLine } from "lucide-react";
import type { Collection } from "@/api/types";
import { IconTile } from "@/components/IconTile";

interface GroupCardProps {
  collection: Collection;
  active: boolean;
  onClick: () => void;
}

export function GroupCard({ collection, active, onClick }: GroupCardProps) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className="card card-hover group flex cursor-pointer items-center gap-3 p-3"
      style={active ? { borderColor: "var(--color-border-2)", background: "var(--color-surface-2)" } : undefined}
    >
      <IconTile gradient={collection.gradient} size={38}>
        <Layers size={18} strokeWidth={2} />
      </IconTile>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-semibold leading-tight">{collection.name}</div>
        <div className="mt-0.5 text-[12.5px] text-[var(--color-text-2)]">{collection.bookIds.length} books</div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <button className="icon-btn" onClick={(e) => e.stopPropagation()} title="Edit"><PencilLine size={15} /></button>
        <button className="icon-btn" onClick={(e) => e.stopPropagation()} title="Delete"><Trash2 size={15} /></button>
      </div>
    </div>
  );
}
