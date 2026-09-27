/** "Download slides as PDF" (PLAN.md Phase 12 task 8), built entirely in the browser with jsPDF —
 * no server involved, so it costs nothing and works with the same signed URLs the gallery already
 * has loaded. One photo per page, scaled to fit with its caption underneath if it has one. */
export async function downloadSlidesPdf(lectureTitle: string, photos: { url: string; caption: string | null }[]): Promise<void> {
  if (photos.length === 0) return;

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const captionSpace = 24;

  for (let i = 0; i < photos.length; i++) {
    if (i > 0) doc.addPage();
    const dataUrl = await fetchAsDataUrl(photos[i].url);
    const { width, height } = await getImageDimensions(dataUrl);

    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2 - (photos[i].caption ? captionSpace : 0);
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    const x = (pageWidth - drawWidth) / 2;

    doc.addImage(dataUrl, "JPEG", x, margin, drawWidth, drawHeight);
    if (photos[i].caption) {
      doc.setFontSize(10);
      doc.text(photos[i].caption!, pageWidth / 2, margin + drawHeight + 16, { align: "center" });
    }
  }

  const safeTitle = lectureTitle.replace(/[^\w\- ]+/g, "").trim() || "slides";
  doc.save(`${safeTitle} - slides.pdf`);
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read image dimensions."));
    img.src = dataUrl;
  });
}
