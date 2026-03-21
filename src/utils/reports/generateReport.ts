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
  rb.addSection('Building Dimensions');
  rb.addInfoGrid({
    'Width': fd.building_width_ft ? `${fd.building_width_ft} ft` : '',
    'Length': fd.building_length_ft ? `${fd.building_length_ft} ft` : '',
    'Eave Height': fd.eave_height_ft ? `${fd.eave_height_ft} ft` : '',
    'Mean Roof Height': fd.mean_roof_height_ft ? `${fd.mean_roof_height_ft} ft` : '',
  });

  rb.addSection('Roof & Fastener Details');
  rb.addInfoGrid({
    'Roof Type': fd.roof_type ?? '',
    'Deck Type': fd.deck_type ?? '',
    'Fastener Type': fd.fastener_type ?? '',
    'Fastener Size': fd.fastener_size ?? '',
    'Field Zone Spacing': fd.field_zone_spacing ?? '',
    'Perimeter Zone Spacing': fd.perimeter_zone_spacing ?? '',
    'Corner Zone Spacing': fd.corner_zone_spacing ?? '',
    'NOA System': fd.noa_system ?? '',
  });
}
