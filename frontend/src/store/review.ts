import { create } from "zustand";

/**
 * Spaced-repetition scheduler for highlights, using a lightweight SM-2.
 * A card is created lazily the first time a highlight is graded; until then
 * a highlight counts as "new" and is due immediately.
 */

export type Grade = "again" | "good" | "easy";

export interface ReviewCard {
  /** Highlight id this card schedules. */
  id: string;
  /** Next due timestamp (ms). */
  due: number;
  /** Ease factor (SM-2), starts at 2.5. */
  ease: number;
  /** Current interval in days. */
  interval: number;
  /** Successful repetitions in a row. */
  reps: number;
  /** Last time it was reviewed. */
  reviewedAt: number;
}

const KEY = "reader:review";
const DAY = 86_400_000;

function load(): Record<string, ReviewCard> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function persist(map: Record<string, ReviewCard>) {
  localStorage.setItem(KEY, JSON.stringify(map));
}

/** Apply one SM-2 step to a card (or a fresh card) for the given grade. */
export function schedule(card: ReviewCard | undefined, id: string, grade: Grade): ReviewCard {
  const now = Date.now();
  let ease = card?.ease ?? 2.5;
  let reps = card?.reps ?? 0;
  let interval = card?.interval ?? 0;

  if (grade === "again") {
    reps = 0;
    interval = 0; // relearn today (~10 min, rounded to same-day)
    ease = Math.max(1.3, ease - 0.2);
  } else {
    const q = grade === "easy" ? 5 : 4;
    ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    reps += 1;
    if (reps === 1) interval = grade === "easy" ? 2 : 1;
    else if (reps === 2) interval = grade === "easy" ? 6 : 3;
    else interval = Math.round(interval * ease * (grade === "easy" ? 1.3 : 1));
  }

  return {
    id,
    ease,
    reps,
    interval,
    reviewedAt: now,
    due: now + Math.max(interval, grade === "again" ? 0 : 1) * DAY,
  };
}

interface ReviewState {
  cards: Record<string, ReviewCard>;
  grade(id: string, grade: Grade): void;
  isDue(id: string): boolean;
  reset(id: string): void;
}

export const useReview = create<ReviewState>((set, get) => ({
  cards: load(),
  grade(id, g) {
    const cards = { ...get().cards };
    cards[id] = schedule(cards[id], id, g);
    persist(cards);
    set({ cards });
  },
  isDue(id) {
    const c = get().cards[id];
    return !c || c.due <= Date.now();
  },
  reset(id) {
    const cards = { ...get().cards };
    delete cards[id];
    persist(cards);
    set({ cards });
  },
}));

/** Count of highlight ids that are due (unseen highlights count as due). */
export function dueCount(cards: Record<string, ReviewCard>, ids: string[]): number {
  const now = Date.now();
  return ids.filter((id) => {
    const c = cards[id];
    return !c || c.due <= now;
  }).length;
}
