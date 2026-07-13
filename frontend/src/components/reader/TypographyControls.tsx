import { Minus, Plus, Save } from "lucide-react";
import { useSettings, type ReaderTheme, type ReaderFont } from "@/store/settings";
import { useState } from "react";

const THEMES: { id: ReaderTheme; label: string; swatch: string }[] = [
  { id: "dark", label: "Dark", swatch: "#0f1115" },
  { id: "night", label: "Night", swatch: "#05070a" },
  { id: "paper", label: "Paper", swatch: "#faf7f0" },
  { id: "sepia", label: "Sepia", swatch: "#f3e6d0" },
];

const FONTS: { id: ReaderFont; label: string }[] = [
  { id: "serif", label: "Serif" },
  { id: "sans", label: "Sans" },
];

function Stepper({ label, value, suffix, onDec, onInc }: { label: string; value: string; suffix?: string; onDec: () => void; onInc: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-[var(--color-text-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={onDec} className="btn btn-ghost !px-2 !py-1"><Minus size={13} /></button>
        <span className="w-14 text-center text-[13px] tabular-nums">{value}{suffix}</span>
        <button onClick={onInc} className="btn btn-ghost !px-2 !py-1"><Plus size={13} /></button>
      </div>
    </div>
  );
}

export function TypographyControls() {
  const { prefs, set, presets, applyPreset, savePreset } = useSettings();
  const [presetName, setPresetName] = useState("");

  return (
    <div className="w-72 space-y-4">
      {/* Presets */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">Presets</div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button key={p.id} onClick={() => applyPreset(p.id)} className="chip !cursor-pointer hover:!border-[var(--color-primary)]">
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">Theme</div>
        <div className="grid grid-cols-4 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => set("theme", t.id)}
              className="flex flex-col items-center gap-1.5 rounded-lg border p-2 transition"
              style={{ borderColor: prefs.theme === t.id ? "var(--color-primary)" : "var(--color-border)" }}
            >
              <span className="h-7 w-full rounded" style={{ background: t.swatch, border: "1px solid rgba(255,255,255,.08)" }} />
              <span className="text-[10.5px] text-[var(--color-text-muted)]">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Font */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">Typeface</div>
        <div className="grid grid-cols-2 gap-2">
          {FONTS.map((f) => (
            <button
              key={f.id}
              onClick={() => set("font", f.id)}
              className="rounded-lg border py-2 text-[13px] transition"
              style={{
                borderColor: prefs.font === f.id ? "var(--color-primary)" : "var(--color-border)",
                fontFamily: f.id === "serif" ? "var(--font-serif)" : "var(--font-sans)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-2.5">
        <Stepper label="Font size" value={prefs.size.toFixed(2)} suffix="rem" onDec={() => set("size", Math.max(0.8, +(prefs.size - 0.05).toFixed(2)))} onInc={() => set("size", Math.min(1.8, +(prefs.size + 0.05).toFixed(2)))} />
        <Stepper label="Line height" value={prefs.leading.toFixed(2)} onDec={() => set("leading", Math.max(1.3, +(prefs.leading - 0.05).toFixed(2)))} onInc={() => set("leading", Math.min(2.2, +(prefs.leading + 0.05).toFixed(2)))} />
        <Stepper label="Line width" value={String(prefs.measure)} suffix="ch" onDec={() => set("measure", Math.max(45, prefs.measure - 2))} onInc={() => set("measure", Math.min(95, prefs.measure + 2))} />
      </div>

      {/* Save preset */}
      <div className="flex gap-2 border-t border-[var(--color-border)] pt-3">
        <input className="input !py-1.5 !text-[12px]" placeholder="Save current as…" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
        <button
          onClick={() => { if (presetName.trim()) { savePreset(presetName.trim()); setPresetName(""); } }}
          className="btn btn-ghost !px-2.5"
          title="Save preset"
        >
          <Save size={14} />
        </button>
      </div>
    </div>
  );
}
