import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, ListChecks, FileText, HelpCircle, X } from "lucide-react";
import { api } from "@/api/mock";
import type { AiMessage, Book } from "@/api/types";

const uid = () => Math.random().toString(36).slice(2, 10);

interface AiPanelProps {
  book: Book;
  selection: string;
  onClose: () => void;
  onClearSelection: () => void;
}

const QUICK = [
  { label: "Summarize", icon: FileText, prompt: "Summarize this book." },
  { label: "Key highlights", icon: ListChecks, prompt: "What are the key highlights I should mark?" },
];

export function AiPanel({ book, selection, onClose, onClearSelection }: AiPanelProps) {
  const [messages, setMessages] = useState<AiMessage[]>([
    { id: uid(), role: "assistant", content: `I've read “${book.title}.” Ask me to summarize it, pull key highlights, or explain anything you select.` },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const userMsg: AiMessage = { id: uid(), role: "user", content: q };
    const pending: AiMessage = { id: uid(), role: "assistant", content: "", pending: true };
    setMessages((m) => [...m, userMsg, pending]);
    setInput("");
    setBusy(true);
    try {
      const answer = await api.ask(book, q, messages);
      setMessages((m) => m.map((msg) => (msg.id === pending.id ? { ...msg, content: answer, pending: false } : msg)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <Sparkles size={16} className="text-[var(--color-primary)]" />
        <span className="text-[14px] font-semibold">AI copilot</span>
        <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-[var(--color-text-faint)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
          <X size={16} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className="max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed"
              style={
                m.role === "user"
                  ? { background: "var(--color-primary)", color: "#0b0b12" }
                  : { background: "var(--color-surface)", border: "1px solid var(--color-border)" }
              }
            >
              {m.pending ? (
                <span className="flex items-center gap-1 text-[var(--color-text-muted)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" style={{ animation: "pulse-dot 1s infinite" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-current" style={{ animation: "pulse-dot 1s infinite .2s" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-current" style={{ animation: "pulse-dot 1s infinite .4s" }} />
                </span>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
      </div>

      {selection && (
        <div className="mx-4 mb-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">Selected</span>
            <button onClick={onClearSelection} className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]"><X size={13} /></button>
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] text-[var(--color-text-muted)] italic">“{selection}”</p>
          <button onClick={() => send(`Explain this passage: "${selection}"`)} className="btn btn-ghost mt-2 w-full !py-1.5 !text-[12px]">
            <HelpCircle size={13} /> Explain selection
          </button>
        </div>
      )}

      <div className="border-t border-[var(--color-border)] p-3">
        <div className="mb-2 flex gap-1.5">
          {QUICK.map(({ label, icon: Icon, prompt }) => (
            <button key={label} onClick={() => send(prompt)} disabled={busy} className="chip !cursor-pointer hover:!border-[var(--color-primary)] hover:!text-[var(--color-text)]">
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-end gap-2"
        >
          <textarea
            className="input min-h-[42px] resize-none py-2.5"
            rows={1}
            placeholder="Ask about this book…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          />
          <button type="submit" disabled={busy || !input.trim()} className="btn btn-primary !px-3 !py-2.5">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
