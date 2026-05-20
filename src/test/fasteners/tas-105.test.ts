// TAS 105 — basic statistical sanity checks.
// NOTE: the K-factor vs t-factor question is flagged for PE review against
// the actual TAS 105-20 PDF — see FASTENER_ENGINE_RAS117_VERIFICATION.md §5.

import { describe, expect, it } from 'vitest';
import { calculateTAS105, isTAS105Required } from '@/lib/fasteners/tas-105';

describe('TAS 105 statistical reduction', () => {
  it('Computes mean, stdDev, and MCRF for a known dataset', () => {
    const r = calculateTAS105({ rawValues_lbf: [320, 340, 360, 350, 330] });
    expect(r.n).toBe(5);
    expect(r.mean_lbf).toBeCloseTo(340, 1);
    expect(r.stdDev_lbf).toBeGreaterThan(0);
    expect(r.MCRF_lbf).toBeLessThan(r.mean_lbf);
  });

  it('Flags MCRF < 275 lbf as a failed test', () => {
    const r = calculateTAS105({ rawValues_lbf: [250, 260, 240, 270, 230] });
    expect(r.pass).toBe(false);
  });

  it('Flags MCRF ≥ 275 lbf as a passed test', () => {
    const r = calculateTAS105({ rawValues_lbf: [400, 410, 395, 405, 415] });
    expect(r.pass).toBe(true);
  });

  it('Handles empty input gracefully', () => {
    const r = calculateTAS105({ rawValues_lbf: [] });
    expect(r.n).toBe(0);
    expect(r.pass).toBe(false);
  });
});

describe('isTAS105Required deck/construction matrix', () => {
  it('LW concrete always requires TAS 105', () => {
    expect(isTAS105Required('lw_concrete', 'new').required).toBe(true);
  });

  it('Wood deck recover requires TAS 105', () => {
    expect(isTAS105Required('plywood', 'recover').required).toBe(true);
  });

  it('Structural concrete reroof requires TAS 105', () => {
    expect(isTAS105Required('structural_concrete', 'reroof').required).toBe(true);
  });

  it('New plywood does not require TAS 105', () => {
    expect(isTAS105Required('plywood', 'new').required).toBe(false);
  });
});
