import { Check, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useLibrary } from "@/store/library";
import { Tile } from "@/components/Tile";

export function Connections() {
  const { connections, toggleConnection } = useLibrary();
  const [pending, setPending] = useState<string | null>(null);

  async function toggle(kind: string) {
    setPending(kind);
    try { await toggleConnection(kind); } finally { setPending(null); }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--color-border)] px-6 py-4">
        <h1 className="text-[19px] font-semibold tracking-tight">Connect</h1>
        <p className="text-[12.5px] text-[var(--color-text-muted)]">Bring your reading in from everywhere. Import turns each source into a clean book.</p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2">
          {connections.map((c) => (
            <div key={c.kind} className="surface flex items-center gap-4 p-4">
              <Tile gradient={c.gradient} glyph={c.glyph} size={48} radius={13} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold">{c.name}</span>
                  {c.connected && (
                    <span className="chip !border-[var(--color-accent-green)] !text-[var(--color-accent-green)]">
                      <Check size={11} /> Connected
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">{c.description}</p>
              </div>
              <button
                onClick={() => toggle(c.kind)}
                disabled={pending === c.kind}
                className={c.connected ? "btn btn-ghost" : "btn btn-primary"}
              >
                {pending === c.kind ? <Loader2 size={15} className="animate-spin" /> : c.connected ? null : <Plus size={15} />}
                {c.connected ? "Disconnect" : "Connect"}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 max-w-4xl rounded-2xl border border-dashed border-[var(--color-border-strong)] p-5">
          <h3 className="text-[14px] font-semibold">How importing works</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            When you connect a source, Reader fetches your pages and articles and converts them into a normalized reading format — the same clean surface used for EPUBs. Your highlights, progress, and notes stay attached to the book and sync to your account. Connecting real providers requires OAuth credentials, wired through the native bridge; this build uses a mock so you can see the full flow.
          </p>
        </div>
      </div>
    </div>
  );
}
