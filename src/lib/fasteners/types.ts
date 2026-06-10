// Shared types for the fastener engine modules.
// FBC 8th Edition (2023) · ASCE 7-22 Ch. 30 C&C · RAS 117-20 · TAS 105 · TAS 124
// Low-slope (≤ 7°) mechanically attached or adhered roofing systems.

export type RoofSystemType = 'modified_bitumen' | 'single_ply' | 'adhered';
export type DeckType = 'plywood' | 'structural_concrete' | 'steel_deck' | 'wood_plank' | 'lw_concrete';
export type ConstructionType = 'new' | 'reroof' | 'recover';
export type ZoneAttachmentBasis = 'prescriptive' | 'rational_analysis' | 'exceeds_300pct' | 'asterisked_fail';
export type Zone = "1'" | '1' | '2' | '3';

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

export interface RAS128Summary {
  Pasd_field: number;        // Pasd(1), psf (negative)
  Pasd_perimeter: number;    // Pasd(2), psf (negative)
  Pasd_corner: number;       // Pasd(3), psf (negative)
  qh_ult: number;            // ultimate velocity pressure, psf
  a_ft: number;              // C&C zone dimension `a`
  governingZone: string;     // most severe zone
  governingPasd: number;     // most severe zone Pasd, psf (negative)
  qualifiesPrescriptive: boolean;  // true → RAS 128 tabular path (no sealed calc)
  message: string;
  derivation: string[];
}

export interface FastenerOutputs {
  qh_ASD: number;
  Kh: number;
  GCpi: number;
  zonePressures: ZonePressures;
  ras128: RAS128Summary;
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
