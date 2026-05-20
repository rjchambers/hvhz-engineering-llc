// RAS 117-20 §9.2 / §12.6 — NOA MDP compatibility checks.

import { describe, expect, it } from 'vitest';
import { checkNOACompatibility } from '@/lib/fasteners/noa-compatibility';

describe('NOA compatibility checks', () => {
  it('Within MDP → prescriptive', () => {
    const r = checkNOACompatibility({ '1': -30 }, -45, false);
    expect(r[0].basis).toBe('prescriptive');
    expect(r[0].blocksCalculation).toBe(false);
  });

  it('Between 1× and 3× MDP, non-asterisked → rational_analysis', () => {
    const r = checkNOACompatibility({ '2': -84 }, -45, false);
    expect(r[0].basis).toBe('rational_analysis');
    expect(r[0].blocksCalculation).toBe(false);
  });

  it('Above 3× MDP → warning, NOT a hard block per §9.2', () => {
    // §9.2 says additional testing "may be required" — not "prohibited".
    const r = checkNOACompatibility({ '3': -150 }, -45, false);
    expect(r[0].basis).toBe('exceeds_300pct');
    expect(r[0].blocksCalculation).toBe(false);
  });

  it('Asterisked assembly: above MDP → blocked', () => {
    const r = checkNOACompatibility({ '3': -50 }, -45, true);
    expect(r[0].basis).toBe('asterisked_fail');
    expect(r[0].blocksCalculation).toBe(true);
  });
});
