// NOA compatibility check per RAS 117-20 §9.2 and §12.6.
// Compares zone uplift pressures against the NOA's Maximum Design Pressure.

import type { NOAZoneResult } from './types';

export function checkNOACompatibility(
  zonePressures: Record<string, number>,
  mdp_psf: number,
  asterisked: boolean,
): NOAZoneResult[] {
  return Object.entries(zonePressures).map(([zone, P]) => {
    const P_abs = Math.abs(P), MDP_abs = Math.abs(mdp_psf);
    const factor = MDP_abs > 0 ? P_abs / MDP_abs : 999;

    if (P_abs <= MDP_abs) {
      return {
        zone, P_psf: P, MDP_psf: mdp_psf, extrapFactor: factor,
        basis: 'prescriptive' as const,
        message: 'Within NOA MDP. Use prescriptive pattern.',
        blocksCalculation: false,
      };
    }
    if (asterisked) {
      return {
        zone, P_psf: P, MDP_psf: mdp_psf, extrapFactor: factor,
        basis: 'asterisked_fail' as const,
        message: 'Asterisked assembly: extrapolation not permitted. MDP must meet zone pressure.',
        blocksCalculation: true,
      };
    }
    if (factor > 3.0) {
      // RAS 117 §9.2: "If the data extrapolation results in a number of fasteners
      // for an elevated pressure zone which exceeds 300 percent of that for the
      // field area, additional testing, as determined by the building official,
      // MAY BE REQUIRED to confirm the performance of the Roof System Assembly."
      // Per §9.2 this is a warning trigger, not a hard prohibition.
      return {
        zone, P_psf: P, MDP_psf: mdp_psf, extrapFactor: factor,
        basis: 'exceeds_300pct' as const,
        message: `Zone pressure ${factor.toFixed(2)}× NOA MDP — RAS 117 §9.2: additional testing may be required by the building official.`,
        blocksCalculation: false,
      };
    }
    return {
      zone, P_psf: P, MDP_psf: mdp_psf, extrapFactor: factor,
      basis: 'rational_analysis' as const,
      message: `RAS 117 rational analysis. Extrapolation factor: ${factor.toFixed(2)}× (review threshold: 3.00×).`,
      blocksCalculation: false,
    };
  });
}
