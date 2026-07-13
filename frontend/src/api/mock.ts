/**
 * Mock backend. Every function returns a promise with a small delay so the UI
 * exercises real loading states. This is the single seam to replace with a
 * real API (auth + catalog + AI + sync) later — keep the signatures stable.
 *
 * Two things here are NOT mocked when running under the native shell:
 *  - `convert({kind:"url"})` fetches the page via the `net.fetch` bridge and
 *    extracts a clean article (falls back to mock text in browser dev).
 *  - `addFeed` fetches + parses real RSS/Atom (falls back to mock in browser).
 *
 * Book *bodies* are persisted to IndexedDB (see lib/content.ts); the zustand
 * store holds only lightweight metadata. `listBooks` therefore returns books
 * with an empty `blocks` array — call `getBook` to load a body on demand.
 */

import type {
  AiMessage,
  Block,
  Book,
  Citation,
  Collection,
  Connection,
  Feed,
  FeedItem,
  Highlight,
  LibraryAnswer,
  User,
} from "./types";
import { fetchUrl } from "@/lib/native";
import { extractArticle, parseFeed } from "@/lib/extract";
import { blockText, countWords } from "@/lib/blocks";
import * as content from "@/lib/content";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);

const G = (from: string, to: string) => ({ from, to });

const LOREM = [
  "Attention is the rarest and purest form of generosity. What we choose to read shapes the texture of our thinking more than almost anything else we do in a day.",
  "The best reading tools disappear. They hold the page steady, keep your place, and get out of the way so the argument on the page can do its work on your mind.",
  "A library is not a collection of books so much as a collection of unfinished conversations — with authors, with your past self, and with the ideas you meant to return to.",
  "When a machine can summarize, it becomes tempting to skip the reading. But the summary is the map, not the territory; the value was always in the walking.",
  "Every highlight is a small act of hope: that this sentence will matter again, that you will come back, that the future version of you will be grateful for the marker left behind.",
  "Cross-platform is a promise about time, not screens. It means the sentence you underlined on a train this morning is waiting, exactly where you left it, on the desk tonight.",
];

function lorem(paras: number, seed = ""): Block[] {
  const out: Block[] = [];
  for (let i = 0; i < paras; i++) out.push({ type: "p", text: LOREM[(i + seed.length) % LOREM.length] });
  return out;
}

function chapter(title: string, paras: number, seed = ""): Block[] {
  return [{ type: "h2", text: title }, ...lorem(paras, seed)];
}

let USER: User | null = null;

const collections: Collection[] = [
  { id: "c-reading", name: "Reading now", gradient: G("#7c7bff", "#c084fc"), bookIds: [] },
  { id: "c-work", name: "Work & research", gradient: G("#22d3ee", "#3b82f6"), bookIds: [] },
  { id: "c-later", name: "Read later", gradient: G("#34d399", "#10b981"), bookIds: [] },
];

function mkBook(p: Partial<Book> & Pick<Book, "title" | "author" | "format" | "gradient" | "glyph">): Book {
  const blocks: Block[] = p.blocks ?? [
    { type: "h1", text: p.title },
    ...lorem(4, p.title),
    ...chapter("The shape of attention", 5, p.author),
    ...chapter("Notes toward a practice", 4, p.title + p.author),
  ];
  const wordCount = countWords(blocks);
  return {
    id: p.id ?? uid(),
    title: p.title,
    author: p.author,
    format: p.format,
    gradient: p.gradient,
    glyph: p.glyph,
    progress: p.progress ?? 0,
    addedAt: p.addedAt ?? Date.now(),
    source: p.source ?? "Upload",
    collectionId: p.collectionId,
    tags: p.tags ?? [],
    blocks,
    wordCount,
  };
}

/** A deliberately huge book to prove the reader opens instantly and scrolls at
 *  60fps regardless of length (perf verification). ~6,000 blocks. */
function bigBook(): Book {
  const blocks: Block[] = [{ type: "h1", text: "War and Attention" }];
  for (let c = 1; c <= 120; c++) {
    blocks.push({ type: "h2", text: `Chapter ${c}` });
    for (let p = 0; p < 49; p++) {
      blocks.push({ type: "p", text: LOREM[(c + p) % LOREM.length] });
    }
  }
  return mkBook({
    id: "big",
    title: "War and Attention",
    author: "L. Tolstoy (abridged)",
    format: "epub",
    gradient: G("#334155", "#0f172a"),
    glyph: "📚",
    progress: 0.05,
    source: "Upload",
    collectionId: "c-reading",
    tags: ["epic", "focus"],
    blocks,
  });
}

// In-memory "database" — the source of truth (stands in for a server).
let books: Book[] = [
  mkBook({ id: "b1", title: "The Anatomy of Attention", author: "Mira Vance", format: "epub", glyph: "📖", gradient: G("#7c7bff", "#a855f7"), progress: 0.42, source: "Upload", collectionId: "c-reading", tags: ["focus", "essays"] }),
  mkBook({ id: "b2", title: "Systems That Read You Back", author: "Dev Okonkwo", format: "pdf", glyph: "🧩", gradient: G("#22d3ee", "#2563eb"), progress: 0.13, source: "Upload", collectionId: "c-work", tags: ["design", "systems"] }),
  mkBook({ id: "b3", title: "Field Notes on Slowness", author: "Talia Brenner", format: "markdown", glyph: "🌿", gradient: G("#34d399", "#059669"), progress: 0.78, source: "Notion", collectionId: "c-reading", tags: ["journal", "slowness"] }),
  mkBook({ id: "b4", title: "The Long Web", author: "Rin Matsuda", format: "web", glyph: "🌐", gradient: G("#fb7185", "#e11d48"), progress: 0, source: "Web", collectionId: "c-later", tags: ["saved", "systems"] }),
  mkBook({ id: "b5", title: "Marginalia", author: "Anon.", format: "text", glyph: "✍️", gradient: G("#fbbf24", "#f97316"), progress: 0.55, source: "Upload", collectionId: "c-work", tags: ["notes"] }),
  mkBook({ id: "b6", title: "On Rereading", author: "Patricia Vaux", format: "epub", glyph: "🔁", gradient: G("#818cf8", "#6366f1"), progress: 0.9, source: "Upload", collectionId: "c-later", tags: ["essays", "focus"] }),
  bigBook(),
];
const SEED_IDS = new Set(books.map((b) => b.id));

for (const c of collections) c.bookIds = books.filter((b) => b.collectionId === c.id).map((b) => b.id);

// Seed highlights anchored to real block text so marks render in the reader
// and Highlights / Review / Threads have content to show on first run.
function buildSeedHighlights(): Record<string, Highlight[]> {
  const map: Record<string, Highlight[]> = {};
  const colors: Highlight["color"][] = ["violet", "amber", "green", "rose", "cyan"];
  const picks: { bookId: string; note?: string }[] = [
    { bookId: "b1", note: "The thesis in one line." },
    { bookId: "b1" },
    { bookId: "b3", note: "Return to this before writing." },
    { bookId: "b2" },
    { bookId: "b6", note: "The whole case for rereading." },
    { bookId: "b5" },
  ];
  let ci = 0;
  const day = 86_400_000;
  picks.forEach((pick, idx) => {
    const b = books.find((x) => x.id === pick.bookId);
    if (!b) return;
    const blockIndex = b.blocks.findIndex((bl, i) => i > 0 && bl.type === "p");
    if (blockIndex < 0) return;
    const full = blockText(b.blocks[blockIndex]);
    const quote = full.split(". ")[0] + ".";
    (map[pick.bookId] ??= []).push({
      id: uid(),
      bookId: pick.bookId,
      blockIndex,
      text: quote,
      color: colors[ci++ % colors.length],
      note: pick.note,
      createdAt: Date.now() - (idx + 1) * day * 2,
    });
  });
  return map;
}

let feeds: Feed[] = [
  { id: "f1", title: "Ribbonfarm", homepage: "ribbonfarm.com", gradient: G("#f59e0b", "#ef4444"), glyph: "🎗️", unread: 3 },
  { id: "f2", title: "Stratechery", homepage: "stratechery.com", gradient: G("#3b82f6", "#1d4ed8"), glyph: "📊", unread: 1 },
  { id: "f3", title: "The Marginalian", homepage: "themarginalian.org", gradient: G("#10b981", "#0d9488"), glyph: "🖋️", unread: 5 },
];

let feedItems: FeedItem[] = [
  { id: "i1", feedId: "f1", title: "The Calculus of Grit", excerpt: "A theory of how effort compounds when you stop optimizing for legibility.", publishedAt: Date.now() - 3600_000 * 5, read: false, blocks: [{ type: "h1", text: "The Calculus of Grit" }, ...lorem(6, "grit")] },
  { id: "i2", feedId: "f2", title: "Aggregation Theory, Revisited", excerpt: "Why owning the demand relationship still beats owning supply.", publishedAt: Date.now() - 3600_000 * 26, read: false, blocks: [{ type: "h1", text: "Aggregation Theory, Revisited" }, ...lorem(7, "aggregation")] },
  { id: "i3", feedId: "f3", title: "On the Art of Being Interrupted", excerpt: "How the great essayists made room for wandering.", publishedAt: Date.now() - 3600_000 * 50, read: true, blocks: [{ type: "h1", text: "On the Art of Being Interrupted" }, ...lorem(5, "interrupt")] },
];

const connections: Connection[] = [
  { kind: "notion", name: "Notion", description: "Import pages & databases as books", gradient: G("#e5e7eb", "#9ca3af"), glyph: "N", connected: false },
  { kind: "pocket", name: "Pocket", description: "Sync your saved read-later queue", gradient: G("#fb7185", "#e11d48"), glyph: "P", connected: false },
  { kind: "readwise", name: "Readwise", description: "Two-way sync of your highlights", gradient: G("#38bdf8", "#0ea5e9"), glyph: "R", connected: false },
  { kind: "gdrive", name: "Google Drive", description: "Open EPUB & PDF from Drive", gradient: G("#34d399", "#f59e0b"), glyph: "D", connected: false },
];

const meta = (b: Book): Book => ({ ...b, blocks: [] });

// Hydrate persisted (user-added) books from IndexedDB once.
let hydrated = false;
async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const metas = await content.listBookMetas();
    for (const m of metas) {
      if (books.some((b) => b.id === m.id)) continue;
      const blocks = (await content.loadBlocks(m.id)) ?? [];
      books.push({ ...m, blocks });
    }
  } catch {
    /* IndexedDB unavailable — seeds still work */
  }
}

// ---------------------------------------------------------------- auth

export const api = {
  async login(email: string, _password: string): Promise<User> {
    await delay(600);
    const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    USER = { id: uid(), name: name || "Reader", email, gradient: G("#7c7bff", "#22d3ee"), plan: "pro" };
    return USER;
  },
  async signup(name: string, email: string, _password: string): Promise<User> {
    await delay(700);
    USER = { id: uid(), name, email, gradient: G("#34d399", "#3b82f6"), plan: "free" };
    return USER;
  },
  async logout(): Promise<void> {
    await delay(150);
    USER = null;
  },
  async currentUser(): Promise<User | null> {
    await delay(120);
    return USER;
  },

  // -------------------------------------------------------------- library
  /** Returns lightweight metadata (empty blocks) — call getBook for a body. */
  async listBooks(): Promise<Book[]> {
    await hydrate();
    await delay(240);
    return books
      .slice()
      .sort((a, b) => b.addedAt - a.addedAt)
      .map(meta);
  },
  async listCollections(): Promise<Collection[]> {
    await delay(120);
    return collections.slice();
  },
  async getBook(id: string): Promise<Book | undefined> {
    await hydrate();
    await delay(160);
    return books.find((b) => b.id === id);
  },
  /** Seed highlights (used only when the user has none persisted yet). */
  async listSeedHighlights(): Promise<Record<string, Highlight[]>> {
    return buildSeedHighlights();
  },
  async setProgress(id: string, progress: number): Promise<void> {
    const b = books.find((x) => x.id === id);
    if (b) {
      b.progress = Math.max(0, Math.min(1, progress));
      if (!SEED_IDS.has(id)) content.saveBook(b).catch(() => {});
    }
  },
  async addBook(book: Book): Promise<Book> {
    await delay(120);
    books = [book, ...books];
    if (!SEED_IDS.has(book.id)) await content.saveBook(book).catch(() => {});
    return book;
  },
  async deleteBook(id: string): Promise<void> {
    await delay(120);
    books = books.filter((b) => b.id !== id);
    if (!SEED_IDS.has(id)) await content.deleteBook(id).catch(() => {});
  },

  // -------------------------------------------------------------- feeds
  async listFeeds(): Promise<Feed[]> {
    await delay(200);
    return feeds.slice();
  },
  async listFeedItems(): Promise<FeedItem[]> {
    await delay(250);
    return feedItems.slice().sort((a, b) => b.publishedAt - a.publishedAt);
  },
  async markRead(itemId: string): Promise<void> {
    const it = feedItems.find((i) => i.id === itemId);
    if (it && !it.read) {
      it.read = true;
      const f = feeds.find((x) => x.id === it.feedId);
      if (f) f.unread = Math.max(0, f.unread - 1);
    }
  },
  /** Real RSS/Atom via the native bridge; mock fallback in browser dev. */
  async addFeed(url: string): Promise<Feed> {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetchUrl(normalized);
    const parsed = res.body ? parseFeed(res.body) : null;

    if (parsed && parsed.items.length) {
      const host = parsed.homepage || normalized.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const feed: Feed = {
        id: uid(),
        title: parsed.title,
        homepage: host,
        gradient: G("#7c7bff", "#22d3ee"),
        glyph: "🔗",
        unread: parsed.items.length,
      };
      feeds = [feed, ...feeds];
      const items: FeedItem[] = parsed.items.map((it) => ({
        id: uid(),
        feedId: feed.id,
        title: it.title,
        excerpt: it.excerpt,
        publishedAt: it.publishedAt,
        read: false,
        blocks: it.blocks,
      }));
      feedItems = [...items, ...feedItems];
      return feed;
    }

    // Fallback (no bridge / unreachable): synthesize a feed so dev still flows.
    await delay(400);
    const host = normalized.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const feed: Feed = { id: uid(), title: host.split(".")[0].replace(/\b\w/, (c) => c.toUpperCase()), homepage: host, gradient: G("#7c7bff", "#22d3ee"), glyph: "🔗", unread: 2 };
    feeds = [feed, ...feeds];
    feedItems = [
      { id: uid(), feedId: feed.id, title: `Latest from ${feed.title}`, excerpt: "Freshly fetched from the feed.", publishedAt: Date.now(), read: false, blocks: [{ type: "h1", text: `Latest from ${feed.title}` }, ...lorem(4, feed.id)] },
      ...feedItems,
    ];
    return feed;
  },

  // -------------------------------------------------------------- connections
  async listConnections(): Promise<Connection[]> {
    await delay(120);
    return connections.slice();
  },
  async toggleConnection(kind: string): Promise<Connection[]> {
    await delay(400);
    const c = connections.find((x) => x.kind === kind);
    if (c) c.connected = !c.connected;
    return connections.slice();
  },

  // -------------------------------------------------------------- convert
  /**
   * Turn a URL / pasted text / import into a reading-ready book. For URLs this
   * fetches via the native bridge and runs a Readability-style extractor;
   * without a bridge it falls back to placeholder text so browser dev works.
   * Returns the built book WITHOUT persisting — the caller adds it via addBook
   * (which persists), letting the ImportDialog preview first.
   */
  async convert(input: { kind: "url" | "text" | "notion"; value: string; title?: string }): Promise<Book> {
    if (input.kind === "text") {
      await delay(300);
      const blocks: Block[] = [
        { type: "h1", text: input.title || "Pasted note" },
        ...input.value.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean).map((t) => ({ type: "p" as const, text: t })),
      ];
      return mkBook({ title: input.title || "Pasted note", author: "You", format: "text", glyph: "✍️", gradient: G("#fbbf24", "#f59e0b"), source: "Paste", blocks });
    }

    if (input.kind === "url") {
      const url = input.value.startsWith("http") ? input.value : `https://${input.value}`;
      let hostname = "article";
      try { hostname = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep default */ }
      const res = await fetchUrl(url);
      if (res.body && res.contentType.includes("html")) {
        const { title, author, blocks } = extractArticle(res.body, input.title || hostname);
        return mkBook({ title: input.title || title, author: author || hostname, format: "web", glyph: "🌐", gradient: G("#fb7185", "#f59e0b"), source: hostname, blocks });
      }
      // Fallback for browser dev / unreachable pages.
      await delay(500);
      return mkBook({ title: input.title || hostname, author: hostname, format: "web", glyph: "🌐", gradient: G("#fb7185", "#f59e0b"), source: hostname, blocks: [{ type: "h1", text: input.title || `Saved from ${hostname}` }, ...lorem(6, input.value)] });
    }

    // notion (still mocked)
    await delay(700);
    return mkBook({ title: input.title || "Notion page", author: "Notion", format: "web", glyph: "N", gradient: G("#e5e7eb", "#9ca3af"), source: "Notion", blocks: [{ type: "h1", text: input.title || "Notion page" }, ...lorem(6, input.value)] });
  },

  // -------------------------------------------------------------- AI (per book)
  /** Streamed-feel chat grounded in a single book (the in-reader copilot). */
  async ask(book: Book | null, question: string, _history: AiMessage[]): Promise<string> {
    await delay(700 + Math.random() * 500);
    const ctx = book ? `"${book.title}" by ${book.author}` : "your library";
    const q = question.toLowerCase();
    if (q.includes("summar")) {
      return `Here's the gist of ${ctx}:\n\n• It argues that attention is a resource you spend, not a state you're in.\n• The middle chapters turn that into a practice: fewer sources, deeper passes, deliberate rereading.\n• The payoff is compounding — small markers left today make the next pass faster.\n\nWant me to expand any point, or pull the exact passages behind it?`;
    }
    if (q.includes("highlight") || q.includes("key")) {
      return `The lines most worth marking in ${ctx}:\n\n1. "Attention is the rarest and purest form of generosity."\n2. "The summary is the map, not the territory; the value was always in the walking."\n\nI can save these as highlights if you'd like.`;
    }
    if (book && (q.includes("explain") || q.includes("mean"))) {
      return `In the context of ${ctx}, that passage is making a narrow claim: the tool should hold your place so the *argument* can do the work. It's less about features and more about removing friction between you and the page.`;
    }
    return `Good question about ${ctx}. Short version: the throughline is that reading is an active practice, and the right tooling protects your attention instead of competing for it. Ask me to summarize, pull key highlights, or explain a passage you select.`;
  },

  // -------------------------------------------------------------- AI (library-wide)
  /**
   * Search every book's blocks for the question's keywords, then return a
   * grounded answer with citations that deep-link to the source passage.
   */
  async askLibrary(question: string): Promise<LibraryAnswer> {
    await hydrate();
    await delay(650 + Math.random() * 350);
    const terms = tokenize(question);

    type Hit = { bookId: string; bookTitle: string; blockIndex: number; quote: string; score: number };
    const hits: Hit[] = [];
    for (const b of books) {
      b.blocks.forEach((block, i) => {
        if (block.type === "h1" || block.type === "img") return;
        const score = scoreBlock(block.text, terms);
        if (score > 0) hits.push({ bookId: b.id, bookTitle: b.title, blockIndex: i, quote: snippet(block.text), score });
      });
    }
    hits.sort((a, b) => b.score - a.score);

    // Keep the best hit per book first, then fill up to 5 citations.
    const perBook = new Map<string, Hit>();
    for (const h of hits) if (!perBook.has(h.bookId)) perBook.set(h.bookId, h);
    const ordered = [...perBook.values(), ...hits.filter((h) => perBook.get(h.bookId) !== h)];
    const citations: Citation[] = ordered.slice(0, 5).map((h) => ({
      bookId: h.bookId,
      bookTitle: h.bookTitle,
      blockIndex: h.blockIndex,
      quote: h.quote,
    }));

    const topic = terms.length ? terms.join(", ") : "that";
    let answer: string;
    if (citations.length === 0) {
      answer = `I couldn't find passages in your library that speak directly to "${question}". Try different words, or open a book and ask the in-reader copilot for a focused read.`;
    } else {
      const bookCount = new Set(citations.map((c) => c.bookId)).size;
      answer =
        `Across ${bookCount} ${bookCount === 1 ? "book" : "books"} in your library, the through-line on ${topic} is that attention is a resource you spend deliberately, and the practice is fewer sources read more deeply. ` +
        `The clearest support is in ${citations[0].bookTitle}${citations[1] ? ` and ${citations[1].bookTitle}` : ""} — see the grounded passages below.`;
    }
    return { answer, citations };
  },
};

// ------------------------------------------------------------------ helpers
const STOP = new Set(["the", "a", "an", "of", "to", "in", "on", "and", "or", "is", "are", "what", "how", "why", "does", "do", "about", "for", "with", "that", "this", "it", "my", "me", "i", "you", "can", "tell"]);

function tokenize(q: string): string[] {
  return Array.from(
    new Set(
      q
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP.has(w)),
    ),
  );
}

function scoreBlock(text: string, terms: string[]): number {
  if (!terms.length) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const t of terms) {
    let idx = lower.indexOf(t);
    while (idx >= 0) {
      score += 1;
      idx = lower.indexOf(t, idx + t.length);
    }
  }
  return score;
}

function snippet(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max).replace(/\s+\S*$/, "") + "…" : clean;
}

export type Api = typeof api;
