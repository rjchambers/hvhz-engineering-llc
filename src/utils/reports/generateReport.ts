import { HVHZReportBuilder } from './reportLayout';
import { format } from 'date-fns';

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
      addDrainageSections(rb, fieldData);
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

function addDrainageSections(rb: HVHZReportBuilder, fd: Record<string, any>) {
  rb.addSection('Drainage System');
  rb.addInfoGrid({
    'Roof Area': fd.roof_area_sqft ? `${fd.roof_area_sqft} sqft` : '',
    'Number of Drains': fd.number_of_drains ?? '',
    'Drain Type': fd.drain_type ?? '',
    'Drain Size': fd.drain_size_inches ? `${fd.drain_size_inches}"` : '',
    'Overflow Drains': fd.number_overflow_drains ?? '',
    'Lowest Point': fd.lowest_point_location ?? '',
    'Ponding Evidence': fd.ponding_evidence ? 'Yes' : 'No',
  });
  if (fd.ponding_notes) rb.addTextBlock(fd.ponding_notes);

  if (fd.slope_measurements?.length) {
    rb.addSection('Slope Measurements');
    fd.slope_measurements.forEach((s: any) => {
      rb.addInfoGrid({ 'Location': s.location, 'Slope': `${s.slope_percent}%` });
    });
  }
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
