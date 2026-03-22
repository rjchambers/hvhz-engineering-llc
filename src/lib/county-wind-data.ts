export interface CountyWindData {
  V_mph: number;
  exposureSuggestion: 'B' | 'C' | 'D';
  isHVHZ: boolean;
  note?: string;
}

export const FLORIDA_COUNTY_WIND: Record<string, CountyWindData> = {
  'Miami-Dade':    { V_mph: 185, exposureSuggestion: 'C', isHVHZ: true,  note: 'HVHZ — Miami-Dade NOA required' },
  'Broward':       { V_mph: 175, exposureSuggestion: 'C', isHVHZ: true,  note: 'HVHZ — FL Product Approval accepted' },
  'Monroe':        { V_mph: 185, exposureSuggestion: 'D', isHVHZ: true,  note: 'HVHZ — Exposure D for coastal sites' },
  'Palm Beach':    { V_mph: 165, exposureSuggestion: 'C', isHVHZ: false },
  'Martin':        { V_mph: 160, exposureSuggestion: 'C', isHVHZ: false },
  'St. Lucie':     { V_mph: 160, exposureSuggestion: 'C', isHVHZ: false },
  'Indian River':  { V_mph: 155, exposureSuggestion: 'C', isHVHZ: false },
  'Brevard':       { V_mph: 150, exposureSuggestion: 'C', isHVHZ: false },
  'Collier':       { V_mph: 170, exposureSuggestion: 'C', isHVHZ: false },
  'Lee':           { V_mph: 165, exposureSuggestion: 'C', isHVHZ: false },
  'Charlotte':     { V_mph: 160, exposureSuggestion: 'C', isHVHZ: false },
  'Sarasota':      { V_mph: 155, exposureSuggestion: 'C', isHVHZ: false },
  'Hillsborough':  { V_mph: 145, exposureSuggestion: 'C', isHVHZ: false },
  'Pinellas':      { V_mph: 150, exposureSuggestion: 'C', isHVHZ: false },
};

export function lookupByCounty(county: string): CountyWindData | null {
  return FLORIDA_COUNTY_WIND[county] ?? null;
}
