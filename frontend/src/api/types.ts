/** Core domain types shared across the app. */

export type BookFormat = "epub" | "pdf" | "text" | "markdown" | "web" | "feed";

export type Gradient = {
  from: string;
  to: string;
};

export interface User {
  id: string;
  name: string;
  email: string;
  gradient: Gradient;
  plan: "free" | "pro";
}

export interface Highlight {
  id: string;
  bookId: string;
  /** Index of the block (paragraph/heading) the highlight anchors to. */
  blockIndex: number;
  text: string;
  color: "violet" | "amber" | "green" | "rose" | "cyan";
  note?: string;
  createdAt: number;
}

/** A reading block — the normalized unit every source is converted into. */
export interface Block {
  type: "h1" | "h2" | "h3" | "p" | "quote";
  text: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  gradient: Gradient;
  /** Emoji or short initials shown on the cover tile. */
  glyph: string;
  /** 0..1 reading progress. */
  progress: number;
  addedAt: number;
  /** Where it came from: "Upload", "Notion", "Web", a feed title, etc. */
  source: string;
  collectionId?: string;
  tags: string[];
  /** Normalized reading content. */
  blocks: Block[];
  wordCount: number;
}

export interface Collection {
  id: string;
  name: string;
  gradient: Gradient;
  bookIds: string[];
}

export interface Feed {
  id: string;
  title: string;
  homepage: string;
  gradient: Gradient;
  glyph: string;
  unread: number;
}

export interface FeedItem {
  id: string;
  feedId: string;
  title: string;
  excerpt: string;
  publishedAt: number;
  read: boolean;
  /** Set when the user has saved this article into their library as a book. */
  savedBookId?: string;
  blocks: Block[];
}

export type ConnectionKind =
  | "notion"
  | "pocket"
  | "readwise"
  | "gdrive"
  | "url";

export interface Connection {
  kind: ConnectionKind;
  name: string;
  description: string;
  gradient: Gradient;
  glyph: string;
  connected: boolean;
}

export type AiRole = "user" | "assistant";

export interface AiMessage {
  id: string;
  role: AiRole;
  content: string;
  pending?: boolean;
}
