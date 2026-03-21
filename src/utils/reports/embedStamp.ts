import { PDFDocument } from 'pdf-lib';

/**
 * Embeds a PE stamp image onto the last page of a PDF.
 * Stamp is placed at bottom-left, 10mm from edges, 64x64pt.
 */
export async function embedStampOnPdf(
  pdfBlob: Blob,
  stampImageUrl: string
): Promise<Blob> {
  const pdfBytes = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Fetch stamp image
  const stampResponse = await fetch(stampImageUrl);
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

  // 10mm from edges ≈ 28.35pt, 64pt size
  // Position over the stamp placeholder box
  const stampX = 19 * 2.835; // ml in mm to pt
  const stampY = 60; // near bottom area
  const stampSize = 64;

  lastPage.drawImage(stampImage, {
    x: stampX,
    y: stampY,
    width: stampSize,
    height: stampSize,
  });

  const signedBytes = await pdfDoc.save();
  return new Blob([signedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}
