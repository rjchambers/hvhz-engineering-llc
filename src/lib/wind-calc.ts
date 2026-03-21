/**
 * ASCE 7-22 Wind Pressure Calculation Engine
 * For HVHZ permit-submittal engineering reports
 */

// Table 26.10-1, Exposure C
const KZ_C = [
  { z: 0, k: 0.85 },
  { z: 15, k: 0.85 },
  { z: 20, k: 0.90 },
  { z: 25, k: 0.94 },
  { z: 30, k: 0.98 },
  { z: 40, k: 1.04 },
  { z: 50, k: 1.09 },
  { z: 60, k: 1.13 },
];

export function getKz(h: number): number {
  if (h <= 0) return KZ_C[0].k;
  if (h >= KZ_C[KZ_C.length - 1].z) return KZ_C[KZ_C.length - 1].k;
  for (let i = 0; i < KZ_C.length - 1; i++) {
    const lo = KZ_C[i];
    const hi = KZ_C[i + 1];
    if (h >= lo.z && h <= hi.z) {
      const t = (h - lo.z) / (hi.z - lo.z);
      return lo.k + t * (hi.k - lo.k);
    }
  }
  return KZ_C[0].k;
}

export interface WindCalcInputs {
  V: number;       // basic wind speed mph
  Kzt: number;     // topographic factor
  Kd: number;      // directionality factor
  Ke: number;      // ground elevation factor
  W: number;       // building width ft
  L: number;       // building length ft
  h: number;       // mean roof height ft
}

export interface ZonePressure {
  zone: string;
  GCpf: number;
  GCpi: number;
  netPressure: number;
  direction: string;
}

export interface WindCalcResults {
  Kz: number;
  qh: number;
  a: number;
  zones: ZonePressure[];
}

// GCpf values from ASCE 7-22 Fig. 28.3-1, gable roof approximation
const ZONE_GCPF: { zone: string; GCpf: number; direction: string }[] = [
  { zone: "Zone 1 (Field)", GCpf: -0.45, direction: "Uplift" },
  { zone: "Zone 1E (Edge)", GCpf: -0.69, direction: "Uplift" },
  { zone: "Zone 2 (Eave)", GCpf: -0.69, direction: "Uplift" },
  { zone: "Zone 2E (Corner)", GCpf: -1.07, direction: "Uplift" },
];

const GCpi = -0.18; // enclosed building

export function computeWindPressures(inputs: WindCalcInputs): WindCalcResults {
  const { V, Kzt, Kd, Ke, W, L, h } = inputs;

  const Kz = getKz(h);
  const qh = 0.00256 * Kz * Kzt * Kd * Ke * V * V;

  // Zone dimension per ASCE 7-22
  const minWL = Math.min(W, L);
  const a = Math.max(
    Math.min(0.1 * minWL, 0.4 * h),
    Math.max(0.04 * minWL, 3)
  );

  const zones: ZonePressure[] = ZONE_GCPF.map(({ zone, GCpf, direction }) => ({
    zone,
    GCpf,
    GCpi,
    netPressure: parseFloat((qh * (GCpf - GCpi)).toFixed(2)),
    direction,
  }));

  return {
    Kz: parseFloat(Kz.toFixed(4)),
    qh: parseFloat(qh.toFixed(2)),
    a: parseFloat(a.toFixed(2)),
    zones,
  };
}

// Simplified fastener spacing per zone
export const FASTENER_SPACING: Record<string, string> = {
  "Field": '12" o.c.',
  "Perimeter": '6" o.c.',
  "Corner": '4" o.c.',
};
