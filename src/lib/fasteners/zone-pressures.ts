// Wind pressure calculation per ASCE 7-22 Ch. 26 & 30 (Envelope Procedure, h ≤ 60 ft).
// Outputs are ASD-level pressures by C&C zone for low-slope (≤ 7°) roofs.

import type { FastenerInputs, ZonePressures } from './types';

const KH_TABLE: { z: number; B: number; C: number; D: number }[] = [
  { z: 0, B: 0.57, C: 0.85, D: 1.03 }, { z: 15, B: 0.57, C: 0.85, D: 1.03 },
  { z: 20, B: 0.62, C: 0.90, D: 1.08 }, { z: 25, B: 0.66, C: 0.94, D: 1.12 },
  { z: 30, B: 0.70, C: 0.98, D: 1.16 }, { z: 40, B: 0.76, C: 1.04, D: 1.22 },
  { z: 50, B: 0.81, C: 1.09, D: 1.27 }, { z: 60, B: 0.85, C: 1.13, D: 1.31 },
];

export function getKh(exposure: 'B' | 'C' | 'D', h: number): number {
  const z = Math.max(0, Math.min(h, 60));
  for (let i = 0; i < KH_TABLE.length - 1; i++) {
    const lo = KH_TABLE[i], hi = KH_TABLE[i + 1];
    if (z >= lo.z && z <= hi.z) {
      const frac = hi.z === lo.z ? 0 : (z - lo.z) / (hi.z - lo.z);
      return lo[exposure] + frac * (hi[exposure] - lo[exposure]);
    }
  }
  return KH_TABLE[KH_TABLE.length - 1][exposure];
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

// NOTE: ASCE 7-22 §30.2 actually defines the C&C zone parameter `a` as
//   a = min(0.1 × least_horiz_dim, 0.4 × h)
// constrained by  a ≥ max(0.04 × least_horiz_dim, 3 ft).
// The historical 0.6 × h here ignores plan dimensions and may overstate `a`
// for tall, narrow buildings, pushing additional roof area into Zone 2/3.
// Flagged for PE review against the actual ASCE 7-22 §30.2 figure before
// changing — the standard's RAS 117 worked examples don't depend on this.
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
  const has1prime = (inputs.buildingLength > 2 * zoneWidth) && (inputs.buildingWidth > 2 * zoneWidth);
  return {
    zone1prime: has1prime ? calcP("1'") : calcP('1'),
    zone1: calcP('1'), zone2: calcP('2'), zone3: calcP('3'),
    zoneWidth_ft: Math.round(zoneWidth * 100) / 100,
    zone3_depth_ft: Math.round(0.2 * h_eff * 100) / 100,
    zone3_length_ft: Math.round(0.6 * h_eff * 100) / 100,
  };
}
