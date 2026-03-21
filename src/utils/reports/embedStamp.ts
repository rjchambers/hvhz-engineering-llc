import { PDFDocument } from 'pdf-lib';

/**
 * Embeds a PE stamp image at the correct position on the last page of a PDF.
 * stampBoxMm: position of the placeholder box in jsPDF mm coordinates (origin top-left).
 * PDF points use origin bottom-left: ptFromTop = pageHeightPt - mmToPt(mmFromTop) - sizePt
 */
export async function embedStampOnPdf(
  pdfBlob: Blob,
  stampImageUrl: string,
  stampBoxMm: { x: number; y: number; size: number } | null
): Promise<Blob> {
  const pdfBytes = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const stampResponse = await fetch(stampImageUrl);
  if (!stampResponse.ok) throw new Error(`Stamp fetch failed: ${stampResponse.status}`);
  const stampBytes = await stampResponse.arrayBuffer();
  const contentType = stampResponse.headers.get('content-type') ?? '';

  let stampImage;
  if (contentType.includes('png')) {
    stampImage = await pdfDoc.embedPng(stampBytes);
  } else {
    stampImage = await pdfDoc.embedJpg(stampBytes);
  }

  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { height: pageHeightPt } = lastPage.getSize();

  // Convert mm to points (1mm = 2.835pt)
  const MM_TO_PT = 2.835;

  let stampX: number;
  let stampY: number;
  let stampSize: number;

  if (stampBoxMm) {
    stampSize = stampBoxMm.size * MM_TO_PT;
    stampX = stampBoxMm.x * MM_TO_PT;
    // jsPDF y is from top; pdf-lib y is from bottom
    stampY = pageHeightPt - (stampBoxMm.y * MM_TO_PT) - stampSize;
  } else {
    // Fallback: bottom-left quadrant
    stampSize = 64 * MM_TO_PT;
    stampX = 19 * MM_TO_PT;
    stampY = 60;
  }

  lastPage.drawImage(stampImage, {
    x: stampX,
    y: stampY,
    width: stampSize,
    height: stampSize,
  });

  const signedBytes = await pdfDoc.save();
  return new Blob([signedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}
