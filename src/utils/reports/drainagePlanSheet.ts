import jsPDF from 'jspdf';

export interface PlanSheetInputs {
  projectAddress: string;
  clientName: string;
  engineerName: string;
  peLicenseNumber: string;
  date: string;
  jobNumber: string;
  buildingWidthFt: number;
  buildingLengthFt: number;
  primaryDrains: Array<{
    drain_id: string;
    pos_x: number;
    pos_y: number;
    pipe_diameter_in: number;
    leader_type: string;
    rated_capacity_gpm: number;
  }>;
  secondaryDrains: Array<{
    drain_id: string;
    pos_x: number;
    pos_y: number;
    secondary_type: string;
    scupper_width_in?: number;
    scupper_depth_in?: number;
    rated_capacity_gpm: number;
    height_above_primary_in: number;
  }>;
  openings: Array<{
    label: string;
    pos_x: number; pos_y: number;
    width_pct: number; height_pct: number;
  }>;
  parapetWalls: string[];
  flowArrows: Array<{
    from_x: number; from_y: number;
    to_drain_id: string;
  }>;
  zones: Array<{
    zone_id: string;
    area_sqft: number;
    q_required_gpm: number;
  }>;
  designRainfallRate: number;
  county: string;
  locationMapBase64?: string;
  stampImageBase64?: string;
}

const PAGE_W = 279.4;
const PAGE_H = 215.9;

export function drawDrainagePlanPage(doc: jsPDF, inputs: PlanSheetInputs) {
  drawDesignCriteria(doc, inputs);
  drawRoofPlan(doc, inputs);
  drawZoneDiagram(doc, inputs);
  drawTitleBlock(doc, inputs);
  drawSymbolLegend(doc);
}

function drawDesignCriteria(doc: jsPDF, inputs: PlanSheetInputs) {
  const lcX = 4;
  const lcW = 56;
  let y = 6;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('DESIGN CRITERIA:', lcX, y); y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('PER SECTION 1611 AND ASCE 7-22 SECTION 8', lcX, y); y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CODE BASIS:', lcX, y); y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('FLORIDA BUILDING CODE 2023', lcX, y); y += 4;
  doc.text(`100 YR- 1HR STORM ${inputs.designRainfallRate} IN/HR`, lcX, y); y += 4;
  doc.text(`COUNTY: ${inputs.county.toUpperCase()}`, lcX, y); y += 8;

  // Contractor notes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('NOTES:', lcX, y); y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);

  const notes = [
    `1. INFORMATION SHOWN ON THIS PLAN IS BASED ON INFORMATION PROVIDED BY ${inputs.clientName.toUpperCase()}.`,
    '2. THE CONTRACTOR SHALL VERIFY ALL CONDITIONS, DIMENSIONS, PENETRATIONS AND LOCATIONS.',
    '3. CONTRACTOR SHALL PITCH THE ROOF IN A MANNER THAT NO PONDING WATER OCCURS. ROOF SHALL FULLY DRAIN AFTER A MAXIMUM 48 HOURS.',
    '4. THE CONTRACTOR SHALL REFERENCE ALL APPLICABLE CONSTRUCTION DOCUMENTS FOR ACTUAL LOCATIONS OF ROOF DRAINAGE SCOPE OF WORK.',
    '5. CONTRACTOR SHALL NOTIFY THE ENGINEER OF ANY DISCREPANCIES OR IF THE CONDITIONS IN THE PROJECT DIFFER FROM WHAT IS SHOWN IN THIS PLAN.',
    '6. HVHZ ENGINEERING RESERVES THE RIGHT TO MODIFY DESIGN IF DEEMED NECESSARY.',
  ];

  notes.forEach(note => {
    const lines = doc.splitTextToSize(note, lcW - 2);
    lines.forEach((line: string) => {
      doc.text(line, lcX, y);
      y += 2.8;
    });
    y += 1;
  });
}

function drawRoofPlan(doc: jsPDF, inputs: PlanSheetInputs) {
  const drawX = 62;
  const drawY = 4;
  const drawW = 150;
  const drawH = 138;

  const scaleX = (drawW - 20) / Math.max(inputs.buildingWidthFt, 1);
  const scaleY = (drawH - 20) / Math.max(inputs.buildingLengthFt, 1);
  const scale = Math.min(scaleX, scaleY);

  const bw = inputs.buildingWidthFt * scale;
  const bh = inputs.buildingLengthFt * scale;
  const ox = drawX + (drawW - bw) / 2;
  const oy = drawY + (drawH - bh) / 2;

  // Building outline
  doc.setDrawColor(0);
  doc.setLineWidth(0.8);
  doc.rect(ox, oy, bw, bh);

  // Dimension labels
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  doc.text(`${inputs.buildingWidthFt}' +/-`, ox + bw / 2, oy - 3, { align: 'center' });
  doc.text(`${inputs.buildingLengthFt}' +/-`, ox - 5, oy + bh / 2, { angle: 90 });

  // Parapet hatching
  doc.setLineWidth(0.15);
  doc.setDrawColor(0);
  inputs.parapetWalls.forEach(wall => {
    drawParapetHatch(doc, wall, ox, oy, bw, bh);
  });

  // Openings
  inputs.openings.forEach(opening => {
    const oX = ox + opening.pos_x * bw;
    const oY = oy + opening.pos_y * bh;
    const oW = opening.width_pct * bw;
    const oH = opening.height_pct * bh;
    doc.setLineWidth(0.3);
    doc.setDrawColor(100);
    doc.rect(oX, oY, oW, oH);
    drawCrosshatch(doc, oX, oY, oW, oH);
    doc.setFontSize(5);
    doc.setTextColor(80);
    doc.text(opening.label, oX + oW / 2, oY + oH / 2, { align: 'center' });
  });

  // Flow arrows
  doc.setDrawColor(80);
  doc.setLineWidth(0.3);
  inputs.flowArrows.forEach(arrow => {
    const fromX = ox + arrow.from_x * bw;
    const fromY = oy + arrow.from_y * bh;
    const targetDrain = inputs.primaryDrains.find(d => d.drain_id === arrow.to_drain_id);
    if (!targetDrain) return;
    const toX = ox + targetDrain.pos_x * bw;
    const toY = oy + targetDrain.pos_y * bh;
    drawArrowLine(doc, fromX, fromY, toX, toY);
  });

  // Primary drains
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.setTextColor(0);
  inputs.primaryDrains.forEach(d => {
    const cx = ox + d.pos_x * bw;
    const cy = oy + d.pos_y * bh;
    doc.circle(cx, cy, 2.5, 'S');

    const calloutX = cx + 8;
    doc.setLineWidth(0.2);
    doc.line(cx + 2.5, cy, calloutX - 1, cy);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `=${d.pipe_diameter_in}"d ${d.leader_type.toUpperCase()} LEADER: ${d.rated_capacity_gpm} GPM`,
      calloutX, cy - 1
    );
  });

  // Secondary drains
  inputs.secondaryDrains.forEach(d => {
    const sx = ox + d.pos_x * bw;
    const sy = oy + d.pos_y * bh;

    if (d.secondary_type === 'Scupper') {
      doc.setLineWidth(0.3);
      doc.rect(sx - 3, sy - 2, 6, 4, 'S');
      drawHatch(doc, sx - 3, sy - 2, 6, 4);

      doc.setFontSize(4.5);
      const calloutText = [
        `=${(d.scupper_width_in ?? 0)}"W X ${(d.scupper_depth_in ?? 0)}" OVERFLOW SCUPPER`,
        `CAPACITY: ${d.rated_capacity_gpm} GPM`,
        `SET ${d.height_above_primary_in}" ABOVE PRIMARY`,
      ];
      let callY = sy + 6;
      calloutText.forEach(line => {
        doc.text(line, sx, callY);
        callY += 2.5;
      });
    } else {
      doc.circle(sx, sy, 2, 'S');
      doc.line(sx - 1.5, sy - 1.5, sx + 1.5, sy + 1.5);
      doc.line(sx - 1.5, sy + 1.5, sx + 1.5, sy - 1.5);
      doc.setFontSize(4.5);
      doc.text(d.drain_id, sx + 3, sy + 1);
    }
  });

  // Field verification note
  doc.setFontSize(4.5);
  doc.setTextColor(60);
  doc.text(
    'NOTE: THE EXACT LOCATION SHALL BE DETERMINED IN THE FIELD BASED ON ACTUAL EXISTING ROOF DRAINAGE PROPERTIES.',
    ox, oy + bh + 6
  );
  doc.text(
    'CONFORMANCE OF THIS DRAWING SHALL BE VERIFIED BY THE AUTHORITY HAVING JURISDICTION OR THIS OFFICE.',
    ox, oy + bh + 9
  );
}

function drawZoneDiagram(doc: jsPDF, inputs: PlanSheetInputs) {
  const zdX = 62;
  const zdY = 152;
  const zdW = 150;

  const zoneCount = inputs.zones.length;
  if (zoneCount === 0) return;
  const zoneW = Math.min((zdW - 20) / zoneCount, 60);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('ROOF DIAGRAM', zdX + zdW / 2, zdY, { align: 'center' });
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');
  doc.text('N.T.S', zdX + zdW / 2, zdY + 4, { align: 'center' });

  inputs.zones.forEach((zone, i) => {
    const zx = zdX + 10 + i * (zoneW + 4);
    const zy = zdY + 8;

    doc.setLineWidth(0.5);
    doc.setDrawColor(0);
    doc.rect(zx, zy, zoneW, 35);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(`ROOF "${zone.zone_id}"`, zx + zoneW / 2, zy + 10, { align: 'center' });

    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(`${zone.area_sqft.toLocaleString()} SQFT`, zx + zoneW / 2, zy + 18, { align: 'center' });

    doc.text('REQUIRED FLOW:', zx + zoneW / 2, zy + 25, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(`${zone.q_required_gpm} GPM`, zx + zoneW / 2, zy + 30, { align: 'center' });
  });
}

function drawTitleBlock(doc: jsPDF, inputs: PlanSheetInputs) {
  const tbX = 214;
  const tbW = 65;

  // Outer border
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(tbX, 0, tbW, PAGE_H);

  // Company section
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('HVHZ ENGINEERING', tbX + tbW / 2, 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.text('750 E Sample Rd', tbX + tbW / 2, 17, { align: 'center' });
  doc.text('Pompano Beach FL 33064', tbX + tbW / 2, 21, { align: 'center' });
  doc.text('info@hvhzengineering.com', tbX + tbW / 2, 25, { align: 'center' });

  doc.setLineWidth(0.3);
  doc.line(tbX, 28, tbX + tbW, 28);

  // Engineer info
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('ENGINEER:', tbX + 3, 34);
  doc.setFont('helvetica', 'normal');
  doc.text(inputs.engineerName, tbX + 3, 39);
  doc.text(`PE #${inputs.peLicenseNumber}`, tbX + 3, 43);

  doc.line(tbX, 47, tbX + tbW, 47);

  // Revisions
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('REVISIONS:', tbX + 3, 53);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.text('_______________', tbX + 3, 58);
  doc.text('_______________', tbX + 3, 63);
  doc.text('_______________', tbX + 3, 68);

  doc.line(tbX, 72, tbX + tbW, 72);

  // Location map
  let mapEndY = 73;
  if (inputs.locationMapBase64) {
    const mapY = 75;
    const mapW = tbW - 6;
    const mapH = mapW * 0.75;
    try {
      doc.addImage(inputs.locationMapBase64, 'JPEG', tbX + 3, mapY, mapW, mapH);
    } catch { /* Map unavailable */ }
    doc.rect(tbX + 3, mapY, mapW, mapH);
    doc.setFontSize(5);
    doc.text('LOCATION MAP', tbX + tbW / 2, mapY + mapH + 3, { align: 'center' });
    drawNorthArrow(doc, tbX + tbW - 10, mapY + 5);
    mapEndY = mapY + mapH + 6;
  }

  doc.line(tbX, mapEndY, tbX + tbW, mapEndY);

  // Seal box
  const sealY = mapEndY + 3;
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('SEAL:', tbX + 3, sealY + 3);
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  const sealSize = Math.min(tbW - 10, 45);
  doc.rect(tbX + (tbW - sealSize) / 2, sealY + 6, sealSize, sealSize);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180);
  doc.text('PE STAMP', tbX + tbW / 2, sealY + 6 + sealSize / 2, { align: 'center' });
  doc.setTextColor(0);

  const sigY = sealY + sealSize + 10;
  doc.setLineWidth(0.3);
  doc.line(tbX, sigY, tbX + tbW, sigY);

  // Digital signing notice
  doc.setFontSize(4.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100);
  const sigLines = doc.splitTextToSize(
    `This item has been digitally signed and sealed by ${inputs.engineerName}. Printed copies are not considered signed. Per FL Statutes 471 and FAC 61G15-23.003.`,
    tbW - 6
  );
  let sy = sigY + 4;
  sigLines.forEach((line: string) => {
    doc.text(line, tbX + 3, sy);
    sy += 2.5;
  });

  // Bottom: title + project info
  const bottomY = PAGE_H - 42;
  doc.setLineWidth(0.3);
  doc.setDrawColor(0);
  doc.line(tbX, bottomY, tbX + tbW, bottomY);

  doc.setFontSize(6);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.text('Title:', tbX + 2, bottomY + 5);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ROOF DRAIN PLAN', tbX + tbW / 2, bottomY + 12, { align: 'center' });

  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.line(tbX, bottomY + 15, tbX + tbW, bottomY + 15);
  doc.text('Project:', tbX + 2, bottomY + 20);
  const addrLines = doc.splitTextToSize(inputs.projectAddress, tbW - 20);
  doc.text(addrLines, tbX + 18, bottomY + 20);

  doc.line(tbX, bottomY + 25, tbX + tbW, bottomY + 25);
  doc.text('Client:', tbX + 2, bottomY + 30);
  doc.text(inputs.clientName, tbX + 18, bottomY + 30);

  doc.line(tbX, bottomY + 33, tbX + tbW, bottomY + 33);
  doc.text('Drawn By:', tbX + 2, bottomY + 38);
  doc.text(inputs.engineerName, tbX + 22, bottomY + 38);

  doc.text('Date:', tbX + tbW / 2 + 2, bottomY + 38);
  doc.text(inputs.date, tbX + tbW / 2 + 14, bottomY + 38);
}

function drawSymbolLegend(doc: jsPDF) {
  const lx = 4;
  const ly = PAGE_H - 22;

  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('LEGEND:', lx, ly);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);

  doc.setLineWidth(0.5);
  doc.circle(lx + 4, ly + 5, 2, 'S');
  doc.text('= PRIMARY DRAIN (VERTICAL LEADER)', lx + 8, ly + 6);

  doc.rect(lx + 2, ly + 9, 4, 3, 'S');
  drawHatch(doc, lx + 2, ly + 9, 4, 3);
  doc.text('= OVERFLOW SCUPPER', lx + 8, ly + 12);

  drawArrowLine(doc, lx + 2, ly + 17, lx + 6, ly + 17);
  doc.text('= FLOW DIRECTION', lx + 8, ly + 18);
}

// ─── Helper drawing functions ─────────────────────────────────

function drawParapetHatch(doc: jsPDF, wall: string, ox: number, oy: number, bw: number, bh: number) {
  const hatchWidth = 3;
  const spacing = 2;

  let x1: number, y1: number, w: number, h: number;
  switch (wall) {
    case 'north': x1 = ox; y1 = oy - hatchWidth; w = bw; h = hatchWidth; break;
    case 'south': x1 = ox; y1 = oy + bh; w = bw; h = hatchWidth; break;
    case 'west':  x1 = ox - hatchWidth; y1 = oy; w = hatchWidth; h = bh; break;
    case 'east':  x1 = ox + bw; y1 = oy; w = hatchWidth; h = bh; break;
    default: return;
  }

  for (let i = 0; i < (w + h) / spacing; i++) {
    const offset = i * spacing;
    const sx = x1 + Math.min(offset, w);
    const sy = y1 + Math.max(0, offset - w);
    const ex = x1 + Math.max(0, offset - h);
    const ey = y1 + Math.min(offset, h);
    doc.line(sx, sy, ex, ey);
  }
}

function drawCrosshatch(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setLineWidth(0.1);
  doc.setDrawColor(150);
  const spacing = 3;
  for (let i = 0; i < (w + h) / spacing; i++) {
    const offset = i * spacing;
    doc.line(x + Math.min(offset, w), y + Math.max(0, offset - w), x + Math.max(0, offset - h), y + Math.min(offset, h));
  }
  for (let i = 0; i < (w + h) / spacing; i++) {
    const offset = i * spacing;
    doc.line(x + w - Math.min(offset, w), y + Math.max(0, offset - w), x + w - Math.max(0, offset - h), y + Math.min(offset, h));
  }
}

function drawHatch(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setLineWidth(0.1);
  const spacing = 1.5;
  for (let i = 0; i < (w + h) / spacing; i++) {
    const offset = i * spacing;
    const sx = x + Math.min(offset, w);
    const sy = y + Math.max(0, offset - w);
    const ex = x + Math.max(0, offset - h);
    const ey = y + Math.min(offset, h);
    doc.line(sx, sy, ex, ey);
  }
}

function drawArrowLine(doc: jsPDF, x1: number, y1: number, x2: number, y2: number) {
  doc.line(x1, y1, x2, y2);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 2;
  doc.line(x2, y2, x2 - headLen * Math.cos(angle - 0.5), y2 - headLen * Math.sin(angle - 0.5));
  doc.line(x2, y2, x2 - headLen * Math.cos(angle + 0.5), y2 - headLen * Math.sin(angle + 0.5));
}

function drawNorthArrow(doc: jsPDF, x: number, y: number) {
  doc.setLineWidth(0.3);
  doc.setDrawColor(0);
  doc.line(x, y + 8, x, y);
  doc.line(x, y, x - 2, y + 3);
  doc.line(x, y, x + 2, y + 3);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('N', x, y - 2, { align: 'center' });
}
