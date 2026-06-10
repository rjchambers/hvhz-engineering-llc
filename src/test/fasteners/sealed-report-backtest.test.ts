// Back-test against a signed & sealed RAS 117 / ASCE 7-22 insulation calc.
//
// Source: "1852 NW 82nd Ave, Coral Springs FL" insulation attachment report,
// digitally signed & sealed by Erik Nemati, P.E. (No. 84648), GAF NOA FL11946-R26.
//
// Reported inputs:
//   V = 175 mph, Exposure C, h = 15 ft, ENCLOSED, Risk II, slope < 7°,
//   Kz = 0.85, Kzt = 1, Kd = 0.85, GCp = -0.9/-1.7/-2.3/-3.2 (Zone 1'/1/2/3),
//   GCpi = ±0.18, qz = 56.57 psf, Dqz = 33.94 psf.
// Reported uplift pressures (ASD):
//   P1' = -36.66, P1 = -63.81, P2 = -84.18, P3 = -114.72 psf.
// Reported insulation data:
//   DP (NOA MDP) = -52.5 psf, 4'×4' board = 16 ft², FPB (field pattern) = 9,
//   Fv = -94.5 lb (= 52.5 × 1.8), tributary 2.58/1.48/1.12/0.82 ft²/fastener.
//   Reported counts (their office's conservative method): 9/13/16/21.
//
// This test pins the PRESSURE engine to the sealed report exactly, and pins the
// insulation engine to the standard RAS 117 §9 proportional method (the FBC
// worked-example rule) — which lands a few fasteners below the report's
// conservative office numbers (a documented, expected difference).

import { describe, expect, it } from 'vitest';
import { computeRAS128Pressures } from '@/lib/fasteners/ras128';
import { calcQhASD, getZonePressures, getZoneWidth } from '@/lib/fasteners/zone-pressures';
import { calcInsulationZone } from '@/lib/fasteners/insulation-engine';
import { computeInsulationAttachment } from '@/lib/wind-calc';
import type { FastenerInputs } from '@/lib/fasteners/types';

const report = {
  V: 175, exposure: 'C' as const, h: 15,
  Kz: 0.85, qz: 56.57, Dqz: 33.94,
  P: { "1'": -36.66, '1': -63.81, '2': -84.18, '3': -114.72 },
  DP: -52.5, boardArea: 16, FPB: 9, Fv: -94.5,
  trib: { "1'": 2.58, '1': 1.48, '2': 1.12, '3': 0.82 },
  counts: { "1'": 9, '1': 13, '2': 16, '3': 21 },
};

describe('Sealed report back-test — pressures (must match exactly)', () => {
  const r = computeRAS128Pressures({
    V: report.V, exposure: report.exposure, h: report.h,
    W: 65, L: 65, Kzt: 1, Kd: 0.85, Ke: 1, enclosure: 'enclosed', ewa_ft2: 10,
  });

  it('Kz matches (ASCE 7-22 Eq. 26.10-1)', () => {
    expect(r.Kz).toBeCloseTo(report.Kz, 2);
  });
  it('qh and Dqz match', () => {
    expect(r.qh_ult).toBeCloseTo(report.qz, 1);
    expect(0.6 * r.qh_ult).toBeCloseTo(report.Dqz, 1);
  });
  it('every zone uplift pressure matches the sealed report', () => {
    const p = (k: string) => r.zones.find((z) => z.zone === k)!.Pasd;
    expect(p("1'")).toBeCloseTo(report.P["1'"], 1);
    expect(p('1')).toBeCloseTo(report.P['1'], 1);
    expect(p('2')).toBeCloseTo(report.P['2'], 1);
    expect(p('3')).toBeCloseTo(report.P['3'], 1);
  });

  it('the RAS 117 fastener engine produces the same pressures', () => {
    const inputs = { V: report.V, exposureCategory: report.exposure, h: report.h,
      Kzt: 1, Kd: 0.85, Ke: 1, enclosure: 'enclosed', buildingWidth: 65,
      buildingLength: 65, parapetHeight: 0 } as unknown as FastenerInputs;
    const { qh_ASD } = calcQhASD(report.V, report.exposure, report.h, 1, 0.85, 1);
    const zp = getZonePressures(inputs, qh_ASD, 10);
    expect(zp.zone1prime).toBeCloseTo(report.P["1'"], 1);
    expect(zp.zone1).toBeCloseTo(report.P['1'], 1);
    expect(zp.zone2).toBeCloseTo(report.P['2'], 1);
    expect(zp.zone3).toBeCloseTo(report.P['3'], 1);
  });
});

describe('Sealed report back-test — zone widths (firm 0.6H / 0.2H convention)', () => {
  it('field/perimeter/corner band = 0.6H = 9 ft', () => {
    expect(getZoneWidth(report.h)).toBeCloseTo(0.6 * report.h, 6);
    expect(getZoneWidth(report.h)).toBeCloseTo(9, 6);
  });
  it('corner-inner = 0.2H = 3 ft', () => {
    expect(0.2 * report.h).toBeCloseTo(3, 6);
  });
});

describe('Sealed report back-test — insulation (standard RAS 117 §9)', () => {
  // f_y derived from the NOA field pattern: f_y = MDP × board_area / FPB.
  const f_y = Math.abs(report.DP) * report.boardArea / report.FPB; // 93.33 lb

  it('derived per-fastener value Fv ≈ report (-94.5 from their rounding)', () => {
    expect(f_y).toBeCloseTo(93.33, 1);
    // The report rounds board_area/FPB (16/9 = 1.78) to 1.8 before multiplying.
    expect(Math.abs(report.DP) * 1.8).toBeCloseTo(Math.abs(report.Fv), 1);
  });

  it('standard §9 counts: 9 / 11 / 15 / 20 (≤ the report\'s conservative 9/13/16/21)', () => {
    const N = (k: keyof typeof report.P) =>
      calcInsulationZone(k as never, report.P[k], report.boardArea, f_y, report.FPB).N_used;
    expect(N("1'")).toBe(9);   // FPB minimum governs (report also 9)
    expect(N('1')).toBe(11);   // report 13
    expect(N('2')).toBe(15);   // report 16
    expect(N('3')).toBe(20);   // report 21
  });

  it('never specifies fewer than the NOA field pattern (FPB)', () => {
    for (const k of ["1'", '1', '2', '3'] as const) {
      const n = calcInsulationZone(k as never, report.P[k], report.boardArea, f_y, report.FPB).N_used;
      expect(n).toBeGreaterThanOrEqual(report.FPB);
    }
  });

  it('our §9 counts are always ≤ the sealed report\'s conservative counts', () => {
    for (const k of ["1'", '1', '2', '3'] as const) {
      const n = calcInsulationZone(k as never, report.P[k], report.boardArea, f_y, report.FPB).N_used;
      expect(n).toBeLessThanOrEqual(report.counts[k]);
    }
  });
});

describe('Sealed report back-test — report insulation section (computeInsulationAttachment)', () => {
  // The report generator / UI card consume this helper. Drive it with the same
  // zone pressures and NOA inputs as the sealed report.
  const zones = [
    { zone: "1'", label: 'Field (interior)', pressure: report.P["1'"] },
    { zone: '1', label: 'Field', pressure: report.P['1'] },
    { zone: '2', label: 'Perimeter', pressure: report.P['2'] },
    { zone: '3', label: 'Corner', pressure: report.P['3'] },
  ];
  const ins = computeInsulationAttachment(zones, report.DP, report.FPB, 4, 4);

  it('derives Fv from the NOA field pattern (DP × A / FPB)', () => {
    expect(ins.applicable).toBe(true);
    expect(ins.boardArea).toBe(16);
    expect(ins.fv).toBeCloseTo(93.33, 1);
  });

  it('reproduces tributary areas close to the sealed report', () => {
    const trib = (k: string) => ins.zones.find(z => z.zone === k)!.tribArea;
    expect(trib("1'")).toBeCloseTo(report.trib["1'"], 1);
    expect(trib('3')).toBeCloseTo(report.trib['3'], 1);
  });

  it('produces standard §9 counts: 9 / 11 / 15 / 20', () => {
    const n = (k: string) => ins.zones.find(z => z.zone === k)!.fasteners;
    expect(n("1'")).toBe(9);
    expect(n('1')).toBe(11);
    expect(n('2')).toBe(15);
    expect(n('3')).toBe(20);
  });

  it('is not applicable when MDP or FPB are missing', () => {
    expect(computeInsulationAttachment(zones, 0, 9, 4, 4).applicable).toBe(false);
    expect(computeInsulationAttachment(zones, -52.5, 0, 4, 4).applicable).toBe(false);
  });
});
