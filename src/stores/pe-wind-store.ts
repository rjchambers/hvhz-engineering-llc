import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { computeWindPressures, type WindCalcInputs, type WindCalcResults } from '@/lib/wind-calc';

interface WindInputs {
  V: number;
  exposureCategory: 'B' | 'C' | 'D';
  riskCategory: string;
  Kzt: number;
  Kd: number;
  Ke: number;
  buildingWidth: number;
  buildingLength: number;
  wallHeight: number;
  meanRoofHeight: number;
  roofShape: string;
  yearBuilt: string;
  occupancyType: string;
  stories: string;
  roofCoveringType: string;
  noaNumber: string;
  noaExpiry: string;
  deckType: string;
  deckThickness: string;
  fastenerType: string;
  fastenerSize: string;
  roofToWallConnection: string;
  connectionSpacing: string;
  allOpeningsProtected: boolean;
  garageDoorRated: boolean;
}

const defaultInputs: WindInputs = {
  V: 185,
  exposureCategory: 'C',
  riskCategory: 'II',
  Kzt: 1.0,
  Kd: 0.85,
  Ke: 1.0,
  buildingWidth: 0,
  buildingLength: 0,
  wallHeight: 0,
  meanRoofHeight: 0,
  roofShape: '',
  yearBuilt: '',
  occupancyType: '',
  stories: '',
  roofCoveringType: '',
  noaNumber: '',
  noaExpiry: '',
  deckType: '',
  deckThickness: '',
  fastenerType: '',
  fastenerSize: '',
  roofToWallConnection: '',
  connectionSpacing: '',
  allOpeningsProtected: false,
  garageDoorRated: false,
};

interface PEWindState {
  inputs: WindInputs;
  output: WindCalcResults | null;
  dirty: boolean;
  workOrderId: string | null;

  setInput: <K extends keyof WindInputs>(key: K, value: WindInputs[K]) => void;
  loadFromFieldData: (fd: Record<string, any>, siteCtx: Record<string, any>, woId: string) => void;
  saveToFieldData: (workOrderId: string) => Promise<void>;
  recalculate: () => void;
}

function calcWind(inputs: WindInputs): WindCalcResults | null {
  if (inputs.buildingWidth <= 0 || inputs.buildingLength <= 0 || inputs.meanRoofHeight <= 0) return null;
  return computeWindPressures({
    V: inputs.V,
    Kzt: inputs.Kzt,
    Kd: inputs.Kd,
    Ke: inputs.Ke,
    W: inputs.buildingWidth,
    L: inputs.buildingLength,
    h: inputs.meanRoofHeight,
  });
}

export const usePEWindStore = create<PEWindState>()(
  persist(
    (set, get) => ({
      inputs: defaultInputs,
      output: null,
      dirty: false,
      workOrderId: null,

      setInput: (key, value) => {
        const inputs = { ...get().inputs, [key]: value };
        set({ inputs, output: calcWind(inputs), dirty: true });
      },

      loadFromFieldData: (fd, siteCtx, woId) => {
        const inputs: WindInputs = {
          V: siteCtx?.hvhz_constants?.V ?? 185,
          exposureCategory: (fd.exposure_category ?? 'C') as any,
          riskCategory: fd.risk_category ?? 'II',
          Kzt: parseFloat(fd.Kzt) || 1.0,
          Kd: parseFloat(fd.Kd) || 0.85,
          Ke: parseFloat(fd.Ke) || 1.0,
          buildingWidth: parseFloat(fd.building_width_ft) || 0,
          buildingLength: parseFloat(fd.building_length_ft) || 0,
          wallHeight: parseFloat(fd.wall_height_ft) || 0,
          meanRoofHeight: parseFloat(fd.mean_roof_height_ft) || 0,
          roofShape: fd.roof_shape ?? '',
          yearBuilt: fd.year_built?.toString() ?? '',
          occupancyType: fd.occupancy_type ?? '',
          stories: fd.stories?.toString() ?? '',
          roofCoveringType: fd.roof_covering_type ?? '',
          noaNumber: fd.noa_number ?? '',
          noaExpiry: fd.noa_expiry ?? '',
          deckType: fd.deck_type ?? '',
          deckThickness: fd.deck_thickness ?? '',
          fastenerType: fd.fastener_type ?? '',
          fastenerSize: fd.fastener_size ?? '',
          roofToWallConnection: fd.roof_to_wall_connection ?? '',
          connectionSpacing: fd.connection_spacing_inches?.toString() ?? '',
          allOpeningsProtected: fd.all_openings_protected ?? false,
          garageDoorRated: fd.garage_door_rated ?? false,
        };
        set({ inputs, output: calcWind(inputs), dirty: false, workOrderId: woId });
      },

      saveToFieldData: async (workOrderId) => {
        const { inputs, output } = get();
        const formPatch: Record<string, any> = {
          pe_override_applied: true,
          pe_override_timestamp: new Date().toISOString(),
          year_built: inputs.yearBuilt ? parseInt(inputs.yearBuilt) : null,
          occupancy_type: inputs.occupancyType,
          stories: inputs.stories ? parseInt(inputs.stories) : null,
          building_width_ft: inputs.buildingWidth || null,
          building_length_ft: inputs.buildingLength || null,
          wall_height_ft: inputs.wallHeight || null,
          mean_roof_height_ft: inputs.meanRoofHeight || null,
          roof_shape: inputs.roofShape,
          roof_covering_type: inputs.roofCoveringType,
          noa_number: inputs.noaNumber,
          noa_expiry: inputs.noaExpiry || null,
          deck_type: inputs.deckType,
          deck_thickness: inputs.deckThickness,
          fastener_type: inputs.fastenerType,
          fastener_size: inputs.fastenerSize,
          roof_to_wall_connection: inputs.roofToWallConnection,
          connection_spacing_inches: parseFloat(inputs.connectionSpacing) || null,
          all_openings_protected: inputs.allOpeningsProtected,
          garage_door_rated: inputs.garageDoorRated,
          basic_wind_speed: inputs.V,
          exposure_category: inputs.exposureCategory,
          risk_category: inputs.riskCategory,
          Kd: inputs.Kd,
          Kzt: inputs.Kzt,
          Ke: inputs.Ke,
          ...(output ? {
            computed_Kz: output.Kz,
            computed_qh: output.qh,
            computed_zone_a: output.a,
            computed_zones: output.zones,
          } : {}),
        };

        const { data: existing } = await supabase
          .from('field_data').select('form_data').eq('work_order_id', workOrderId).maybeSingle();
        const merged = { ...((existing?.form_data as any) || {}), ...formPatch };

        await supabase.from('field_data').update({
          form_data: merged as any,
          calculation_results: output as any,
        }).eq('work_order_id', workOrderId);

        set({ dirty: false });
      },

      recalculate: () => {
        const { inputs } = get();
        set({ output: calcWind(inputs) });
      },
    }),
    {
      name: 'pe-wind-draft',
      partialize: (state) => ({
        inputs: state.inputs,
        workOrderId: state.workOrderId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.output = calcWind(state.inputs);
        }
      },
    }
  )
);
