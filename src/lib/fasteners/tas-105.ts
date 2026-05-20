// TAS 105 — Field Withdrawal Resistance Test analysis.
// Statistical reduction of field test data to a characteristic withdrawal value.

import type { DeckType, ConstructionType, TAS105Inputs, TAS105Outputs } from './types';

// One-sided 95% Student's t factors. NOTE: TAS 105-20 may require a one-sided
// TOLERANCE-limit K-factor rather than a confidence interval on the mean — the
// two are not interchangeable and K-factors are materially larger than t-factors
// at the same n. Flagged for PE review against TAS 105-20 PDF.
const T_TABLE: Record<number, number> = {
  3: 2.920, 4: 2.353, 5: 2.132, 6: 2.015, 7: 1.943, 8: 1.895, 9: 1.860,
  10: 1.833, 11: 1.812, 12: 1.796, 15: 1.761, 20: 1.725, 25: 1.708, 30: 1.697,
};

export function getTFactor(n: number): number {
  if (n <= 2) return 3.078;
  if (n >= 30) return 1.645;
  if (T_TABLE[n]) return T_TABLE[n];
  const keys = Object.keys(T_TABLE).map(Number).sort((a, b) => a - b);
  const upper = keys.find(k => k >= n)!, lower = [...keys].reverse().find(k => k <= n)!;
  return T_TABLE[lower] + ((n - lower) / (upper - lower)) * (T_TABLE[upper] - T_TABLE[lower]);
}

export function calculateTAS105(inputs: TAS105Inputs): TAS105Outputs {
  const n = inputs.rawValues_lbf.length;
  if (n === 0) return { n: 0, mean_lbf: 0, stdDev_lbf: 0, tFactor: 0, MCRF_lbf: 0, pass: false };
  const mean = inputs.rawValues_lbf.reduce((a, b) => a + b, 0) / n;
  const variance = inputs.rawValues_lbf.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance || 0);
  const tFactor = getTFactor(n);
  const MCRF = mean - tFactor * stdDev;
  return {
    n,
    mean_lbf: Math.round(mean * 10) / 10,
    stdDev_lbf: Math.round(stdDev * 10) / 10,
    tFactor,
    MCRF_lbf: Math.round(MCRF * 10) / 10,
    pass: MCRF >= 275,
  };
}

export function isTAS105Required(
  deckType: DeckType,
  constructionType: ConstructionType,
): { required: boolean; reason: string } {
  if (deckType === 'lw_concrete') {
    return { required: true, reason: 'LW insulating concrete requires TAS 105 field testing.' };
  }
  if (deckType === 'structural_concrete' && (constructionType === 'reroof' || constructionType === 'recover')) {
    return { required: true, reason: 'Structural concrete reroof/recover requires TAS 105.' };
  }
  if ((deckType === 'plywood' || deckType === 'wood_plank') && constructionType === 'recover') {
    return { required: true, reason: 'Wood deck recover requires TAS 105.' };
  }
  if (deckType === 'steel_deck' && constructionType === 'recover') {
    return { required: true, reason: 'Steel deck recover requires TAS 105.' };
  }
  return { required: false, reason: '' };
}
