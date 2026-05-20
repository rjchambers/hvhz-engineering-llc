// Base sheet / anchor sheet attachment per RAS 117-20 §10.
//
// §10.4.5 General Equation:  FS = (f_y × 144) / (P × RS)
//   where  f_y = "fastener value"  = MDP × (sq ft per fastener)   [§10.4.3]
//          RS  = row spacing       = net width / number of rows   [§10 NOTE]
//          FS  = fastener spacing in lap (in.), rounded DOWN to next whole inch
//   General guidance: side lap spacing should not exceed 12 in. o.c.
//
// Differences from the prior implementation:
//   - RS = NW / n   (was NW / (n-1) — verification against §10 worked example)
//   - FS rounded down to whole inch (was nearest 0.5 in.)
//   - No half-sheet fallback (§10 escalates by adding rows, not halving sheet)
//   - No hard 6 in. FS floor (§10 states a 12 in. max; no min stated)
//   - Steel deck FS in 6 in. increments per §10.1

import type {
  DeckType, FastenerWarning, FastenerZoneResult, NOAZoneResult, Zone,
} from './types';

export interface BaseSheetSolveResult {
  n: number;
  RS_in: number;
  FS_calc_in: number;
  FS_used_in: number;
  status: 'ok' | 'fail';
}

const FS_MAX_IN = 12;             // §10 general guidance: not to exceed 12 in. o.c.
const PRACTICAL_MIN_FS_IN = 6;    // industry practical install minimum; not from §10
const DEFAULT_MAX_ROWS = 6;

export function solveRowsAndFS(
  Fy: number,
  P: number,
  NW_in: number,
  initialN: number,
  options: { deckType?: DeckType; maxRows?: number } = {},
): BaseSheetSolveResult {
  const absP = Math.abs(P);
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;

  if (absP === 0) {
    const RS = NW_in / initialN;
    return { n: initialN, RS_in: round1(RS), FS_calc_in: FS_MAX_IN, FS_used_in: FS_MAX_IN, status: 'ok' };
  }

  for (let n = initialN; n <= maxRows; n++) {
    const RS = NW_in / n;                                    // §10 NOTE
    const FS_calc = (Fy * 144) / (absP * RS);                // §10.4.5
    const FS_floor = Math.floor(FS_calc);                    // §10: round down to next whole inch
    let FS_used = Math.min(FS_floor, FS_MAX_IN);             // §10: 12 in. cap

    if (options.deckType === 'steel_deck') {
      // §10.1: For steel deck applications, fastener spacing shall be in increments of 6 in. o.c.
      FS_used = Math.floor(FS_used / 6) * 6;
    }

    // If FS falls below the practical install minimum, try more rows.
    if (FS_used < PRACTICAL_MIN_FS_IN && n < maxRows) continue;

    if (FS_used < PRACTICAL_MIN_FS_IN) {
      return { n, RS_in: round1(RS), FS_calc_in: round1(FS_calc), FS_used_in: FS_used, status: 'fail' };
    }
    return { n, RS_in: round1(RS), FS_calc_in: round1(FS_calc), FS_used_in: FS_used, status: 'ok' };
  }
  // Unreachable given the loop bound, but TypeScript needs a return.
  const RS = NW_in / maxRows;
  return { n: maxRows, RS_in: round1(RS), FS_calc_in: 0, FS_used_in: 0, status: 'fail' };
}

function round1(x: number): number { return Math.round(x * 10) / 10; }

export interface BaseSheetZoneInputs {
  Fy_lbf: number;
  sheetWidth_in: number;
  lapWidth_in: number;
  initialRows: number;
  deckType: DeckType;
}

export function calculateBaseSheetZone(
  zone: Zone,
  P: number,
  inputs: BaseSheetZoneInputs,
  noaResult: NOAZoneResult,
  warnings: FastenerWarning[],
): FastenerZoneResult {
  const NW = inputs.sheetWidth_in - inputs.lapWidth_in;
  const result = solveRowsAndFS(inputs.Fy_lbf, P, NW, inputs.initialRows, { deckType: inputs.deckType });
  const A_f = (result.FS_used_in * result.RS_in) / 144;
  const F_demand = Math.abs(P) * A_f;
  const DR = inputs.Fy_lbf > 0 ? F_demand / inputs.Fy_lbf : 0;

  if (result.status === 'fail') {
    warnings.push({
      level: 'error',
      message: `Zone ${zone}: no row count up to the configured maximum produces a workable fastener spacing. Select a higher-capacity assembly or commission additional testing per RAS 117 §9.2.`,
      reference: 'RAS 117 §10',
    });
  } else if (result.n > 5) {
    warnings.push({
      level: 'warning',
      message: `More than 5 fastener rows in Zone ${zone}. Consider higher-capacity fastener or assembly.`,
      reference: 'RAS 117 §10',
    });
  }

  return {
    zone,
    P_psf: Math.round(Math.abs(P) * 100) / 100,
    n_rows: result.n,
    RS_in: result.RS_in,
    FS_calculated_in: result.FS_calc_in,
    FS_used_in: result.FS_used_in,
    halfSheetRequired: false,                  // §10 does not endorse half-sheets
    demandRatio: Math.round(DR * 1000) / 1000,
    A_fastener_ft2: Math.round(A_f * 1000) / 1000,
    F_demand_lbf: Math.round(F_demand * 10) / 10,
    noaCheck: noaResult,
  };
}
