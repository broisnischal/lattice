import { create } from "zustand";
import { api } from "@/api/mock";
import type { Book, Collection, Connection, Feed, FeedItem, Highlight } from "@/api/types";

const HL_KEY = "reader:highlights";

function loadHighlights(): Record<string, Highlight[]> {
  try {
    return JSON.parse(localStorage.getItem(HL_KEY) || "{}");
  } catch {
    return {};
  }
}
function persistHighlights(map: Record<string, Highlight[]>) {
  localStorage.setItem(HL_KEY, JSON.stringify(map));
}

interface LibraryState {
  loaded: boolean;
  books: Book[];
  collections: Collection[];
  feeds: Feed[];
  feedItems: FeedItem[];
  connections: Connection[];
  highlights: Record<string, Highlight[]>;

  loadAll(): Promise<void>;
  addBook(book: Book): Promise<void>;
  deleteBook(id: string): Promise<void>;
  setProgress(id: string, progress: number): void;

  addFeed(url: string): Promise<void>;
  markRead(itemId: string): Promise<void>;
  toggleConnection(kind: string): Promise<void>;

  addHighlight(h: Omit<Highlight, "id" | "createdAt">): Highlight;
  removeHighlight(bookId: string, id: string): void;
  highlightsFor(bookId: string): Highlight[];
}

export const useLibrary = create<LibraryState>((set, get) => ({
  loaded: false,
  books: [],
  collections: [],
  feeds: [],
  feedItems: [],
  connections: [],
  highlights: loadHighlights(),

  async loadAll() {
    const [books, collections, feeds, feedItems, connections] = await Promise.all([
      api.listBooks(),
      api.listCollections(),
      api.listFeeds(),
      api.listFeedItems(),
      api.listConnections(),
    ]);
    // First run with no saved highlights: seed a few so Highlights / Review /
    // Threads / library citations have grounded content to show.
    let highlights = get().highlights;
    if (Object.keys(highlights).length === 0) {
      const seeded = await api.listSeedHighlights();
      if (Object.keys(seeded).length) {
        highlights = seeded;
        persistHighlights(seeded);
      }
    }
    set({ books, collections, feeds, feedItems, connections, highlights, loaded: true });
  },

  async addBook(book) {
    await api.addBook(book);
    set((s) => ({ books: [book, ...s.books] }));
  },
  async deleteBook(id) {
    await api.deleteBook(id);
    set((s) => ({ books: s.books.filter((b) => b.id !== id) }));
  },
  setProgress(id, progress) {
    api.setProgress(id, progress);
    set((s) => ({ books: s.books.map((b) => (b.id === id ? { ...b, progress } : b)) }));
  },

  async addFeed(url) {
    const feed = await api.addFeed(url);
    const feedItems = await api.listFeedItems();
    set((s) => ({ feeds: [feed, ...s.feeds], feedItems }));
  },
  async markRead(itemId) {
    await api.markRead(itemId);
    set((s) => ({
      feedItems: s.feedItems.map((i) => (i.id === itemId ? { ...i, read: true } : i)),
      feeds: (() => {
        const it = s.feedItems.find((i) => i.id === itemId);
        if (!it || it.read) return s.feeds;
        return s.feeds.map((f) => (f.id === it.feedId ? { ...f, unread: Math.max(0, f.unread - 1) } : f));
      })(),
    }));
  },
  async toggleConnection(kind) {
    const connections = await api.toggleConnection(kind);
    set({ connections });
  },

  addHighlight(h) {
    const full: Highlight = { ...h, id: Math.random().toString(36).slice(2, 10), createdAt: Date.now() };
    const map = { ...get().highlights };
    map[h.bookId] = [...(map[h.bookId] ?? []), full];
    persistHighlights(map);
    set({ highlights: map });
    return full;
  },
  removeHighlight(bookId, id) {
    const map = { ...get().highlights };
    map[bookId] = (map[bookId] ?? []).filter((x) => x.id !== id);
    persistHighlights(map);
    set({ highlights: map });
  },
  highlightsFor(bookId) {
    return get().highlights[bookId] ?? [];
  },
}));
