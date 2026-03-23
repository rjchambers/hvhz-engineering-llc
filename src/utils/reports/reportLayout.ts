import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Brand colors (RGB)
const NAVY: [number, number, number] = [27, 42, 74];
const TEAL: [number, number, number] = [13, 148, 136];
const DARK_SLATE: [number, number, number] = [15, 23, 42];
const MID_SLATE: [number, number, number] = [100, 116, 139];
const LIGHT_GRAY: [number, number, number] = [241, 245, 249];
const WHITE: [number, number, number] = [255, 255, 255];
const PASS_GREEN: [number, number, number] = [22, 163, 74];
const FAIL_RED: [number, number, number] = [220, 38, 38];
const WARN_AMBER: [number, number, number] = [217, 119, 6];

export interface PhotoData {
  base64DataUrl: string;
  section_tag: string | null;
  caption: string | null;
}

export interface ReportConfig {
  title: string;
  jobNumber: string;
  address: string;
  county: string;
  clientName: string;
  engineerName: string;
  peLicense: string;
  reportDate: string;
  inspectionDate: string;
}

export interface TableOptions {
  columnWidths?: number[];
  headerColor?: 'navy' | 'teal';
  highlightColumn?: number;
  statusColumn?: number;
  fontSize?: number;
  compactMode?: boolean;
}

export class HVHZReportBuilder {
  doc: jsPDF;
  yPos = 90;
  ml = 19;
  mr = 19;
  pageW = 215.9;
  pageH = 279.4;
  cw = 177.9; // pageW - ml - mr
  stampBoxMm: { x: number; y: number; size: number } | null = null;
  private config: ReportConfig;
  private sectionCounter = 0;

  constructor(config: ReportConfig) {
    this.config = config;
    this.doc = new jsPDF('p', 'mm', 'letter');
    this.drawFirstPageHeader();
    this.drawDocumentInfoTable();
  }

  // ─── FIRST PAGE HEADER ───────────────────────────────────────
  private drawFirstPageHeader() {
    // Navy banner – 32mm
    this.doc.setFillColor(...NAVY);
    this.doc.rect(0, 0, this.pageW, 32, 'F');

    // Company name
    this.doc.setTextColor(...WHITE);
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('HVHZ ENGINEERING', this.ml, 11);

    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Roof Engineering for South Florida\'s HVHZ', this.ml, 17);
    this.doc.text('750 E Sample Rd, Pompano Beach FL 33064', this.ml, 22);
    this.doc.text('info@hvhzengineering.com', this.ml, 27);

    // Right side
    this.doc.setFontSize(8);
    this.doc.text(this.config.address || '', this.pageW - this.mr, 11, { align: 'right' });
    this.doc.text('WO-' + this.config.jobNumber, this.pageW - this.mr, 17, { align: 'right' });

    // Teal accent bar
    this.doc.setFillColor(...TEAL);
    this.doc.rect(0, 32, this.pageW, 3, 'F');

    // Report title centered on accent bar
    this.doc.setTextColor(...WHITE);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(this.config.title.toUpperCase(), this.pageW / 2, 34.2, { align: 'center' });

    this.yPos = 40;
  }

  // ─── DOCUMENT INFO TABLE ─────────────────────────────────────
  private drawDocumentInfoTable() {
    const rows = [
      ['Report No.', 'WO-' + this.config.jobNumber, 'Date', this.config.reportDate],
      ['Client', this.config.clientName, 'County', this.config.county],
      ['Job Address', this.config.address, 'Inspection', this.config.inspectionDate],
      ['Engineer', this.config.engineerName, 'PE License', this.config.peLicense],
    ];

    autoTable(this.doc, {
      startY: this.yPos,
      body: rows,
      margin: { left: this.ml, right: this.mr },
      theme: 'plain',
      showHead: false,
      bodyStyles: {
        fontSize: 8.5,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 2 },
        lineWidth: 0,
      },
      alternateRowStyles: { fillColor: [...LIGHT_GRAY] },
      columnStyles: {
        0: { textColor: [...MID_SLATE], cellWidth: 30, fontStyle: 'normal' },
        1: { textColor: [...DARK_SLATE], cellWidth: 58, fontStyle: 'bold' },
        2: { textColor: [...MID_SLATE], cellWidth: 30, fontStyle: 'normal' },
        3: { textColor: [...DARK_SLATE], cellWidth: 58, fontStyle: 'bold' },
      },
      didDrawCell: (data) => {
        if (data.section === 'body') {
          this.doc.setDrawColor(220, 225, 230);
          this.doc.setLineWidth(0.1);
          const y = data.cell.y + data.cell.height;
          this.doc.line(data.cell.x, y, data.cell.x + data.cell.width, y);
        }
      },
    });

    this.yPos = (this.doc as any).lastAutoTable.finalY + 8;
  }

  // ─── CONTINUATION HEADER (pages 2+) ──────────────────────────
  private drawContinuationHeader() {
    this.doc.setFillColor(...NAVY);
    this.doc.rect(0, 0, this.pageW, 14, 'F');
    this.doc.setTextColor(...WHITE);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('HVHZ ENGINEERING', this.ml, 8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(this.config.title.toUpperCase(), this.pageW / 2, 8, { align: 'center' });
    // Page number placeholder — finalized later
  }

  // ─── PAGE BREAK CHECK ────────────────────────────────────────
  checkPageBreak(needed = 12) {
    if (this.yPos + needed > 255) {
      this.doc.addPage();
      this.drawContinuationHeader();
      this.yPos = 20;
    }
  }

  // ─── SECTION HEADER ──────────────────────────────────────────
  addSection(number: string, title: string) {
    this.checkPageBreak(16);
    this.yPos += 8;

    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...NAVY);
    this.doc.text(`${number}  ${title.toUpperCase()}`, this.ml, this.yPos);

    this.yPos += 1.5;
    this.doc.setDrawColor(...TEAL);
    this.doc.setLineWidth(0.6);
    this.doc.line(this.ml, this.yPos, this.ml + this.cw, this.yPos);
    this.yPos += 4;
  }

  // ─── SUB-SECTION HEADER ──────────────────────────────────────
  addSubSection(number: string, title: string) {
    this.checkPageBreak(10);
    this.yPos += 5;

    this.doc.setFontSize(9.5);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...NAVY);
    this.doc.text(`${number}  ${title}`, this.ml, this.yPos);
    this.yPos += 3;
  }

  // ─── INFO GRID (key-value pairs via autoTable) ───────────────
  addInfoGrid(data: Record<string, any>, options?: { cols?: 2 | 3 }) {
    const entries = Object.entries(data).filter(([, v]) => v != null && v !== '');
    if (!entries.length) return;

    const cols = options?.cols ?? 2;
    const rows: string[][] = [];

    if (cols === 2) {
      for (let i = 0; i < entries.length; i += 2) {
        const row: string[] = [entries[i][0], String(entries[i][1])];
        if (entries[i + 1]) {
          row.push(entries[i + 1][0], String(entries[i + 1][1]));
        } else {
          row.push('', '');
        }
        rows.push(row);
      }
    } else {
      for (let i = 0; i < entries.length; i += 3) {
        const row: string[] = [];
        for (let j = 0; j < 3; j++) {
          if (entries[i + j]) {
            row.push(entries[i + j][0], String(entries[i + j][1]));
          } else {
            row.push('', '');
          }
        }
        rows.push(row);
      }
    }

    this.checkPageBreak(rows.length * 6 + 4);

    const colStyles: Record<number, any> = cols === 2
      ? {
          0: { textColor: [...MID_SLATE], cellWidth: 36, fontStyle: 'normal' },
          1: { textColor: [...DARK_SLATE], cellWidth: 52, fontStyle: 'bold' },
          2: { textColor: [...MID_SLATE], cellWidth: 36, fontStyle: 'normal' },
          3: { textColor: [...DARK_SLATE], cellWidth: 52, fontStyle: 'bold' },
        }
      : {
          0: { textColor: [...MID_SLATE], cellWidth: 25, fontStyle: 'normal' },
          1: { textColor: [...DARK_SLATE], cellWidth: 34, fontStyle: 'bold' },
          2: { textColor: [...MID_SLATE], cellWidth: 25, fontStyle: 'normal' },
          3: { textColor: [...DARK_SLATE], cellWidth: 34, fontStyle: 'bold' },
          4: { textColor: [...MID_SLATE], cellWidth: 25, fontStyle: 'normal' },
          5: { textColor: [...DARK_SLATE], cellWidth: 34, fontStyle: 'bold' },
        };

    autoTable(this.doc, {
      startY: this.yPos,
      body: rows,
      margin: { left: this.ml, right: this.mr },
      theme: 'plain',
      showHead: false,
      bodyStyles: {
        fontSize: 8.5,
        cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
        lineWidth: 0,
      },
      alternateRowStyles: { fillColor: [...LIGHT_GRAY] },
      columnStyles: colStyles,
      didDrawCell: (data) => {
        if (data.section === 'body') {
          this.doc.setDrawColor(220, 225, 230);
          this.doc.setLineWidth(0.1);
          const y = data.cell.y + data.cell.height;
          this.doc.line(data.cell.x, y, data.cell.x + data.cell.width, y);
        }
      },
    });

    this.yPos = (this.doc as any).lastAutoTable.finalY + 4;
  }

  // ─── TABLE ───────────────────────────────────────────────────
  addTable(headers: string[], rows: string[][], options: TableOptions = {}) {
    this.checkPageBreak(20);
    const statusCol = options.statusColumn;
    const hdrColor: [number, number, number] = options.headerColor === 'teal' ? [TEAL[0], TEAL[1], TEAL[2]] : [NAVY[0], NAVY[1], NAVY[2]];

    autoTable(this.doc, {
      startY: this.yPos,
      head: [headers],
      body: rows,
      margin: { left: this.ml, right: this.mr },
      theme: 'plain',
      headStyles: {
        fillColor: hdrColor,
        textColor: [...WHITE],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
        lineWidth: 0,
      },
      bodyStyles: {
        fontSize: options.fontSize ?? 8,
        textColor: [...DARK_SLATE],
        cellPadding: options.compactMode
          ? { top: 1.5, bottom: 1.5, left: 2, right: 2 }
          : { top: 2.5, bottom: 2.5, left: 2, right: 2 },
        lineWidth: 0,
      },
      alternateRowStyles: { fillColor: [...LIGHT_GRAY] },
      columnStyles: options.columnWidths
        ? Object.fromEntries(options.columnWidths.map((w, i) => [i, { cellWidth: w }]))
        : {},
      didParseCell: (data) => {
        if (statusCol !== undefined && data.column.index === statusCol && data.section === 'body') {
          const val = String(data.cell.raw).toUpperCase();
          if (['COMPLIANT', 'ADEQUATE', 'PASS', 'OK', '✓'].some(s => val.includes(s))) {
            data.cell.styles.textColor = [PASS_GREEN[0], PASS_GREEN[1], PASS_GREEN[2]];
            data.cell.styles.fontStyle = 'bold';
          } else if (['DEFICIENT', 'INADEQUATE', 'FAIL', '✗'].some(s => val.includes(s))) {
            data.cell.styles.textColor = [FAIL_RED[0], FAIL_RED[1], FAIL_RED[2]];
            data.cell.styles.fontStyle = 'bold';
          } else if (['WARNING', 'MARGINAL'].some(s => val.includes(s))) {
            data.cell.styles.textColor = [WARN_AMBER[0], WARN_AMBER[1], WARN_AMBER[2]];
            data.cell.styles.fontStyle = 'bold';
          } else if (['PRESCRIPTIVE', 'NOA PRESCRIPTIVE'].some(s => val.includes(s))) {
            data.cell.styles.textColor = [TEAL[0], TEAL[1], TEAL[2]];
          } else if (['RAS 117 RATIONAL', 'RATIONAL ANALYSIS'].some(s => val.includes(s))) {
            data.cell.styles.textColor = [WARN_AMBER[0], WARN_AMBER[1], WARN_AMBER[2]];
          }
        }
        if (options.highlightColumn !== undefined && data.column.index === options.highlightColumn && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          this.drawContinuationHeader();
        }
      },
    });

    this.yPos = (this.doc as any).lastAutoTable.finalY + 6;
  }

  // ─── TEXT BLOCK ──────────────────────────────────────────────
  addTextBlock(text: string, options?: { indent?: boolean; bold?: boolean; color?: 'navy' | 'slate' | 'red' | 'amber' }) {
    const colorMap = {
      navy: NAVY, slate: MID_SLATE, red: FAIL_RED, amber: WARN_AMBER
    };
    const c = options?.color ? colorMap[options.color] : DARK_SLATE;
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
    this.doc.setTextColor(...c);
    const indent = options?.indent ? this.ml + 6 : this.ml;
    const maxW = this.cw - (options?.indent ? 6 : 0);
    const lines = this.doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      this.checkPageBreak(5);
      this.doc.text(line, indent, this.yPos);
      this.yPos += 4.5;
    }
    this.yPos += 2;
  }

  // ─── CALLOUT BOX ─────────────────────────────────────────────
  addCalloutBox(text: string, type: 'info' | 'warning' | 'error' | 'success') {
    const colors: Record<string, { border: [number, number, number]; bg: [number, number, number] }> = {
      info: { border: TEAL, bg: [237, 250, 250] },
      warning: { border: WARN_AMBER, bg: [255, 248, 235] },
      error: { border: FAIL_RED, bg: [254, 242, 242] },
      success: { border: PASS_GREEN, bg: [240, 253, 244] },
    };
    const { border, bg } = colors[type];

    const lines = this.doc.splitTextToSize(text, this.cw - 10);
    const boxH = lines.length * 4.5 + 6;
    this.checkPageBreak(boxH + 4);

    // Background
    this.doc.setFillColor(bg[0], bg[1], bg[2]);
    this.doc.roundedRect(this.ml, this.yPos - 1, this.cw, boxH, 1, 1, 'F');

    // Left accent stripe
    this.doc.setFillColor(border[0], border[1], border[2]);
    this.doc.rect(this.ml, this.yPos - 1, 1.5, boxH, 'F');

    // Text
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...DARK_SLATE);
    let ty = this.yPos + 2;
    for (const line of lines) {
      this.doc.text(line, this.ml + 5, ty);
      ty += 4.5;
    }
    this.yPos += boxH + 4;
  }

  // ─── DERIVATION BLOCK ───────────────────────────────────────
  addDerivationBlock(equations: string[]) {
    const lineH = 4.5;
    const boxH = equations.length * lineH + 6;
    this.checkPageBreak(boxH + 4);

    // Background
    this.doc.setFillColor(248, 250, 252);
    this.doc.setDrawColor(220, 225, 230);
    this.doc.setLineWidth(0.3);
    this.doc.roundedRect(this.ml, this.yPos - 1, this.cw, boxH, 1, 1, 'FD');

    // Equations in Courier
    this.doc.setFontSize(8);
    this.doc.setFont('courier', 'normal');
    this.doc.setTextColor(...NAVY);
    let ty = this.yPos + 2;
    for (const eq of equations) {
      this.doc.text(eq, this.ml + 3, ty);
      ty += lineH;
    }

    this.yPos += boxH + 4;
  }

  // ─── ZONE PLAN DIAGRAM ──────────────────────────────────────
  addZonePlanDiagram(
    sectionNum: string,
    W: number,
    L: number,
    zoneWidths: { zone1: number; zone2: number; zone3outer: number; zone3inner: number; hasZone1Prime: boolean },
    spacings: Array<{ zone: string; label: string; final: number; fieldRows: number }>
  ) {
    this.doc.addPage();
    this.drawContinuationHeader();
    this.yPos = 20;
    this.addSection(sectionNum, 'ZONE PLAN DIAGRAM');

    const maxDimFt = Math.max(W, L);
    if (maxDimFt <= 0) return;
    const scale = 120 / maxDimFt;
    const drawW = W * scale;
    const drawL = L * scale;
    const ox = this.ml + (this.cw - drawW) / 2;
    const oy = this.yPos + 8;

    const ZONE1_BG: [number, number, number] = [230, 240, 250];
    const ZONE2_BG: [number, number, number] = [255, 243, 224];
    const ZONE3_BG: [number, number, number] = [254, 226, 226];

    // Full building outline (Zone 1 field)
    this.doc.setFillColor(...ZONE1_BG);
    this.doc.setDrawColor(...NAVY);
    this.doc.setLineWidth(0.5);
    this.doc.rect(ox, oy, drawW, drawL, 'FD');

    const z2w = zoneWidths.zone2 * scale;
    const z3o = zoneWidths.zone3outer * scale;

    // Perimeter strips (Zone 2) — top, bottom, left, right
    this.doc.setFillColor(...ZONE2_BG);
    this.doc.setDrawColor(200, 180, 140);
    this.doc.setLineWidth(0.2);
    // Top strip
    this.doc.rect(ox, oy, drawW, z2w, 'FD');
    // Bottom strip
    this.doc.rect(ox, oy + drawL - z2w, drawW, z2w, 'FD');
    // Left strip
    this.doc.rect(ox, oy + z2w, z2w, drawL - 2 * z2w, 'FD');
    // Right strip
    this.doc.rect(ox + drawW - z2w, oy + z2w, z2w, drawL - 2 * z2w, 'FD');

    // Corner squares (Zone 3)
    this.doc.setFillColor(...ZONE3_BG);
    this.doc.setDrawColor(200, 140, 140);
    this.doc.setLineWidth(0.2);
    // Top-left
    this.doc.rect(ox, oy, z3o, z3o, 'FD');
    // Top-right
    this.doc.rect(ox + drawW - z3o, oy, z3o, z3o, 'FD');
    // Bottom-left
    this.doc.rect(ox, oy + drawL - z3o, z3o, z3o, 'FD');
    // Bottom-right
    this.doc.rect(ox + drawW - z3o, oy + drawL - z3o, z3o, z3o, 'FD');

    // Re-draw building outline
    this.doc.setDrawColor(...NAVY);
    this.doc.setLineWidth(0.5);
    this.doc.rect(ox, oy, drawW, drawL, 'S');

    // Zone labels
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');

    // Field label (center)
    this.doc.setTextColor(30, 64, 175);
    const fieldLabel = zoneWidths.hasZone1Prime ? "ZONE 1'" : 'ZONE 1';
    this.doc.text(fieldLabel, ox + drawW / 2, oy + drawL / 2, { align: 'center' });

    // Perimeter label (top center, inside perimeter strip)
    this.doc.setTextColor(180, 100, 20);
    if (z2w > 6) {
      this.doc.text('ZONE 2', ox + drawW / 2, oy + z2w / 2 + 1, { align: 'center' });
    }

    // Corner label (top-left corner)
    this.doc.setTextColor(190, 50, 50);
    if (z3o > 8) {
      this.doc.text('ZONE 3', ox + z3o / 2, oy + z3o / 2 + 1, { align: 'center' });
    }

    // Spacing annotations below zone labels
    this.doc.setFontSize(6);
    this.doc.setFont('helvetica', 'normal');
    for (const s of spacings) {
      if (s.label === 'Field' || s.label === 'Interior') {
        this.doc.setTextColor(30, 64, 175);
        this.doc.text(`${s.final}" O.C., ${s.fieldRows} rows`, ox + drawW / 2, oy + drawL / 2 + 5, { align: 'center' });
      }
    }

    // Dimension lines
    this.doc.setDrawColor(...MID_SLATE);
    this.doc.setLineWidth(0.2);
    this.doc.setFontSize(7);
    this.doc.setTextColor(...DARK_SLATE);
    this.doc.setFont('helvetica', 'normal');

    // Zone 2 width dimension (above building)
    const dimY = oy - 5;
    this.doc.line(ox, dimY, ox + z2w, dimY);
    this.doc.line(ox, dimY - 1.5, ox, dimY + 1.5);
    this.doc.line(ox + z2w, dimY - 1.5, ox + z2w, dimY + 1.5);
    this.doc.text(`${zoneWidths.zone2}'`, ox + z2w / 2, dimY - 1.5, { align: 'center' });

    // Zone 3 inner dimension (if flat)
    if (zoneWidths.hasZone1Prime) {
      const z3i = zoneWidths.zone3inner * scale;
      const innerDimY = oy - 12;
      this.doc.line(ox, innerDimY, ox + z3i, innerDimY);
      this.doc.line(ox, innerDimY - 1.5, ox, innerDimY + 1.5);
      this.doc.line(ox + z3i, innerDimY - 1.5, ox + z3i, innerDimY + 1.5);
      this.doc.text(`${zoneWidths.zone3inner}'`, ox + z3i / 2, innerDimY - 1.5, { align: 'center' });
    }

    // Building width dimension (below)
    const bDimY = oy + drawL + 8;
    this.doc.line(ox, bDimY, ox + drawW, bDimY);
    this.doc.line(ox, bDimY - 1.5, ox, bDimY + 1.5);
    this.doc.line(ox + drawW, bDimY - 1.5, ox + drawW, bDimY + 1.5);
    this.doc.text(`${W}'`, ox + drawW / 2, bDimY + 4, { align: 'center' });

    // Building length dimension (left)
    const lDimX = ox - 8;
    this.doc.line(lDimX, oy, lDimX, oy + drawL);
    this.doc.line(lDimX - 1.5, oy, lDimX + 1.5, oy);
    this.doc.line(lDimX - 1.5, oy + drawL, lDimX + 1.5, oy + drawL);
    this.doc.save();
    this.doc.text(`${L}'`, lDimX - 3, oy + drawL / 2, { align: 'center', angle: 90 });
    this.doc.restore();

    // Legend
    const legY = bDimY + 12;
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...DARK_SLATE);

    const legItems: { color: [number, number, number]; text: string }[] = [
      { color: ZONE1_BG, text: `Field (Zone ${zoneWidths.hasZone1Prime ? "1'/1" : '1'})` },
      { color: ZONE2_BG, text: 'Perimeter (Zone 2)' },
      { color: ZONE3_BG, text: 'Corner (Zone 3)' },
    ];
    let legX = ox;
    for (const item of legItems) {
      this.doc.setFillColor(...item.color);
      this.doc.setDrawColor(180, 180, 180);
      this.doc.setLineWidth(0.2);
      this.doc.rect(legX, legY - 2.5, 4, 4, 'FD');
      this.doc.text(item.text, legX + 5.5, legY + 0.5);
      legX += 50;
    }

    this.yPos = legY + 10;
  }

  // ─── SCOPE SECTION ──────────────────────────────────────────
  addScopeSection(serviceType: string) {
    this.addSection('1.0', 'SCOPE OF ENGINEERING SERVICES');

    const scopeTexts: Record<string, string> = {
      'fastener-calculation': `This report presents the fastener uplift calculation for the mechanically attached roofing system at the above-referenced address within the High Velocity Hurricane Zone (HVHZ) of ${this.config.county} County, Florida. Calculations are performed in accordance with the Florida Building Code 8th Edition (2023), ASCE 7-22 Components & Cladding (Chapter 30), and applicable Roofing Application Standards (RAS 117, 128, 137).`,
      'drainage-analysis': `This report presents the roof drainage adequacy analysis for the above-referenced property within the High Velocity Hurricane Zone (HVHZ). Analysis is performed in accordance with the Florida Building Code Plumbing 2023 §1101–1106, FBC Building 2023 §1502, and NOAA Atlas 14 design storm data.`,
      'wind-mitigation-permit': `This report documents the wind mitigation inspection and engineering analysis for pre-roofing permit submittal. The inspection verifies compliance with Florida Building Code 8th Edition (2023) HVHZ requirements, ASCE 7-22 wind load provisions, and applicable product approval standards.`,
      'roof-inspection': `This report presents the findings of a visual roof inspection performed at the above-referenced property. The inspection evaluates the current condition of the roofing system, identifies deficiencies, and provides recommendations.`,
      'roof-certification': `This report certifies the condition and estimated remaining useful life of the roofing system at the above-referenced property based on a thorough field inspection performed by the undersigned engineer.`,
      'special-inspection': `This report documents the special inspection performed in accordance with the Florida Building Code and the approved construction documents for the above-referenced project.`,
    };

    this.addTextBlock(scopeTexts[serviceType] ?? scopeTexts['roof-inspection']);
  }

  // ─── CODE REFERENCES SECTION ────────────────────────────────
  addCodeReferencesSection(serviceType: string) {
    this.addSection('2.0', 'APPLICABLE CODES & STANDARDS');

    const codesByType: Record<string, [string, string][]> = {
      'fastener-calculation': [
        ['FBC 8th Ed. (2023)', 'Florida Building Code, Building'],
        ['ASCE 7-22 Ch. 30', 'Minimum Design Loads — Components & Cladding'],
        ['RAS 117', 'Modified Bitumen Roofing Systems'],
        ['RAS 128', 'Insulation Board Attachment'],
        ['RAS 137', 'Single-Ply Membrane Systems'],
        ['TAS 105', 'Fastener Pullout Resistance Test'],
        ['TAS 114', 'Wind Resistance of Roof Assemblies'],
      ],
      'drainage-analysis': [
        ['FBC Plumbing 2023 §1101–1106', 'Roof Drainage Design'],
        ['FBC Building 2023 §1502', 'Secondary Drainage Requirements'],
        ['NOAA Atlas 14', 'Precipitation Frequency Data'],
        ['ASCE 7-22 §8', 'Rain Loads'],
      ],
      'wind-mitigation-permit': [
        ['FBC 8th Ed. (2023)', 'Florida Building Code, Building'],
        ['ASCE 7-22 Ch. 26–31', 'Wind Load Provisions'],
        ['FBC §1620', 'HVHZ Wind Speed Requirements'],
      ],
      'roof-inspection': [
        ['FBC 8th Ed. (2023)', 'Florida Building Code, Building'],
        ['ASTM D7186', 'Standard Practice for Roof Condition Assessment'],
        ['ASTM E108', 'Standard Test Methods for Fire Tests of Roof Coverings'],
      ],
      'roof-certification': [
        ['FBC 8th Ed. (2023)', 'Florida Building Code, Building'],
        ['ASTM D7186', 'Standard Practice for Roof Condition Assessment'],
        ['ASTM E108', 'Standard Test Methods for Fire Tests of Roof Coverings'],
      ],
      'special-inspection': [
        ['FBC 8th Ed. (2023)', 'Florida Building Code, Building'],
        ['Applicable TAS Standards', 'Testing Application Standards'],
      ],
    };

    const codes = codesByType[serviceType] ?? codesByType['roof-inspection'];
    this.addTable(
      ['Code / Standard', 'Description'],
      codes.map(([code, desc]) => [code, desc]),
      { headerColor: 'teal' }
    );
  }

  // ─── DISCLAIMER SECTION ─────────────────────────────────────
  addDisclaimerSection(sectionNum: string) {
    this.addSection(sectionNum, 'LIMITATIONS AND DISCLAIMER');

    this.doc.setDrawColor(...NAVY);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.ml, this.yPos - 2, this.ml + this.cw, this.yPos - 2);

    this.addTextBlock(
      'This report has been prepared for the exclusive use of the client identified herein and the applicable building department. The findings, opinions, and recommendations expressed in this report are based on field observations made at the time of inspection and the documents reviewed. This report does not constitute a warranty or guarantee. HVHZ Engineering assumes no responsibility for conditions that were not observable at the time of inspection or for changes that may occur after the date of this report. This report shall not be reproduced in part without the written consent of HVHZ Engineering.',
      { color: 'slate' }
    );
  }

  // ─── PHOTO PAGE ─────────────────────────────────────────────
  addPhotoPage(photos: PhotoData[], sectionNum?: string) {
    if (!photos.length) return;

    this.doc.addPage();
    this.drawContinuationHeader();
    this.yPos = 20;

    if (sectionNum) {
      this.addSection(sectionNum, 'PHOTO DOCUMENTATION');
    } else {
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...NAVY);
      this.doc.text('PHOTO DOCUMENTATION', this.ml, this.yPos);
      this.doc.setDrawColor(...TEAL);
      this.doc.setLineWidth(0.6);
      this.doc.line(this.ml, this.yPos + 1.5, this.ml + this.cw, this.yPos + 1.5);
      this.yPos += 6;
    }

    const colW = 85;
    const imgH = 58;
    const textH = 9;
    const cellH = imgH + textH + 4;
    const gutter = 7;
    const cols = [this.ml, this.ml + colW + gutter];
    const bottomLimit = 255;

    let col = 0;
    let lastTag = '';

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const tag = photo.section_tag ?? 'General';

      // Section tag header
      if (tag !== lastTag && col === 0) {
        if (this.yPos + 6 + cellH > bottomLimit) {
          this.doc.addPage();
          this.drawContinuationHeader();
          this.yPos = 20;
        }
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(...NAVY);
        this.doc.text(tag.toUpperCase(), this.ml, this.yPos + 4);
        this.yPos += 7;
        lastTag = tag;
      }

      const x = cols[col];

      if (col === 0 && this.yPos + cellH > bottomLimit) {
        this.doc.addPage();
        this.drawContinuationHeader();
        this.yPos = 20;
        lastTag = '';
      }

      // Navy top accent on frame
      this.doc.setFillColor(...NAVY);
      this.doc.rect(x, this.yPos, colW, 1, 'F');

      // Border
      this.doc.setDrawColor(220, 225, 230);
      this.doc.setLineWidth(0.3);
      this.doc.rect(x, this.yPos + 1, colW, imgH, 'S');

      // Tag badge
      this.doc.setFillColor(...NAVY);
      const badgeW = this.doc.getTextWidth(tag) + 4;
      this.doc.roundedRect(x + 1, this.yPos + 2, badgeW > 6 ? badgeW : 6, 4, 0.5, 0.5, 'F');
      this.doc.setFontSize(5.5);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...WHITE);
      this.doc.text(tag, x + 2, this.yPos + 4.8);

      try {
        this.doc.addImage(photo.base64DataUrl, 'JPEG', x, this.yPos + 1, colW, imgH);
      } catch {
        this.doc.setFillColor(245, 245, 245);
        this.doc.rect(x, this.yPos + 1, colW, imgH, 'F');
        this.doc.setFontSize(7);
        this.doc.setTextColor(180, 180, 180);
        this.doc.text('[Photo unavailable]', x + colW / 2, this.yPos + imgH / 2, { align: 'center' });
      }

      // Caption
      this.doc.setFontSize(7.5);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...MID_SLATE);
      const captionY = this.yPos + imgH + 5;
      if (photo.caption) {
        const captionLines = this.doc.splitTextToSize(photo.caption, colW - 2);
        this.doc.text(captionLines[0], x + 1, captionY);
      }

      col++;
      if (col >= 2) {
        col = 0;
        this.yPos += cellH + 4;
      }
    }
    if (col !== 0) {
      this.yPos += cellH + 4;
    }
  }

  // ─── PE SIGNATURE PAGE ──────────────────────────────────────
  addPESignaturePage(
    peProfile: { full_name: string; pe_license_number: string | null },
    peNotes: string | null,
    signedDate: string
  ) {
    this.doc.addPage();
    this.drawContinuationHeader();
    this.yPos = 30;

    // Engineer notes
    if (peNotes) {
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...NAVY);
      this.doc.text('Engineer Notes', this.ml, this.yPos);
      this.yPos += 6;
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...DARK_SLATE);
      const noteLines = this.doc.splitTextToSize(peNotes, this.cw);
      this.doc.text(noteLines, this.ml, this.yPos);
      this.yPos += noteLines.length * 5 + 10;
    }

    // Certification title
    this.doc.setFontSize(13);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...NAVY);
    this.doc.text("ENGINEER'S CERTIFICATION", this.ml, this.yPos);
    this.yPos += 2;
    this.doc.setDrawColor(...TEAL);
    this.doc.setLineWidth(0.6);
    this.doc.line(this.ml, this.yPos, this.ml + 80, this.yPos);
    this.yPos += 8;

    // Certification text
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...DARK_SLATE);
    const certText = 'I hereby certify that this engineering report has been prepared by me or under my direct supervision and that I am a duly licensed Professional Engineer under the laws of the State of Florida.';
    const certLines = this.doc.splitTextToSize(certText, this.cw);
    this.doc.text(certLines, this.ml, this.yPos);
    this.yPos += certLines.length * 5 + 12;

    // Stamp box
    this.doc.setFillColor(...LIGHT_GRAY);
    this.doc.setDrawColor(...NAVY);
    this.doc.setLineWidth(0.5);
    this.doc.rect(this.ml, this.yPos, 64, 64, 'FD');
    this.stampBoxMm = { x: this.ml, y: this.yPos, size: 64 };
    this.doc.setFontSize(8);
    this.doc.setTextColor(180, 180, 180);
    this.doc.text('PE STAMP', this.ml + 22, this.yPos + 30);

    // Signature area (right of stamp)
    const sigX = this.ml + 80;
    const sigY = this.yPos + 20;

    // Signature line
    this.doc.setDrawColor(...NAVY);
    this.doc.setLineWidth(0.3);
    this.doc.line(sigX, sigY, sigX + 90, sigY);

    this.doc.setFontSize(8);
    this.doc.setTextColor(...MID_SLATE);
    this.doc.text('Signature', sigX, sigY + 4);

    // PE name below
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...DARK_SLATE);
    this.doc.text(`${peProfile.full_name}, P.E.`, sigX, sigY + 14);

    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...MID_SLATE);
    this.doc.text(`Florida PE License #${peProfile.pe_license_number ?? 'N/A'}`, sigX, sigY + 20);
    this.doc.text(`Date: ${signedDate}`, sigX, sigY + 26);

    this.yPos += 74;

    // FAC compliance notice
    this.doc.setFontSize(7.5);
    this.doc.setFont('helvetica', 'italic');
    this.doc.setTextColor(...MID_SLATE);
    const facText = `This item has been digitally signed and sealed by ${peProfile.full_name} on ${signedDate}. Printed copies of this document are not considered signed and sealed and the signature must be verified on any electronic copies.`;
    const facLines = this.doc.splitTextToSize(facText, this.cw);
    this.doc.text(facLines, this.ml, this.yPos);
    this.yPos += facLines.length * 4 + 4;

    // FL Statute & FAC compliance
    const complianceText = `The method and software that have been utilized to sign and seal this report comply with the intent of the Board Rules. Specifically, with reference to Florida Statutes 471 and the Florida Administrative Code Rule 61G15-23.003 for Engineers.`;
    const compLines = this.doc.splitTextToSize(complianceText, this.cw);
    this.doc.text(compLines, this.ml, this.yPos);
    this.yPos += compLines.length * 4 + 15;

    // END OF REPORT
    this.doc.setDrawColor(...TEAL);
    this.doc.setLineWidth(0.4);
    this.doc.line(this.ml + 30, this.yPos, this.ml + this.cw - 30, this.yPos);
    this.yPos += 5;
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...NAVY);
    this.doc.text('END OF REPORT', this.pageW / 2, this.yPos, { align: 'center' });
    this.yPos += 5;
    this.doc.setDrawColor(...TEAL);
    this.doc.line(this.ml + 30, this.yPos, this.ml + this.cw - 30, this.yPos);
  }

  // ─── FINALIZE (stamp footer on all pages) ───────────────────
  private finalize() {
    const totalPages = this.doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);

      // Teal line at y=262
      this.doc.setDrawColor(...TEAL);
      this.doc.setLineWidth(0.3);
      this.doc.line(this.ml, 262, this.ml + this.cw, 262);

      // Footer text
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...MID_SLATE);

      this.doc.text('HVHZ Engineering · 750 E Sample Rd, Pompano Beach FL 33064', this.ml, 266);
      this.doc.text(`Page ${i} of ${totalPages}`, this.pageW - this.mr, 266, { align: 'right' });

      this.doc.text('WO-' + this.config.jobNumber, this.ml, 270);
      this.doc.text('CONFIDENTIAL', this.pageW - this.mr, 270, { align: 'right' });
    }
  }

  // ─── OUTPUT ─────────────────────────────────────────────────
  toResult(): { blob: Blob; stampBoxMm: { x: number; y: number; size: number } | null } {
    this.finalize();
    return {
      blob: this.doc.output('blob'),
      stampBoxMm: this.stampBoxMm,
    };
  }

  toBlob(): Blob {
    return this.toResult().blob;
  }
}
