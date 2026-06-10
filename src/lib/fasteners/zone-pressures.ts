// Wind pressure calculation per RAS 128-20 / ASCE 7-22 Ch. 26 & 30
// (Components & Cladding, low-slope ≤ 7° roofs, h ≤ 60 ft).
// Outputs are ASD-level pressures by C&C zone. RAS 128 is the FBC procedure that
// governs this determination (Pasd = 0.6 × Pult); the heavy lifting lives in
// ./ras128.ts so the fastener engine and the report/UI share one source of truth.

import type { FastenerInputs, ZonePressures } from './types';
import { kzASCE } from './ras128';

// Velocity pressure exposure coefficient Kh (= Kz at mean roof height).
// Single source of truth: ASCE 7-22 Eq. 26.10-1 (see ras128.kzASCE). Previously
// this interpolated Table 26.10-1; the analytic form is what the code prescribes
// and keeps this engine, the RAS 128 module, and the C&C engine in agreement.
export function getKh(exposure: 'B' | 'C' | 'D', h: number): number {
  return kzASCE(exposure, h);
}

const GCP_AREA_TABLE: Record<string, [number, number][]> = {
  "1'": [[10, -0.90], [200, -0.90]],
  '1': [[10, -1.70], [200, -0.90]],
  '2': [[10, -2.30], [200, -1.40]],
  '3': [[10, -3.20], [200, -1.80]],
};

export function getGCpByArea(zone: string, ewa_ft2: number): number {
  const table = GCP_AREA_TABLE[zone] ?? GCP_AREA_TABLE['1'];
  const EWA = Math.max(10, Math.min(ewa_ft2, 200));
  const lo = table[0], hi = table[table.length - 1];
  const logEWA = Math.log10(EWA), logLo = Math.log10(lo[0]), logHi = Math.log10(hi[0]);
  const frac = logHi === logLo ? 0 : (logEWA - logLo) / (logHi - logLo);
  return lo[1] + frac * (hi[1] - lo[1]);
}

// Low-slope (≤ 7°) C&C zone band width. This firm's HVHZ insulation / base-sheet
// calcs use the 0.6·H field/perimeter/corner band (with 0.2·H corner-inner)
// convention, matching the signed/sealed reference reports (e.g. Coral Springs,
// Erik Nemati P.E.). Pressures themselves are unaffected by band width — they
// come from RAS 128 / ASCE 7-22 (qh, GCp, GCpi). The steep-slope ASCE 7-22 §30.2
// dimension `a` is applied in the C&C engine's gable/hip path.
export function getZoneWidth(h: number): number {
  return 0.6 * h;
}

export function calcQhASD(
  V: number,
  exposure: 'B' | 'C' | 'D',
  h: number,
  Kzt: number,
  Kd: number,
  Ke: number,
): { qh_ASD: number; Kh: number } {
  const Kh = getKh(exposure, h);
  const qh_ASD = 0.00256 * Kh * Kzt * Kd * Ke * V * V * 0.6;
  return { qh_ASD, Kh };
}

export function getZonePressures(inputs: FastenerInputs, qh_ASD: number, ewa_ft2 = 10): ZonePressures {
  const GCpi = inputs.enclosure === 'partially_enclosed' ? 0.55 : inputs.enclosure === 'enclosed' ? 0.18 : 0;
  const h_eff = inputs.h + (inputs.parapetHeight ?? 0);
  const zoneWidth = getZoneWidth(h_eff);
  const calcP = (zone: string) => qh_ASD * (getGCpByArea(zone, ewa_ft2) - GCpi);
  // An interior Zone 1' exists when both plan dimensions clear the perimeter +
  // field bands (each 0.6·H) → plan dim > 2 × zoneWidth.
  const has1prime = (inputs.buildingLength > 2 * zoneWidth) && (inputs.buildingWidth > 2 * zoneWidth);
  return {
    zone1prime: has1prime ? calcP("1'") : calcP('1'),
    zone1: calcP('1'), zone2: calcP('2'), zone3: calcP('3'),
    // Low-slope band geometry (firm convention): field/perimeter/corner = 0.6·H,
    // corner-inner = 0.2·H.
    zoneWidth_ft: Math.round(zoneWidth * 100) / 100,
    zone3_depth_ft: Math.round(0.2 * h_eff * 100) / 100,
    zone3_length_ft: Math.round(0.6 * h_eff * 100) / 100,
  };
}
