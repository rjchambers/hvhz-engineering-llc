import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import {
  calculateFastener, calculateTAS105,
  type FastenerInputs, type FastenerOutputs,
  type TAS105Inputs, type TAS105Outputs,
} from '@/lib/fastener-engine';

function normDeckType(v: string): string {
  const map: Record<string, string> = { Plywood: 'plywood', OSB: 'plywood', 'Structural Concrete': 'structural_concrete', 'Steel Deck': 'steel_deck', 'Wood Plank': 'wood_plank', 'LW Insulating Concrete': 'lw_concrete' };
  return map[v] ?? v;
}
function normConstructionType(v: string): string {
  const map: Record<string, string> = { 'New Construction': 'new', Reroof: 'reroof', Recover: 'recover' };
  return map[v] ?? v;
}
function normEnclosure(v: string): string {
  const map: Record<string, string> = { Enclosed: 'enclosed', 'Partially Enclosed': 'partially_enclosed', Open: 'open' };
  return map[v] ?? v;
}

const defaultInputs: FastenerInputs = {
  V: 185,
  exposureCategory: 'C',
  h: 15,
  Kzt: 1.0,
  Kd: 0.85,
  Ke: 1.0,
  enclosure: 'enclosed',
  riskCategory: 'II',
  buildingLength: 60,
  buildingWidth: 40,
  parapetHeight: 0,
  systemType: 'modified_bitumen',
  deckType: 'plywood',
  constructionType: 'reroof',
  existingLayers: 1,
  sheetWidth_in: 39.375,
  lapWidth_in: 4,
  Fy_lbf: 29.48,
  fySource: 'noa',
  initialRows: 4,
  noa: {
    approvalType: 'miami_dade_noa',
    approvalNumber: '',
    manufacturer: '',
    productName: '',
    systemNumber: '',
    mdp_psf: -60,
    asterisked: false,
  },
  boardLength_ft: 4,
  boardWidth_ft: 8,
  insulation_Fy_lbf: 29.48,
  county: 'miami_dade',
  isHVHZ: true,
};

interface PEFastenerState {
  inputs: FastenerInputs;
  outputs: FastenerOutputs | null;
  tas105Inputs: TAS105Inputs;
  tas105Outputs: TAS105Outputs | null;
  dirty: boolean;
  workOrderId: string | null;

  setInput: <K extends keyof FastenerInputs>(key: K, value: FastenerInputs[K]) => void;
  setNOA: <K extends keyof FastenerInputs['noa']>(key: K, value: FastenerInputs['noa'][K]) => void;
  setTAS105Values: (values: number[]) => void;
  setTAS105Meta: (meta: Partial<TAS105Inputs>) => void;
  loadFromFieldData: (fd: Record<string, any>, siteCtx: Record<string, any>, woId: string) => void;
  saveToFieldData: (workOrderId: string) => Promise<void>;
  recalculate: () => void;
}

export const usePEFastenerStore = create<PEFastenerState>()(
  persist(
    (set, get) => ({
      inputs: defaultInputs,
      outputs: null,
      tas105Inputs: { rawValues_lbf: [] },
      tas105Outputs: null,
      dirty: false,
      workOrderId: null,

      setInput: (key, value) => {
        const inputs = { ...get().inputs, [key]: value };
        set({ inputs, outputs: calculateFastener(inputs), dirty: true });
      },

      setNOA: (key, value) => {
        const noa = { ...get().inputs.noa, [key]: value };
        const inputs = { ...get().inputs, noa };
        set({ inputs, outputs: calculateFastener(inputs), dirty: true });
      },

      setTAS105Values: (values: number[]) => {
        const tas105Inputs = { ...get().tas105Inputs, rawValues_lbf: values };
        const tas105Outputs = values.length >= 2 ? calculateTAS105(tas105Inputs) : null;
        const updates: Partial<PEFastenerState> = { tas105Inputs, tas105Outputs, dirty: true };

        if (tas105Outputs && tas105Outputs.pass) {
          const inputs = { ...get().inputs, Fy_lbf: tas105Outputs.MCRF_lbf, fySource: 'tas105' as const };
          set({ ...updates, inputs, outputs: calculateFastener(inputs) });
        } else {
          set(updates as any);
        }
      },

      setTAS105Meta: (meta) => {
        set({ tas105Inputs: { ...get().tas105Inputs, ...meta }, dirty: true });
      },

      loadFromFieldData: (fd, siteCtx, woId) => {
        const fyValue = fd.tas105_mean_lbf ?? fd.fy_lbf ?? 29.48;
        const county = siteCtx?.county || fd.county || 'Broward';
        const countyKey = county === 'Miami-Dade' ? 'miami_dade' : county.toLowerCase();

        const inputs: FastenerInputs = {
          V: siteCtx?.hvhz_constants?.V ?? 185,
          exposureCategory: 'C',
          h: parseFloat(fd.mean_roof_height_ft) || 15,
          Kzt: parseFloat(fd.Kzt) || 1.0,
          Kd: 0.85,
          Ke: parseFloat(fd.Ke) || 1.0,
          enclosure: normEnclosure(fd.enclosure_type ?? 'Enclosed') as any,
          riskCategory: (fd.risk_category ?? 'II') as any,
          buildingLength: parseFloat(fd.building_length_ft) || 60,
          buildingWidth: parseFloat(fd.building_width_ft) || 40,
          parapetHeight: parseFloat(fd.parapet_height_ft) || 0,
          systemType: (fd.system_type ?? 'modified_bitumen') as any,
          deckType: normDeckType(fd.deck_type ?? 'Plywood') as any,
          constructionType: normConstructionType(fd.construction_type ?? 'Reroof') as any,
          existingLayers: fd.existing_layers === '2+' ? 2 : 1,
          sheetWidth_in: parseFloat(fd.sheet_width_in) || 39.375,
          lapWidth_in: parseFloat(fd.lap_width_in) || 4,
          Fy_lbf: parseFloat(String(fyValue)),
          fySource: fd.tas105_mean_lbf ? 'tas105' : 'noa',
          initialRows: parseInt(fd.initial_rows) || 4,
          noa: {
            approvalType: fd.noa_approval_type === 'FL Product Approval' ? 'fl_product_approval' : 'miami_dade_noa',
            approvalNumber: fd.noa_number ?? '',
            manufacturer: fd.noa_manufacturer,
            productName: fd.noa_product,
            systemNumber: fd.noa_system_number,
            mdp_psf: parseFloat(fd.noa_mdp_psf) || -60,
            mdp_basis: fd.noa_mdp_basis === 'Ultimate' ? 'ultimate' : 'asd',
            asterisked: fd.noa_asterisked ?? false,
          },
          boardLength_ft: parseFloat(fd.insulation_board_length_ft) || 4,
          boardWidth_ft: parseFloat(fd.insulation_board_width_ft) || 8,
          insulation_Fy_lbf: parseFloat(fd.insulation_fy_lbf) || parseFloat(String(fyValue)),
          county: countyKey as any,
          isHVHZ: true,
          ewa_membrane_ft2: fd.ewa_membrane_ft2 ? parseFloat(fd.ewa_membrane_ft2) : 10,
        };

        // Load TAS 105 data if present
        const tas105Inputs: TAS105Inputs = {
          rawValues_lbf: fd.tas105_raw_values ?? [],
          testingAgency: fd.tas105_agency,
          testDate: fd.tas105_date,
          deckConditionNotes: fd.tas105_deck_notes,
        };
        const tas105Outputs = tas105Inputs.rawValues_lbf.length >= 2 ? calculateTAS105(tas105Inputs) : null;

        set({
          inputs,
          outputs: calculateFastener(inputs),
          tas105Inputs,
          tas105Outputs,
          dirty: false,
          workOrderId: woId,
        });
      },

      saveToFieldData: async (workOrderId: string) => {
        const { inputs, outputs, tas105Inputs, tas105Outputs } = get();
        const formPatch: Record<string, any> = {
          pe_override_applied: true,
          pe_override_timestamp: new Date().toISOString(),
          building_width_ft: inputs.buildingWidth,
          building_length_ft: inputs.buildingLength,
          mean_roof_height_ft: inputs.h,
          parapet_height_ft: inputs.parapetHeight,
          exposure_category: inputs.exposureCategory,
          risk_category: inputs.riskCategory,
          enclosure_type: inputs.enclosure === 'enclosed' ? 'Enclosed' : inputs.enclosure === 'partially_enclosed' ? 'Partially Enclosed' : 'Open',
          Kzt: inputs.Kzt,
          Ke: inputs.Ke,
          system_type: inputs.systemType,
          deck_type: inputs.deckType,
          construction_type: inputs.constructionType,
          sheet_width_in: inputs.sheetWidth_in,
          lap_width_in: inputs.lapWidth_in,
          initial_rows: inputs.initialRows,
          fy_lbf: inputs.Fy_lbf,
          noa_approval_type: inputs.noa.approvalType === 'miami_dade_noa' ? 'Miami-Dade NOA' : 'FL Product Approval',
          noa_number: inputs.noa.approvalNumber,
          noa_manufacturer: inputs.noa.manufacturer,
          noa_product: inputs.noa.productName,
          noa_system_number: inputs.noa.systemNumber,
          noa_mdp_psf: inputs.noa.mdp_psf,
          noa_asterisked: inputs.noa.asterisked,
          insulation_board_length_ft: inputs.boardLength_ft,
          insulation_board_width_ft: inputs.boardWidth_ft,
          insulation_fy_lbf: inputs.insulation_Fy_lbf,
          county: inputs.county === 'miami_dade' ? 'Miami-Dade' : 'Broward',
          // TAS 105 data
          tas105_raw_values: tas105Inputs.rawValues_lbf,
          tas105_agency: tas105Inputs.testingAgency,
          tas105_date: tas105Inputs.testDate,
          tas105_deck_notes: tas105Inputs.deckConditionNotes,
          tas105_mean_lbf: tas105Outputs?.mean_lbf,
        };

        const { data: existing } = await supabase
          .from('field_data')
          .select('form_data')
          .eq('work_order_id', workOrderId)
          .maybeSingle();

        const merged = { ...((existing?.form_data as any) || {}), ...formPatch };

        await supabase.from('field_data').update({
          form_data: merged as any,
          calculation_results: outputs as any,
        }).eq('work_order_id', workOrderId);

        set({ dirty: false });
      },

      recalculate: () => {
        const { inputs } = get();
        set({ outputs: calculateFastener(inputs) });
      },
    }),
    {
      name: 'pe-fastener-draft',
      partialize: (state) => ({
        inputs: state.inputs,
        tas105Inputs: state.tas105Inputs,
        workOrderId: state.workOrderId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.outputs = calculateFastener(state.inputs);
          if (state.tas105Inputs.rawValues_lbf.length >= 2) {
            state.tas105Outputs = calculateTAS105(state.tas105Inputs);
          }
        }
      },
    }
  )
);
