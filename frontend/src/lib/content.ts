import { openDB, type IDBPDatabase } from "idb";
import type { Block, Book } from "@/api/types";

/**
 * IndexedDB-backed persistence for user-added books. Book *bodies* (the block
 * arrays, which can be megabytes for a large EPUB/PDF) live here — never in
 * localStorage (synchronous, string-only, ~5 MB cap) and never duplicated in
 * the zustand store, which keeps only lightweight metadata.
 *
 * `meta`  store: BookMeta (everything except blocks) keyed by id.
 * `body`  store: { id, blocks } keyed by id — loaded lazily when a book opens.
 */

export type BookMeta = Omit<Book, "blocks">;

const DB = "reader-db";
const VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;
function db() {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB, VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "id" });
        if (!d.objectStoreNames.contains("body")) d.createObjectStore("body", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export function splitBook(book: Book): { meta: BookMeta; blocks: Block[] } {
  const { blocks, ...meta } = book;
  return { meta, blocks };
}

export async function saveBook(book: Book): Promise<void> {
  const conn = db();
  if (!conn) return;
  const { meta, blocks } = splitBook(book);
  const d = await conn;
  const tx = d.transaction(["meta", "body"], "readwrite");
  await Promise.all([
    tx.objectStore("meta").put(meta),
    tx.objectStore("body").put({ id: book.id, blocks }),
    tx.done,
  ]);
}

export async function listBookMetas(): Promise<BookMeta[]> {
  const conn = db();
  if (!conn) return [];
  const d = await conn;
  return (await d.getAll("meta")) as BookMeta[];
}

export async function loadBlocks(id: string): Promise<Block[] | null> {
  const conn = db();
  if (!conn) return null;
  const d = await conn;
  const rec = (await d.get("body", id)) as { id: string; blocks: Block[] } | undefined;
  return rec?.blocks ?? null;
}

export async function deleteBook(id: string): Promise<void> {
  const conn = db();
  if (!conn) return;
  const d = await conn;
  const tx = d.transaction(["meta", "body"], "readwrite");
  await Promise.all([tx.objectStore("meta").delete(id), tx.objectStore("body").delete(id), tx.done]);
}
