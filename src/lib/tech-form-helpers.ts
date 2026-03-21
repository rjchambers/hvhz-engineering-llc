// Photo section tags by service type
export const PHOTO_SECTION_TAGS: Record<string, string[]> = {
  "roof-inspection": [
    "Overview", "North Elevation", "South Elevation", "East Elevation",
    "West Elevation", "Membrane Surface", "Flashing", "Drainage", "Penetrations",
    "Defect - 1", "Defect - 2", "Defect - 3", "Interior/Attic",
  ],
  "roof-certification": [
    "Overview", "North Elevation", "South Elevation", "East Elevation",
    "West Elevation", "Membrane Surface", "Flashing", "Drainage", "Penetrations",
    "Defect - 1", "Defect - 2", "Defect - 3", "Interior/Attic",
  ],
  "drainage-analysis": [
    "Primary Drain D1", "Primary Drain D2", "Primary Drain D3",
    "Secondary OD1", "Secondary OD2",
    "Slope Measurement", "Ponding Area", "Overview", "Parapet / Edge Detail",
  ],
  "special-inspection": [
    "Fastener Pattern", "Deck Attachment", "Roof Covering", "General",
  ],
  "wind-mitigation-permit": [
    "Roof Covering", "Deck Attachment", "Roof-to-Wall Connection",
    "Opening Protection", "Garage Door", "Overview",
  ],
  "fastener-calculation": [
    "Fastener Field Zone", "Fastener Perimeter Zone", "Fastener Corner Zone",
    "Deck Condition", "Existing Membrane", "NOA Label / Approval Tag",
    "TAS 105 Test Location", "Overview",
  ],
};

export const MIN_PHOTO_COUNTS: Record<string, number> = {
  "roof-inspection": 6,
  "roof-certification": 6,
  "drainage-analysis": 5,
  "special-inspection": 3,
  "wind-mitigation-permit": 4,
  "fastener-calculation": 5,
};

// Standard FBC checklist items by special-inspection type
export const SPECIAL_INSPECTION_CHECKLISTS: Record<string, string[]> = {
  "Roof Deck Fastening": [
    "Deck fastener type matches approved NOA",
    "Fastener spacing meets HVHZ requirements",
    "Fastener penetration depth is adequate",
    "Deck panels properly staggered",
    "Edge fastening at proper spacing",
    "No missing or damaged fasteners observed",
    "Deck material matches approved plans",
    "Ring-shank nails or screws as specified",
  ],
  "Roof Covering": [
    "Roof covering installed per manufacturer specs",
    "Underlayment type and installation verified",
    "Flashing properly installed at all penetrations",
    "Drip edge installed per FBC requirements",
    "Hip and ridge properly secured",
    "Valley installation meets code requirements",
    "Starter course properly installed",
    "NOA product approval verified and current",
  ],
  "Rooftop Equipment": [
    "Equipment curb properly flashed",
    "Structural support adequate for wind loads",
    "Equipment anchoring meets HVHZ requirements",
    "Penetration waterproofing verified",
    "Lightning protection where required",
    "Equipment clearance from roof edge adequate",
    "Condensate drainage properly routed",
    "Vibration isolation installed where required",
  ],
  "Other": [
    "Installation matches approved plans",
    "Materials match NOA approvals",
    "Fastener type and spacing verified",
    "Waterproofing properly installed",
    "Structural connections adequate",
    "Code compliance verified",
    "Manufacturer specifications followed",
    "Documentation complete and accurate",
  ],
};

// Compress image to max dimension
export async function compressImage(file: File, maxDim = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}
