// Pre-calculation validation of fastener inputs against FBC, ASCE 7-22, and RAS 117.

import type { FastenerInputs, FastenerWarning } from './types';
import { isTAS105Required } from './tas-105';

export function validateFastenerInputs(inputs: FastenerInputs): FastenerWarning[] {
  const w: FastenerWarning[] = [];

  if (inputs.isHVHZ && inputs.exposureCategory !== 'C') {
    w.push({
      level: 'error',
      message: 'HVHZ requires Exposure Category C per FBC §1620 and ASCE 7-22 §26.7.3.',
      reference: '§26.7.3',
    });
  }
  if (inputs.h > 60) {
    w.push({
      level: 'error',
      message: 'ASCE 7-22 Ch. 30 Envelope Procedure is limited to h ≤ 60 ft. For h > 60 ft, use the Directional Procedure to derive pressures, then apply RAS 117 §10 attachment calc per §10.6.',
      reference: 'ASCE 7-22 §30.1 / RAS 117 §10.6',
    });
  }
  if (inputs.constructionType === 'recover' && inputs.existingLayers > 1) {
    w.push({
      level: 'error',
      message: 'FBC §1521 prohibits recover over more than one existing roof layer in HVHZ.',
      reference: 'FBC §1521',
    });
  }
  if (inputs.constructionType === 'recover') {
    // RAS 117 §10.5: "In recover applications anchor/base sheet attachment
    // applications shall utilize approved insulation fasteners and bearing
    // plates. Anchor or base sheet fasteners or nails shall not be utilized
    // in such applications."
    w.push({
      level: 'warning',
      message: 'RAS 117 §10.5: Recover applications must use approved insulation fasteners and bearing plates. Anchor/base sheet fasteners or nails are not permitted.',
      reference: 'RAS 117 §10.5',
    });
  }
  if (inputs.isHVHZ && inputs.V < 150) {
    w.push({
      level: 'error',
      message: `Design wind speed ${inputs.V} mph below HVHZ minimum. FBC §1620.1 requires 150 mph min for Risk Cat II.`,
      reference: 'FBC §1620.1',
    });
  }

  const tas105 = isTAS105Required(inputs.deckType, inputs.constructionType);
  if (tas105.required && inputs.fySource !== 'tas105') {
    w.push({
      level: inputs.deckType === 'lw_concrete' ? 'error' : 'warning',
      message: tas105.reason + ' Enter TAS 105 test results.',
      reference: 'TAS 105',
    });
  }
  if (!inputs.noa.mdp_psf) {
    w.push({
      level: 'error',
      message: 'NOA Maximum Design Pressure (MDP) is required.',
      reference: 'NOA',
    });
  }
  if (Math.abs(inputs.noa.mdp_psf) > 200) {
    w.push({
      level: 'warning',
      message: `NOA MDP ${Math.abs(inputs.noa.mdp_psf)} psf is unusually high. Confirm this is ASD-level MDP, not ultimate test pressure.`,
      reference: 'TAS 114',
    });
  }
  if (inputs.enclosure === 'partially_enclosed') {
    w.push({
      level: 'info',
      message: 'GCpi = ±0.55 applied. Verify opening ratios per ASCE 7-22 §26.13.3.',
      reference: 'ASCE 7-22 §26.13.3',
    });
  }
  if (inputs.parapetHeight > 0) {
    w.push({
      level: 'info',
      message: 'Parapet present. Zone 3 corners start at inside face of parapet per ASCE 7-22 §26.2.',
      reference: 'ASCE 7-22 §26.2',
    });
  }
  if (inputs.county === 'miami_dade') {
    w.push({
      level: 'info',
      message: 'Miami-Dade HVHZ requires a Miami-Dade NOA (Notice of Acceptance).',
      reference: 'NOA',
    });
  }
  return w;
}
