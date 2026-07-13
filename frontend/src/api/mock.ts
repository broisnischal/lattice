/**
 * Mock backend. Every function returns a promise with a small delay so the UI
 * exercises real loading states. This is the single seam to replace with a
 * real API (auth + catalog + AI + sync) later — keep the signatures stable.
 */

import type {
  AiMessage,
  Block,
  Book,
  Collection,
  Connection,
  Feed,
  FeedItem,
  User,
} from "./types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);

const G = (from: string, to: string) => ({ from, to });

function lorem(paras: number, seed = ""): Block[] {
  const base = [
    "Attention is the rarest and purest form of generosity. What we choose to read shapes the texture of our thinking more than almost anything else we do in a day.",
    "The best reading tools disappear. They hold the page steady, keep your place, and get out of the way so the argument on the page can do its work on your mind.",
    "A library is not a collection of books so much as a collection of unfinished conversations — with authors, with your past self, and with the ideas you meant to return to.",
    "When a machine can summarize, it becomes tempting to skip the reading. But the summary is the map, not the territory; the value was always in the walking.",
    "Every highlight is a small act of hope: that this sentence will matter again, that you will come back, that the future version of you will be grateful for the marker left behind.",
    "Cross-platform is a promise about time, not screens. It means the sentence you underlined on a train this morning is waiting, exactly where you left it, on the desk tonight.",
  ];
  const out: Block[] = [];
  for (let i = 0; i < paras; i++) {
    out.push({ type: "p", text: base[(i + seed.length) % base.length] });
  }
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
  const wordCount = blocks.reduce((n, b) => n + b.text.split(/\s+/).length, 0);
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

let books: Book[] = [
  mkBook({ id: "b1", title: "The Anatomy of Attention", author: "Mira Vance", format: "epub", glyph: "📖", gradient: G("#7c7bff", "#a855f7"), progress: 0.42, source: "Upload", collectionId: "c-reading", tags: ["focus", "essays"] }),
  mkBook({ id: "b2", title: "Systems That Read You Back", author: "Dev Okonkwo", format: "pdf", glyph: "🧩", gradient: G("#22d3ee", "#2563eb"), progress: 0.13, source: "Upload", collectionId: "c-work", tags: ["design"] }),
  mkBook({ id: "b3", title: "Field Notes on Slowness", author: "Talia Brenner", format: "markdown", glyph: "🌿", gradient: G("#34d399", "#059669"), progress: 0.78, source: "Notion", collectionId: "c-reading", tags: ["journal"] }),
  mkBook({ id: "b4", title: "The Long Web", author: "Rin Matsuda", format: "web", glyph: "🌐", gradient: G("#fb7185", "#e11d48"), progress: 0, source: "Web", collectionId: "c-later", tags: ["saved"] }),
  mkBook({ id: "b5", title: "Marginalia", author: "Anon.", format: "text", glyph: "✍️", gradient: G("#fbbf24", "#f97316"), progress: 0.55, source: "Upload", collectionId: "c-work", tags: ["notes"] }),
  mkBook({ id: "b6", title: "On Rereading", author: "Patricia Vaux", format: "epub", glyph: "🔁", gradient: G("#818cf8", "#6366f1"), progress: 0.9, source: "Upload", collectionId: "c-later", tags: ["essays"] }),
];

// Wire collection membership from the seed books.
for (const c of collections) c.bookIds = books.filter((b) => b.collectionId === c.id).map((b) => b.id);

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
  async listBooks(): Promise<Book[]> {
    await delay(300);
    return books.slice().sort((a, b) => b.addedAt - a.addedAt);
  },
  async listCollections(): Promise<Collection[]> {
    await delay(120);
    return collections.slice();
  },
  async getBook(id: string): Promise<Book | undefined> {
    await delay(200);
    return books.find((b) => b.id === id);
  },
  async setProgress(id: string, progress: number): Promise<void> {
    const b = books.find((x) => x.id === id);
    if (b) b.progress = Math.max(0, Math.min(1, progress));
  },
  async addBook(book: Book): Promise<Book> {
    await delay(150);
    books = [book, ...books];
    return book;
  },
  async deleteBook(id: string): Promise<void> {
    await delay(120);
    books = books.filter((b) => b.id !== id);
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
  async addFeed(url: string): Promise<Feed> {
    await delay(500);
    const host = url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
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
  /** "Convert" a URL / pasted text / import into a reading-ready book. */
  async convert(input: { kind: "url" | "text" | "notion"; value: string; title?: string }): Promise<Book> {
    await delay(900);
    const isUrl = input.kind === "url";
    const blocks: Block[] =
      input.kind === "text"
        ? [{ type: "h1", text: input.title || "Pasted note" }, ...input.value.split(/\n{2,}/).filter(Boolean).map((t) => ({ type: "p" as const, text: t }))]
        : [{ type: "h1", text: input.title || (isUrl ? "Saved article" : "Notion page") }, ...lorem(6, input.value)];
    return mkBook({
      title: input.title || (isUrl ? new URL(input.value.startsWith("http") ? input.value : `https://${input.value}`).hostname : input.kind === "notion" ? "Notion page" : "Pasted note"),
      author: input.kind === "notion" ? "Notion" : isUrl ? "Web" : "You",
      format: input.kind === "notion" ? "web" : isUrl ? "web" : "text",
      glyph: input.kind === "notion" ? "N" : isUrl ? "🌐" : "✍️",
      gradient: input.kind === "notion" ? G("#e5e7eb", "#9ca3af") : G("#fb7185", "#f59e0b"),
      source: input.kind === "notion" ? "Notion" : isUrl ? "Web" : "Paste",
      blocks,
    });
  },

  // -------------------------------------------------------------- AI
  /** Streamed-feel chat grounded in a book's content. */
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
};

export type Api = typeof api;
