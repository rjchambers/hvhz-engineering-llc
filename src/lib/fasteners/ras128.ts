// RAS 128-20 — Standard Procedure for Determining Applicable Wind Allowable
// Stress Design (ASD) Pressures for Low-Slope Roofs in Accordance with ASCE 7.
//
// FBC 8th Edition (2023) · Test Protocols for HVHZ.
//
// What this module does
// ─────────────────────
// RAS 128 codifies the determination of the roof component & cladding (C&C)
// uplift pressures used by every downstream attachment calculation (RAS 117
// §9/§10, RAS 137, etc.). Its procedure is the ASCE 7 Chapter 30 C&C method,
// reported at the ASD level:
//
//   Pasd = 0.6 × Pult
//
// and broken out by the three RAS 128 roof areas:
//
//   Pasd(1) = field      (ASCE 7-22 Zone 1; interior Zone 1' reported separately)
//   Pasd(2) = perimeter  (ASCE 7-22 Zone 2)
//   Pasd(3) = corner     (ASCE 7-22 Zone 3)
//
// RAS 128 also provides Table 1 / Table 2 of pre-computed Pasd values. Per the
// standard, where a project's pressures fall within those tabulated values the
// submittal "does not require additional signed and sealed engineering design
// calculations." Those printed tables are nothing more than this same procedure
// evaluated at fixed assumptions (enclosed building, slope ≤ 7°, Kd = 0.85,
// Kzt = 1.0, Ke = 1.0, effective wind area = 10 ft²). `generateRAS128Table`
// reproduces them by running the procedure across a grid of wind speeds and
// mean roof heights.
//
// PROVENANCE NOTE
// ───────────────
// The numeric table here is COMPUTED from the RAS 128 procedure (ASCE 7-22),
// not transcribed from the printed RAS 128 PDF. The two should agree to within
// rounding, but before relying on the "no signed/sealed calcs required" path
// for a permit, verify the generated values against the printed RAS 128 Table 1
// / Table 2 for the 8th Edition.

export type Exposure = 'B' | 'C' | 'D';
export type Enclosure = 'enclosed' | 'partially_enclosed' | 'open';
export type RAS128ZoneKey = "1'" | '1' | '2' | '3';

// ASCE 7-22 Table 26.11-1 — terrain exposure constants.
const EXPOSURE_PARAMS: Record<Exposure, { alpha: number; zg: number }> = {
  B: { alpha: 7.0, zg: 1200 },
  C: { alpha: 9.5, zg: 900 },
  D: { alpha: 11.5, zg: 700 },
};

// ASCE 7-22 Table 26.13-1 — internal pressure coefficient (magnitude).
const GCPI: Record<Enclosure, number> = {
  enclosed: 0.18,
  partially_enclosed: 0.55,
  open: 0.0,
};

// ASCE 7-22 Figure 30.3-2A — low-slope (θ ≤ 7°) roof C&C external pressure
// coefficients (GCp), uplift, as a function of effective wind area (EWA).
// Each entry is [EWA_ft2, GCp]; intermediate areas interpolate on log10(EWA).
const GCP_LOW_SLOPE: Record<RAS128ZoneKey, [number, number][]> = {
  "1'": [[10, -0.90], [500, -0.90]],
  '1':  [[10, -1.70], [500, -0.90]],
  '2':  [[10, -2.30], [500, -1.40]],
  '3':  [[10, -3.20], [500, -1.80]],
};

/**
 * ASCE 7-22 Eq. 26.10-1 velocity pressure exposure coefficient.
 * Kz = 2.01 × (z / zg)^(2/α), with z taken as the mean roof height but not
 * less than 15 ft (Table 26.10-1, Note 1).
 */
export function kzASCE(exposure: Exposure, h: number): number {
  const { alpha, zg } = EXPOSURE_PARAMS[exposure];
  const z = Math.max(h, 15);
  return 2.01 * Math.pow(z / zg, 2 / alpha);
}

/**
 * ASCE 7-22 §30.2 component & cladding roof zone dimension `a`:
 *   a = min(0.1 × least horizontal dim, 0.4 × h)
 *   but not less than max(0.04 × least horizontal dim, 3 ft).
 */
export function zoneDimA(h: number, W: number, L: number): number {
  const lhd = Math.min(W, L);
  return Math.max(Math.min(0.1 * lhd, 0.4 * h), Math.max(0.04 * lhd, 3));
}

/** Low-slope GCp for a zone, interpolated on log10(EWA) per Fig. 30.3-2A. */
export function gcpLowSlope(zone: RAS128ZoneKey, ewa_ft2: number): number {
  const table = GCP_LOW_SLOPE[zone];
  const lo = table[0], hi = table[table.length - 1];
  const ewa = Math.max(lo[0], Math.min(ewa_ft2, hi[0]));
  const t = (Math.log10(ewa) - Math.log10(lo[0])) / (Math.log10(hi[0]) - Math.log10(lo[0]));
  return lo[1] + t * (hi[1] - lo[1]);
}

export interface RAS128Inputs {
  V: number;            // ultimate (basic) design wind speed, mph
  exposure: Exposure;
  h: number;            // mean roof height, ft (incl. parapet effect if desired)
  W: number;            // building width, ft
  L: number;            // building length, ft
  Kzt: number;          // topographic factor (ASCE 7-22 §26.8)
  Kd: number;           // directionality factor (ASCE 7-22 Table 26.6-1) — 0.85 C&C
  Ke: number;           // ground elevation factor (ASCE 7-22 Table 26.9-1)
  enclosure: Enclosure;
  ewa_ft2?: number;     // effective wind area; defaults to 10 ft²
}

export interface RAS128ZonePressure {
  zone: RAS128ZoneKey;
  label: string;
  GCp: number;
  Pult: number;         // ultimate uplift pressure, psf (negative)
  Pasd: number;         // ASD uplift pressure, psf (negative) = 0.6 × Pult
}

export interface RAS128Result {
  Kz: number;
  qh_ult: number;       // ultimate velocity pressure, psf
  GCpi: number;         // internal pressure coefficient magnitude applied
  a_ft: number;         // C&C zone dimension `a`
  hasInterior: boolean; // true when a Zone 1' interior exists
  zones: RAS128ZonePressure[];
  // Convenience accessors named per RAS 128 (most severe of the relevant zone):
  Pasd_field: number;       // Pasd(1)
  Pasd_perimeter: number;   // Pasd(2)
  Pasd_corner: number;      // Pasd(3)
  derivation: string[];
}

const ZONE_LABELS: Record<RAS128ZoneKey, string> = {
  "1'": 'Field (interior)',
  '1': 'Field',
  '2': 'Perimeter',
  '3': 'Corner',
};

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round3(n: number): number { return Math.round(n * 1000) / 1000; }

/**
 * Full RAS 128 procedure: returns ASD uplift pressures by roof zone.
 * Pasd = 0.6 × Pult, Pult = qh × (GCp − GCpi) per ASCE 7-22 Eq. 30.3-1.
 */
export function computeRAS128Pressures(inputs: RAS128Inputs): RAS128Result {
  const { V, exposure, h, W, L, Kzt, Kd, Ke, enclosure } = inputs;
  const ewa = inputs.ewa_ft2 ?? 10;

  const Kz = kzASCE(exposure, h);
  const qh_ult = 0.00256 * Kz * Kzt * Kd * Ke * V * V;
  const GCpi = GCPI[enclosure];
  const a = zoneDimA(h, W, L);

  // ASCE 7-22 Fig. 30.3-2A: a Zone 1' interior exists only when both plan
  // dimensions extend past the perimeter (Zone 2) + field-edge (Zone 1) bands,
  // i.e. more than 2a in from every edge → least plan dim > 4a.
  const hasInterior = Math.min(W, L) > 4 * a;

  const keys: RAS128ZoneKey[] = hasInterior ? ["1'", '1', '2', '3'] : ['1', '2', '3'];
  const zones: RAS128ZonePressure[] = keys.map((zone) => {
    const GCp = gcpLowSlope(zone, ewa);
    const Pult = qh_ult * (GCp - GCpi);  // GCp < 0, GCpi > 0 → most negative uplift
    return {
      zone,
      label: ZONE_LABELS[zone],
      GCp: round3(GCp),
      Pult: round2(Pult),
      Pasd: round2(0.6 * Pult),
    };
  });

  // RAS 128 field/perimeter/corner = ASCE 7-22 Zone 1/2/3 (the field uses the
  // edge Zone 1, never the reduced interior Zone 1', so the field value stays
  // conservative for assemblies that span both).
  const pasdOf = (z: RAS128ZoneKey) => zones.find((p) => p.zone === z)?.Pasd ?? 0;

  const derivation = [
    `Kz = 2.01 × (max(${h},15)/${EXPOSURE_PARAMS[exposure].zg})^(2/${EXPOSURE_PARAMS[exposure].alpha}) = ${round3(Kz)}  [ASCE 7-22 Eq. 26.10-1]`,
    `qh = 0.00256 × ${round3(Kz)} × ${Kzt} × ${Kd} × ${Ke} × ${V}² = ${round2(qh_ult)} psf  [ASCE 7-22 Eq. 26.10-1]`,
    `a = min(0.1×${Math.min(W, L)}, 0.4×${h}) ≥ max(0.04×${Math.min(W, L)}, 3) = ${round2(a)} ft  [ASCE 7-22 §30.2]`,
    `Pult = qh × (GCp − GCpi), GCpi = ${GCpi}  [ASCE 7-22 Eq. 30.3-1]`,
    `Pasd = 0.6 × Pult  [RAS 128-20]`,
  ];

  return {
    Kz: round3(Kz),
    qh_ult: round2(qh_ult),
    GCpi,
    a_ft: round2(a),
    hasInterior,
    zones,
    Pasd_field: pasdOf('1'),
    Pasd_perimeter: pasdOf('2'),
    Pasd_corner: pasdOf('3'),
    derivation,
  };
}

// ─── RAS 128 Table 1 / Table 2 generation ───────────────────────────────────

export interface RAS128TableRow {
  V: number;
  h: number;
  Pasd_field: number;       // Pasd(1)
  Pasd_perimeter: number;   // Pasd(2)
  Pasd_corner: number;      // Pasd(3)
}

export interface RAS128TableOptions {
  exposure?: Exposure;          // default C (HVHZ default)
  enclosure?: Enclosure;        // default enclosed
  windSpeeds?: number[];        // default common HVHZ Vult values
  meanRoofHeights?: number[];   // default 15–60 ft band
  Kzt?: number;                 // default 1.0
  Kd?: number;                  // default 0.85
  Ke?: number;                  // default 1.0
  ewa_ft2?: number;             // default 10
  // Plan dimensions used only to bound the `a` term; the printed RAS 128 tables
  // assume the field pressure governs the field area, so a large footprint is
  // used by default to keep field = Zone 1 (not the reduced Zone 1').
  W?: number;
  L?: number;
}

const DEFAULT_TABLE_WIND_SPEEDS = [150, 160, 170, 175, 180, 185, 195, 200];
const DEFAULT_TABLE_HEIGHTS = [15, 20, 25, 30, 40, 50, 60];

/**
 * Reproduces the RAS 128 Table 1 / Table 2 grid of Pasd(1/2/3) values by running
 * the RAS 128 procedure at the standard's fixed assumptions. See PROVENANCE NOTE.
 */
export function generateRAS128Table(options: RAS128TableOptions = {}): RAS128TableRow[] {
  const exposure = options.exposure ?? 'C';
  const enclosure = options.enclosure ?? 'enclosed';
  const windSpeeds = options.windSpeeds ?? DEFAULT_TABLE_WIND_SPEEDS;
  const heights = options.meanRoofHeights ?? DEFAULT_TABLE_HEIGHTS;
  const Kzt = options.Kzt ?? 1.0;
  const Kd = options.Kd ?? 0.85;
  const Ke = options.Ke ?? 1.0;
  const ewa = options.ewa_ft2 ?? 10;
  const W = options.W ?? 1000;
  const L = options.L ?? 1000;

  const rows: RAS128TableRow[] = [];
  for (const V of windSpeeds) {
    for (const h of heights) {
      const r = computeRAS128Pressures({ V, exposure, h, W, L, Kzt, Kd, Ke, enclosure, ewa_ft2: ewa });
      rows.push({
        V,
        h,
        Pasd_field: r.Pasd_field,
        Pasd_perimeter: r.Pasd_perimeter,
        Pasd_corner: r.Pasd_corner,
      });
    }
  }
  return rows;
}

export interface RAS128PrescriptiveCheck {
  qualifies: boolean;          // true → RAS 128 tabular path, no signed/sealed calc
  governingZone: RAS128ZoneKey;
  requiredPasd: number;        // most severe zone Pasd (psf, negative)
  ratedPressure: number;       // assembly's approved/NOA pressure (psf, negative)
  message: string;
}

/**
 * RAS 128 tabular compliance: if the assembly's approved (NOA) ASD design
 * pressure envelopes the most severe tabulated zone Pasd, the submittal may use
 * the RAS 128 table path without additional signed/sealed engineering. Otherwise
 * a rational analysis (RAS 117 §9/§10) is required.
 */
export function checkRAS128Prescriptive(
  result: RAS128Result,
  ratedPressure_psf: number,
): RAS128PrescriptiveCheck {
  const rated = -Math.abs(ratedPressure_psf);
  const governing = result.zones.reduce((worst, z) =>
    Math.abs(z.Pasd) > Math.abs(worst.Pasd) ? z : worst, result.zones[0]);
  const qualifies = Math.abs(rated) >= Math.abs(governing.Pasd);
  return {
    qualifies,
    governingZone: governing.zone,
    requiredPasd: governing.Pasd,
    ratedPressure: rated,
    message: qualifies
      ? `Assembly rated ${Math.abs(rated).toFixed(1)} psf ≥ governing ${governing.label} Pasd ${Math.abs(governing.Pasd).toFixed(1)} psf — RAS 128 tabular path applies; no additional signed/sealed calculations required.`
      : `Assembly rated ${Math.abs(rated).toFixed(1)} psf < governing ${governing.label} Pasd ${Math.abs(governing.Pasd).toFixed(1)} psf — rational analysis (RAS 117 §9/§10) required.`,
  };
}
