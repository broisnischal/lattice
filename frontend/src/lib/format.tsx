import { BookOpen, FileText, Globe, Rss, Type, NotebookPen } from "lucide-react";
import type { BookFormat } from "@/api/types";

export const FORMAT_META: Record<BookFormat, { label: string; Icon: typeof BookOpen }> = {
  epub: { label: "EPUB", Icon: BookOpen },
  pdf: { label: "PDF", Icon: FileText },
  text: { label: "Text", Icon: Type },
  markdown: { label: "Markdown", Icon: NotebookPen },
  web: { label: "Web", Icon: Globe },
  feed: { label: "Article", Icon: Rss },
};
