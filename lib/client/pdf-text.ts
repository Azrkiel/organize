/** Extracts a PDF's text entirely in the browser with pdf.js (PLAN.md Phase 13 task 1) — the file
 * never needs to reach a server just to be read. Returns one block of text, pages separated by
 * blank lines. A scanned (image-only) PDF comes back empty; the caller says so. */
export async function extractPdfText(file: File): Promise<string> {
  // Dynamic import: pdf.js is big and only needed on the one screen that imports a syllabus.
  const pdfjs = await import("pdfjs-dist");
  // One worker for the page's lifetime, created on first use; pdf.js reuses it for every document.
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("./pdf.worker.ts", import.meta.url), { type: "module" });
  }

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str + (item.hasEOL ? "\n" : "");
      }
      pages.push(text.trim());
    }
    return pages.filter(Boolean).join("\n\n");
  } finally {
    await task.destroy();
  }
}
