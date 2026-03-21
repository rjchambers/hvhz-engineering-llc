import { HVHZReportBuilder } from './reportLayout';
import { format } from 'date-fns';
import { runDrainageCalc, DESIGN_RAINFALL, type DrainageCalcInputs } from '@/lib/drainage-calc';
import { calculateFastener, calculateTAS105, type FastenerInputs } from '@/lib/fastener-engine';

interface EngineerProfile {
  full_name: string;
  pe_license_number: string | null;
  pe_license_state: string | null;
  pe_expiry: string | null;
  stamp_image_url: string | null;
}

const SERVICE_TITLES: Record<string, string> = {
  "roof-inspection": "Roof Inspection Report",
  "roof-certification": "Roof Certification Report",
  "drainage-analysis": "Drainage Analysis Report",
  "special-inspection": "Special Inspection Report",
  "wind-mitigation-permit": "Wind Mitigation Engineering Report",
  "fastener-calculation": "Fastener Uplift Calculation Report",
};

export function generateReport(
  serviceType: string,
  workOrder: { id: string; scheduled_date: string | null; orders?: { job_address?: string | null; job_city?: string | null; job_zip?: string | null; job_county?: string | null } | null },
  fieldData: Record<string, any>,
  engineerProfile: EngineerProfile,
  peNotes: string | null
): Blob {
  const title = SERVICE_TITLES[serviceType] || serviceType;
  const address = [workOrder.orders?.job_address, workOrder.orders?.job_city, workOrder.orders?.job_zip].filter(Boolean).join(', ');
  const jobNum = workOrder.id.slice(0, 8).toUpperCase();
  const signedDate = format(new Date(), 'MMMM d, yyyy');

  const rb = new HVHZReportBuilder(title, jobNum, address);

  // Job info
  rb.addSection('Job Information');
  rb.addInfoGrid({
    'Job Address': address,
    'County': workOrder.orders?.job_county ?? '',
    'Scheduled Date': workOrder.scheduled_date ?? '',
    'Report Date': signedDate,
    'Engineer': engineerProfile.full_name,
    'PE License': `FL #${engineerProfile.pe_license_number ?? 'N/A'}`,
  });

  // Job conditions (shared)
  if (fieldData.inspection_date || fieldData.weather_notes || fieldData.temperature_f) {
    rb.addSection('Job Conditions');
    rb.addInfoGrid({
      'Inspection Date': fieldData.inspection_date ? format(new Date(fieldData.inspection_date), 'MMMM d, yyyy') : '',
      'Weather': fieldData.weather_notes ?? '',
      'Temperature': fieldData.temperature_f ? `${fieldData.temperature_f}°F` : '',
      'Inspector': fieldData.inspector_name ?? '',
    });
    if (fieldData.notes) {
      rb.addTextBlock(fieldData.notes);
    }
  }

  // Service-specific sections
  switch (serviceType) {
    case 'roof-inspection':
    case 'roof-certification':
      addRoofInspectionSections(rb, fieldData);
      if (serviceType === 'roof-certification') addCertificationSections(rb, fieldData);
      break;
    case 'drainage-analysis':
      addDrainageSections(rb, fieldData, workOrder.orders?.job_county ?? 'Other');
      break;
    case 'special-inspection':
      addSpecialInspectionSections(rb, fieldData);
      break;
    case 'wind-mitigation-permit':
      addWindMitigationSections(rb, fieldData);
      break;
    case 'fastener-calculation':
      addFastenerCalcSections(rb, fieldData);
      break;
  }

  // PE signature page
  rb.addPESignaturePage(engineerProfile, peNotes, signedDate);

  return rb.toBlob();
}

function addRoofInspectionSections(rb: HVHZReportBuilder, fd: Record<string, any>) {
  rb.addSection('Roof Details');
  rb.addInfoGrid({
    'Roof Type': fd.roof_type ?? '',
    'Roof Age': fd.roof_age_years ? `${fd.roof_age_years} years` : '',
    'Installation Year': fd.installation_year ?? '',
    'Overall Condition': fd.overall_condition ?? '',
    'Condition Score': fd.condition_score != null ? `${fd.condition_score}/100` : '',
  });

  rb.addSection('Component Conditions');
  rb.addInfoGrid({
    'Drainage': fd.drainage_condition ?? '',
    'Ponding Observed': fd.ponding_observed ? 'Yes' : 'No',
    'Surface': fd.surface_condition ?? '',
    'Flashing': fd.flashing_condition ?? '',
    'Penetrations': fd.penetrations_condition ?? '',
    'Ventilation': fd.ventilation_condition ?? '',
  });

  if (fd.defects_found?.length) {
    rb.addSection('Defects Found');
    fd.defects_found.forEach((d: any, i: number) => {
      rb.addInfoGrid({
        [`Defect ${i + 1} Location`]: d.location,
        'Severity': d.severity,
        'Description': d.description,
        'Action': d.recommended_action,
        'Priority': d.priority,
      });
    });
  }

  rb.addSection('Recommendations');
  rb.addTextBlock(fd.recommendations ?? 'None provided.');
  rb.addInfoGrid({ 'Estimated Remaining Life': fd.estimated_remaining_life_years ? `${fd.estimated_remaining_life_years} years` : '' });
}

function addCertificationSections(rb: HVHZReportBuilder, fd: Record<string, any>) {
  rb.addSection('Certification');
  rb.addInfoGrid({
    'Certification Recommended': fd.certification_recommended ? 'Yes' : 'No',
    'Est. Remaining Life': fd.estimated_remaining_life_years ? `${fd.estimated_remaining_life_years} years` : '',
  });
  if (fd.certification_conditions) {
    rb.addTextBlock(fd.certification_conditions);
  }
}

function addDrainageSections(rb: HVHZReportBuilder, fd: Record<string, any>, county: string) {
  const rainfallRate = fd.pe_rainfall_rate ?? DESIGN_RAINFALL[county] ?? 8.39;

  // 1. Design Basis
  rb.addSection('Design Basis');
  rb.addInfoGrid({
    'Code Authority': 'FBC Plumbing 2023 §1101–1106; FBC Building 2023 §1502',
    'Design Storm': '100-Year, 1-Hour (NOAA Atlas 14)',
    'County': county,
    'Design Rainfall': fd.pe_rainfall_override ? `${fd.pe_rainfall_rate} in/hr (PE override)` : `${DESIGN_RAINFALL[county] ?? 8.39} in/hr`,
    'Secondary Required': 'Yes — FBC §1502.3 (HVHZ mandate)',
    'Slope Assumption': fd.pe_pipe_slope_assumption ?? '1/8" per ft',
  });

  const zones = fd.drainage_zones ?? [];
  const primaryDrains = fd.primary_drains ?? [];
  const secondaryDrains = fd.secondary_drains ?? [];

  // Run calc engine
  const calcInputs: DrainageCalcInputs = {
    county,
    rainfall_override: fd.pe_rainfall_override ? fd.pe_rainfall_rate : undefined,
    pipe_slope_assumption: fd.pe_pipe_slope_assumption ?? '1/8',
    zones,
    primary_drains: primaryDrains,
    secondary_drains: secondaryDrains,
  };
  const results = runDrainageCalc(calcInputs);

  // 2. Required Flow Calculation
  rb.addSection('Required Flow Calculation');
  results.zone_results.forEach((zr) => {
    const zone = zones.find((z: any) => z.zone_id === zr.zone_id);
    rb.addTextBlock(
      `Zone ${zr.zone_id}: ${zone?.description ?? ''}\n` +
      `Drainage Area = ${zr.area_sqft} sqft\n` +
      `Q_req = A × I / 96.23 = ${zr.area_sqft} × ${rainfallRate} / 96.23 = ${zr.q_required_gpm} gpm\n` +
      `(FBC §1106.1, 100-yr design storm)`
    );
  });
  rb.addTextBlock(`Total Required Capacity: ${results.total_required_gpm} gpm`);

  // 3. Primary Drain Capacity
  rb.addSection('Primary Drain Capacity');
  results.zone_results.forEach((zr) => {
    const grid: Record<string, string> = {};
    zr.primary_drains.forEach((d) => {
      grid[`Drain ${d.drain_id} (${d.diameter_in}", ${d.leader_type})`] = `${d.rated_capacity_gpm} gpm (${d.fbc_table})`;
    });
    grid[`Zone ${zr.zone_id} Provided`] = `${zr.q_primary_provided_gpm} gpm`;
    grid[`Zone ${zr.zone_id} Required`] = `${zr.q_required_gpm} gpm`;
    grid[`Zone ${zr.zone_id} Status`] = zr.primary_adequate ? 'ADEQUATE ✓' : 'DEFICIENT ✗';
    rb.addInfoGrid(grid);
  });

  // 4. Secondary / Overflow Drain Capacity
  rb.addSection('Secondary / Overflow Drain Capacity');
  results.zone_results.forEach((zr) => {
    const grid: Record<string, string> = {};
    zr.secondary_drains.forEach((d) => {
      const label = d.type === 'Scupper' ? `${d.drain_id} (Scupper)` : `${d.drain_id} (${d.type})`;
      grid[label] = `${d.rated_capacity_gpm} gpm · Height: ${d.height_above_primary_in}"`;
    });
    grid[`Zone ${zr.zone_id} Secondary Provided`] = `${zr.q_secondary_provided_gpm} gpm`;
    grid[`Zone ${zr.zone_id} FBC §1502.3`] = zr.secondary_adequate ? 'COMPLIANT' : 'DEFICIENT';
    rb.addInfoGrid(grid);
  });

  // 5. Compliance Matrix
  rb.addSection('Drainage Compliance Matrix');
  rb.addInfoGrid({
    'Primary System': results.overall_primary_adequate ? 'COMPLIANT' : 'DEFICIENT',
    'Secondary System (FBC §1502.3)': results.overall_secondary_adequate ? 'COMPLIANT' : 'DEFICIENT',
    'Total Required': `${results.total_required_gpm} gpm`,
    'Total Provided (Primary)': `${results.total_primary_provided_gpm} gpm`,
    'Design Standard': 'FBC Plumbing 2023, NOAA Atlas 14',
  });

  // 6. Engineering Deficiencies
  if (results.deficiencies.length > 0) {
    rb.addSection('Engineering Deficiencies');
    results.deficiencies.forEach((d) => rb.addTextBlock(`• ${d}`));
  }

  // 7. Field Observations
  rb.addSection('Field Observations');
  rb.addInfoGrid({
    'Roof Type': fd.roof_type ?? '',
    'Membrane': fd.roof_membrane ?? '',
    'Ponding Observed': fd.ponding_observed ? 'Yes' : 'No',
    'Drain Conditions': fd.drain_conditions_summary ?? '',
  });

  if (fd.ponding_observed && fd.ponding_areas?.length) {
    rb.addTextBlock('Ponding Areas:');
    fd.ponding_areas.forEach((p: any) => {
      rb.addTextBlock(`  Location: ${p.location}, Area: ${p.area_sqft} sqft, Depth: ${p.depth_in}", ${p.hours_after_rain}hrs after rain`);
    });
  }
  if (fd.deficiencies_observed) rb.addTextBlock(`Field Deficiencies: ${fd.deficiencies_observed}`);
  if (fd.recommendations) rb.addTextBlock(`Recommendations: ${fd.recommendations}`);
}

function addSpecialInspectionSections(rb: HVHZReportBuilder, fd: Record<string, any>) {
  rb.addSection('Special Inspection');
  rb.addInfoGrid({
    'Inspection Type': fd.inspection_type ?? '',
    'Permit Number': fd.permit_number ?? '',
  });
  if (fd.checklist_items?.length) {
    rb.addSection('Inspection Checklist');
    fd.checklist_items.forEach((item: any) => {
      rb.addInfoGrid({
        'Item': item.item_description,
        'Result': item.result,
        ...(item.corrective_action ? { 'Corrective Action': item.corrective_action } : {}),
      });
    });
  }
}

function addWindMitigationSections(rb: HVHZReportBuilder, fd: Record<string, any>) {
  rb.addSection('Building Information');
  rb.addInfoGrid({
    'Year Built': fd.year_built ?? '',
    'Occupancy': fd.occupancy_type ?? '',
    'Stories': fd.stories ?? '',
    'Width': fd.building_width_ft ? `${fd.building_width_ft} ft` : '',
    'Length': fd.building_length_ft ? `${fd.building_length_ft} ft` : '',
    'Wall Height': fd.wall_height_ft ? `${fd.wall_height_ft} ft` : '',
    'Mean Roof Height': fd.mean_roof_height_ft ? `${fd.mean_roof_height_ft} ft` : '',
  });

  rb.addSection('Roof System');
  rb.addInfoGrid({
    'Roof Shape': fd.roof_shape ?? '',
    'Covering Type': fd.roof_covering_type ?? '',
    'NOA Number': fd.noa_number ?? '',
    'NOA Expiry': fd.noa_expiry ? format(new Date(fd.noa_expiry), 'MM/dd/yyyy') : '',
    'Deck Type': fd.deck_type ?? '',
    'Deck Thickness': fd.deck_thickness ?? '',
    'Fastener Type': fd.fastener_type ?? '',
    'Fastener Size': fd.fastener_size ?? '',
  });

  rb.addSection('Connections & Protection');
  rb.addInfoGrid({
    'Roof-to-Wall': fd.roof_to_wall_connection ?? '',
    'Connection Spacing': fd.connection_spacing_inches ? `${fd.connection_spacing_inches}"` : '',
    'All Openings Protected': fd.all_openings_protected ? 'Yes' : 'No',
    'Garage Door Rated': fd.garage_door_rated ? 'Yes' : 'No',
  });
}

function addFastenerCalcSections(rb: HVHZReportBuilder, fd: Record<string, any>) {
  const SYSTEM_LABELS: Record<string, string> = { modified_bitumen: "Modified Bitumen (RAS 117)", single_ply: "Single-Ply TPO/EPDM (RAS 137)", adhered: "Adhered Membrane (TAS 124)" };
  const DECK_LABELS: Record<string, string> = { plywood: "Plywood", structural_concrete: "Structural Concrete", steel_deck: "Steel Deck", wood_plank: "Wood Plank", lw_concrete: "LW Insulating Concrete" };

  const normDeck = (v: string) => ({ Plywood: 'plywood', OSB: 'plywood', 'Structural Concrete': 'structural_concrete', 'Steel Deck': 'steel_deck', 'Wood Plank': 'wood_plank', 'LW Insulating Concrete': 'lw_concrete' }[v] ?? v);
  const normCon = (v: string) => ({ 'New Construction': 'new', Reroof: 'reroof', Recover: 'recover' }[v] ?? v);
  const normEnc = (v: string) => ({ Enclosed: 'enclosed', 'Partially Enclosed': 'partially_enclosed', Open: 'open' }[v] ?? v);

  const fyValue = fd.tas105_mean_lbf ?? fd.fy_lbf ?? 29.48;
  const fySource = fd.tas105_mean_lbf ? 'tas105' : 'noa';

  const inputs: FastenerInputs = {
    V: 185, exposureCategory: (fd.exposure_category ?? 'C') as any, h: fd.mean_roof_height_ft ?? 20,
    Kzt: fd.Kzt ?? 1, Kd: 0.85, Ke: fd.Ke ?? 1,
    enclosure: normEnc(fd.enclosure_type ?? 'Enclosed') as any, riskCategory: (fd.risk_category ?? 'II') as any,
    buildingLength: fd.building_length_ft ?? 0, buildingWidth: fd.building_width_ft ?? 0,
    parapetHeight: fd.parapet_height_ft ?? 0, systemType: (fd.system_type ?? 'modified_bitumen') as any,
    deckType: normDeck(fd.deck_type ?? 'plywood') as any, constructionType: normCon(fd.construction_type ?? 'new') as any,
    existingLayers: fd.existing_layers === '2+' ? 2 : 1, sheetWidth_in: fd.sheet_width_in ?? 39.375,
    lapWidth_in: fd.lap_width_in ?? 4, Fy_lbf: fyValue,
    fySource: fySource as any, initialRows: fd.initial_rows ?? 4,
    noa: { approvalType: fd.noa_approval_type === 'FL Product Approval' ? 'fl_product_approval' : 'miami_dade_noa', approvalNumber: fd.noa_number ?? '', mdp_psf: fd.noa_mdp_psf ?? 0, mdp_basis: fd.noa_mdp_basis === 'Ultimate (will be ÷2 per TAS 114)' ? 'ultimate' : 'asd', asterisked: fd.noa_asterisked ?? false },
    boardLength_ft: fd.insulation_board_length_ft ?? 4, boardWidth_ft: fd.insulation_board_width_ft ?? 8,
    insulation_Fy_lbf: fd.insulation_fy_lbf ?? fyValue, county: fd.county === 'Miami-Dade' ? 'miami_dade' : 'broward',
    isHVHZ: true, ewa_membrane_ft2: fd.ewa_membrane_ft2 ?? 10,
  };
  const outputs = calculateFastener(inputs);

  rb.addSection('Project & Code Basis');
  rb.addInfoGrid({
    'Code Authority': 'FBC 8th Ed. (2023) · ASCE 7-22 Ch. 30 C&C',
    'Standards': 'RAS 117 · RAS 128 · RAS 137 · TAS 105',
    'Design Wind Speed': '185 mph (HVHZ, FBC §1620.1)',
    'Exposure': fd.exposure_category ?? 'C',
    'Risk Category': fd.risk_category ?? 'II',
    'Construction Type': fd.construction_type ?? '',
    'County': fd.county ?? '',
    'Data Source': 'Field submission — technician documented',
  });

  rb.addSection('Building & Roof System');
  rb.addInfoGrid({
    'Width × Length': `${fd.building_width_ft ?? ''} ft × ${fd.building_length_ft ?? ''} ft`,
    'Mean Roof Height': `${fd.mean_roof_height_ft ?? ''} ft`,
    'Parapet Height': `${fd.parapet_height_ft ?? 0} ft`,
    'Roof System': SYSTEM_LABELS[fd.system_type] ?? fd.system_type ?? '',
    'Deck Type': DECK_LABELS[normDeck(fd.deck_type ?? '')] ?? fd.deck_type ?? '',
    'Sheet Width': fd.sheet_width_in ? `${fd.sheet_width_in}"` : 'N/A (adhered)',
    'Lap Width': fd.lap_width_in ? `${fd.lap_width_in}"` : 'N/A (adhered)',
  });

  rb.addSection('NOA / Product Approval');
  rb.addInfoGrid({
    'Approval Type': fd.noa_approval_type ?? '',
    'Approval Number': fd.noa_number ?? '',
    'Manufacturer': fd.noa_manufacturer ?? '',
    'Product': fd.noa_product ?? '',
    'System No.': fd.noa_system_number ?? '',
    'NOA MDP (ASD)': `${Math.abs(fd.noa_mdp_psf ?? 0)} psf`,
    'Asterisked Assembly': fd.noa_asterisked ? 'Yes — extrapolation prohibited' : 'No',
  });

  rb.addSection('Wind Pressure Calculation');
  rb.addTextBlock(outputs.derivation.eq_26_10_1);
  rb.addTextBlock(outputs.derivation.qh_asd);
  rb.addTextBlock(outputs.derivation.eq_30_3_1);
  rb.addInfoGrid({
    'Kh': String(outputs.Kh),
    'qh,ASD': `${outputs.qh_ASD} psf`,
    'Zone Width (a)': `${outputs.zonePressures.zoneWidth_ft} ft`,
    'GCpi': String(outputs.GCpi),
  });

  rb.addSection('Zone Pressures & NOA Compliance');
  outputs.noaResults.forEach(nr => {
    rb.addInfoGrid({
      [`Zone ${nr.zone} Pressure`]: `${Math.abs(nr.P_psf).toFixed(1)} psf`,
      [`Zone ${nr.zone} MDP`]: `${Math.abs(nr.MDP_psf)} psf`,
      [`Zone ${nr.zone} Factor`]: `${nr.extrapFactor.toFixed(2)}×`,
      [`Zone ${nr.zone} Basis`]: nr.basis,
    });
  });

  rb.addSection('Fastener Attachment Schedule');
  if (fd.system_type === 'adhered') {
    rb.addTextBlock('Adhered membrane system — no mechanical row spacing. Verify adhesive bond strength per TAS 124.');
  } else {
    outputs.fastenerResults.forEach(fr => {
      rb.addInfoGrid({
        [`Zone ${fr.zone} — Pressure`]: `${fr.P_psf} psf`,
        [`Zone ${fr.zone} — Rows`]: String(fr.n_rows),
        [`Zone ${fr.zone} — Row Spacing`]: `${fr.RS_in}"`,
        [`Zone ${fr.zone} — Field Spacing`]: `${fr.FS_used_in}"`,
        [`Zone ${fr.zone} — Half-Sheet`]: fr.halfSheetRequired ? 'Required' : 'Not required',
        [`Zone ${fr.zone} — Basis`]: fr.noaCheck.basis,
      });
    });
  }

  rb.addSection('Insulation Board Fasteners');
  outputs.insulationResults.forEach(ir => {
    rb.addInfoGrid({ [`Zone ${ir.zone}`]: `${ir.N_used} fasteners (${ir.layout}) — ${ir.P_psf} psf` });
  });

  if (fd.tas105_mean_lbf) {
    rb.addSection('TAS 105 Laboratory Test Results');
    rb.addInfoGrid({
      'Mean Pullout Value': `${fd.tas105_mean_lbf} lbf`,
      'Testing Agency': fd.tas105_agency ?? '(see attached lab report)',
      'Test Date': fd.tas105_date ?? '',
      'Source': 'Third-party laboratory report',
    });
  }

  rb.addSection('Warnings & Engineering Notes');
  const nonInfoWarnings = outputs.warnings.filter(w => w.level !== 'info');
  if (nonInfoWarnings.length > 0) {
    nonInfoWarnings.forEach(w => rb.addTextBlock(`[${w.level.toUpperCase()}] ${w.message} (${w.reference ?? ''})`));
  } else {
    rb.addTextBlock('No engineering warnings. System meets all HVHZ requirements.');
  }

  rb.addSection('Disclaimer');
  rb.addTextBlock('This report is based on provided field measurements and NOA documentation. The Engineer of Record has reviewed and verified all inputs. Calculations per FBC 8th Ed. (2023), ASCE 7-22, RAS 117/128/137.');
}
