// FastenerCalc HVHZ — Calculation Engine v5.0
// FBC 8th Edition (2023) · ASCE 7-22 Ch. 30 C&C
// RAS 117-20 · TAS 105 · TAS 114 · TAS 124
// Low-slope (≤ 7°) mechanically attached or adhered roofing systems.
//
// Module layout:
//   zone-pressures.ts     — ASCE 7-22 qh, GCp, zone widths
//   noa-compatibility.ts  — RAS 117 §9.2 / §12.6 NOA MDP checks
//   tas-105.ts            — TAS 105 field withdrawal statistical reduction
//   base-sheet-engine.ts  — RAS 117 §10 anchor/base sheet attachment
//   insulation-engine.ts  — RAS 117 §9 insulation panel attachment
//   validation.ts         — pre-calc input validation
//   index.ts              — orchestrator (this file) + public re-exports

import type {
  FastenerInputs, FastenerOutputs, FastenerWarning, FastenerDerivation,
  FastenerZoneResult, InsulationZoneResult, NOAZoneResult, RAS128Summary, Zone,
} from './types';
import { calcQhASD, getZonePressures } from './zone-pressures';
import { checkNOACompatibility } from './noa-compatibility';
import { validateFastenerInputs } from './validation';
import { calculateBaseSheetZone } from './base-sheet-engine';
import { calcInsulationZone } from './insulation-engine';
import { computeRAS128Pressures, checkRAS128Prescriptive } from './ras128';

export * from './types';
export {
  getKh, getGCpByArea, getZoneWidth, getZonePressures, calcQhASD,
} from './zone-pressures';
export {
  computeRAS128Pressures, generateRAS128Table, checkRAS128Prescriptive,
  kzASCE, zoneDimA, gcpLowSlope,
  getRAS128Table, lookupRAS128Table,
  RAS128_TABLE_1_EXP_C, RAS128_TABLE_2_EXP_D,
  RAS128_TABLE_V_MPH, RAS128_TABLE_RISK_CATEGORY, RAS128_TABLE_MAX_SLOPE,
} from './ras128';
export type {
  RAS128Inputs, RAS128Result, RAS128ZonePressure, RAS128TableRow,
  RAS128TableOptions, RAS128PrescriptiveCheck, RAS128TableEntry,
} from './ras128';
export { checkNOACompatibility } from './noa-compatibility';
export { calculateTAS105, isTAS105Required, getTFactor } from './tas-105';
export { solveRowsAndFS, calculateBaseSheetZone } from './base-sheet-engine';
export { calcInsulationZone } from './insulation-engine';
export { validateFastenerInputs } from './validation';
export {
  FASTENER_INPUT_SPECS, checkFastenerInputs, techRequiredKeys, isInputProvided,
} from './required-inputs';
export type {
  FastenerInputSpec, FastenerInputStatus, FastenerInputCheck, InputStage,
} from './required-inputs';

const ZONES: Zone[] = ["1'", '1', '2', '3'];

export function calculateFastener(inputs: FastenerInputs): FastenerOutputs {
  const warnings = validateFastenerInputs(inputs);
  const { qh_ASD, Kh } = calcQhASD(inputs.V, inputs.exposureCategory, inputs.h, inputs.Kzt, inputs.Kd, inputs.Ke);
  const GCpi = inputs.enclosure === 'partially_enclosed' ? 0.55 : inputs.enclosure === 'enclosed' ? 0.18 : 0;

  const ewa_m = inputs.ewa_membrane_ft2 ?? 10;
  const ewa_i = inputs.ewa_insulation_ft2 ?? (inputs.boardLength_ft * inputs.boardWidth_ft);

  const mdp_eff = inputs.noa.mdp_basis === 'ultimate' ? inputs.noa.mdp_psf / 2 : inputs.noa.mdp_psf;
  if (inputs.noa.mdp_basis === 'ultimate') {
    warnings.push({
      level: 'info',
      message: `Ultimate MDP (${inputs.noa.mdp_psf} psf) converted to ASD: ${mdp_eff} psf (÷2 per TAS 114).`,
      reference: 'TAS 114',
    });
  }

  const zp = getZonePressures(inputs, qh_ASD, ewa_m);
  const zpMap: Record<string, number> = { "1'": zp.zone1prime, '1': zp.zone1, '2': zp.zone2, '3': zp.zone3 };
  const noaResults = checkNOACompatibility(zpMap, mdp_eff, inputs.noa.asterisked);

  for (const nr of noaResults) {
    if (nr.basis === 'exceeds_300pct') {
      warnings.push({
        level: 'warning',
        message: `Zone ${nr.zone}: pressure ratio ${nr.extrapFactor.toFixed(2)}× NOA MDP exceeds 3.00×. RAS 117 §9.2: additional testing may be required by the building official.`,
        reference: 'RAS 117 §9.2',
      });
    }
    if (nr.basis === 'asterisked_fail') {
      warnings.push({
        level: 'error',
        message: `Asterisked assembly: Zone ${nr.zone} pressure exceeds NOA MDP. Extrapolation not permitted.`,
        reference: 'NOA',
      });
    }
  }
  if (noaResults.every(nr => nr.basis === 'prescriptive')) {
    warnings.push({
      level: 'info',
      message: 'All zones within NOA MDP. Prescriptive attachment pattern may be used throughout.',
      reference: 'NOA',
    });
  }

  const derivation = buildDerivation(inputs, Kh, qh_ASD, GCpi);

  // ── RAS 128 — applicable low-slope ASD pressures (Pasd = 0.6 × Pult) ────────
  const ras128 = buildRAS128Summary(inputs, ewa_m, mdp_eff, warnings);

  // ── Insulation per §9 ────────────────────────────────────────────────
  const boardArea = inputs.boardLength_ft * inputs.boardWidth_ft;
  const zp_ins = getZonePressures(inputs, qh_ASD, ewa_i);
  const insMap: Record<string, number> = {
    "1'": zp_ins.zone1prime, '1': zp_ins.zone1, '2': zp_ins.zone2, '3': zp_ins.zone3,
  };
  const f_y_ins = inputs.insulation_Fy_lbf || inputs.Fy_lbf;
  // The prescriptive minimum per §9 is the NOA's field-area pattern. We don't
  // yet take N_field as an explicit input; until the data model is updated,
  // pass 0 here so N_used = N_required from the rational analysis.
  const insulationResults: InsulationZoneResult[] = ZONES.map(z =>
    calcInsulationZone(z, insMap[z], boardArea, f_y_ins, 0),
  );

  // ── Adhered systems per §12 ──────────────────────────────────────────
  if (inputs.systemType === 'adhered') {
    // §12.6: "No extrapolation for the elevated pressure zones, as defined by
    // ASCE 7, shall be allowed in adhered roof assemblies."
    for (const nr of noaResults) {
      if (Math.abs(nr.P_psf) > Math.abs(mdp_eff)) {
        warnings.push({
          level: 'error',
          message: `Adhered system: Zone ${nr.zone} pressure (${Math.abs(nr.P_psf).toFixed(1)} psf) exceeds NOA MDP (${Math.abs(mdp_eff).toFixed(1)} psf). RAS 117 §12.6 prohibits extrapolation — select a higher-MDP assembly or commission TAS 124 testing per §12.6.1 (1.45:1 margin of safety).`,
          reference: 'RAS 117 §12.6',
        });
      }
    }
    warnings.push({
      level: 'info',
      message: 'Adhered membrane: verify NOA listed adhesive bond strength ≥ each zone pressure. RAS 117 §12.2 requires ≥ 85% panel-to-substrate contact unless an intermittent pattern is specified by the assembly Product Approval.',
      reference: 'RAS 117 §12.2',
    });

    const maxE = Math.max(...noaResults.map(r => r.extrapFactor), 0);
    const hasErr = warnings.some(w => w.level === 'error');
    const hasWarn = warnings.some(w => w.level === 'warning');
    return {
      qh_ASD: round2(qh_ASD), Kh: round3(Kh), GCpi,
      zonePressures: zp, ras128,
      fastenerResults: [], insulationResults, noaResults, warnings,
      maxExtrapolationFactor: round2(maxE),
      halfSheetZones: [],
      minFS_in: 0,
      overallStatus: hasErr ? 'fail' : hasWarn ? 'warning' : 'ok',
      ewa_membrane_ft2: ewa_m, ewa_insulation_ft2: ewa_i,
      derivation,
    };
  }

  // ── Base sheet / anchor sheet per §10 ────────────────────────────────
  const fastenerResults: FastenerZoneResult[] = ZONES.map(zone =>
    calculateBaseSheetZone(zone, zpMap[zone], {
      Fy_lbf: inputs.Fy_lbf,
      sheetWidth_in: inputs.sheetWidth_in,
      lapWidth_in: inputs.lapWidth_in,
      initialRows: inputs.initialRows,
      deckType: inputs.deckType,
    }, noaResults.find(nr => nr.zone === zone)!, warnings),
  );

  const maxE = Math.max(...noaResults.map(r => r.extrapFactor), 0);
  const minFS = Math.min(...fastenerResults.map(r => r.FS_used_in));
  const hasErr = warnings.some(w => w.level === 'error');
  const hasWarn = warnings.some(w => w.level === 'warning');
  return {
    qh_ASD: round2(qh_ASD), Kh: round3(Kh), GCpi,
    zonePressures: zp, ras128,
    fastenerResults, insulationResults, noaResults, warnings,
    maxExtrapolationFactor: round2(maxE),
    halfSheetZones: [],
    minFS_in: minFS,
    overallStatus: hasErr ? 'fail' : hasWarn ? 'warning' : 'ok',
    ewa_membrane_ft2: ewa_m, ewa_insulation_ft2: ewa_i,
    derivation,
  };
}

function buildRAS128Summary(
  inputs: FastenerInputs,
  ewa_ft2: number,
  mdp_eff_psf: number,
  warnings: FastenerWarning[],
): RAS128Summary {
  const r = computeRAS128Pressures({
    V: inputs.V,
    exposure: inputs.exposureCategory,
    h: inputs.h + (inputs.parapetHeight ?? 0),
    W: inputs.buildingWidth,
    L: inputs.buildingLength,
    Kzt: inputs.Kzt,
    Kd: inputs.Kd,
    Ke: inputs.Ke,
    enclosure: inputs.enclosure,
    ewa_ft2,
  });
  const governing = r.zones.reduce((worst, z) =>
    Math.abs(z.Pasd) > Math.abs(worst.Pasd) ? z : worst, r.zones[0]);
  const presc = checkRAS128Prescriptive(r, mdp_eff_psf);

  warnings.push({
    level: presc.qualifies ? 'info' : 'warning',
    message: presc.message,
    reference: 'RAS 128-20',
  });

  return {
    Pasd_field: r.Pasd_field,
    Pasd_perimeter: r.Pasd_perimeter,
    Pasd_corner: r.Pasd_corner,
    qh_ult: r.qh_ult,
    a_ft: r.a_ft,
    governingZone: governing.zone,
    governingPasd: governing.Pasd,
    qualifiesPrescriptive: presc.qualifies,
    message: presc.message,
    derivation: r.derivation,
  };
}

function buildDerivation(inputs: FastenerInputs, Kh: number, qh_ASD: number, GCpi: number): FastenerDerivation {
  const qh_lrfd = 0.00256 * Kh * inputs.Kzt * inputs.Ke * inputs.V * inputs.V;
  return {
    eq_26_10_1: `qh = 0.00256 × ${Kh.toFixed(3)} × ${inputs.Kzt} × ${inputs.Ke} × ${inputs.V}² = ${qh_lrfd.toFixed(2)} psf [ASCE 7-22 Eq. 26.10-1]`,
    qh_asd: `qh,ASD = ${qh_lrfd.toFixed(2)} × 0.6 = ${qh_ASD.toFixed(2)} psf [ASCE 7-22 ASD factor]`,
    eq_30_3_1: `p = qh,ASD × (GCp − GCpi) = ${qh_ASD.toFixed(2)} × (GCp − ${GCpi.toFixed(2)}) [ASCE 7-22 Eq. 30.3-1]`,
    ras117_fs: `FS = (f_y × 144) / (|P| × RS), RS = NW / n [RAS 117 §10.4.5]`,
  };
}

function round2(x: number): number { return Math.round(x * 100) / 100; }
function round3(x: number): number { return Math.round(x * 1000) / 1000; }
