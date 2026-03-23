/**
 * ASCE 7-22 Wind Pressure Calculation Engine
 * For HVHZ permit-submittal engineering reports
 */

// ─── EXISTING: MWFRS (used by WindMitigationCalc) ──────────

// Table 26.10-1, Exposure C
const KZ_C = [
  { z: 0, k: 0.85 },
  { z: 15, k: 0.85 },
  { z: 20, k: 0.90 },
  { z: 25, k: 0.94 },
  { z: 30, k: 0.98 },
  { z: 40, k: 1.04 },
  { z: 50, k: 1.09 },
  { z: 60, k: 1.13 },
];

export function getKz(h: number): number {
  if (h <= 0) return KZ_C[0].k;
  if (h >= KZ_C[KZ_C.length - 1].z) return KZ_C[KZ_C.length - 1].k;
  for (let i = 0; i < KZ_C.length - 1; i++) {
    const lo = KZ_C[i];
    const hi = KZ_C[i + 1];
    if (h >= lo.z && h <= hi.z) {
      const t = (h - lo.z) / (hi.z - lo.z);
      return lo.k + t * (hi.k - lo.k);
    }
  }
  return KZ_C[0].k;
}

export interface WindCalcInputs {
  V: number;
  Kzt: number;
  Kd: number;
  Ke: number;
  W: number;
  L: number;
  h: number;
}

export interface ZonePressure {
  zone: string;
  GCpf: number;
  GCpi: number;
  netPressure: number;
  direction: string;
}

export interface WindCalcResults {
  Kz: number;
  qh: number;
  a: number;
  zones: ZonePressure[];
}

const ZONE_GCPF: { zone: string; GCpf: number; direction: string }[] = [
  { zone: "Zone 1 (Field)", GCpf: -0.45, direction: "Uplift" },
  { zone: "Zone 1E (Edge)", GCpf: -0.69, direction: "Uplift" },
  { zone: "Zone 2 (Eave)", GCpf: -0.69, direction: "Uplift" },
  { zone: "Zone 2E (Corner)", GCpf: -1.07, direction: "Uplift" },
];

const GCpi_mwfrs = -0.18;

export function computeWindPressures(inputs: WindCalcInputs): WindCalcResults {
  const { V, Kzt, Kd, Ke, W, L, h } = inputs;
  const Kz_val = getKz(h);
  const qh = 0.00256 * Kz_val * Kzt * Kd * Ke * V * V;
  const minWL = Math.min(W, L);
  const a = Math.max(Math.min(0.1 * minWL, 0.4 * h), Math.max(0.04 * minWL, 3));
  const zones: ZonePressure[] = ZONE_GCPF.map(({ zone, GCpf, direction }) => ({
    zone, GCpf, GCpi: GCpi_mwfrs,
    netPressure: parseFloat((qh * (GCpf - GCpi_mwfrs)).toFixed(2)),
    direction,
  }));
  return { Kz: parseFloat(Kz_val.toFixed(4)), qh: parseFloat(qh.toFixed(2)), a: parseFloat(a.toFixed(2)), zones };
}

export const FASTENER_SPACING: Record<string, string> = {
  "Field": '12" o.c.',
  "Perimeter": '6" o.c.',
  "Corner": '4" o.c.',
};

// ─── NEW: C&C Fastener Calculation Engine (ASCE 7-22 Ch.30) ─

// Exposure parameters — ASCE 7-22 Table 26.11-1
const EXPOSURE_PARAMS: Record<string, { alpha: number; Zg: number }> = {
  B: { alpha: 7.0, Zg: 1200 },
  C: { alpha: 9.5, Zg: 900 },
  D: { alpha: 11.5, Zg: 700 },
};

// Internal pressure coefficients — ASCE 7-22 Table 26.13-1
// Positive values for worst-case uplift
const GCPI_VALUES: Record<string, number> = {
  ENCLOSED: 0.18,
  PARTIALLY_ENCLOSED: 0.55,
  PARTIALLY_OPEN: 0.00,
};

// ─── GCp Tables — ASCE 7-22 Chapter 30 (EWA = 10 sqft) ─────

type ZoneGCp = { zone: string; label: string; GCp: number };

// Table 30.3-2A: Flat Roofs (slope ≤ 7°)
const CC_GCP_FLAT: ZoneGCp[] = [
  { zone: "1'", label: "Interior", GCp: -0.9 },
  { zone: "1",  label: "Field",    GCp: -1.7 },
  { zone: "2",  label: "Perimeter", GCp: -2.3 },
  { zone: "3",  label: "Corner",   GCp: -3.2 },
];

// Table 30.3-2B: Gable/Hip Roofs, 7° < slope ≤ 27°
const CC_GCP_GABLE_LOW: ZoneGCp[] = [
  { zone: "1", label: "Field",     GCp: -1.0 },
  { zone: "2", label: "Perimeter", GCp: -1.8 },
  { zone: "3", label: "Corner",    GCp: -2.8 },
];

// Table 30.3-2C: Gable/Hip Roofs, slope > 27°
const CC_GCP_GABLE_HIGH: ZoneGCp[] = [
  { zone: "1", label: "Field",     GCp: -0.8 },
  { zone: "2", label: "Perimeter", GCp: -1.0 },
  { zone: "3", label: "Corner",    GCp: -1.0 },
];

// Table 30.3-2D: Monoslope Roofs, 7° < slope ≤ 27°
const CC_GCP_MONOSLOPE_MED: ZoneGCp[] = [
  { zone: "1", label: "Field",     GCp: -1.1 },
  { zone: "2", label: "Perimeter", GCp: -2.0 },
  { zone: "3", label: "Corner",    GCp: -3.0 },
];

// Monoslope > 27° (same coefficients as flat for conservatism)
const CC_GCP_MONOSLOPE_HIGH: ZoneGCp[] = [
  { zone: "1", label: "Field",     GCp: -0.8 },
  { zone: "2", label: "Perimeter", GCp: -1.0 },
  { zone: "3", label: "Corner",    GCp: -1.0 },
];

function getGCpTable(roofType: string, slopeDeg: number): ZoneGCp[] {
  if (roofType === "Flat" || slopeDeg <= 7) {
    return CC_GCP_FLAT;
  }
  if (roofType === "Monoslope") {
    if (slopeDeg <= 27) return CC_GCP_MONOSLOPE_MED;
    return CC_GCP_MONOSLOPE_HIGH;
  }
  // Gable or Hip
  if (slopeDeg <= 27) {
    const table = CC_GCP_GABLE_LOW.map(t => ({ ...t }));
    if (roofType === "Hip") {
      table[2] = { ...table[2], GCp: round2(table[2].GCp * 0.8) };
    }
    return table;
  }
  const table = CC_GCP_GABLE_HIGH.map(t => ({ ...t }));
  if (roofType === "Hip") {
    table[2] = { ...table[2], GCp: round2(table[2].GCp * 0.8) };
  }
  return table;
}

interface ZoneWidths {
  zone1: number;
  zone2: number;
  zone3outer: number;
  zone3inner: number;
  hasZone1Prime: boolean;
}

function getZoneWidths(roofType: string, slopeDeg: number, h: number, W: number, L: number): ZoneWidths {
  if (roofType === "Flat" || slopeDeg <= 7) {
    const zoneWidth = Math.max(0.6 * h, 4);
    return {
      zone1: round2(zoneWidth),
      zone2: round2(zoneWidth),
      zone3outer: round2(zoneWidth),
      zone3inner: round2(Math.max(0.2 * h, 4)),
      hasZone1Prime: true,
    };
  }
  const minWL = Math.min(W, L);
  const a = Math.max(Math.min(0.1 * minWL, 0.4 * h), Math.max(0.04 * minWL, 3));
  return {
    zone1: round2(a),
    zone2: round2(a),
    zone3outer: round2(a),
    zone3inner: round2(a),
    hasZone1Prime: false,
  };
}

// ─── Interfaces ─────────────────────────────────────────────

export type FastenerRoofType = "Flat" | "Gable" | "Hip" | "Monoslope";

export interface FastenerCalcInputs {
  V: number;
  h: number;
  W: number;
  L: number;
  roofType: FastenerRoofType;
  slopeDeg: number;
  hasParapet: boolean;
  exposure: "B" | "C" | "D";
  enclosure: "ENCLOSED" | "PARTIALLY_ENCLOSED" | "PARTIALLY_OPEN";
  riskCategory: "I" | "II" | "III" | "IV";
  Kzt: number;
  Kd: number;
  Ke: number;
  manufacturer: string;
  noaNumber: string;
  noaPageRef: string;
  deckMaterial: string;
  insulationDesc: string;
  membraneDesc: string;
  designPressure: number;   // DP (psf, negative)
  rollWidth: number;        // inches
  sideLap: number;          // inches
  lapFastenerSpacing: number;  // inches (per NOA)
  fieldFastenerSpacing: number;// inches (per NOA)
  lapRows: number;
  fieldRows: number;
}

export interface FastenerCalcZone {
  zone: string;
  label: string;
  GCp: number;
  pressure: number;   // net uplift psf (negative)
}

export interface FastenerCalcSpacing {
  zone: string;
  label: string;
  computed: number;
  final: number;
  lapSpacing: number;
  fieldRows: number;
  fieldSpacing: number;
  rowSpacing: number;
  totalRows: number;
}

export interface FastenerCalcResults {
  Kz: number;
  qh: number;         // ultimate velocity pressure
  Dqz: number;        // 0.6 × qh (ASD)
  GCpi: number;
  zones: FastenerCalcZone[];
  zoneWidths: ZoneWidths;
  netWidth: number;
  netLengthPerSquare: number;
  fastenersPerSquare: number;
  sqftPerFastener: number;
  fastenerValue: number;    // Fv (LBF)
  baseRowSpacing: number;   // RS for Zone 1 (inches)
  computedSpacings: FastenerCalcSpacing[];
  gcpTableName: string;
}

// ─── Rounding helpers ───────────────────────────────────────

function round1(n: number): number { return Math.round(n * 10) / 10; }
function round2(n: number): number { return Math.round(n * 100) / 100; }

// ─── Main Calculation ───────────────────────────────────────

export function computeFastenerCalc(inputs: FastenerCalcInputs): FastenerCalcResults {
  const {
    V, Kzt, Kd, Ke, h, W, L,
    rollWidth, sideLap, designPressure,
    lapFastenerSpacing, fieldFastenerSpacing, lapRows, fieldRows,
    enclosure, exposure, roofType, slopeDeg,
  } = inputs;

  // 1. Kz via ASCE 7-22 formula: Kz = 2.01 × (h/Zg)^(2/α)
  const { alpha, Zg } = EXPOSURE_PARAMS[exposure];
  const h_clamped = Math.max(h, 15); // Table 26.10-1 Note 1: use 15ft minimum
  const Kz = round2(2.01 * Math.pow(h_clamped / Zg, 2 / alpha));

  // 2. Velocity pressure (ultimate)
  const qh = round2(0.00256 * Kz * Kzt * Kd * Ke * V * V);
  const Dqz = round2(0.6 * qh); // ASD factor

  // 3. GCpi
  const encKey = enclosure.toUpperCase().replace(/ /g, '_');
  const GCpi = GCPI_VALUES[encKey] ?? 0.18;

  // 4. GCp table
  const gcpTable = getGCpTable(roofType, slopeDeg);
  const gcpTableName = getGCpTableName(roofType, slopeDeg);

  // 5. Zone pressures (C&C) — P = Dqz × (GCp - GCpi)
  const zones: FastenerCalcZone[] = gcpTable.map(({ zone, label, GCp }) => ({
    zone,
    label,
    GCp,
    pressure: round2(Dqz * (GCp - GCpi)),
  }));

  // 6. Zone widths
  const zoneWidths = getZoneWidths(roofType, slopeDeg, h, W, L);

  // 7. Fastener chain
  const netWidth = round2(rollWidth - sideLap);
  const netWidthFt = netWidth / 12;
  const netLengthPerSquare = round2(100 / netWidthFt);

  // FPS from base (Zone 1) configuration
  const netLengthInches = netLengthPerSquare * 12;
  const fastenersInField = (netLengthInches / fieldFastenerSpacing) * fieldRows;
  const fastenersInLap = (netLengthInches / lapFastenerSpacing) * lapRows;
  const fastenersPerSquare = round1(fastenersInField + fastenersInLap);

  const sqftPerFastener = round2(100 / fastenersPerSquare);
  const fastenerValue = round2(designPressure * 100 / fastenersPerSquare);

  // Base row spacing (Zone 1)
  const baseTotalRows = fieldRows + lapRows;
  const baseRowSpacing = round2(netWidth / baseTotalRows);

  // 8. Computed spacings per zone
  const noaMin = Math.min(lapFastenerSpacing, fieldFastenerSpacing);
  const computedSpacings: FastenerCalcSpacing[] = zones.map(z => {
    const isHighPressure = z.zone === "2" || z.zone === "3";
    const zoneFieldRows = isHighPressure ? fieldRows * 2 : fieldRows;
    const totalRows = zoneFieldRows + lapRows;
    const rowSpacing = round2(netWidth / totalRows);
    const computed = round1(Math.abs(fastenerValue) * 144 / (Math.abs(z.pressure) * rowSpacing));
    const final = round1(Math.min(computed, noaMin));

    return {
      zone: z.zone,
      label: z.label,
      computed,
      final,
      lapSpacing: noaMin,
      fieldRows: zoneFieldRows,
      fieldSpacing: round1(final),
      rowSpacing,
      totalRows,
    };
  });

  return {
    Kz, qh, Dqz, GCpi,
    zones, zoneWidths,
    netWidth, netLengthPerSquare,
    fastenersPerSquare, sqftPerFastener,
    fastenerValue,
    baseRowSpacing,
    computedSpacings,
    gcpTableName,
  };
}

function getGCpTableName(roofType: string, slopeDeg: number): string {
  if (roofType === "Flat" || slopeDeg <= 7) return "Table 30.3-2A (Flat Roof, θ ≤ 7°)";
  if (roofType === "Monoslope") {
    if (slopeDeg <= 27) return "Table 30.3-2D (Monoslope, 7° < θ ≤ 27°)";
    return "Table 30.3-2D (Monoslope, θ > 27°)";
  }
  if (slopeDeg <= 27) return `Table 30.3-2B (${roofType}, 7° < θ ≤ 27°)`;
  return `Table 30.3-2C (${roofType}, θ > 27°)`;
}
