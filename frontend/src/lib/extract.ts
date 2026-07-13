import type { Block } from "@/api/types";

/**
 * Lightweight, dependency-free content extraction for the WebView + browser.
 * Turns fetched HTML into clean reading Block[] (a Readability-style
 * heuristic), and parses RSS/Atom feed XML with DOMParser.
 */

export interface Extracted {
  title: string;
  author?: string;
  blocks: Block[];
}

const BLOCK_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "BLOCKQUOTE", "LI", "PRE"]);
const STRIP_TAGS = "script,style,noscript,nav,header,footer,aside,form,iframe,svg,button,figure figcaption,.ad,.ads,.advert,.share,.social,.newsletter,.comments,.related,.sidebar";

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function tagToBlock(el: Element): Block | null {
  const text = clean(el.textContent || "");
  if (!text) return null;
  switch (el.tagName) {
    case "H1":
      return { type: "h1", text };
    case "H2":
    case "H4":
      return { type: "h2", text };
    case "H3":
    case "H5":
    case "H6":
      return { type: "h3", text };
    case "BLOCKQUOTE":
      return { type: "quote", text };
    default:
      return { type: "p", text };
  }
}

/**
 * Pull headings/paragraphs/quotes/list-items in document order. Uses
 * querySelectorAll (worker-safe — no TreeWalker) and drops block tags nested
 * inside another captured block to avoid duplicate text.
 */
export function htmlToBlocks(container: Element): Block[] {
  const els = Array.from(
    container.querySelectorAll("h1,h2,h3,h4,h5,h6,p,blockquote,li,pre"),
  );
  const blocks: Block[] = [];
  for (const el of els) {
    let ancestorCaptured = false;
    let p = el.parentElement;
    while (p && p !== container) {
      if (BLOCK_TAGS.has(p.tagName)) { ancestorCaptured = true; break; }
      p = p.parentElement;
    }
    if (ancestorCaptured) continue;
    const b = tagToBlock(el);
    if (b && b.text.length > 1) blocks.push(b);
  }
  return blocks;
}

function textLength(el: Element): number {
  return (el.textContent || "").replace(/\s+/g, " ").trim().length;
}

/** Pick the densest content container: article > main > best-scoring block. */
function pickContentRoot(doc: Document): Element {
  const article = doc.querySelector("article");
  if (article && textLength(article) > 200) return article;
  const main = doc.querySelector("main");
  if (main && textLength(main) > 200) return main;

  const candidates = Array.from(doc.querySelectorAll("div,section,article,main"));
  let best: Element | null = null;
  let bestScore = 0;
  for (const el of candidates) {
    const paras = el.querySelectorAll(":scope > p, :scope > h2, :scope > h3");
    let score = 0;
    paras.forEach((p) => (score += textLength(p)));
    // Favor containers whose direct paragraphs hold the bulk of the text.
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best && bestScore > 140 ? best : doc.body;
}

function metaContent(doc: Document, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const c = el?.getAttribute("content") || el?.textContent;
    if (c && clean(c)) return clean(c);
  }
  return undefined;
}

export function extractArticle(html: string, fallbackTitle = "Saved article"): Extracted {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(STRIP_TAGS).forEach((el) => el.remove());

  const title =
    metaContent(doc, ['meta[property="og:title"]', 'meta[name="twitter:title"]', "title", "h1"]) ||
    fallbackTitle;
  const author = metaContent(doc, [
    'meta[name="author"]',
    'meta[property="article:author"]',
    '[rel="author"]',
    ".author",
    ".byline",
  ]);

  const root = pickContentRoot(doc);
  let blocks = htmlToBlocks(root);

  // Drop a leading block that just repeats the title.
  if (blocks.length && clean(blocks[0].text).toLowerCase() === clean(title).toLowerCase()) {
    blocks = blocks.slice(1);
  }
  // Ensure the document opens with a title heading.
  blocks = [{ type: "h1", text: title }, ...blocks];

  return { title, author, blocks };
}

/** Minimal Markdown → Block[] (headings, blockquotes, paragraphs). */
export function markdownToBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      const text = clean(para.join(" ").replace(/[*_`]/g, ""));
      if (text) blocks.push({ type: "p", text });
      para = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = h[1].length;
      blocks.push({ type: level === 1 ? "h1" : level === 2 ? "h2" : "h3", text: clean(h[2]) });
    } else if (/^>\s?/.test(line)) {
      flush();
      blocks.push({ type: "quote", text: clean(line.replace(/^>\s?/, "")) });
    } else if (line.trim() === "") {
      flush();
    } else if (/^[-*+]\s+/.test(line)) {
      flush();
      blocks.push({ type: "p", text: "• " + clean(line.replace(/^[-*+]\s+/, "")) });
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

// ------------------------------------------------------------------ feeds

export interface FeedEntry {
  title: string;
  link: string;
  publishedAt: number;
  excerpt: string;
  blocks: Block[];
}

export interface ParsedFeed {
  title: string;
  homepage: string;
  items: FeedEntry[];
}

function firstText(parent: Element, tags: string[]): string {
  for (const t of tags) {
    const el = parent.getElementsByTagName(t)[0] || parent.querySelector(t.replace(":", "\\:"));
    if (el && clean(el.textContent || "")) return clean(el.textContent || "");
  }
  return "";
}

function contentToBlocks(raw: string, title: string): { blocks: Block[]; excerpt: string } {
  const looksHtml = /<[a-z][\s\S]*>/i.test(raw);
  let blocks: Block[];
  if (looksHtml) {
    const doc = new DOMParser().parseFromString(raw, "text/html");
    doc.querySelectorAll(STRIP_TAGS).forEach((el) => el.remove());
    blocks = htmlToBlocks(doc.body);
  } else {
    blocks = clean(raw)
      .split(/\n{2,}|(?<=\.)\s{2,}/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => ({ type: "p" as const, text: t }));
  }
  const excerpt = blocks.find((b) => b.type === "p")?.text.slice(0, 220) || clean(raw).slice(0, 220);
  return { blocks: [{ type: "h1", text: title }, ...blocks], excerpt };
}

export function parseFeed(xml: string): ParsedFeed | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return null;

  const isAtom = doc.documentElement.tagName.toLowerCase() === "feed";
  const channel = doc.querySelector("channel") || doc.documentElement;

  const feedTitle = firstText(channel, ["title"]) || "Untitled feed";
  let homepage = "";
  if (isAtom) {
    const link = Array.from(doc.querySelectorAll("feed > link")).find(
      (l) => !l.getAttribute("rel") || l.getAttribute("rel") === "alternate",
    );
    homepage = link?.getAttribute("href") || "";
  } else {
    homepage = firstText(channel, ["link"]);
  }

  const itemEls = Array.from(doc.querySelectorAll(isAtom ? "entry" : "item"));
  const items: FeedEntry[] = itemEls.slice(0, 40).map((el) => {
    const title = firstText(el, ["title"]) || "Untitled";
    let link = "";
    if (isAtom) {
      const l = el.querySelector("link");
      link = l?.getAttribute("href") || firstText(el, ["id"]);
    } else {
      link = firstText(el, ["link"]) || firstText(el, ["guid"]);
    }
    const dateStr = firstText(el, ["pubDate", "published", "updated", "date"]);
    const publishedAt = dateStr ? new Date(dateStr).getTime() || Date.now() : Date.now();

    // Prefer full content (content:encoded / atom content) over summary.
    const encoded =
      el.getElementsByTagName("content:encoded")[0]?.textContent ||
      el.querySelector("encoded")?.textContent ||
      "";
    const content = encoded || firstText(el, ["content", "description", "summary"]);
    const { blocks, excerpt } = contentToBlocks(content || title, title);

    return { title, link, publishedAt, excerpt, blocks };
  });

  return { title: feedTitle, homepage: homepage.replace(/^https?:\/\//, "").replace(/\/$/, ""), items };
}
