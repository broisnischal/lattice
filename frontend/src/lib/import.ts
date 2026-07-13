import type JSZip from "jszip";
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
  // Decoded image bytes are shared across chapters (logos, repeated figures),
  // so encode each zip entry to a data URL at most once.
  const imgCache = new Map<string, string | null>();

  for (let i = 0; i < spine.length; i++) {
    const chapterPath = decodeURIComponent((opfDir + spine[i]).replace(/^\.\//, ""));
    const doc = await zip.file(chapterPath)?.async("string");
    if (doc) {
      const parsed = new DOMParser().parseFromString(doc, "text/html");
      parsed.querySelectorAll("script,style,nav,header,footer").forEach((el) => el.remove());
      const chapterDir = chapterPath.includes("/") ? chapterPath.replace(/\/[^/]*$/, "/") : "";
      // Identity resolver: keep the raw (zip-relative) href so we can resolve it
      // against this chapter's directory and inline the bytes as a data URL.
      const raw = htmlToBlocks(parsed.body, { images: true, resolveSrc: (s) => s });
      for (const b of raw) {
        if (b.type === "img") {
          const zipPath = resolveZipPath(chapterDir, b.src);
          if (!zipPath) continue;
          const url = await zipImageDataUrl(zip, zipPath, imgCache);
          if (url) blocks.push({ type: "img", src: url, alt: b.alt });
        } else {
          blocks.push(b);
        }
      }
    }
    onProgress?.(0.1 + 0.85 * ((i + 1) / Math.max(spine.length, 1)));
  }

  if (blocks.length < 2) throw new Error("EPUB contained no readable content");
  return { title, author, blocks, format: "epub" };
}

const IMG_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", jfif: "image/jpeg",
  gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", avif: "image/avif",
};

/** Resolve an EPUB-relative image href to a normalized zip entry path. */
function resolveZipPath(fromDir: string, href: string): string | null {
  let p = href.split("#")[0].split("?")[0].trim();
  if (!p) return null;
  try { p = decodeURIComponent(p); } catch { /* keep as-is if malformed */ }
  if (/^[a-z][a-z0-9+.-]*:/i.test(p)) return null; // external URL / data: — not in the zip
  const base = p.startsWith("/") ? "" : fromDir;
  const out: string[] = [];
  for (const seg of (base + p.replace(/^\//, "")).split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return out.join("/") || null;
}

/** Read a zip image entry and return it as a self-contained data: URL. */
async function zipImageDataUrl(
  zip: JSZip,
  path: string,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (cache.has(path)) return cache.get(path)!;
  let entry = zip.file(path);
  if (!entry) {
    // EPUB paths are usually case-sensitive, but be forgiving of authoring slips.
    const lower = path.toLowerCase();
    const key = Object.keys(zip.files).find((k) => k.toLowerCase() === lower);
    if (key) entry = zip.file(key);
  }
  if (!entry) { cache.set(path, null); return null; }
  try {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    const mime = IMG_MIME[ext] || "image/png";
    const b64 = await entry.async("base64");
    const url = `data:${mime};base64,${b64}`;
    cache.set(path, url);
    return url;
  } catch {
    cache.set(path, null);
    return null;
  }
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
  // Dedupe images across pages by XObject id (logos/watermarks repeat every page).
  const seenImages = new Set<string>();
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

    // Embedded raster images for this page, appended after its text. Wrapped so
    // a decode failure never aborts text extraction for the rest of the book.
    try {
      for (const img of await pdfPageImages(pdfjs, page, seenImages)) blocks.push(img);
    } catch {
      /* image extraction is best-effort */
    }

    page.cleanup();
    onProgress?.(p / doc.numPages);
  }

  await loadingTask.destroy();
  if (blocks.length < 2) throw new Error("No selectable text or images found (scanned PDF?)");
  return { title, author, blocks, format: "pdf" };
}

/** Largest edge (px) an extracted PDF image is scaled down to, to cap size. */
const PDF_IMAGE_MAX_EDGE = 1600;

type PdfjsModule = Awaited<ReturnType<typeof loadPdfjs>>;
type PdfPage = Awaited<ReturnType<Awaited<ReturnType<PdfjsModule["getDocument"]>["promise"]>["getPage"]>>;

/** Extract embedded raster images (paintImageXObject) from a page, in order. */
async function pdfPageImages(pdfjs: PdfjsModule, page: PdfPage, seen: Set<string>): Promise<Block[]> {
  const ops = await page.getOperatorList();
  const paintImage = pdfjs.OPS.paintImageXObject;
  const ids: string[] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] !== paintImage) continue;
    const id = ops.argsArray[i]?.[0];
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  const out: Block[] = [];
  for (const id of ids) {
    const block = await pdfImageBlock(page, id);
    if (block) out.push(block);
  }
  return out;
}

/** Resolve a page image object (may resolve asynchronously) with a timeout. */
function getPageObj(page: PdfPage, objId: string): Promise<unknown> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: unknown) => { if (!settled) { settled = true; resolve(v); } };
    try {
      // With a callback, pdf.js fires it immediately if already resolved,
      // or once the worker delivers the decoded image otherwise.
      page.objs.get(objId, done);
    } catch {
      done(null);
    }
    setTimeout(() => done(null), 8000);
  });
}

interface PdfImageObj {
  width?: number;
  height?: number;
  bitmap?: CanvasImageSource;
  data?: Uint8ClampedArray;
  kind?: number;
}

/** Convert a decoded PDF image object into a data-URL image block. */
async function pdfImageBlock(page: PdfPage, objId: string): Promise<Block | null> {
  const img = (await getPageObj(page, objId)) as PdfImageObj | null;
  if (!img) return null;
  const w = img.width ?? 0;
  const h = img.height ?? 0;
  if (w < 8 || h < 8) return null; // skip spacers, rule lines, tiny masks
  try {
    const scale = Math.min(1, PDF_IMAGE_MAX_EDGE / Math.max(w, h));
    const dw = Math.max(1, Math.round(w * scale));
    const dh = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    if (img.bitmap) {
      ctx.drawImage(img.bitmap, 0, 0, dw, dh);
    } else if (img.data) {
      const imageData = rawToImageData(img);
      if (!imageData) return null;
      if (scale === 1) {
        ctx.putImageData(imageData, 0, 0);
      } else {
        const tmp = document.createElement("canvas");
        tmp.width = w;
        tmp.height = h;
        tmp.getContext("2d")?.putImageData(imageData, 0, 0);
        ctx.drawImage(tmp, 0, 0, dw, dh);
      }
    } else {
      return null;
    }
    // JPEG keeps photo-heavy PDFs from ballooning IndexedDB; figures are opaque.
    const src = canvas.toDataURL("image/jpeg", 0.82);
    return { type: "img", src, alt: undefined, ratio: w / h };
  } catch {
    return null;
  }
}

/** Expand pdf.js raw image bytes (RGBA/RGB) into canvas ImageData. */
function rawToImageData(img: PdfImageObj): ImageData | null {
  const { data, width: w = 0, height: h = 0 } = img;
  if (!data || w < 1 || h < 1) return null;
  const rgba = new Uint8ClampedArray(w * h * 4);
  if (data.length === w * h * 4) {
    rgba.set(data);
  } else if (data.length === w * h * 3) {
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      rgba[j] = data[i];
      rgba[j + 1] = data[i + 1];
      rgba[j + 2] = data[i + 2];
      rgba[j + 3] = 255;
    }
  } else {
    return null; // grayscale-1bpp / packed formats: leave to the bitmap path
  }
  return new ImageData(rgba, w, h);
}
