import { HardDrive, Shield, Palette, LogOut, Monitor } from "lucide-react";
import { useAuth } from "@/store/auth";
import { useLibrary } from "@/store/library";
import { useSettings } from "@/store/settings";
import { TypographyControls } from "@/components/reader/TypographyControls";
import { Tile } from "@/components/Tile";
import { hasNativeBridge } from "@/lib/native";

function Section({ icon: Icon, title, desc, children }: { icon: typeof Shield; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="surface p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="tile" style={{ width: 36, height: 36, borderRadius: 10 }}>
          <Icon size={17} className="text-[var(--color-text-2)]" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function Settings() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { prefs } = useSettings();
  const { books, highlights } = useLibrary();
  const totalHl = Object.values(highlights).reduce((n, arr) => n + arr.length, 0);
  const words = books.reduce((n, b) => n + b.wordCount, 0);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[var(--color-border)] px-6 py-4">
        <h1 className="text-[19px] font-semibold tracking-tight">Settings</h1>
        <p className="text-[12.5px] text-[var(--color-text-muted)]">Account, reading defaults, storage, and privacy.</p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto grid max-w-3xl gap-4">
          {/* Account */}
          {user && (
            <Section icon={Shield} title="Account" desc="Your identity and sync status.">
              <div className="flex items-center gap-3">
                <Tile gradient={user.gradient} glyph={user.name.slice(0, 1).toUpperCase()} size={46} radius={12} />
                <div className="flex-1">
                  <div className="text-[14px] font-semibold">{user.name}</div>
                  <div className="text-[12.5px] text-[var(--color-text-muted)]">{user.email}</div>
                </div>
                <span className="chip capitalize">{user.plan} plan</span>
                <button onClick={() => logout()} className="btn btn-ghost"><LogOut size={15} /> Sign out</button>
              </div>
            </Section>
          )}

          {/* Reading defaults */}
          <Section icon={Palette} title="Reading defaults" desc="These presets apply to every book. Tweak per-book from the reader.">
            <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
              <TypographyControls />
              {/* Live preview */}
              <div className="reader-surface min-h-40 rounded-xl border border-[var(--color-border)] p-5" data-theme={prefs.theme}>
                <div
                  className="reader-prose !mx-0 !max-w-none"
                  style={{
                    ["--reader-size" as string]: `${prefs.size}rem`,
                    ["--reader-leading" as string]: prefs.leading,
                    ["--reader-font" as string]: prefs.font === "serif" ? "var(--font-serif)" : "var(--font-sans)",
                  }}
                >
                  <h2 style={{ marginTop: 0 }}>Preview</h2>
                  <p>Attention is the rarest and purest form of generosity. This preview updates live as you adjust the theme, typeface, and spacing above.</p>
                </div>
              </div>
            </div>
          </Section>

          {/* Storage */}
          <Section icon={HardDrive} title="Storage & sync" desc="Where your library lives.">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Books", value: books.length },
                { label: "Highlights", value: totalHl },
                { label: "Words", value: words.toLocaleString() },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-[var(--color-border)] p-3 text-center">
                  <div className="text-[20px] font-semibold tabular-nums">{s.value}</div>
                  <div className="text-[11.5px] text-[var(--color-text-faint)]">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[12.5px] text-[var(--color-text-muted)]">
              <Monitor size={14} />
              {hasNativeBridge()
                ? "Books are stored locally via the native bridge and synced to your account."
                : "Running in the browser — books persist in local storage. In the desktop app they're stored natively and synced."}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
