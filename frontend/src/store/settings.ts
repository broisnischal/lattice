import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ReaderTheme = "dark" | "night" | "paper" | "sepia";
export type ReaderFont = "serif" | "sans";

export interface ReaderPrefs {
  theme: ReaderTheme;
  font: ReaderFont;
  /** Base font size in rem. */
  size: number;
  /** Line height. */
  leading: number;
  /** Measure (line length) in ch. */
  measure: number;
}

export interface Preset extends ReaderPrefs {
  id: string;
  name: string;
}

const DEFAULT_PREFS: ReaderPrefs = {
  theme: "dark",
  font: "serif",
  size: 1.15,
  leading: 1.75,
  measure: 68,
};

export const BUILT_IN_PRESETS: Preset[] = [
  { id: "focus", name: "Focus", theme: "night", font: "serif", size: 1.2, leading: 1.85, measure: 60 },
  { id: "daylight", name: "Daylight", theme: "paper", font: "serif", size: 1.15, leading: 1.7, measure: 66 },
  { id: "compact", name: "Compact", theme: "dark", font: "sans", size: 1.0, leading: 1.6, measure: 78 },
  { id: "classic", name: "Classic", theme: "sepia", font: "serif", size: 1.25, leading: 1.8, measure: 62 },
];

interface SettingsState {
  prefs: ReaderPrefs;
  presets: Preset[];
  set<K extends keyof ReaderPrefs>(key: K, value: ReaderPrefs[K]): void;
  applyPreset(id: string): void;
  savePreset(name: string): void;
  reset(): void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      prefs: DEFAULT_PREFS,
      presets: BUILT_IN_PRESETS,
      set: (key, value) => set((s) => ({ prefs: { ...s.prefs, [key]: value } })),
      applyPreset: (id) => {
        const p = get().presets.find((x) => x.id === id);
        if (p) set({ prefs: { theme: p.theme, font: p.font, size: p.size, leading: p.leading, measure: p.measure } });
      },
      savePreset: (name) => {
        const { prefs } = get();
        set((s) => ({ presets: [...s.presets, { id: Math.random().toString(36).slice(2, 8), name, ...prefs }] }));
      },
      reset: () => set({ prefs: DEFAULT_PREFS }),
    }),
    { name: "reader:settings" },
  ),
);
