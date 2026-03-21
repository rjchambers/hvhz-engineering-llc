import jsPDF from 'jspdf';

export class HVHZReportBuilder {
  doc: jsPDF;
  yPos = 46;
  ml = 19;
  mr = 19;
  pageW = 215.9;
  pageH = 279.4;
  cw = 177.9;

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
      this.doc.text(val.substring(0, 50), x + 40, this.yPos);
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

    // Signature fields
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

    // Stamp placeholder box
    this.doc.setDrawColor(150, 150, 150);
    this.doc.setLineWidth(0.5);
    this.doc.rect(this.ml, this.yPos + 10, 64, 64, 'S');
    this.doc.setFontSize(8);
    this.doc.setTextColor(150, 150, 150);
    this.doc.text('PE STAMP', this.ml + 20, this.yPos + 42);
    this.doc.text('(Affixed at signing)', this.ml + 8, this.yPos + 48);
  }

  toBlob(): Blob {
    return this.doc.output('blob');
  }
}
