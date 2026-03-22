export interface ServiceBundle {
  id: string;
  name: string;
  description: string;
  services: string[];
  savings: number;
  popular?: boolean;
}

export const SERVICE_BUNDLES: ServiceBundle[] = [
  {
    id: "reroof-package",
    name: "Reroof Engineering Package",
    description: "Everything needed for a roofing permit in HVHZ. Most popular for reroofing contractors.",
    services: ["enhanced-fastener", "wind-mitigation"],
    savings: 0,
    popular: true,
  },
  {
    id: "full-inspection",
    name: "Full Roof Assessment",
    description: "Comprehensive moisture survey with fastener and drainage analysis.",
    services: ["tas-126", "enhanced-fastener", "drainage"],
    savings: 0,
  },
  {
    id: "drainage-permit",
    name: "Drainage & Wind Permit Package",
    description: "Complete drainage analysis plus wind mitigation for new construction or reroof.",
    services: ["drainage", "wind-mitigation", "enhanced-fastener"],
    savings: 0,
  },
];

export function getRecommendedServices(selectedServices: string[]): string[] {
  const recommendations: string[] = [];

  if (selectedServices.includes("enhanced-fastener") && !selectedServices.includes("wind-mitigation")) {
    recommendations.push("wind-mitigation");
  }

  if (selectedServices.includes("drainage") && !selectedServices.includes("enhanced-fastener")) {
    recommendations.push("enhanced-fastener");
  }

  if (selectedServices.includes("tas-126") && !selectedServices.includes("drainage")) {
    recommendations.push("drainage");
  }

  if (selectedServices.includes("wind-mitigation") && !selectedServices.includes("enhanced-fastener")) {
    recommendations.push("enhanced-fastener");
  }

  return recommendations.filter((r) => !selectedServices.includes(r));
}
