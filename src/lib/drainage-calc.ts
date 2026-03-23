/**
 * FBC HVHZ Drainage Analysis Calculation Engine
 * Code basis: FBC Plumbing 2023 §1101–1106, ASCE 7-22 §8
 * Rainfall data: NOAA Atlas 14 (1-hr, 100-yr design storm)
 */

// NOAA Atlas 14 design rainfall rates (in/hr), 1-hr 100-yr storm
export const DESIGN_RAINFALL: Record<string, number> = {
  'Miami-Dade': 8.85,
  'Broward':    8.39,
  'Palm Beach': 8.10,
  'Monroe':     8.50,
  'Collier':    7.80,
  'Other':      8.39,
};

// FBC Table 1106.2 — Horizontal storm drain capacity (gpm) by diameter + slope
export const FBC_1106_2: Record<number, Record<string, number>> = {
  2:  { '1/16': 9,   '1/8': 12,  '1/4': 17,  '1/2': 24  },
  3:  { '1/16': 20,  '1/8': 29,  '1/4': 41,  '1/2': 58  },
  4:  { '1/16': 44,  '1/8': 63,  '1/4': 89,  '1/2': 126 },
  5:  { '1/16': 83,  '1/8': 118, '1/4': 166, '1/2': 235 },
  6:  { '1/16': 140, '1/8': 198, '1/4': 280, '1/2': 396 },
  8:  { '1/16': 315, '1/8': 446, '1/4': 631, '1/2': 892 },
  10: { '1/16': 570, '1/8': 806, '1/4': 1140,'1/2': 1612 },
};

// FBC Table 1105.2 — Vertical conductor (roof drain leader) capacity (gpm)
export const FBC_1105_2: Record<number, number> = {
  2: 34, 3: 87, 4: 174, 5: 361, 6: 552, 8: 1380, 10: 2900,
};

export interface DrainEntry {
  drain_id: string;
  zone_id: string;
  location_description: string;
  drain_type: 'Interior' | 'Edge' | 'Parapet';
  pipe_diameter_in: number;
  leader_type: 'Vertical' | 'Horizontal';
  pipe_slope: '1/16' | '1/8' | '1/4' | '1/2';
  condition: 'Good' | 'Fair' | 'Obstructed' | 'Damaged';
  strainer_present: boolean;
  strainer_condition: string;
  photo_tag: string;
  // Position on roof plan (0-1 normalized coordinates, origin top-left)
  pos_x?: number;  // 0 = west wall, 1 = east wall
  pos_y?: number;  // 0 = north wall, 1 = south wall
}

export interface SecondaryEntry {
  drain_id: string;
  zone_id: string;
  secondary_type: 'Overflow Drain' | 'Scupper' | 'Emergency Overflow';
  location_description: string;
  pipe_diameter_in?: number;
  scupper_width_in?: number;
  scupper_depth_in?: number;
  height_above_primary_in: number;
  condition: 'Good' | 'Fair' | 'Obstructed' | 'Damaged';
  photo_tag: string;
}

export interface DrainageZone {
  zone_id: string;
  description: string;
  area_sqft: number;
  lowest_point: string;
}

export interface DrainCalcResult {
  zone_id: string;
  area_sqft: number;
  rainfall_rate: number;
  q_required_gpm: number;
  primary_drains: {
    drain_id: string;
    diameter_in: number;
    leader_type: string;
    rated_capacity_gpm: number;
    condition: string;
    fbc_table: string;
  }[];
  q_primary_provided_gpm: number;
  primary_adequate: boolean;
  secondary_drains: {
    drain_id: string;
    type: string;
    rated_capacity_gpm: number;
    condition: string;
    height_above_primary_in: number;
    fbc_compliant_height: boolean;
  }[];
  q_secondary_provided_gpm: number;
  secondary_adequate: boolean;
  overflow_required: boolean;
}

export interface DrainageCalcInputs {
  county: string;
  rainfall_override?: number;
  pipe_slope_assumption: '1/16' | '1/8' | '1/4' | '1/2';
  zones: DrainageZone[];
  primary_drains: DrainEntry[];
  secondary_drains: SecondaryEntry[];
}

export interface DrainageCalcOutput {
  design_rainfall_rate: number;
  code_basis: string;
  zone_results: DrainCalcResult[];
  overall_primary_adequate: boolean;
  overall_secondary_adequate: boolean;
  total_required_gpm: number;
  total_primary_provided_gpm: number;
  deficiencies: string[];
}

export function getDrainCapacity(
  diameter: number,
  leaderType: 'Vertical' | 'Horizontal',
  slope: string
): { capacity: number; table: string } {
  if (leaderType === 'Vertical') {
    const cap = FBC_1105_2[diameter] ?? 0;
    return { capacity: cap, table: 'FBC Table 1105.2' };
  }
  const cap = FBC_1106_2[diameter]?.[slope] ?? 0;
  return { capacity: cap, table: `FBC Table 1106.2 (${slope}"/ft slope)` };
}

export function calcScupperCapacity(widthIn: number, headIn: number = 2): number {
  // Rectangular weir formula: Q(gpm) = 22.4 × L(in) × h(in)^1.5
  return Math.round(22.4 * widthIn * Math.pow(headIn, 1.5));
}

export function runDrainageCalc(inputs: DrainageCalcInputs): DrainageCalcOutput {
  const rainfallRate = inputs.rainfall_override ?? DESIGN_RAINFALL[inputs.county] ?? DESIGN_RAINFALL['Other'];
  const codeBasis = inputs.rainfall_override
    ? `PE override: ${inputs.rainfall_override} in/hr`
    : `NOAA Atlas 14, ${inputs.county} County, 1-hr 100-yr = ${rainfallRate} in/hr`;

  const deficiencies: string[] = [];

  const zoneResults: DrainCalcResult[] = inputs.zones.map((zone) => {
    const qRequired = (zone.area_sqft * rainfallRate) / 96.23;

    const primaryForZone = inputs.primary_drains.filter((d) => d.zone_id === zone.zone_id);
    const primaryCalc = primaryForZone.map((d) => {
      const { capacity, table } = getDrainCapacity(d.pipe_diameter_in, d.leader_type, inputs.pipe_slope_assumption);
      return {
        drain_id: d.drain_id,
        diameter_in: d.pipe_diameter_in,
        leader_type: d.leader_type,
        rated_capacity_gpm: capacity,
        condition: d.condition,
        fbc_table: table,
      };
    });

    const qPrimaryProvided = primaryCalc.reduce((s, d) => s + d.rated_capacity_gpm, 0);
    const primaryAdequate = qPrimaryProvided >= qRequired;

    if (!primaryAdequate) {
      deficiencies.push(
        `Zone ${zone.zone_id}: Primary drainage inadequate. Required ${qRequired.toFixed(1)} gpm, provided ${qPrimaryProvided.toFixed(1)} gpm.`
      );
    }

    const secondaryForZone = inputs.secondary_drains.filter((d) => d.zone_id === zone.zone_id);
    const secondaryCalc = secondaryForZone.map((d) => {
      let capacity = 0;
      if (d.secondary_type === 'Scupper' && d.scupper_width_in) {
        capacity = calcScupperCapacity(d.scupper_width_in, 2);
      } else if (d.pipe_diameter_in) {
        const { capacity: cap } = getDrainCapacity(d.pipe_diameter_in, 'Vertical', '1/4');
        capacity = cap;
      }

      const fbcCompliantHeight = d.height_above_primary_in >= 2;
      if (!fbcCompliantHeight) {
        deficiencies.push(
          `Zone ${zone.zone_id}: Secondary drain ${d.drain_id} height above primary (${d.height_above_primary_in}") is less than 2" required by FBC §1101.7.`
        );
      }

      return {
        drain_id: d.drain_id,
        type: d.secondary_type,
        rated_capacity_gpm: capacity,
        condition: d.condition,
        height_above_primary_in: d.height_above_primary_in,
        fbc_compliant_height: fbcCompliantHeight,
      };
    });

    const qSecondaryProvided = secondaryCalc.reduce((s, d) => s + d.rated_capacity_gpm, 0);
    const overflowRequired = true; // FBC §1502.3 always requires secondary in HVHZ
    const secondaryAdequate = secondaryCalc.length > 0 && qSecondaryProvided >= qRequired;

    if (!secondaryAdequate) {
      deficiencies.push(
        `Zone ${zone.zone_id}: Secondary/overflow drainage inadequate per FBC §1502.3. Required ${qRequired.toFixed(1)} gpm, provided ${qSecondaryProvided.toFixed(1)} gpm.`
      );
    }

    return {
      zone_id: zone.zone_id,
      area_sqft: zone.area_sqft,
      rainfall_rate: rainfallRate,
      q_required_gpm: Math.round(qRequired * 10) / 10,
      primary_drains: primaryCalc,
      q_primary_provided_gpm: Math.round(qPrimaryProvided * 10) / 10,
      primary_adequate: primaryAdequate,
      secondary_drains: secondaryCalc,
      q_secondary_provided_gpm: Math.round(qSecondaryProvided * 10) / 10,
      secondary_adequate: secondaryAdequate,
      overflow_required: overflowRequired,
    };
  });

  const totalRequired = zoneResults.reduce((s, z) => s + z.q_required_gpm, 0);
  const totalPrimary = zoneResults.reduce((s, z) => s + z.q_primary_provided_gpm, 0);

  return {
    design_rainfall_rate: rainfallRate,
    code_basis: codeBasis,
    zone_results: zoneResults,
    overall_primary_adequate: zoneResults.every((z) => z.primary_adequate),
    overall_secondary_adequate: zoneResults.every((z) => z.secondary_adequate),
    total_required_gpm: Math.round(totalRequired * 10) / 10,
    total_primary_provided_gpm: Math.round(totalPrimary * 10) / 10,
    deficiencies,
  };
}
