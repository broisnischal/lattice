import type { Block } from "@/api/types";

/**
 * The searchable/wordcount-able text of a block. Image blocks contribute their
 * alt text (usually empty), so callers that treat every block as text — search
 * scoring, citation quotes, word counts — stay correct after image blocks were
 * added to the union.
 */
export function blockText(b: Block): string {
  return b.type === "img" ? b.alt ?? "" : b.text;
}

/** Word count across a block list; image blocks count as zero words. */
export function countWords(blocks: Block[]): number {
  return blocks.reduce((n, b) => {
    if (b.type === "img") return n;
    return n + b.text.split(/\s+/).filter(Boolean).length;
  }, 0);
}
