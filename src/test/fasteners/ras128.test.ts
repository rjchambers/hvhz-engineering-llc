// RAS 128-20 — Applicable Wind ASD Pressures for Low-Slope Roofs.
// Verifies the procedure (Pasd = 0.6 × Pult per ASCE 7-22 Ch. 30), the Table 1/2
// generator, the prescriptive-path check, and engine reconciliation: the RAS 117
// fastener engine, the C&C engine, and the RAS 128 module must agree on geometry
// and pressures.

import { describe, expect, it } from 'vitest';
import {
  computeRAS128Pressures,
  generateRAS128Table,
  checkRAS128Prescriptive,
  kzASCE,
  zoneDimA,
  gcpLowSlope,
} from '@/lib/fasteners/ras128';
import { getZonePressures, calcQhASD, getZoneWidth } from '@/lib/fasteners/zone-pressures';
import { computeFastenerCalc } from '@/lib/wind-calc';
import type { FastenerInputs } from '@/lib/fasteners/types';

const baseRAS128 = {
  V: 185,
  exposure: 'C' as const,
  h: 30,
  W: 100,
  L: 200,
  Kzt: 1.0,
  Kd: 0.85,
  Ke: 1.0,
  enclosure: 'enclosed' as const,
};

describe('RAS 128 — Kz (ASCE 7-22 Eq. 26.10-1)', () => {
  it('matches Table 26.10-1 values within rounding (Exp C)', () => {
    // The analytic Eq. 26.10-1 value and the printed (rounded) table differ by
    // up to ~0.01; the formula is the governing one.
    expect(Math.abs(kzASCE('C', 15) - 0.85)).toBeLessThan(0.02);
    expect(Math.abs(kzASCE('C', 30) - 0.98)).toBeLessThan(0.02);
    expect(Math.abs(kzASCE('C', 60) - 1.13)).toBeLessThan(0.02);
  });
  it('applies the 15 ft floor (Table 26.10-1 Note 1)', () => {
    expect(kzASCE('C', 5)).toBeCloseTo(kzASCE('C', 15), 6);
  });
});

describe('RAS 128 — zone dimension a (ASCE 7-22 §30.2)', () => {
  it('uses 0.4h when it governs over 0.1·LHD', () => {
    // LHD = 100 → 0.1·LHD = 10; 0.4h at h=15 → 6 → a = 6
    expect(zoneDimA(15, 100, 200)).toBeCloseTo(6, 6);
  });
  it('caps at 0.1·LHD for tall buildings', () => {
    // LHD = 40 → 0.1·LHD = 4; 0.4h at h=50 → 20 → min = 4
    expect(zoneDimA(50, 40, 60)).toBeCloseTo(4, 6);
  });
  it('never drops below max(0.04·LHD, 3 ft)', () => {
    expect(zoneDimA(2, 10, 10)).toBeGreaterThanOrEqual(3);
  });
});

describe('RAS 128 — GCp low-slope (ASCE 7-22 Fig. 30.3-2A)', () => {
  it('returns table endpoints at EWA = 10 ft²', () => {
    expect(gcpLowSlope('1', 10)).toBeCloseTo(-1.7, 6);
    expect(gcpLowSlope('2', 10)).toBeCloseTo(-2.3, 6);
    expect(gcpLowSlope('3', 10)).toBeCloseTo(-3.2, 6);
  });
  it('reduces (less negative) magnitude as EWA grows', () => {
    expect(Math.abs(gcpLowSlope('3', 100))).toBeLessThan(Math.abs(gcpLowSlope('3', 10)));
  });
});

describe('RAS 128 — procedure', () => {
  const r = computeRAS128Pressures(baseRAS128);

  it('reports Pasd = 0.6 × Pult for every zone', () => {
    for (const z of r.zones) {
      expect(z.Pasd).toBeCloseTo(0.6 * z.Pult, 1);
    }
  });

  it('orders uplift corner > perimeter > field (magnitude)', () => {
    expect(Math.abs(r.Pasd_corner)).toBeGreaterThan(Math.abs(r.Pasd_perimeter));
    expect(Math.abs(r.Pasd_perimeter)).toBeGreaterThan(Math.abs(r.Pasd_field));
  });

  it('all ASD uplift pressures are negative (suction)', () => {
    expect(r.Pasd_field).toBeLessThan(0);
    expect(r.Pasd_corner).toBeLessThan(0);
  });

  it('includes an interior Zone 1\' for a large footprint', () => {
    expect(r.hasInterior).toBe(true);
    expect(r.zones.some((z) => z.zone === "1'")).toBe(true);
  });

  it('omits Zone 1\' for a small footprint (least dim ≤ 4a)', () => {
    const small = computeRAS128Pressures({ ...baseRAS128, W: 10, L: 10, h: 10 });
    expect(small.hasInterior).toBe(false);
    expect(small.zones.some((z) => z.zone === "1'")).toBe(false);
  });

  it('produces a non-empty derivation citing RAS 128', () => {
    expect(r.derivation.join(' ')).toMatch(/RAS 128/);
  });
});

describe('RAS 128 — Table 1/2 generation', () => {
  const table = generateRAS128Table({ exposure: 'C' });

  it('produces a row per (wind speed × height)', () => {
    expect(table.length).toBeGreaterThan(0);
    for (const row of table) {
      expect(Math.abs(row.Pasd_corner)).toBeGreaterThan(Math.abs(row.Pasd_perimeter));
      expect(Math.abs(row.Pasd_perimeter)).toBeGreaterThan(Math.abs(row.Pasd_field));
    }
  });

  it('pressure rises monotonically with wind speed at fixed height', () => {
    const h30 = table.filter((r) => r.h === 30).sort((a, b) => a.V - b.V);
    for (let i = 1; i < h30.length; i++) {
      expect(Math.abs(h30[i].Pasd_corner)).toBeGreaterThan(Math.abs(h30[i - 1].Pasd_corner));
    }
  });

  it('pressure rises monotonically with mean roof height at fixed speed', () => {
    const v185 = table.filter((r) => r.V === 185).sort((a, b) => a.h - b.h);
    for (let i = 1; i < v185.length; i++) {
      expect(Math.abs(v185[i].Pasd_corner)).toBeGreaterThanOrEqual(Math.abs(v185[i - 1].Pasd_corner));
    }
  });
});

describe('RAS 128 — prescriptive (tabular) path', () => {
  const r = computeRAS128Pressures(baseRAS128);

  it('qualifies when the assembly envelopes the governing zone Pasd', () => {
    const strong = checkRAS128Prescriptive(r, r.Pasd_corner - 5);
    expect(strong.qualifies).toBe(true);
    expect(strong.message).toMatch(/no additional signed\/sealed/i);
  });

  it('requires rational analysis when the assembly is under-rated', () => {
    const weak = checkRAS128Prescriptive(r, Math.abs(r.Pasd_field) - 1);
    expect(weak.qualifies).toBe(false);
    expect(weak.message).toMatch(/rational analysis/i);
  });
});

describe('Engine reconciliation — RAS 117 / C&C / RAS 128 agree', () => {
  const inputs: FastenerInputs = {
    V: 185, exposureCategory: 'C', h: 30, Kzt: 1.0, Kd: 0.85, Ke: 1.0,
    enclosure: 'enclosed', riskCategory: 'II',
    buildingLength: 200, buildingWidth: 100, parapetHeight: 0,
    systemType: 'modified_bitumen', deckType: 'plywood', constructionType: 'reroof',
    existingLayers: 1, sheetWidth_in: 39.375, lapWidth_in: 4, Fy_lbf: 60,
    fySource: 'noa', initialRows: 4,
    noa: { approvalType: 'miami_dade_noa', approvalNumber: '', mdp_psf: -60, asterisked: false },
    boardLength_ft: 4, boardWidth_ft: 8, insulation_Fy_lbf: 60,
    county: 'miami_dade', isHVHZ: true,
  };

  it('low-slope zone band width is 0.6H and identical across both engines', () => {
    // Firm convention for low-slope roofs (matches the sealed reference reports).
    expect(getZoneWidth(inputs.h)).toBeCloseTo(0.6 * inputs.h, 6);
    const cc = computeFastenerCalc({
      V: inputs.V, h: inputs.h, W: inputs.buildingWidth, L: inputs.buildingLength,
      roofType: 'Flat', slopeDeg: 0, hasParapet: false,
      exposure: 'C', enclosure: 'ENCLOSED', riskCategory: 'II',
      Kzt: 1.0, Kd: 0.85, Ke: 1.0,
      manufacturer: '', noaNumber: '', noaPageRef: '', deckMaterial: 'plywood',
      insulationDesc: '', membraneDesc: '', designPressure: -75,
      rollWidth: 39.37, sideLap: 3, lapFastenerSpacing: 7, fieldFastenerSpacing: 7,
      lapRows: 1, fieldRows: 2,
    });
    expect(cc.zoneWidths.zone2).toBeCloseTo(0.6 * inputs.h, 1);
    expect(cc.zoneWidths.zone2).toBeCloseTo(getZoneWidth(inputs.h), 1);
  });

  it('RAS 117 zone pressures equal the RAS 128 procedure (same Kz, GCp)', () => {
    const { qh_ASD } = calcQhASD(inputs.V, inputs.exposureCategory, inputs.h, inputs.Kzt, inputs.Kd, inputs.Ke);
    const zp = getZonePressures(inputs, qh_ASD, 10);
    const r128 = computeRAS128Pressures({
      V: inputs.V, exposure: inputs.exposureCategory, h: inputs.h,
      W: inputs.buildingWidth, L: inputs.buildingLength,
      Kzt: inputs.Kzt, Kd: inputs.Kd, Ke: inputs.Ke, enclosure: inputs.enclosure, ewa_ft2: 10,
    });
    expect(zp.zone1).toBeCloseTo(r128.Pasd_field, 1);
    expect(zp.zone2).toBeCloseTo(r128.Pasd_perimeter, 1);
    expect(zp.zone3).toBeCloseTo(r128.Pasd_corner, 1);
  });
});
