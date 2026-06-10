// Single source of truth for the inputs the fastener / wind-mitigation calc
// depends on. Used by (1) the technician work-order form to gate submission and
// asterisk required fields, and (2) the engineering report to verify that every
// value is provided — never silently assumed — and to flag anything missing.
//
// `stage` indicates who supplies the value:
//   locked → HVHZ code-mandated / standard factor (not entered; shown for record)
//   tech   → technician enters in the field work order (asterisked, gates submit)
//   pe     → PE enters/overrides in FastenerCalc before sealing

export type InputStage = 'locked' | 'tech' | 'pe';

export interface FastenerInputSpec {
  key: string;                 // field_data key
  label: string;
  group: string;               // report grouping
  stage: InputStage;
  required: boolean;           // must be present for an assumption-free calc
  unit?: string;
  defaultNote?: string;        // basis for a locked/standard value
  defaultValue?: string | number;  // code-mandated value for locked stage
  appliesIf?: (fd: Record<string, any>) => boolean;  // conditional applicability
}

const isInsulationJob = (fd: Record<string, any>) =>
  fd.cc_insulation_fpb != null && Number(fd.cc_insulation_fpb) > 0;

const isMechanical = (fd: Record<string, any>) =>
  (fd.system_type ?? 'modified_bitumen') !== 'adhered';

export const FASTENER_INPUT_SPECS: FastenerInputSpec[] = [
  // ── Design criteria (HVHZ code-locked / standard) ──────────────────────────
  { key: 'wind_speed', label: 'Design Wind Speed (V)', group: 'Design Criteria', stage: 'locked', required: true, unit: 'mph', defaultValue: 185, defaultNote: 'FBC §1620.1 (HVHZ)' },
  { key: 'exposure_category', label: 'Exposure Category', group: 'Design Criteria', stage: 'locked', required: true, defaultValue: 'C', defaultNote: 'FBC §1620 — Exposure C in HVHZ' },
  { key: 'risk_category', label: 'Risk Category', group: 'Design Criteria', stage: 'tech', required: true, defaultNote: 'From building permit' },
  { key: 'enclosure_type', label: 'Enclosure Classification', group: 'Design Criteria', stage: 'tech', required: true },
  { key: 'Kzt', label: 'Topographic Factor (Kzt)', group: 'Design Criteria', stage: 'locked', required: true, defaultValue: 1.0, defaultNote: 'ASCE 7-22 §26.8 — 1.0 unless topographic speed-up' },
  { key: 'Kd', label: 'Directionality Factor (Kd)', group: 'Design Criteria', stage: 'locked', required: true, defaultValue: 0.85, defaultNote: 'ASCE 7-22 Table 26.6-1 — 0.85 (C&C)' },
  { key: 'Ke', label: 'Ground Elevation Factor (Ke)', group: 'Design Criteria', stage: 'locked', required: true, defaultValue: 1.0, defaultNote: 'ASCE 7-22 Table 26.9-1 — 1.0 (conservative)' },

  // ── Building geometry (technician) ─────────────────────────────────────────
  { key: 'building_width_ft', label: 'Building Width', group: 'Building Geometry', stage: 'tech', required: true, unit: 'ft' },
  { key: 'building_length_ft', label: 'Building Length', group: 'Building Geometry', stage: 'tech', required: true, unit: 'ft' },
  { key: 'mean_roof_height_ft', label: 'Mean Roof Height', group: 'Building Geometry', stage: 'tech', required: true, unit: 'ft' },
  { key: 'parapet_height_ft', label: 'Parapet Height', group: 'Building Geometry', stage: 'tech', required: false, unit: 'ft', defaultNote: '0 if no parapet' },

  // ── Roof system (technician) ───────────────────────────────────────────────
  { key: 'construction_type', label: 'Construction Type', group: 'Roof System', stage: 'tech', required: true },
  { key: 'system_type', label: 'Roof System Type', group: 'Roof System', stage: 'tech', required: true },
  { key: 'deck_type', label: 'Deck Type', group: 'Roof System', stage: 'tech', required: true },
  { key: 'cc_roof_type', label: 'Roof Shape', group: 'Roof System', stage: 'pe', required: true },
  { key: 'cc_slope_deg', label: 'Roof Slope', group: 'Roof System', stage: 'pe', required: true, unit: '°' },

  // ── NOA / product approval (technician) ────────────────────────────────────
  { key: 'noa_number', label: 'NOA / Approval Number', group: 'NOA / Product Approval', stage: 'tech', required: true },
  { key: 'noa_manufacturer', label: 'Manufacturer', group: 'NOA / Product Approval', stage: 'tech', required: true },
  { key: 'noa_mdp_psf', label: 'NOA Maximum Design Pressure (MDP)', group: 'NOA / Product Approval', stage: 'tech', required: true, unit: 'psf' },

  // ── Fastener pattern from NOA (PE) — mechanical systems only ────────────────
  { key: 'cc_design_pressure', label: 'Design Pressure (DP)', group: 'Fastener Pattern (NOA)', stage: 'pe', required: true, unit: 'psf', appliesIf: isMechanical },
  { key: 'cc_roll_width', label: 'Roll / Sheet Width', group: 'Fastener Pattern (NOA)', stage: 'pe', required: true, unit: 'in', appliesIf: isMechanical },
  { key: 'cc_side_lap', label: 'Side Lap', group: 'Fastener Pattern (NOA)', stage: 'pe', required: true, unit: 'in', appliesIf: isMechanical },
  { key: 'cc_lap_fastener_spacing', label: 'Lap Fastener Spacing', group: 'Fastener Pattern (NOA)', stage: 'pe', required: true, unit: 'in', appliesIf: isMechanical },
  { key: 'cc_field_fastener_spacing', label: 'Field Fastener Spacing', group: 'Fastener Pattern (NOA)', stage: 'pe', required: true, unit: 'in', appliesIf: isMechanical },
  { key: 'cc_lap_rows', label: 'Rows in Lap', group: 'Fastener Pattern (NOA)', stage: 'pe', required: true, appliesIf: isMechanical },
  { key: 'cc_field_rows', label: 'Rows in Field', group: 'Fastener Pattern (NOA)', stage: 'pe', required: true, appliesIf: isMechanical },

  // ── Insulation attachment (PE) — only when an insulation calc is requested ──
  { key: 'cc_insulation_mdp', label: 'Insulation NOA MDP', group: 'Insulation Attachment (RAS 117 §9)', stage: 'pe', required: true, unit: 'psf', appliesIf: isInsulationJob },
  { key: 'cc_insulation_fpb', label: 'NOA Field Pattern (fasteners/board)', group: 'Insulation Attachment (RAS 117 §9)', stage: 'pe', required: true, appliesIf: isInsulationJob },
  { key: 'cc_insulation_board_l', label: 'Insulation Board Length', group: 'Insulation Attachment (RAS 117 §9)', stage: 'pe', required: true, unit: 'ft', appliesIf: isInsulationJob },
  { key: 'cc_insulation_board_w', label: 'Insulation Board Width', group: 'Insulation Attachment (RAS 117 §9)', stage: 'pe', required: true, unit: 'ft', appliesIf: isInsulationJob },
];

export function isInputProvided(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'number' && Number.isNaN(value)) return false;
  return true;
}

export interface FastenerInputStatus extends FastenerInputSpec {
  provided: boolean;
  value: unknown;
}

export interface FastenerInputCheck {
  items: FastenerInputStatus[];        // applicable specs with status
  missingRequired: FastenerInputStatus[];
  techMissing: FastenerInputStatus[];  // tech-stage required + missing (gate submit)
  complete: boolean;                   // no required input missing
}

export function checkFastenerInputs(fd: Record<string, any>): FastenerInputCheck {
  const items: FastenerInputStatus[] = FASTENER_INPUT_SPECS
    .filter(spec => !spec.appliesIf || spec.appliesIf(fd))
    .map(spec => {
      const raw = fd[spec.key];
      const hasRaw = isInputProvided(raw);
      // Code-locked factors carry a mandated default, so they are never "missing".
      const provided = hasRaw || (spec.stage === 'locked' && spec.defaultValue != null);
      const value = hasRaw ? raw : (spec.stage === 'locked' ? spec.defaultValue : raw);
      return { ...spec, value, provided };
    });

  const missingRequired = items.filter(i => i.required && !i.provided);
  const techMissing = missingRequired.filter(i => i.stage === 'tech');
  return { items, missingRequired, techMissing, complete: missingRequired.length === 0 };
}

/** Tech-stage required field keys (for form gating / asterisks). */
export function techRequiredKeys(fd: Record<string, any>): string[] {
  return FASTENER_INPUT_SPECS
    .filter(s => s.stage === 'tech' && s.required && (!s.appliesIf || s.appliesIf(fd)))
    .map(s => s.key);
}
