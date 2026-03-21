import jsPDF from 'jspdf';

export interface PhotoData {
  base64DataUrl: string;
  section_tag: string | null;
  caption: string | null;
}

export class HVHZReportBuilder {
  doc: jsPDF;
  yPos = 46;
  ml = 19;
  mr = 19;
  pageW = 215.9;
  pageH = 279.4;
  cw = 177.9;
  stampBoxMm: { x: number; y: number; size: number } | null = null;

  constructor(title: string, jobNum: string, address: string) {
    this.doc = new jsPDF('p', 'mm', 'letter');

    // Navy header band
    this.doc.setFillColor(27, 42, 74);
    this.doc.rect(0, 0, this.pageW, 25, 'F');
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('HVHZ ENGINEERING', this.ml, 9);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('750 E Sample Rd, Pompano Beach FL 33064', this.ml, 14);
    this.doc.setFontSize(13);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title.toUpperCase(), this.pageW / 2, 16, { align: 'center' });
    this.doc.setFontSize(8);
    this.doc.text(address || '', this.pageW - this.mr, 9, { align: 'right' });
    this.doc.text('Job #: ' + jobNum, this.pageW - this.mr, 14, { align: 'right' });
  }

  drawContinuationHeader() {
    this.doc.setFillColor(27, 42, 74);
    this.doc.rect(0, 0, this.pageW, 12, 'F');
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('HVHZ ENGINEERING — Continued', this.ml, 8);
  }

  checkPageBreak(needed = 12) {
    if (this.yPos + needed > 240) {
      this.doc.addPage();
      this.drawContinuationHeader();
      this.yPos = 20;
    }
  }

  addSection(title: string) {
    this.checkPageBreak(12);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(27, 42, 74);
    this.doc.text(title, this.ml, this.yPos);
    this.yPos += 1;
    this.doc.setDrawColor(27, 42, 74);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.ml, this.yPos, this.ml + this.cw, this.yPos);
    this.yPos += 5;
  }

  addInfoGrid(data: Record<string, any>) {
    const entries = Object.entries(data).filter(([, v]) => v != null && v !== '');
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    entries.forEach(([k, v], i) => {
      const col = i % 2;
      const x = this.ml + col * (this.cw / 2);
      if (i % 2 === 0 && i > 0) this.yPos += 5;
      if (i % 2 === 0) this.checkPageBreak(6);
      this.doc.setTextColor(100, 116, 139);
      this.doc.text(k + ':', x, this.yPos);
      this.doc.setTextColor(15, 23, 42);
      const val = String(v);
      const maxWidth = this.cw / 2 - 42;
      const valLines = this.doc.splitTextToSize(val, maxWidth);
      this.doc.text(valLines, x + 40, this.yPos);
      if (valLines.length > 1 && i % 2 === 1) {
        this.yPos += (valLines.length - 1) * 4.5;
      }
    });
    this.yPos += 8;
  }

  addTextBlock(text: string) {
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(15, 23, 42);
    const lines = this.doc.splitTextToSize(text, this.cw);
    for (const line of lines) {
      this.checkPageBreak(5);
      this.doc.text(line, this.ml, this.yPos);
      this.yPos += 4.5;
    }
    this.yPos += 3;
  }

  addPhotoPage(photos: PhotoData[]) {
    if (!photos.length) return;

    this.doc.addPage();
    this.doc.setFillColor(27, 42, 74);
    this.doc.rect(0, 0, this.pageW, 12, 'F');
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('HVHZ ENGINEERING — Photo Documentation', this.ml, 8);

    this.doc.setTextColor(27, 42, 74);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Field Photo Documentation', this.ml, 22);
    this.doc.setDrawColor(27, 42, 74);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.ml, 23, this.ml + this.cw, 23);

    const colW = 85;
    const imgH = 58;
    const textH = 9;
    const cellH = imgH + textH + 4;
    const gutter = 7;
    const cols = [this.ml, this.ml + colW + gutter];
    const topMargin = 28;
    const bottomLimit = this.pageH - 18;

    let col = 0;
    let yRow = topMargin;
    let lastTag = '';

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const tag = photo.section_tag ?? 'General';

      if (tag !== lastTag && col === 0) {
        if (yRow + 6 + cellH > bottomLimit) {
          this.doc.addPage();
          this.drawContinuationHeader();
          yRow = 20;
          col = 0;
        }
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(27, 42, 74);
        this.doc.text(tag.toUpperCase(), this.ml, yRow + 4);
        yRow += 7;
        lastTag = tag;
      }

      const x = cols[col];

      if (col === 0 && yRow + cellH > bottomLimit) {
        this.doc.addPage();
        this.drawContinuationHeader();
        yRow = 20;
        lastTag = '';
      }

      this.doc.setDrawColor(220, 220, 220);
      this.doc.setLineWidth(0.3);
      this.doc.rect(x, yRow, colW, imgH, 'S');

      try {
        this.doc.addImage(photo.base64DataUrl, 'JPEG', x, yRow, colW, imgH);
      } catch {
        this.doc.setFillColor(245, 245, 245);
        this.doc.rect(x, yRow, colW, imgH, 'F');
        this.doc.setFontSize(7);
        this.doc.setTextColor(180, 180, 180);
        this.doc.text('[Photo unavailable]', x + colW / 2, yRow + imgH / 2, { align: 'center' });
      }

      this.doc.setFontSize(7.5);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(80, 80, 80);
      const captionY = yRow + imgH + 5;

      if (photo.caption) {
        const captionLines = this.doc.splitTextToSize(photo.caption, colW - 2);
        this.doc.text(captionLines[0], x + 1, captionY);
      } else {
        this.doc.setTextColor(160, 160, 160);
        this.doc.text(tag, x + 1, captionY);
      }

      col++;
      if (col >= 2) {
        col = 0;
        yRow += cellH + 4;
      }
    }
  }

  addPESignaturePage(
    peProfile: { full_name: string; pe_license_number: string | null },
    peNotes: string | null,
    signedDate: string
  ) {
    this.doc.addPage();
    this.yPos = 30;

    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(100, 116, 139);
    const complianceText =
      'This item has been digitally signed and sealed by ' +
      peProfile.full_name + ' on ' + signedDate +
      '. Printed copies of this document are not considered signed and sealed and the signature must be verified on any electronic copies. FAC 61G15-23.004';
    const lines = this.doc.splitTextToSize(complianceText, this.cw);
    this.doc.text(lines, this.ml, this.yPos);
    this.yPos += lines.length * 5 + 10;

    if (peNotes) {
      this.doc.setTextColor(27, 42, 74);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Engineer Notes:', this.ml, this.yPos);
      this.yPos += 5;
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(15, 23, 42);
      const noteLines = this.doc.splitTextToSize(peNotes, this.cw);
      this.doc.text(noteLines, this.ml, this.yPos);
      this.yPos += noteLines.length * 5 + 10;
    }

    this.doc.setDrawColor(27, 42, 74);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.ml, this.yPos + 20, this.ml + 80, this.yPos + 20);
    this.doc.line(this.ml + 100, this.yPos + 20, this.ml + this.cw, this.yPos + 20);
    this.doc.setFontSize(8);
    this.doc.setTextColor(100, 116, 139);
    this.doc.text('Signature', this.ml, this.yPos + 24);
    this.doc.text('Date', this.ml + 100, this.yPos + 24);
    this.yPos += 30;

    this.doc.text('FL PE #' + (peProfile.pe_license_number ?? ''), this.ml, this.yPos);
    this.doc.text(peProfile.full_name, this.ml + 100, this.yPos);

    this.doc.setDrawColor(150, 150, 150);
    this.doc.setLineWidth(0.5);
    this.doc.rect(this.ml, this.yPos + 10, 64, 64, 'S');
    this.stampBoxMm = { x: this.ml, y: this.yPos + 10, size: 64 };
    this.doc.setFontSize(8);
    this.doc.setTextColor(150, 150, 150);
    this.doc.text('PE STAMP', this.ml + 20, this.yPos + 42);
    this.doc.text('(Affixed at signing)', this.ml + 8, this.yPos + 48);
  }

  toResult(): { blob: Blob; stampBoxMm: { x: number; y: number; size: number } | null } {
    return {
      blob: this.doc.output('blob'),
      stampBoxMm: this.stampBoxMm,
    };
  }

  toBlob(): Blob {
    return this.toResult().blob;
  }
}
