// FastenerCalc HVHZ — Calculation Engine v4.0
// FBC 8th Edition (2023) · ASCE 7-22 Ch. 30 C&C
// RAS 117 · 128 · 137 · TAS 105
// Low-slope (≤ 7°) mechanically attached roofing systems ONLY

export type RoofSystemType = 'modified_bitumen' | 'single_ply' | 'adhered';
export type DeckType = 'plywood' | 'structural_concrete' | 'steel_deck' | 'wood_plank' | 'lw_concrete';
export type ConstructionType = 'new' | 'reroof' | 'recover';
export type ZoneAttachmentBasis = 'prescriptive' | 'rational_analysis' | 'exceeds_300pct' | 'asterisked_fail';

export interface NOAParams {
  approvalType: 'miami_dade_noa' | 'fl_product_approval';
  approvalNumber: string;
  manufacturer?: string;
  productName?: string;
  systemNumber?: string;
  mdp_psf: number;
  mdp_basis?: 'asd' | 'ultimate';
  asterisked: boolean;
}

export interface FastenerInputs {
  V: number;
  exposureCategory: 'B' | 'C' | 'D';
  h: number;
  Kzt: number;
  Kd: number;
  Ke: number;
  enclosure: 'enclosed' | 'partially_enclosed' | 'open';
  riskCategory: 'I' | 'II' | 'III' | 'IV';
  buildingLength: number;
  buildingWidth: number;
  parapetHeight: number;
  systemType: RoofSystemType;
  deckType: DeckType;
  constructionType: ConstructionType;
  existingLayers: number;
  sheetWidth_in: number;
  lapWidth_in: number;
  Fy_lbf: number;
  fySource: 'noa' | 'tas105';
  initialRows: number;
  noa: NOAParams;
  boardLength_ft: number;
  boardWidth_ft: number;
  insulation_Fy_lbf: number;
  county: 'miami_dade' | 'broward' | 'other';
  isHVHZ: boolean;
  ewa_membrane_ft2?: number;
  ewa_insulation_ft2?: number;
}

export interface FastenerWarning {
  level: 'error' | 'warning' | 'info';
  message: string;
  reference?: string;
}

export interface ZonePressures {
  zone1prime: number;
  zone1: number;
  zone2: number;
  zone3: number;
  zoneWidth_ft: number;
  zone3_depth_ft: number;
  zone3_length_ft: number;
}

export interface NOAZoneResult {
  zone: string;
  P_psf: number;
  MDP_psf: number;
  extrapFactor: number;
  basis: ZoneAttachmentBasis;
  message: string;
  blocksCalculation: boolean;
}

export interface FastenerZoneResult {
  zone: string;
  P_psf: number;
  n_rows: number;
  RS_in: number;
  FS_calculated_in: number;
  FS_used_in: number;
  halfSheetRequired: boolean;
  demandRatio: number;
  A_fastener_ft2: number;
  F_demand_lbf: number;
  noaCheck: NOAZoneResult;
}

export interface InsulationZoneResult {
  zone: string;
  P_psf: number;
  N_required: number;
  N_prescribed: number;
  N_used: number;
  layout: string;
}

export interface TAS105Inputs {
  rawValues_lbf: number[];
  testingAgency?: string;
  testDate?: string;
  deckConditionNotes?: string;
  testLocationDescription?: string;
}

export interface TAS105Outputs {
  n: number;
  mean_lbf: number;
  stdDev_lbf: number;
  tFactor: number;
  MCRF_lbf: number;
  pass: boolean;
}

export interface FastenerDerivation {
  eq_26_10_1: string;
  qh_asd: string;
  eq_30_3_1: string;
  ras117_fs: string;
}

export interface FastenerOutputs {
  qh_ASD: number;
  Kh: number;
  GCpi: number;
  zonePressures: ZonePressures;
  fastenerResults: FastenerZoneResult[];
  insulationResults: InsulationZoneResult[];
  noaResults: NOAZoneResult[];
  warnings: FastenerWarning[];
  maxExtrapolationFactor: number;
  halfSheetZones: string[];
  minFS_in: number;
  overallStatus: 'ok' | 'warning' | 'fail';
  ewa_membrane_ft2: number;
  ewa_insulation_ft2: number;
  derivation: FastenerDerivation;
}

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

export function getZoneWidth(h: number): number { return 0.6 * h; }

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

export function checkNOACompatibility(zonePressures: Record<string, number>, mdp_psf: number, asterisked: boolean): NOAZoneResult[] {
  return Object.entries(zonePressures).map(([zone, P]) => {
    const P_abs = Math.abs(P), MDP_abs = Math.abs(mdp_psf);
    const factor = MDP_abs > 0 ? P_abs / MDP_abs : 999;
    if (P_abs <= MDP_abs) return { zone, P_psf: P, MDP_psf: mdp_psf, extrapFactor: factor, basis: 'prescriptive' as const, message: 'Within NOA MDP. Use prescriptive pattern.', blocksCalculation: false };
    if (asterisked) return { zone, P_psf: P, MDP_psf: mdp_psf, extrapFactor: factor, basis: 'asterisked_fail' as const, message: 'Asterisked assembly: extrapolation not permitted. MDP must meet zone pressure.', blocksCalculation: true };
    if (factor > 3.0) return { zone, P_psf: P, MDP_psf: mdp_psf, extrapFactor: factor, basis: 'exceeds_300pct' as const, message: `Zone pressure exceeds 3.0× MDP limit (${factor.toFixed(2)}×). Select higher-MDP assembly or install half-sheets.`, blocksCalculation: true };
    return { zone, P_psf: P, MDP_psf: mdp_psf, extrapFactor: factor, basis: 'rational_analysis' as const, message: `RAS 117 rational analysis. Extrapolation factor: ${factor.toFixed(2)}× (limit: 3.00×).`, blocksCalculation: false };
  });
}

export function solveRowsAndFS(Fy: number, P: number, NW_in: number, initialN: number): { n: number; RS: number; FS: number; halfSheet: boolean } {
  const absP = Math.abs(P);
  if (absP === 0) return { n: initialN, RS: NW_in / (initialN - 1), FS: 12, halfSheet: false };
  let n = initialN;
  while (n <= 6) {
    const RS = NW_in / (n - 1), FS = (Fy * 144) / (absP * RS);
    if (FS >= 6.0) return { n, RS: Math.round(RS * 10) / 10, FS: Math.round(FS * 10) / 10, halfSheet: false };
    n++;
  }
  const halfNW = NW_in / 2; n = initialN;
  while (n <= 6) {
    const RS = halfNW / (n - 1), FS = (Fy * 144) / (absP * RS);
    if (FS >= 6.0) return { n, RS: Math.round(RS * 10) / 10, FS: Math.round(FS * 10) / 10, halfSheet: true };
    n++;
  }
  const RS = halfNW / 5, FS = (Fy * 144) / (absP * RS);
  return { n: 6, RS: Math.round(RS * 10) / 10, FS: Math.round(FS * 10) / 10, halfSheet: true };
}

const T_TABLE: Record<number, number> = { 3:2.920,4:2.353,5:2.132,6:2.015,7:1.943,8:1.895,9:1.860,10:1.833,11:1.812,12:1.796,15:1.761,20:1.725,25:1.708,30:1.697 };

function getTFactor(n: number): number {
  if (n <= 2) return 3.078; if (n >= 30) return 1.645;
  if (T_TABLE[n]) return T_TABLE[n];
  const keys = Object.keys(T_TABLE).map(Number).sort((a,b)=>a-b);
  const upper = keys.find(k=>k>=n)!, lower = [...keys].reverse().find(k=>k<=n)!;
  return T_TABLE[lower] + ((n - lower) / (upper - lower)) * (T_TABLE[upper] - T_TABLE[lower]);
}

export function calculateTAS105(inputs: TAS105Inputs): TAS105Outputs {
  const n = inputs.rawValues_lbf.length;
  if (n === 0) return { n:0, mean_lbf:0, stdDev_lbf:0, tFactor:0, MCRF_lbf:0, pass:false };
  const mean = inputs.rawValues_lbf.reduce((a,b)=>a+b,0)/n;
  const variance = inputs.rawValues_lbf.reduce((s,v)=>s+(v-mean)**2,0)/(n-1);
  const stdDev = Math.sqrt(variance||0), tFactor = getTFactor(n), MCRF = mean - tFactor*stdDev;
  return { n, mean_lbf:Math.round(mean*10)/10, stdDev_lbf:Math.round(stdDev*10)/10, tFactor, MCRF_lbf:Math.round(MCRF*10)/10, pass:MCRF>=275 };
}

export function isTAS105Required(deckType: DeckType, constructionType: ConstructionType): { required: boolean; reason: string } {
  if (deckType==='lw_concrete') return { required:true, reason:'LW insulating concrete requires TAS 105 field testing.' };
  if (deckType==='structural_concrete'&&(constructionType==='reroof'||constructionType==='recover')) return { required:true, reason:'Structural concrete reroof/recover requires TAS 105.' };
  if ((deckType==='plywood'||deckType==='wood_plank')&&constructionType==='recover') return { required:true, reason:'Wood deck recover requires TAS 105.' };
  if (deckType==='steel_deck'&&constructionType==='recover') return { required:true, reason:'Steel deck recover requires TAS 105.' };
  return { required:false, reason:'' };
}

function calcInsulation(P: number, boardArea: number, Fy: number, zone: string): InsulationZoneResult {
  const N_req = Math.ceil((Math.abs(P)*boardArea)/Fy), N_pres = boardArea>=28?4:2, N_used = Math.max(N_req,N_pres);
  const layout = N_used<=4?'2×2':N_used<=6?'2×3':N_used<=9?'3×3':N_used<=12?'3×4':'4×4';
  return { zone, P_psf:Math.round(Math.abs(P)*100)/100, N_required:N_req, N_prescribed:N_pres, N_used, layout };
}

export function validateFastenerInputs(inputs: FastenerInputs): FastenerWarning[] {
  const w: FastenerWarning[] = [];
  if (inputs.isHVHZ && inputs.exposureCategory!=='C') w.push({level:'error',message:'HVHZ requires Exposure Category C per FBC §1620 and ASCE 7-22 §26.7.3.',reference:'§26.7.3'});
  if (inputs.h>60) w.push({level:'error',message:'Ch. 30 Envelope Procedure limited to h ≤ 60 ft.',reference:'§30.1'});
  if (inputs.constructionType==='recover'&&inputs.existingLayers>1) w.push({level:'error',message:'FBC §1521 prohibits recover over more than one existing roof layer in HVHZ.',reference:'§1521'});
  if (inputs.isHVHZ&&inputs.V<150) w.push({level:'error',message:`Design wind speed ${inputs.V} mph below HVHZ minimum. FBC §1620.1 requires 150 mph min for Risk Cat II.`,reference:'FBC §1620.1'});
  const tas105 = isTAS105Required(inputs.deckType, inputs.constructionType);
  if (tas105.required&&inputs.fySource!=='tas105') w.push({level:inputs.deckType==='lw_concrete'?'error':'warning',message:tas105.reason+' Enter TAS 105 test results.',reference:'TAS 105'});
  if (!inputs.noa.mdp_psf) w.push({level:'error',message:'NOA Maximum Design Pressure (MDP) is required.',reference:'NOA'});
  if (Math.abs(inputs.noa.mdp_psf)>200) w.push({level:'warning',message:`NOA MDP ${Math.abs(inputs.noa.mdp_psf)} psf is unusually high. Confirm this is ASD-level MDP, not ultimate test pressure.`,reference:'TAS 114'});
  if (inputs.enclosure==='partially_enclosed') w.push({level:'info',message:'GCpi = ±0.55 applied. Verify opening ratios per §26.12.3.',reference:'§26.12.3'});
  if (inputs.parapetHeight>0) w.push({level:'info',message:'Parapet present. Zone 3 corners start at inside face of parapet per ASCE 7-22 §26.2.',reference:'§26.2'});
  if (inputs.county==='miami_dade') w.push({level:'info',message:'Miami-Dade HVHZ requires a Miami-Dade NOA (Notice of Acceptance).',reference:'NOA'});
  return w;
}

export function calculateFastener(inputs: FastenerInputs): FastenerOutputs {
  const warnings = validateFastenerInputs(inputs);
  const Kh = getKh(inputs.exposureCategory, inputs.h);
  const qh_ASD = 0.00256*Kh*inputs.Kzt*inputs.Kd*inputs.Ke*inputs.V*inputs.V*0.6;
  const GCpi = inputs.enclosure==='partially_enclosed'?0.55:inputs.enclosure==='enclosed'?0.18:0;
  const ewa_m = inputs.ewa_membrane_ft2??10;
  const ewa_i = inputs.ewa_insulation_ft2??(inputs.boardLength_ft*inputs.boardWidth_ft);
  const mdp_eff = inputs.noa.mdp_basis==='ultimate'?inputs.noa.mdp_psf/2:inputs.noa.mdp_psf;
  if (inputs.noa.mdp_basis==='ultimate') warnings.push({level:'info',message:`Ultimate MDP (${inputs.noa.mdp_psf} psf) converted to ASD: ${mdp_eff} psf (÷2 per TAS 114).`,reference:'TAS 114'});

  const zp = getZonePressures(inputs, qh_ASD, ewa_m);
  const zpMap: Record<string,number> = {"1'":zp.zone1prime,'1':zp.zone1,'2':zp.zone2,'3':zp.zone3};
  const noaResults = checkNOACompatibility(zpMap, mdp_eff, inputs.noa.asterisked);

  for (const nr of noaResults) {
    if (nr.basis==='exceeds_300pct') warnings.push({level:'error',message:`Zone ${nr.zone}: pressure (${Math.abs(nr.P_psf).toFixed(1)} psf) exceeds 3.0× NOA MDP. Install half-sheets or select higher-MDP assembly.`,reference:'RAS 137 §6.1.3'});
    if (nr.basis==='asterisked_fail') warnings.push({level:'error',message:`Asterisked assembly: Zone ${nr.zone} pressure exceeds NOA MDP. Extrapolation not permitted.`,reference:'NOA'});
  }
  if (noaResults.every(nr=>nr.basis==='prescriptive')) warnings.push({level:'info',message:'All zones within NOA MDP. Prescriptive attachment pattern may be used throughout.',reference:'NOA'});

  const qh_lrfd = 0.00256*Kh*inputs.Kzt*inputs.Ke*inputs.V*inputs.V;
  const derivation: FastenerDerivation = {
    eq_26_10_1:`qh = 0.00256 × ${Kh.toFixed(3)} × ${inputs.Kzt} × ${inputs.Ke} × ${inputs.V}² = ${qh_lrfd.toFixed(2)} psf [ASCE 7-22 Eq. 26.10-1]`,
    qh_asd:`qh,ASD = ${qh_lrfd.toFixed(2)} × 0.6 = ${qh_ASD.toFixed(2)} psf [ASCE 7-22 ASD factor]`,
    eq_30_3_1:`p = qh,ASD × (GCp − GCpi) = ${qh_ASD.toFixed(2)} × (GCp − ${GCpi.toFixed(2)}) [ASCE 7-22 Eq. 30.3-1]`,
    ras117_fs:`FS = (Fy × 144) / (|P| × RS) [RAS 117 §6 rational analysis]`,
  };

  const boardArea = inputs.boardLength_ft*inputs.boardWidth_ft;
  const zp_ins = getZonePressures(inputs, qh_ASD, ewa_i);
  const insMap: Record<string,number> = {"1'":zp_ins.zone1prime,'1':zp_ins.zone1,'2':zp_ins.zone2,'3':zp_ins.zone3};
  const insulationResults = (["1'","1","2","3"] as const).map(z=>calcInsulation(insMap[z],boardArea,inputs.insulation_Fy_lbf||inputs.Fy_lbf,z));

  if (inputs.systemType==='adhered') {
    warnings.push({level:'info',message:'Adhered membrane: Verify NOA listed adhesive bond strength (psf) ≥ all zone pressures. No row spacing applies.',reference:'TAS 124'});
    const maxE=Math.max(...noaResults.map(r=>r.extrapFactor),0);
    const hasErr=warnings.some(w=>w.level==='error'), hasWarn=warnings.some(w=>w.level==='warning');
    return { qh_ASD:Math.round(qh_ASD*100)/100, Kh:Math.round(Kh*1000)/1000, GCpi, zonePressures:zp, fastenerResults:[], insulationResults, noaResults, warnings, maxExtrapolationFactor:Math.round(maxE*100)/100, halfSheetZones:[], minFS_in:0, overallStatus:hasErr?'fail':hasWarn?'warning':'ok', ewa_membrane_ft2:ewa_m, ewa_insulation_ft2:ewa_i, derivation };
  }

  const NW = inputs.sheetWidth_in - inputs.lapWidth_in;
  const fastenerResults: FastenerZoneResult[] = [];
  const halfSheetZones: string[] = [];

  for (const zone of ["1'","1","2","3"] as const) {
    const P = zpMap[zone], noaResult = noaResults.find(nr=>nr.zone===zone)!;
    const {n,RS,FS,halfSheet} = solveRowsAndFS(inputs.Fy_lbf, P, NW, inputs.initialRows);
    const FS_used = Math.max(Math.min(Math.floor(FS*2)/2,12),4);
    const A_f = (FS_used*RS)/144, F_demand = Math.abs(P)*A_f, DR = inputs.Fy_lbf>0?F_demand/inputs.Fy_lbf:0;
    if (halfSheet) { halfSheetZones.push(zone); warnings.push({level:'warning',message:`Half-sheet installation required in Zone ${zone}.`,reference:'RAS 117'}); }
    if (n>5) warnings.push({level:'warning',message:`More than 5 fastener rows in Zone ${zone}. Consider higher-capacity fastener.`,reference:'RAS 117'});
    fastenerResults.push({ zone, P_psf:Math.round(Math.abs(P)*100)/100, n_rows:n, RS_in:RS, FS_calculated_in:Math.round(FS*10)/10, FS_used_in:FS_used, halfSheetRequired:halfSheet, demandRatio:Math.round(DR*1000)/1000, A_fastener_ft2:Math.round(A_f*1000)/1000, F_demand_lbf:Math.round(F_demand*10)/10, noaCheck:noaResult });
  }

  const maxE=Math.max(...noaResults.map(r=>r.extrapFactor),0), minFS=Math.min(...fastenerResults.map(r=>r.FS_used_in));
  const hasErr=warnings.some(w=>w.level==='error'), hasWarn=warnings.some(w=>w.level==='warning');
  return { qh_ASD:Math.round(qh_ASD*100)/100, Kh:Math.round(Kh*1000)/1000, GCpi, zonePressures:zp, fastenerResults, insulationResults, noaResults, warnings, maxExtrapolationFactor:Math.round(maxE*100)/100, halfSheetZones, minFS_in:minFS, overallStatus:hasErr?'fail':hasWarn?'warning':'ok', ewa_membrane_ft2:ewa_m, ewa_insulation_ft2:ewa_i, derivation };
}
