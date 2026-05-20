// RAS 117-20 §9 — Insulation Attachment worked example verification.
// Replays the 2020 FBC Test Protocols, 7th Edition, §9.1 example:
//
//   NOA MDP = -45 psf
//   Field pattern: 4 fasteners per 4'×4' (16 ft²) panel
//   f_y (per-fastener tributary capacity at MDP) = MDP × A / N = 45 × 16 / 4 = 180 lbf
//
// Expected results per the standard (round UP to next whole number):
//   Zone 1 @ -64  psf  →  4 × (64/45)  = 5.69 →  6 fasteners
//   Zone 2 @ -84  psf  →  4 × (84/45)  = 7.47 →  8 fasteners
//   Zone 3 @ -115 psf  →  4 × (115/45) = 10.22 → 11 fasteners

import { describe, expect, it } from 'vitest';
import { calcInsulationZone } from '@/lib/fasteners/insulation-engine';

const f_y = 180;
const A_board = 16;
const N_field = 4;

describe('RAS 117 §9 worked example — insulation panel attachment', () => {
  it('Zone 1 @ -64 psf: 6 fasteners per 4×4 panel', () => {
    const r = calcInsulationZone('1', -64, A_board, f_y, N_field);
    expect(r.N_used).toBe(6);
  });

  it('Zone 2 @ -84 psf: 8 fasteners per 4×4 panel', () => {
    const r = calcInsulationZone('2', -84, A_board, f_y, N_field);
    expect(r.N_used).toBe(8);
  });

  it('Zone 3 @ -115 psf: 11 fasteners per 4×4 panel', () => {
    const r = calcInsulationZone('3', -115, A_board, f_y, N_field);
    expect(r.N_used).toBe(11);
  });

  it('Field zone returns the NOA prescribed minimum (§9 baseline)', () => {
    // At MDP, the calc returns exactly N_field; the prescribed minimum should
    // never undercut the NOA-tested field pattern.
    const r = calcInsulationZone('1', -45, A_board, f_y, N_field);
    expect(r.N_used).toBeGreaterThanOrEqual(N_field);
  });

  it('Rounds UP per §9 (any fractional fastener requirement → next whole)', () => {
    // Slightly above MDP forces N_req from 4 to 5.
    const r = calcInsulationZone('1', -46, A_board, f_y, N_field);
    expect(r.N_required).toBeGreaterThanOrEqual(5);
  });
});
