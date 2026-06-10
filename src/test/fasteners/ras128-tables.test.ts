// Validates the verbatim RAS 128-20 Table 1 (Exp C) & Table 2 (Exp D) against
// our ASCE 7-22 procedure, and exercises the lookup.
//
// Source: 2023 FBC Test Protocols for HVHZ, 8th Ed., RAS 128-20, Tables 1 & 2
// (Risk Cat II, slope < 1½:12, V = 175 mph). Transcribed from codes.iccsafe.org.

import { describe, expect, it } from 'vitest';
import {
  computeRAS128Pressures,
  getRAS128Table,
  lookupRAS128Table,
  RAS128_TABLE_1_EXP_C,
  RAS128_TABLE_2_EXP_D,
  RAS128_TABLE_V_MPH,
  type RAS128TableEntry,
} from '@/lib/fasteners/ras128';

// Round magnitude to nearest whole psf (half away from zero), as the table does.
const r = (x: number) => -Math.round(Math.abs(x) - 1e-9);

function computedRow(exposure: 'C' | 'D', h: number): [number, number, number, number] {
  const res = computeRAS128Pressures({
    V: RAS128_TABLE_V_MPH, exposure, h, W: 1000, L: 1000,
    Kzt: 1, Kd: 0.85, Ke: 1, enclosure: 'enclosed', ewa_ft2: 10,
  });
  const z1p = res.zones.find(z => z.zone === "1'")!.Pasd;
  return [r(z1p), r(res.Pasd_field), r(res.Pasd_perimeter), r(res.Pasd_corner)];
}

function compare(exposure: 'C' | 'D', table: RAS128TableEntry[]) {
  let exact = 0, total = 0;
  for (const row of table) {
    const [c1p, c1, c2, c3] = computedRow(exposure, row.maxEaveHeight);
    const printed = [row.zone1prime, row.zone1, row.zone2, row.zone3];
    [c1p, c1, c2, c3].forEach((c, i) => {
      total++;
      // Procedure must reproduce the published value within 1 psf everywhere.
      expect(Math.abs(c - printed[i])).toBeLessThanOrEqual(1);
      if (c === printed[i]) exact++;
    });
  }
  return { exact, total };
}

describe('RAS 128 published tables — procedure reproduces the printed values', () => {
  it('Table 1 (Exposure C): every cell within 1 psf, ≥ 36/40 exact', () => {
    const { exact, total } = compare('C', RAS128_TABLE_1_EXP_C);
    expect(total).toBe(40);
    expect(exact).toBeGreaterThanOrEqual(36);
  });

  it('Table 2 (Exposure D): every cell within 1 psf, ≥ 36/40 exact', () => {
    const { exact, total } = compare('D', RAS128_TABLE_2_EXP_D);
    expect(total).toBe(40);
    expect(exact).toBeGreaterThanOrEqual(36);
  });

  it('combined exact match is ≥ 77/80 (3 half-psf boundary cells differ by 1)', () => {
    const c = compare('C', RAS128_TABLE_1_EXP_C);
    const d = compare('D', RAS128_TABLE_2_EXP_D);
    expect(c.exact + d.exact).toBeGreaterThanOrEqual(77);
  });
});

describe('RAS 128 table structure & lookup', () => {
  it('each table has 10 eave-height bands up to 60 ft', () => {
    expect(RAS128_TABLE_1_EXP_C).toHaveLength(10);
    expect(RAS128_TABLE_2_EXP_D).toHaveLength(10);
    expect(RAS128_TABLE_1_EXP_C[9].maxEaveHeight).toBe(60);
  });

  it('corner > perimeter > field > field-interior (magnitude) in every row', () => {
    for (const row of [...RAS128_TABLE_1_EXP_C, ...RAS128_TABLE_2_EXP_D]) {
      expect(Math.abs(row.zone3)).toBeGreaterThan(Math.abs(row.zone2));
      expect(Math.abs(row.zone2)).toBeGreaterThan(Math.abs(row.zone1));
      expect(Math.abs(row.zone1)).toBeGreaterThan(Math.abs(row.zone1prime));
    }
  });

  it('Exposure D pressures exceed Exposure C at every band', () => {
    for (let i = 0; i < RAS128_TABLE_1_EXP_C.length; i++) {
      expect(Math.abs(RAS128_TABLE_2_EXP_D[i].zone3)).toBeGreaterThan(Math.abs(RAS128_TABLE_1_EXP_C[i].zone3));
    }
  });

  it('getRAS128Table selects Table 1 for C and Table 2 for D', () => {
    expect(getRAS128Table('C')).toBe(RAS128_TABLE_1_EXP_C);
    expect(getRAS128Table('D')).toBe(RAS128_TABLE_2_EXP_D);
  });

  it('lookupRAS128Table returns the band containing the eave height', () => {
    expect(lookupRAS128Table('C', 15)).toEqual(RAS128_TABLE_1_EXP_C[0]);   // ≤ 15
    expect(lookupRAS128Table('C', 15.1)?.maxEaveHeight).toBe(20);          // > 15 to ≤ 20
    expect(lookupRAS128Table('C', 47)?.maxEaveHeight).toBe(50);            // > 45 to ≤ 50
    expect(lookupRAS128Table('D', 60)?.maxEaveHeight).toBe(60);
  });

  it('returns null above 60 ft (table not applicable)', () => {
    expect(lookupRAS128Table('C', 61)).toBeNull();
  });

  it('matches the sealed Coral Springs report (Exp C, ≤15 ft): -37/-64/-84/-115', () => {
    const row = lookupRAS128Table('C', 15)!;
    expect([row.zone1prime, row.zone1, row.zone2, row.zone3]).toEqual([-37, -64, -84, -115]);
  });
});
