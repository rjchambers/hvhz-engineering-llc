// Verifies the required-input model that gates the technician form and powers
// the report's input-verification section.

import { describe, expect, it } from 'vitest';
import { checkFastenerInputs, techRequiredKeys } from '@/lib/fasteners/required-inputs';

const complete = {
  wind_speed: 175, exposure_category: 'C', risk_category: 'II', enclosure_type: 'Enclosed',
  Kzt: 1, Kd: 0.85, Ke: 1,
  building_width_ft: 100, building_length_ft: 200, mean_roof_height_ft: 15, parapet_height_ft: 0,
  construction_type: 'Reroof', system_type: 'modified_bitumen', deck_type: 'Plywood',
  cc_roof_type: 'Flat', cc_slope_deg: 0,
  noa_number: 'FL11946-R26', noa_manufacturer: 'GAF', noa_mdp_psf: -52.5,
  cc_design_pressure: -52.5, cc_roll_width: 39.37, cc_side_lap: 3,
  cc_lap_fastener_spacing: 7, cc_field_fastener_spacing: 7, cc_lap_rows: 1, cc_field_rows: 2,
};

describe('checkFastenerInputs', () => {
  it('empty input → many missing, but code-locked factors are satisfied by defaults', () => {
    const c = checkFastenerInputs({});
    expect(c.complete).toBe(false);
    // Locked factors (V, Exposure, Kzt, Kd, Ke) never count as missing.
    expect(c.missingRequired.some(i => i.stage === 'locked')).toBe(false);
    const wind = c.items.find(i => i.key === 'wind_speed')!;
    expect(wind.provided).toBe(true);
    expect(wind.value).toBe(185);
  });

  it('flags technician-stage required fields as missing when absent', () => {
    const c = checkFastenerInputs({});
    const techKeys = c.techMissing.map(i => i.key);
    expect(techKeys).toEqual(expect.arrayContaining([
      'risk_category', 'enclosure_type', 'building_width_ft', 'building_length_ft',
      'mean_roof_height_ft', 'construction_type', 'system_type', 'deck_type',
      'noa_number', 'noa_manufacturer', 'noa_mdp_psf',
    ]));
  });

  it('a fully populated mechanical job is complete', () => {
    const c = checkFastenerInputs(complete);
    expect(c.complete).toBe(true);
    expect(c.missingRequired).toHaveLength(0);
  });

  it('treats 0 as a provided value (slope, parapet)', () => {
    const c = checkFastenerInputs(complete);
    const slope = c.items.find(i => i.key === 'cc_slope_deg')!;
    expect(slope.provided).toBe(true);
  });

  it('insulation inputs become required only when an insulation calc is requested', () => {
    const without = checkFastenerInputs(complete);
    expect(without.items.some(i => i.key === 'cc_insulation_mdp')).toBe(false);

    const withIns = checkFastenerInputs({ ...complete, cc_insulation_fpb: 9 });
    const insItem = withIns.items.find(i => i.key === 'cc_insulation_mdp');
    expect(insItem).toBeDefined();
    expect(withIns.complete).toBe(false); // mdp/board still missing
    expect(withIns.missingRequired.map(i => i.key)).toEqual(
      expect.arrayContaining(['cc_insulation_mdp', 'cc_insulation_board_l', 'cc_insulation_board_w']),
    );
  });

  it('adhered systems do not require the mechanical fastener pattern', () => {
    const adhered = checkFastenerInputs({ ...complete, system_type: 'adhered',
      cc_design_pressure: undefined, cc_roll_width: undefined, cc_side_lap: undefined,
      cc_lap_fastener_spacing: undefined, cc_field_fastener_spacing: undefined,
      cc_lap_rows: undefined, cc_field_rows: undefined });
    expect(adhered.items.some(i => i.key === 'cc_roll_width')).toBe(false);
    expect(adhered.complete).toBe(true);
  });

  it('techRequiredKeys lists only technician-stage required keys', () => {
    const keys = techRequiredKeys({});
    expect(keys).toContain('building_width_ft');
    expect(keys).not.toContain('wind_speed');      // locked
    expect(keys).not.toContain('cc_roll_width');   // PE stage
  });
});
