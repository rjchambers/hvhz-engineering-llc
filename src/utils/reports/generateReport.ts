import { HVHZReportBuilder, type ReportConfig, type PhotoData } from './reportLayout';
import { format } from 'date-fns';
import { runDrainageCalc, DESIGN_RAINFALL, type DrainageCalcInputs } from '@/lib/drainage-calc';
import { calculateFastener, type FastenerInputs } from '@/lib/fastener-engine';
import { computeFastenerCalc, type FastenerCalcInputs, type FastenerCalcResults } from '@/lib/wind-calc';

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
  peNotes: string | null,
  photos?: PhotoData[]
): { blob: Blob; stampBoxMm: { x: number; y: number; size: number } | null } {
  const title = SERVICE_TITLES[serviceType] || serviceType;
  const address = [workOrder.orders?.job_address, workOrder.orders?.job_city, workOrder.orders?.job_zip].filter(Boolean).join(', ');
  const jobNum = workOrder.id.slice(0, 8).toUpperCase();
  const signedDate = format(new Date(), 'MMMM d, yyyy');
  const inspDate = fieldData.inspection_date ? format(new Date(fieldData.inspection_date), 'MMMM d, yyyy') : signedDate;

  const config: ReportConfig = {
    title,
    jobNumber: jobNum,
    address,
    county: workOrder.orders?.job_county ?? '',
    clientName: fieldData.client_name ?? '',
    engineerName: engineerProfile.full_name,
    peLicense: `FL #${engineerProfile.pe_license_number ?? 'N/A'}`,
    reportDate: signedDate,
    inspectionDate: inspDate,
  };

  const rb = new HVHZReportBuilder(config);

  // All reports: 1.0 Scope, 2.0 Codes
  rb.addScopeSection(serviceType);
  rb.addCodeReferencesSection(serviceType);

  // Service-specific
  switch (serviceType) {
    case 'fastener-calculation':
      buildFastenerReport(rb, fieldData, workOrder);
      break;
    case 'drainage-analysis':
      buildDrainageReport(rb, fieldData, workOrder);
      break;
    case 'wind-mitigation-permit':
      buildWindReport(rb, fieldData, photos);
      break;
    case 'roof-inspection':
      buildRoofInspectionReport(rb, fieldData);
      break;
    case 'roof-certification':
      buildRoofCertificationReport(rb, fieldData);
      break;
    case 'special-inspection':
      buildSpecialInspectionReport(rb, fieldData);
      break;
  }

  // Disclaimer + signature
  const disclaimerNum = getDisclaimerSectionNum(serviceType);
  rb.addDisclaimerSection(disclaimerNum);
  rb.addPESignaturePage(engineerProfile, peNotes, signedDate);

  return rb.toResult();
}

function getDisclaimerSectionNum(serviceType: string): string {
  const nums: Record<string, string> = {
    'fastener-calculation': '10.0',
    'drainage-analysis': '11.0',
    'wind-mitigation-permit': '9.0',
    'roof-inspection': '7.0',
    'roof-certification': '7.0',
    'special-inspection': '6.0',
  };
  return nums[serviceType] ?? '10.0';
}

// ─── FASTENER CALCULATION ─────────────────────────────────────
function buildFastenerReport(rb: HVHZReportBuilder, fd: Record<string, any>, wo: any) {
  const SYSTEM_LABELS: Record<string, string> = { modified_bitumen: "Modified Bitumen (RAS 117)", single_ply: "Single-Ply TPO/EPDM (RAS 137)", adhered: "Adhered Membrane (TAS 124)" };
  const DECK_LABELS: Record<string, string> = { plywood: "Plywood", structural_concrete: "Structural Concrete", steel_deck: "Steel Deck", wood_plank: "Wood Plank", lw_concrete: "LW Insulating Concrete" };

  const normDeck = (v: string) => ({ Plywood: 'plywood', OSB: 'plywood', 'Structural Concrete': 'structural_concrete', 'Steel Deck': 'steel_deck', 'Wood Plank': 'wood_plank', 'LW Insulating Concrete': 'lw_concrete' }[v] ?? v);
  const normCon = (v: string) => ({ 'New Construction': 'new', Reroof: 'reroof', Recover: 'recover' }[v] ?? v);
  const normEnc = (v: string) => ({ Enclosed: 'enclosed', 'Partially Enclosed': 'partially_enclosed', Open: 'open' }[v] ?? v);

  const fyValue = fd.tas105_mean_lbf ?? fd.fy_lbf ?? 29.48;

  const inputs: FastenerInputs = {
    V: 185, exposureCategory: (fd.exposure_category ?? 'C') as any, h: fd.mean_roof_height_ft ?? 20,
    Kzt: fd.Kzt ?? 1, Kd: 0.85, Ke: fd.Ke ?? 1,
    enclosure: normEnc(fd.enclosure_type ?? 'Enclosed') as any, riskCategory: (fd.risk_category ?? 'II') as any,
    buildingLength: fd.building_length_ft ?? 0, buildingWidth: fd.building_width_ft ?? 0,
    parapetHeight: fd.parapet_height_ft ?? 0, systemType: (fd.system_type ?? 'modified_bitumen') as any,
    deckType: normDeck(fd.deck_type ?? 'plywood') as any, constructionType: normCon(fd.construction_type ?? 'new') as any,
    existingLayers: fd.existing_layers === '2+' ? 2 : 1, sheetWidth_in: fd.sheet_width_in ?? 39.375,
    lapWidth_in: fd.lap_width_in ?? 4, Fy_lbf: fyValue,
    fySource: (fd.tas105_mean_lbf ? 'tas105' : 'noa') as any, initialRows: fd.initial_rows ?? 4,
    noa: { approvalType: fd.noa_approval_type === 'FL Product Approval' ? 'fl_product_approval' : 'miami_dade_noa', approvalNumber: fd.noa_number ?? '', mdp_psf: fd.noa_mdp_psf ?? 0, mdp_basis: fd.noa_mdp_basis === 'Ultimate (will be ÷2 per TAS 114)' ? 'ultimate' : 'asd', asterisked: fd.noa_asterisked ?? false },
    boardLength_ft: fd.insulation_board_length_ft ?? 4, boardWidth_ft: fd.insulation_board_width_ft ?? 8,
    insulation_Fy_lbf: fd.insulation_fy_lbf ?? fyValue, county: fd.county === 'Miami-Dade' ? 'miami_dade' : 'broward',
    isHVHZ: true, ewa_membrane_ft2: fd.ewa_membrane_ft2 ?? 10,
  };
  const outputs = calculateFastener(inputs);

  // 3.0 Design Parameters
  rb.addSection('3.0', 'DESIGN PARAMETERS');
  rb.addSubSection('3.1', 'Wind Load Parameters');
  rb.addTable(
    ['Parameter', 'Value', 'Reference'],
    [
      ['Basic Wind Speed (V)', '185 mph', 'FBC §1620.1 (HVHZ)'],
      ['Exposure Category', fd.exposure_category ?? 'C', 'ASCE 7-22 §26.7'],
      ['Velocity Pressure Coeff (Kh)', String(outputs.Kh), 'ASCE 7-22 Table 26.10-1'],
      ['Topographic Factor (Kzt)', String(fd.Kzt ?? 1.0), 'ASCE 7-22 §26.8'],
      ['Directionality Factor (Kd)', '0.85', 'ASCE 7-22 Table 26.6-1'],
      ['Ground Elevation Factor (Ke)', String(fd.Ke ?? 1.0), 'ASCE 7-22 Table 26.9-1'],
      ['Risk Category', fd.risk_category ?? 'II', 'ASCE 7-22 Table 1.5-1'],
    ],
    { headerColor: 'teal', compactMode: true }
  );

  rb.addSubSection('3.2', 'Building Geometry');
  rb.addInfoGrid({
    'Width': `${fd.building_width_ft ?? ''} ft`,
    'Length': `${fd.building_length_ft ?? ''} ft`,
    'Mean Roof Height': `${fd.mean_roof_height_ft ?? ''} ft`,
    'Parapet Height': `${fd.parapet_height_ft ?? 0} ft`,
  });

  // 4.0 Roof System & Product Approval
  rb.addSection('4.0', 'ROOF SYSTEM & PRODUCT APPROVAL');
  rb.addSubSection('4.1', 'Roof Assembly');
  rb.addInfoGrid({
    'Roof System': SYSTEM_LABELS[fd.system_type] ?? fd.system_type ?? '',
    'Deck Type': DECK_LABELS[normDeck(fd.deck_type ?? '')] ?? fd.deck_type ?? '',
    'Construction Type': fd.construction_type ?? '',
    'Sheet Width': fd.sheet_width_in ? `${fd.sheet_width_in}"` : 'N/A (adhered)',
    'Lap Width': fd.lap_width_in ? `${fd.lap_width_in}"` : 'N/A (adhered)',
  });

  rb.addSubSection('4.2', 'NOA / Product Approval');
  rb.addInfoGrid({
    'Approval Type': fd.noa_approval_type ?? '',
    'Approval Number': fd.noa_number ?? '',
    'Manufacturer': fd.noa_manufacturer ?? '',
    'Product': fd.noa_product ?? '',
    'System No.': fd.noa_system_number ?? '',
    'NOA MDP (ASD)': `${Math.abs(fd.noa_mdp_psf ?? 0)} psf`,
    'Asterisked Assembly': fd.noa_asterisked ? 'Yes — extrapolation prohibited' : 'No',
  });

  // 5.0 Wind Pressure Calculation
  rb.addSection('5.0', 'WIND PRESSURE CALCULATION');
  rb.addSubSection('5.1', 'Velocity Pressure');
  rb.addDerivationBlock([
    outputs.derivation.eq_26_10_1,
    outputs.derivation.qh_asd,
  ]);

  rb.addSubSection('5.2', 'Zone Pressures');
  rb.addTable(
    ['Zone', 'Net Pressure (psf)', 'MDP (psf)'],
    outputs.noaResults.map(nr => [
      `Zone ${nr.zone}`,
      `${Math.abs(nr.P_psf).toFixed(1)}`,
      `${Math.abs(nr.MDP_psf)}`,
    ]),
  );

  rb.addSubSection('5.3', 'NOA Compliance Check');
  rb.addTable(
    ['Zone', 'Pressure (psf)', 'MDP (psf)', 'Factor', 'Status'],
    outputs.noaResults.map(nr => [
      `Zone ${nr.zone}`,
      `${Math.abs(nr.P_psf).toFixed(1)}`,
      `${Math.abs(nr.MDP_psf)}`,
      `${nr.extrapFactor.toFixed(2)}×`,
      nr.basis,
    ]),
    { statusColumn: 4 }
  );

  // 6.0 Fastener Attachment Schedule
  rb.addSection('6.0', 'FASTENER ATTACHMENT SCHEDULE');
  if (fd.system_type === 'adhered') {
    rb.addCalloutBox('Adhered membrane system — no mechanical row spacing. Verify adhesive bond strength per TAS 124.', 'info');
  } else {
    rb.addTable(
      ['Zone', 'Pressure (psf)', 'Rows', 'Row Spacing', 'Field Spacing', 'Half-Sheet', 'Basis'],
      outputs.fastenerResults.map(fr => [
        `Zone ${fr.zone}`,
        `${fr.P_psf}`,
        String(fr.n_rows),
        `${fr.RS_in}"`,
        `${fr.FS_used_in}"`,
        fr.halfSheetRequired ? 'Required' : 'No',
        fr.noaCheck.basis,
      ]),
      { statusColumn: 6 }
    );
  }

  // 7.0 Insulation Board Fasteners
  rb.addSection('7.0', 'INSULATION BOARD FASTENERS');
  rb.addTable(
    ['Zone', 'Pressure (psf)', 'Fasteners', 'Layout'],
    outputs.insulationResults.map(ir => [
      `Zone ${ir.zone}`,
      `${ir.P_psf}`,
      String(ir.N_used),
      ir.layout,
    ]),
  );

  // 8.0 TAS 105 (conditional)
  if (fd.tas105_mean_lbf) {
    rb.addSection('8.0', 'TAS 105 LABORATORY RESULTS');
    rb.addInfoGrid({
      'Mean Pullout Value': `${fd.tas105_mean_lbf} lbf`,
      'Testing Agency': fd.tas105_agency ?? '(see attached lab report)',
      'Test Date': fd.tas105_date ?? '',
      'Source': 'Third-party laboratory report',
    });
  }

  // 9.0 Warnings & Engineering Notes
  rb.addSection('9.0', 'WARNINGS & ENGINEERING NOTES');
  const nonInfoWarnings = outputs.warnings.filter(w => w.level !== 'info');
  if (nonInfoWarnings.length > 0) {
    nonInfoWarnings.forEach(w => {
      const type = w.level === 'warning' ? 'warning' : 'error';
      rb.addCalloutBox(`${w.message}${w.reference ? ` (${w.reference})` : ''}`, type);
    });
  } else {
    rb.addCalloutBox('No engineering warnings. System meets all HVHZ requirements.', 'success');
  }
}

// ─── DRAINAGE ANALYSIS ────────────────────────────────────────
function buildDrainageReport(rb: HVHZReportBuilder, fd: Record<string, any>, wo: any) {
  const county = fd.county || wo.orders?.job_county || 'Broward';
  const rainfallRate = fd.pe_rainfall_rate ?? DESIGN_RAINFALL[county] ?? 8.39;

  const zones = fd.drainage_zones ?? [];
  const primaryDrains = fd.primary_drains ?? [];
  const secondaryDrains = fd.secondary_drains ?? [];

  const calcInputs: DrainageCalcInputs = {
    county,
    rainfall_override: fd.pe_rainfall_override ? fd.pe_rainfall_rate : undefined,
    pipe_slope_assumption: fd.pe_pipe_slope_assumption ?? '1/8',
    zones,
    primary_drains: primaryDrains,
    secondary_drains: secondaryDrains,
  };
  const results = runDrainageCalc(calcInputs);

  // 3.0 Design Basis
  rb.addSection('3.0', 'DESIGN BASIS');
  rb.addSubSection('3.1', 'Design Storm Parameters');
  rb.addInfoGrid({
    'Code Authority': 'FBC Plumbing 2023 §1101–1106; FBC Building 2023 §1502',
    'Design Storm': '100-Year, 1-Hour (NOAA Atlas 14)',
    'County': county,
    'Design Rainfall': fd.pe_rainfall_override ? `${fd.pe_rainfall_rate} in/hr (PE override)` : `${DESIGN_RAINFALL[county] ?? 8.39} in/hr`,
    'Secondary Required': 'Yes — FBC §1502.3 (HVHZ mandate)',
  });

  rb.addSubSection('3.2', 'Pipe Slope Assumption');
  rb.addInfoGrid({ 'Slope': fd.pe_pipe_slope_assumption ?? '1/8" per ft' });

  // 4.0 Drainage Zone Delineation
  rb.addSection('4.0', 'DRAINAGE ZONE DELINEATION');
  rb.addTable(
    ['Zone', 'Description', 'Area (sqft)', 'Lowest Point'],
    zones.map((z: any) => [
      z.zone_id ?? '',
      z.description ?? '',
      String(z.area_sqft ?? ''),
      z.lowest_point ?? '—',
    ]),
  );

  // 5.0 Required Flow Calculation
  rb.addSection('5.0', 'REQUIRED FLOW CALCULATION');
  rb.addTable(
    ['Zone', 'Area (sqft)', 'Rainfall (in/hr)', 'Q Required (gpm)', 'Formula'],
    results.zone_results.map(zr => [
      `Zone ${zr.zone_id}`,
      String(zr.area_sqft),
      String(rainfallRate),
      String(zr.q_required_gpm),
      'A × I / 96.23',
    ]),
  );
  rb.addTextBlock(`Total Required Capacity: ${results.total_required_gpm} gpm`, { bold: true });

  // 6.0 Primary Drain Capacity
  rb.addSection('6.0', 'PRIMARY DRAIN CAPACITY');
  results.zone_results.forEach(zr => {
    rb.addSubSection('', `Zone ${zr.zone_id}`);
    if (zr.primary_drains.length > 0) {
      rb.addTable(
        ['Drain ID', 'Diameter', 'Type', 'Capacity (gpm)', 'FBC Table'],
        zr.primary_drains.map(d => [
          d.drain_id,
          `${d.diameter_in}"`,
          d.leader_type,
          String(d.rated_capacity_gpm),
          d.fbc_table,
        ]),
        { compactMode: true }
      );
    }
    rb.addInfoGrid({
      'Provided': `${zr.q_primary_provided_gpm} gpm`,
      'Required': `${zr.q_required_gpm} gpm`,
      'Status': zr.primary_adequate ? 'ADEQUATE ✓' : 'DEFICIENT ✗',
    });
  });

  // 7.0 Secondary / Overflow Drains
  rb.addSection('7.0', 'SECONDARY / OVERFLOW DRAINS');
  results.zone_results.forEach(zr => {
    rb.addSubSection('', `Zone ${zr.zone_id}`);
    if (zr.secondary_drains.length > 0) {
      rb.addTable(
        ['Drain ID', 'Type', 'Capacity (gpm)', 'Height Above Primary', 'FBC Compliant'],
        zr.secondary_drains.map(d => [
          d.drain_id,
          d.type,
          String(d.rated_capacity_gpm),
          `${d.height_above_primary_in}"`,
          zr.secondary_adequate ? 'Yes' : 'No',
        ]),
        { statusColumn: 4, compactMode: true }
      );
    }
    rb.addInfoGrid({
      'Secondary Provided': `${zr.q_secondary_provided_gpm} gpm`,
      'FBC §1502.3': zr.secondary_adequate ? 'COMPLIANT' : 'DEFICIENT',
    });
  });

  // 8.0 Drainage Compliance Matrix
  rb.addSection('8.0', 'DRAINAGE COMPLIANCE MATRIX');
  rb.addTable(
    ['Zone', 'Primary Status', 'Secondary Status', 'Overall'],
    results.zone_results.map(zr => [
      `Zone ${zr.zone_id}`,
      zr.primary_adequate ? 'COMPLIANT' : 'DEFICIENT',
      zr.secondary_adequate ? 'COMPLIANT' : 'DEFICIENT',
      zr.primary_adequate && zr.secondary_adequate ? 'PASS' : 'FAIL',
    ]),
    { statusColumn: 3 }
  );
  rb.addInfoGrid({
    'Primary System': results.overall_primary_adequate ? 'COMPLIANT' : 'DEFICIENT',
    'Secondary System (FBC §1502.3)': results.overall_secondary_adequate ? 'COMPLIANT' : 'DEFICIENT',
    'Total Required': `${results.total_required_gpm} gpm`,
    'Total Provided (Primary)': `${results.total_primary_provided_gpm} gpm`,
  });

  // 9.0 Engineering Deficiencies
  rb.addSection('9.0', 'ENGINEERING DEFICIENCIES');
  if (results.deficiencies.length > 0) {
    results.deficiencies.forEach(d => rb.addCalloutBox(d, 'error'));
  } else {
    rb.addCalloutBox('No engineering deficiencies identified. All drainage systems meet code requirements.', 'success');
  }

  // 10.0 Field Observations
  rb.addSection('10.0', 'FIELD OBSERVATIONS');
  rb.addInfoGrid({
    'Roof Type': fd.roof_type ?? '',
    'Membrane': fd.roof_membrane ?? '',
    'Ponding Observed': fd.ponding_observed ? 'Yes' : 'No',
    'Drain Conditions': fd.drain_conditions_summary ?? '',
  });
  if (fd.ponding_observed && fd.ponding_areas?.length) {
    rb.addTextBlock('Ponding Areas:', { bold: true });
    fd.ponding_areas.forEach((p: any) => {
      rb.addTextBlock(`Location: ${p.location}, Area: ${p.area_sqft} sqft, Depth: ${p.depth_in}", ${p.hours_after_rain}hrs after rain`, { indent: true });
    });
  }
  if (fd.deficiencies_observed) rb.addTextBlock(`Field Deficiencies: ${fd.deficiencies_observed}`);
  if (fd.recommendations) rb.addTextBlock(`Recommendations: ${fd.recommendations}`);
}

// ─── WIND MITIGATION ──────────────────────────────────────────
function buildWindReport(rb: HVHZReportBuilder, fd: Record<string, any>, photos?: PhotoData[]) {
  // 3.0 Building Information
  rb.addSection('3.0', 'BUILDING INFORMATION');
  rb.addInfoGrid({
    'Year Built': fd.year_built ?? '',
    'Occupancy': fd.occupancy_type ?? '',
    'Stories': fd.stories ?? '',
    'Width': fd.building_width_ft ? `${fd.building_width_ft} ft` : '',
    'Length': fd.building_length_ft ? `${fd.building_length_ft} ft` : '',
    'Wall Height': fd.wall_height_ft ? `${fd.wall_height_ft} ft` : '',
    'Mean Roof Height': fd.mean_roof_height_ft ? `${fd.mean_roof_height_ft} ft` : '',
  });

  // 4.0 Roof System
  rb.addSection('4.0', 'ROOF SYSTEM');
  rb.addSubSection('4.1', 'Roof Covering');
  rb.addInfoGrid({
    'Roof Shape': fd.roof_shape ?? '',
    'Covering Type': fd.roof_covering_type ?? '',
    'NOA Number': fd.noa_number ?? '',
    'NOA Expiry': fd.noa_expiry ? format(new Date(fd.noa_expiry), 'MM/dd/yyyy') : '',
    'Deck Type': fd.deck_type ?? '',
    'Deck Thickness': fd.deck_thickness ?? '',
  });

  rb.addSubSection('4.2', 'Fastener Details');
  rb.addInfoGrid({
    'Fastener Type': fd.fastener_type ?? '',
    'Fastener Size': fd.fastener_size ?? '',
  });

  // 5.0 Structural Connections
  rb.addSection('5.0', 'STRUCTURAL CONNECTIONS');
  rb.addInfoGrid({
    'Roof-to-Wall': fd.roof_to_wall_connection ?? '',
    'Connection Spacing': fd.connection_spacing_inches ? `${fd.connection_spacing_inches}"` : '',
  });

  // 6.0 Opening Protection
  rb.addSection('6.0', 'OPENING PROTECTION');
  rb.addInfoGrid({
    'All Openings Protected': fd.all_openings_protected ? 'Yes' : 'No',
    'Garage Door Rated': fd.garage_door_rated ? 'Yes' : 'No',
  });

  // 7.0 Wind Pressure Analysis (if calc results available)
  rb.addSection('7.0', 'WIND PRESSURE ANALYSIS');
  if (fd.calculation_results?.zones) {
    rb.addTable(
      ['Zone', 'Net Pressure (psf)'],
      fd.calculation_results.zones.map((z: any) => [
        `Zone ${z.zone}`,
        `${z.pressure_psf?.toFixed(1)}`,
      ]),
    );
  } else {
    rb.addTextBlock('Wind pressure calculation performed separately. Refer to attached calculation package if applicable.');
  }

  // 8.0 Photo Documentation
  if (photos && photos.length > 0) {
    rb.addPhotoPage(photos, '8.0');
  }
}

// ─── ROOF INSPECTION ──────────────────────────────────────────
function buildRoofInspectionReport(rb: HVHZReportBuilder, fd: Record<string, any>) {
  // 3.0 Roof System Details
  rb.addSection('3.0', 'ROOF SYSTEM DETAILS');
  rb.addInfoGrid({
    'Roof Type': fd.roof_type ?? '',
    'Roof Age': fd.roof_age_years ? `${fd.roof_age_years} years` : '',
    'Installation Year': fd.installation_year ?? '',
    'Overall Condition': fd.overall_condition ?? '',
    'Condition Score': fd.condition_score != null ? `${fd.condition_score}/100` : '',
  });

  // 4.0 Component Conditions
  rb.addSection('4.0', 'COMPONENT CONDITIONS');
  rb.addTable(
    ['Component', 'Condition', 'Notes'],
    [
      ['Drainage', fd.drainage_condition ?? '—', fd.ponding_observed ? 'Ponding observed' : ''],
      ['Surface', fd.surface_condition ?? '—', ''],
      ['Flashing', fd.flashing_condition ?? '—', ''],
      ['Penetrations', fd.penetrations_condition ?? '—', ''],
      ['Ventilation', fd.ventilation_condition ?? '—', ''],
    ],
  );

  // 5.0 Defects Found
  rb.addSection('5.0', 'DEFECTS FOUND');
  if (fd.defects_found?.length) {
    rb.addTable(
      ['#', 'Location', 'Description', 'Severity', 'Action', 'Priority'],
      fd.defects_found.map((d: any, i: number) => [
        String(i + 1),
        d.location ?? '',
        d.description ?? '',
        d.severity ?? '',
        d.recommended_action ?? '',
        d.priority ?? '',
      ]),
      { statusColumn: 3 }
    );
  } else {
    rb.addCalloutBox('No defects identified during inspection.', 'success');
  }

  // 6.0 Recommendations
  rb.addSection('6.0', 'RECOMMENDATIONS');
  rb.addTextBlock(fd.recommendations ?? 'None provided.');
  if (fd.estimated_remaining_life_years) {
    rb.addInfoGrid({ 'Estimated Remaining Life': `${fd.estimated_remaining_life_years} years` });
  }
}

// ─── ROOF CERTIFICATION ───────────────────────────────────────
function buildRoofCertificationReport(rb: HVHZReportBuilder, fd: Record<string, any>) {
  // Reuse inspection sections 3–5
  buildRoofInspectionReport(rb, fd);

  // 6.0 Certification Determination (overrides the inspection's 6.0)
  rb.addSection('6.0', 'CERTIFICATION DETERMINATION');
  rb.addSubSection('6.1', 'Recommendation');
  rb.addInfoGrid({
    'Certification Recommended': fd.certification_recommended ? 'Yes' : 'No',
    'Est. Remaining Life': fd.estimated_remaining_life_years ? `${fd.estimated_remaining_life_years} years` : '',
  });
  if (fd.certification_conditions) {
    rb.addSubSection('6.2', 'Conditions');
    rb.addTextBlock(fd.certification_conditions);
  }
}

// ─── SPECIAL INSPECTION ───────────────────────────────────────
function buildSpecialInspectionReport(rb: HVHZReportBuilder, fd: Record<string, any>) {
  // 3.0 Inspection Details
  rb.addSection('3.0', 'INSPECTION DETAILS');
  rb.addInfoGrid({
    'Inspection Type': fd.inspection_type ?? '',
    'Permit Number': fd.permit_number ?? '',
  });

  // 4.0 Inspection Checklist
  rb.addSection('4.0', 'INSPECTION CHECKLIST');
  if (fd.checklist_items?.length) {
    rb.addTable(
      ['#', 'Item', 'Result', 'Corrective Action'],
      fd.checklist_items.map((item: any, i: number) => [
        String(i + 1),
        item.item_description ?? '',
        item.result ?? '',
        item.corrective_action ?? '',
      ]),
      { statusColumn: 2 }
    );
  }

  // 5.0 Certification
  rb.addSection('5.0', 'CERTIFICATION');
  rb.addTextBlock('The undersigned inspector certifies that the above-referenced special inspection items have been observed and documented in accordance with the approved construction documents and applicable building codes.');
}

export { type PhotoData };
