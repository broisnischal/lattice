import { useState } from "react";
import { BookOpen, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/store/auth";

export function Login() {
  const login = useAuth((s) => s.login);
  const signup = useAuth((s) => s.signup);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") await login(email || "reader@demo.app", password || "demo");
      else await signup(name || "New Reader", email || "reader@demo.app", password || "demo");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid h-full w-full grid-cols-1 lg:grid-cols-2">
      {/* Left: brand / pitch */}
      <div className="relative hidden overflow-hidden border-r border-[var(--color-hairline)] lg:block">
        <div className="absolute inset-0 bg-[#070708]" />
        <div className="absolute -left-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-white opacity-[0.03] blur-[150px]" />
        <div className="absolute right-[-8rem] bottom-0 h-80 w-80 rounded-full bg-white opacity-[0.02] blur-[140px]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-2.5">
            <div className="tile" style={{ width: 34, height: 34, borderRadius: 10 }}>
              <BookOpen size={19} strokeWidth={2.5} className="relative z-10 text-[var(--color-text)]" />
            </div>
            <span className="text-[17px] font-semibold tracking-tight">Reader</span>
          </div>
          <div className="max-w-md">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Every page you love,<br />in one calm place.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-text-muted)]">
              Read EPUB, PDF, articles, and feeds — turn anything into a book. Highlight,
              theme, and let the AI copilot explain, summarize, and connect ideas across
              your whole library.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["EPUB & PDF", "Web & RSS", "Notion import", "AI copilot", "Synced everywhere"].map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
          </div>
          <p className="text-[12px] text-[var(--color-text-faint)]">
            Built with the Native SDK · desktop today, mobile-ready
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center bg-[var(--color-bg)] p-8">
        <form onSubmit={submit} className="w-full max-w-sm animate-in">
          <div className="mb-6 flex gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="flex-1 rounded-lg py-2 text-sm font-medium capitalize transition"
                style={
                  mode === m
                    ? { background: "#f4f4f5", color: "#101013" }
                    : { color: "var(--color-text-muted)" }
                }
              >
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <h2 className="text-xl font-semibold tracking-tight">
            {mode === "login" ? "Welcome back" : "Start reading"}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {mode === "login" ? "Sign in to sync your library." : "Your books, safe and synced across devices."}
          </p>

          <div className="mt-5 space-y-3">
            {mode === "signup" && (
              <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            )}
            <input className="input" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && <p className="mt-3 text-[13px] text-[var(--color-accent-rose)]">{error}</p>}

          <button type="submit" disabled={busy} className="btn btn-primary mt-5 w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>

          <p className="mt-4 text-center text-[12px] text-[var(--color-text-faint)]">
            Demo build — any email &amp; password works.
          </p>
        </form>
      </div>
    </div>
  );
}
