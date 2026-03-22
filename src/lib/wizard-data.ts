export interface WizardData {
  // Step 1 - Company
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  company_address: string;
  company_city: string;
  company_state: string;
  company_zip: string;
  // Step 2 - Job Site & Services
  job_address: string;
  job_city: string;
  job_zip: string;
  job_county: string;
  gated_community: boolean;
  gate_code: string;
  selected_services: string[];
  other_service_details: string;
  // Step 3 - Site Data Collection
  noa_document_path: string;
  noa_document_name: string;
  noa_system_number: string;
  roof_report_path: string;
  roof_report_name: string;
  roof_report_type: string; // "roofr" | "eagleview" | "other"
  // Step 4 - Review & Pay
  terms_accepted: boolean;
}

const STORAGE_KEY = "hvhz-new-order-wizard";

export const defaultWizardData: WizardData = {
  company_name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  company_address: "",
  company_city: "",
  company_state: "FL",
  company_zip: "",
  job_address: "",
  job_city: "",
  job_zip: "",
  job_county: "",
  gated_community: false,
  gate_code: "",
  selected_services: [],
  other_service_details: "",
  noa_document_path: "",
  noa_document_name: "",
  noa_system_number: "",
  roof_report_path: "",
  roof_report_name: "",
  roof_report_type: "",
  terms_accepted: false,
};

export function loadWizardData(): WizardData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...defaultWizardData, ...JSON.parse(saved) };
  } catch {}
  return { ...defaultWizardData };
}

export function saveWizardData(data: WizardData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearWizardData() {
  localStorage.removeItem(STORAGE_KEY);
}
