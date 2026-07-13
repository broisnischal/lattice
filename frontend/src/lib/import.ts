import type { Block } from "@/api/types";
import { htmlToBlocks, markdownToBlocks } from "./extract";

export interface ParsedDoc {
  title: string;
  author?: string;
  blocks: Block[];
  format: "epub" | "pdf" | "markdown" | "text";
}

export type ProgressFn = (value: number) => void;

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}
function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Parse a local file into clean reading blocks — all on the main thread.
 *
 * We deliberately do NOT use a Web Worker here: workers frequently fail to
 * instantiate under the packaged app's `zero://app` origin, which silently
 * broke "Add book" in the desktop build. Import is a one-off action, so
 * main-thread parsing (with heavy deps dynamically imported / code-split) is
 * both robust and fast enough. Binary formats are read as ArrayBuffer and
 * decoded properly — never via file.text().
 */
export async function parseFile(file: File, onProgress?: ProgressFn): Promise<ParsedDoc> {
  const ext = extOf(file.name);
  onProgress?.(0.05);

  if (ext === "pdf") {
    return parsePdf(await file.arrayBuffer(), file.name, onProgress);
  }
  if (ext === "epub") {
    return parseEpub(await file.arrayBuffer(), file.name, onProgress);
  }
  if (ext === "md" || ext === "markdown") {
    const blocks = markdownToBlocks(await file.text());
    onProgress?.(1);
    return { title: baseName(file.name), blocks: ensureTitle(baseName(file.name), blocks), format: "markdown" };
  }
  // plain text
  const text = await file.text();
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({ type: "p" as const, text: t }));
  onProgress?.(1);
  return { title: baseName(file.name), blocks: ensureTitle(baseName(file.name), blocks), format: "text" };
}

function ensureTitle(title: string, blocks: Block[]): Block[] {
  if (blocks[0]?.type === "h1") return blocks;
  return [{ type: "h1", text: title }, ...blocks];
}

// ------------------------------------------------------------------ EPUB
async function parseEpub(buffer: ArrayBuffer, name: string, onProgress?: ProgressFn): Promise<ParsedDoc> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buffer);
  onProgress?.(0.1);

  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  if (!containerXml) throw new Error("Not a valid EPUB (missing container.xml)");
  const container = new DOMParser().parseFromString(containerXml, "application/xml");
  const opfPath = container.querySelector("rootfile")?.getAttribute("full-path");
  if (!opfPath) throw new Error("Not a valid EPUB (no OPF rootfile)");

  const opfXml = await zip.file(opfPath)?.async("string");
  if (!opfXml) throw new Error("EPUB OPF not found");
  const opf = new DOMParser().parseFromString(opfXml, "application/xml");

  const title = opf.querySelector("metadata > title, title")?.textContent?.trim() || baseName(name);
  const author = opf.querySelector("metadata > creator, creator")?.textContent?.trim() || undefined;

  const manifest = new Map<string, string>();
  opf.querySelectorAll("manifest > item").forEach((item) => {
    const iid = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (iid && href) manifest.set(iid, href);
  });

  const spine = Array.from(opf.querySelectorAll("spine > itemref"))
    .map((ref) => ref.getAttribute("idref"))
    .filter((x): x is string => !!x)
    .map((idref) => manifest.get(idref))
    .filter((x): x is string => !!x);

  const opfDir = opfPath.includes("/") ? opfPath.replace(/\/[^/]*$/, "/") : "";
  const blocks: Block[] = [{ type: "h1", text: title }];

  for (let i = 0; i < spine.length; i++) {
    const path = decodeURIComponent((opfDir + spine[i]).replace(/^\.\//, ""));
    const doc = await zip.file(path)?.async("string");
    if (doc) {
      const parsed = new DOMParser().parseFromString(doc, "text/html");
      parsed.querySelectorAll("script,style,nav,header,footer").forEach((el) => el.remove());
      for (const b of htmlToBlocks(parsed.body)) blocks.push(b);
    }
    onProgress?.(0.1 + 0.85 * ((i + 1) / Math.max(spine.length, 1)));
  }

  if (blocks.length < 2) throw new Error("EPUB contained no readable text");
  return { title, author, blocks, format: "epub" };
}

// ------------------------------------------------------------------ PDF
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

async function parsePdf(buffer: ArrayBuffer, name: string, onProgress?: ProgressFn): Promise<ParsedDoc> {
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const doc = await loadingTask.promise;

  let title = baseName(name);
  let author: string | undefined;
  try {
    const meta = await doc.getMetadata();
    const info = meta.info as { Title?: string; Author?: string } | undefined;
    if (info?.Title && clean(info.Title)) title = clean(info.Title);
    if (info?.Author && clean(info.Author)) author = clean(info.Author);
  } catch {
    /* metadata is optional */
  }

  const blocks: Block[] = [{ type: "h1", text: title }];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let line = "";
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      if (typeof item.str !== "string") continue;
      line += item.str;
      if (item.hasEOL) { lines.push(line); line = ""; }
    }
    if (line) lines.push(line);

    let para: string[] = [];
    const flush = () => {
      const text = clean(para.join(" "));
      if (text.length > 1) blocks.push({ type: "p", text });
      para = [];
    };
    for (const l of lines) {
      if (l.trim() === "") flush();
      else para.push(l);
    }
    flush();
    page.cleanup();
    onProgress?.(p / doc.numPages);
  }

  await loadingTask.destroy();
  if (blocks.length < 2) throw new Error("No selectable text found (scanned PDF?)");
  return { title, author, blocks, format: "pdf" };
}
