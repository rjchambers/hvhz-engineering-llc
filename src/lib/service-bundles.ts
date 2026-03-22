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
    services: ["fastener-calculation", "wind-mitigation-permit"],
    savings: 0,
    popular: true,
  },
  {
    id: "full-inspection",
    name: "Full Roof Assessment",
    description: "Comprehensive moisture survey with fastener and drainage analysis.",
    services: ["tas-126", "fastener-calculation", "drainage-analysis"],
    savings: 0,
  },
  {
    id: "drainage-permit",
    name: "Drainage & Wind Permit Package",
    description: "Complete drainage analysis plus wind mitigation for new construction or reroof.",
    services: ["drainage-analysis", "wind-mitigation-permit", "fastener-calculation"],
    savings: 0,
  },
];

export function getRecommendedServices(selectedServices: string[]): string[] {
  const recommendations: string[] = [];

  if (selectedServices.includes("fastener-calculation") && !selectedServices.includes("wind-mitigation-permit")) {
    recommendations.push("wind-mitigation-permit");
  }

  if (selectedServices.includes("drainage-analysis") && !selectedServices.includes("fastener-calculation")) {
    recommendations.push("fastener-calculation");
  }

  if (selectedServices.includes("roof-inspection") && !selectedServices.includes("roof-certification")) {
    recommendations.push("roof-certification");
  }

  if (selectedServices.includes("wind-mitigation-permit") && !selectedServices.includes("fastener-calculation")) {
    recommendations.push("fastener-calculation");
  }

  return recommendations.filter((r) => !selectedServices.includes(r));
}
