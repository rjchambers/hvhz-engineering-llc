// Insulation panel attachment per RAS 117-20 §9.
//
// §9.1.2 General Equation:
//   (Known # of fasteners / max design pressure) = (unknown # of fasteners / elevated design pressure)
//   "All fractions shall be rounded UP to the next whole number."
//
// The current force-balance form  N = ceil(|P| × A_board / f_y)  is
// mathematically equivalent to the proportional form if
//   f_y = MDP × A_board / N_field
// derived from the NOA's tested field-area pattern.
//
// Open work (require UI/data-model changes — tracked in the upgrade plan):
//   §9.3  panel overlapping zones gets the more stringent density across the whole panel
//   §9.4  multilayer systems: top panel density governs (or base if top adhered)
//   §9.5  base sheet may be attached through insulation with insulation fasteners

import type { InsulationZoneResult, Zone } from './types';

export function calcInsulationZone(
  zone: Zone,
  P: number,
  boardArea_ft2: number,
  f_y_lbf: number,
  N_prescribed_field: number,
): InsulationZoneResult {
  // §9.1.2 proportional extrapolation (force-balance form):
  const N_req = Math.ceil((Math.abs(P) * boardArea_ft2) / f_y_lbf);

  // Per §9, the NOA's field pattern IS the prescriptive minimum. Take the
  // larger of the calculated zone requirement and the NOA field pattern.
  const N_used = Math.max(N_req, N_prescribed_field);

  return {
    zone,
    P_psf: Math.round(Math.abs(P) * 100) / 100,
    N_required: N_req,
    N_prescribed: N_prescribed_field,
    N_used,
    layout: pickGridLayout(N_used),
  };
}

function pickGridLayout(N: number): string {
  if (N <= 4) return '2×2';
  if (N <= 6) return '2×3';
  if (N <= 9) return '3×3';
  if (N <= 12) return '3×4';
  return '4×4';
}
