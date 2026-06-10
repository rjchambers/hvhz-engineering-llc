// Wind pressure calculation per RAS 128-20 / ASCE 7-22 Ch. 26 & 30
// (Components & Cladding, low-slope ≤ 7° roofs, h ≤ 60 ft).
// Outputs are ASD-level pressures by C&C zone. RAS 128 is the FBC procedure that
// governs this determination (Pasd = 0.6 × Pult); the heavy lifting lives in
// ./ras128.ts so the fastener engine and the report/UI share one source of truth.

import type { FastenerInputs, ZonePressures } from './types';
import { zoneDimA, kzASCE } from './ras128';

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

// C&C zone band width = ASCE 7-22 §30.2 dimension `a`:
//   a = min(0.1 × least_horiz_dim, 0.4 × h), but ≥ max(0.04 × least_horiz_dim, 3 ft).
// (The prior 0.6 × h was not an ASCE 7-22 quantity; it ignored plan dimensions
// and disagreed with the MWFRS engine, which already used `a`. Fixed so both
// engines and RAS 128 agree.) When plan dimensions are unknown the caller may
// omit them, in which case the height-governed term 0.4h is used.
export function getZoneWidth(h: number, W = Infinity, L = Infinity): number {
  return zoneDimA(h, W, L);
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
  const zoneWidth = getZoneWidth(h_eff, inputs.buildingWidth, inputs.buildingLength);
  const calcP = (zone: string) => qh_ASD * (getGCpByArea(zone, ewa_ft2) - GCpi);
  // ASCE 7-22 Fig. 30.3-2A: an interior Zone 1' exists only when both plan
  // dimensions extend more than 2a in from every edge (Zone 2 band + Zone 1
  // band) → least plan dimension > 4a.
  const has1prime = (inputs.buildingLength > 4 * zoneWidth) && (inputs.buildingWidth > 4 * zoneWidth);
  return {
    zone1prime: has1prime ? calcP("1'") : calcP('1'),
    zone1: calcP('1'), zone2: calcP('2'), zone3: calcP('3'),
    // All C&C bands (Zone 1/2/3) are `a` wide per ASCE 7-22 Fig. 30.3-2A; the
    // corner (Zone 3) is an a×a region.
    zoneWidth_ft: Math.round(zoneWidth * 100) / 100,
    zone3_depth_ft: Math.round(zoneWidth * 100) / 100,
    zone3_length_ft: Math.round(zoneWidth * 100) / 100,
  };
}
