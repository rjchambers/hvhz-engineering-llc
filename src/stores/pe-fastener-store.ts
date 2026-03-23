import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import {
  calculateFastener, calculateTAS105,
  type FastenerInputs, type FastenerOutputs,
  type TAS105Inputs, type TAS105Outputs,
} from '@/lib/fastener-engine';
import {
  computeFastenerCalc,
  type FastenerCalcInputs, type FastenerCalcResults, type FastenerRoofType,
} from '@/lib/wind-calc';

// ─── Normalizers ────────────────────────────────────────────

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

// ─── New C&C Calc Inputs ────────────────────────────────────

export interface CCCalcFields {
  roofType: FastenerRoofType;
  slopeDeg: number;
  hasParapet: boolean;
  noaPageRef: string;
  insulationDesc: string;
  membraneDesc: string;
  designPressure: number;
  rollWidth: number;
  sideLap: number;
  lapFastenerSpacing: number;
  fieldFastenerSpacing: number;
  lapRows: number;
  fieldRows: number;
}

const defaultCCFields: CCCalcFields = {
  roofType: 'Flat',
  slopeDeg: 0,
  hasParapet: false,
  noaPageRef: '',
  insulationDesc: 'N/A',
  membraneDesc: '',
  designPressure: -75,
  rollWidth: 39.37,
  sideLap: 3.0,
  lapFastenerSpacing: 7,
  fieldFastenerSpacing: 7,
  lapRows: 1,
  fieldRows: 2,
};

// ─── Legacy defaults (for backward compat) ──────────────────

const defaultInputs: FastenerInputs = {
  V: 185, exposureCategory: 'C', h: 15,
  Kzt: 1.0, Kd: 0.85, Ke: 1.0,
  enclosure: 'enclosed', riskCategory: 'II',
  buildingLength: 60, buildingWidth: 40,
  parapetHeight: 0, systemType: 'modified_bitumen',
  deckType: 'plywood', constructionType: 'reroof',
  existingLayers: 1, sheetWidth_in: 39.375,
  lapWidth_in: 4, Fy_lbf: 29.48,
  fySource: 'noa', initialRows: 4,
  noa: {
    approvalType: 'miami_dade_noa', approvalNumber: '',
    manufacturer: '', productName: '', systemNumber: '',
    mdp_psf: -60, asterisked: false,
  },
  boardLength_ft: 4, boardWidth_ft: 8,
  insulation_Fy_lbf: 29.48, county: 'miami_dade', isHVHZ: true,
};

// ─── Store ──────────────────────────────────────────────────

interface PEFastenerState {
  inputs: FastenerInputs;
  outputs: FastenerOutputs | null;
  ccFields: CCCalcFields;
  ccResults: FastenerCalcResults | null;
  tas105Inputs: TAS105Inputs;
  tas105Outputs: TAS105Outputs | null;
  dirty: boolean;
  workOrderId: string | null;

  setInput: <K extends keyof FastenerInputs>(key: K, value: FastenerInputs[K]) => void;
  setNOA: <K extends keyof FastenerInputs['noa']>(key: K, value: FastenerInputs['noa'][K]) => void;
  setCCField: <K extends keyof CCCalcFields>(key: K, value: CCCalcFields[K]) => void;
  setTAS105Values: (values: number[]) => void;
  setTAS105Meta: (meta: Partial<TAS105Inputs>) => void;
  loadFromFieldData: (fd: Record<string, any>, siteCtx: Record<string, any>, woId: string) => void;
  saveToFieldData: (workOrderId: string) => Promise<void>;
  recalculate: () => void;
}

function buildCCInputs(inputs: FastenerInputs, cc: CCCalcFields): FastenerCalcInputs {
  const encMap: Record<string, "ENCLOSED" | "PARTIALLY_ENCLOSED" | "PARTIALLY_OPEN"> = {
    enclosed: 'ENCLOSED', partially_enclosed: 'PARTIALLY_ENCLOSED', open: 'PARTIALLY_OPEN',
  };
  return {
    V: inputs.V,
    h: inputs.h,
    W: inputs.buildingWidth,
    L: inputs.buildingLength,
    roofType: cc.roofType,
    slopeDeg: cc.slopeDeg,
    hasParapet: cc.hasParapet,
    exposure: inputs.exposureCategory,
    enclosure: encMap[inputs.enclosure] ?? 'ENCLOSED',
    riskCategory: inputs.riskCategory,
    Kzt: inputs.Kzt,
    Kd: inputs.Kd,
    Ke: inputs.Ke,
    manufacturer: inputs.noa.manufacturer ?? '',
    noaNumber: inputs.noa.approvalNumber ?? '',
    noaPageRef: cc.noaPageRef,
    deckMaterial: inputs.deckType,
    insulationDesc: cc.insulationDesc,
    membraneDesc: cc.membraneDesc,
    designPressure: cc.designPressure,
    rollWidth: cc.rollWidth,
    sideLap: cc.sideLap,
    lapFastenerSpacing: cc.lapFastenerSpacing,
    fieldFastenerSpacing: cc.fieldFastenerSpacing,
    lapRows: cc.lapRows,
    fieldRows: cc.fieldRows,
  };
}

function recalcAll(inputs: FastenerInputs, cc: CCCalcFields) {
  const outputs = calculateFastener(inputs);
  const ccInputs = buildCCInputs(inputs, cc);
  const ccResults = computeFastenerCalc(ccInputs);
  return { outputs, ccResults };
}

export const usePEFastenerStore = create<PEFastenerState>()(
  persist(
    (set, get) => ({
      inputs: defaultInputs,
      outputs: null,
      ccFields: defaultCCFields,
      ccResults: null,
      tas105Inputs: { rawValues_lbf: [] },
      tas105Outputs: null,
      dirty: false,
      workOrderId: null,

      setInput: (key, value) => {
        const inputs = { ...get().inputs, [key]: value };
        const { outputs, ccResults } = recalcAll(inputs, get().ccFields);
        set({ inputs, outputs, ccResults, dirty: true });
      },

      setNOA: (key, value) => {
        const noa = { ...get().inputs.noa, [key]: value };
        const inputs = { ...get().inputs, noa };
        const { outputs, ccResults } = recalcAll(inputs, get().ccFields);
        set({ inputs, outputs, ccResults, dirty: true });
      },

      setCCField: (key, value) => {
        const ccFields = { ...get().ccFields, [key]: value };
        const { outputs, ccResults } = recalcAll(get().inputs, ccFields);
        set({ ccFields, outputs, ccResults, dirty: true });
      },

      setTAS105Values: (values: number[]) => {
        const tas105Inputs = { ...get().tas105Inputs, rawValues_lbf: values };
        const tas105Outputs = values.length >= 2 ? calculateTAS105(tas105Inputs) : null;
        const updates: Partial<PEFastenerState> = { tas105Inputs, tas105Outputs, dirty: true };
        if (tas105Outputs && tas105Outputs.pass) {
          const inputs = { ...get().inputs, Fy_lbf: tas105Outputs.MCRF_lbf, fySource: 'tas105' as const };
          const { outputs, ccResults } = recalcAll(inputs, get().ccFields);
          set({ ...updates, inputs, outputs, ccResults });
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
          V: fd.wind_speed ?? siteCtx?.hvhz_constants?.V ?? 185,
          exposureCategory: fd.exposure_category ?? 'C',
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

        const ccFields: CCCalcFields = {
          roofType: (fd.cc_roof_type ?? 'Flat') as FastenerRoofType,
          slopeDeg: parseFloat(fd.cc_slope_deg) || 0,
          hasParapet: fd.cc_has_parapet ?? false,
          noaPageRef: fd.cc_noa_page_ref ?? '',
          insulationDesc: fd.cc_insulation_desc ?? 'N/A',
          membraneDesc: fd.cc_membrane_desc ?? '',
          designPressure: parseFloat(fd.cc_design_pressure) || -75,
          rollWidth: parseFloat(fd.cc_roll_width) || 39.37,
          sideLap: parseFloat(fd.cc_side_lap) || 3.0,
          lapFastenerSpacing: parseFloat(fd.cc_lap_fastener_spacing) || 7,
          fieldFastenerSpacing: parseFloat(fd.cc_field_fastener_spacing) || 7,
          lapRows: parseInt(fd.cc_lap_rows) || 1,
          fieldRows: parseInt(fd.cc_field_rows) || 2,
        };

        const tas105Inputs: TAS105Inputs = {
          rawValues_lbf: fd.tas105_raw_values ?? [],
          testingAgency: fd.tas105_agency,
          testDate: fd.tas105_date,
          deckConditionNotes: fd.tas105_deck_notes,
        };
        const tas105Outputs = tas105Inputs.rawValues_lbf.length >= 2 ? calculateTAS105(tas105Inputs) : null;

        const { outputs, ccResults } = recalcAll(inputs, ccFields);

        set({
          inputs, outputs, ccFields, ccResults,
          tas105Inputs, tas105Outputs,
          dirty: false, workOrderId: woId,
        });
      },

      saveToFieldData: async (workOrderId: string) => {
        const { inputs, outputs, ccFields, ccResults, tas105Inputs, tas105Outputs } = get();
        const formPatch: Record<string, any> = {
          pe_override_applied: true,
          pe_override_timestamp: new Date().toISOString(),
          wind_speed: inputs.V,
          building_width_ft: inputs.buildingWidth,
          building_length_ft: inputs.buildingLength,
          mean_roof_height_ft: inputs.h,
          parapet_height_ft: inputs.parapetHeight,
          exposure_category: inputs.exposureCategory,
          risk_category: inputs.riskCategory,
          enclosure_type: inputs.enclosure === 'enclosed' ? 'Enclosed' : inputs.enclosure === 'partially_enclosed' ? 'Partially Enclosed' : 'Open',
          Kzt: inputs.Kzt, Ke: inputs.Ke,
          system_type: inputs.systemType, deck_type: inputs.deckType,
          construction_type: inputs.constructionType,
          sheet_width_in: inputs.sheetWidth_in, lap_width_in: inputs.lapWidth_in,
          initial_rows: inputs.initialRows, fy_lbf: inputs.Fy_lbf,
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
          // C&C fields
          cc_roof_type: ccFields.roofType,
          cc_slope_deg: ccFields.slopeDeg,
          cc_has_parapet: ccFields.hasParapet,
          cc_noa_page_ref: ccFields.noaPageRef,
          cc_insulation_desc: ccFields.insulationDesc,
          cc_membrane_desc: ccFields.membraneDesc,
          cc_design_pressure: ccFields.designPressure,
          cc_roll_width: ccFields.rollWidth,
          cc_side_lap: ccFields.sideLap,
          cc_lap_fastener_spacing: ccFields.lapFastenerSpacing,
          cc_field_fastener_spacing: ccFields.fieldFastenerSpacing,
          cc_lap_rows: ccFields.lapRows,
          cc_field_rows: ccFields.fieldRows,
          // C&C results snapshot
          cc_results: ccResults,
          // TAS 105
          tas105_raw_values: tas105Inputs.rawValues_lbf,
          tas105_agency: tas105Inputs.testingAgency,
          tas105_date: tas105Inputs.testDate,
          tas105_deck_notes: tas105Inputs.deckConditionNotes,
          tas105_mean_lbf: tas105Outputs?.mean_lbf,
        };

        const { data: existing } = await supabase
          .from('field_data').select('form_data')
          .eq('work_order_id', workOrderId).maybeSingle();

        const merged = { ...((existing?.form_data as any) || {}), ...formPatch };
        await supabase.from('field_data').update({
          form_data: merged as any,
          calculation_results: { legacy: outputs, cc: ccResults } as any,
        }).eq('work_order_id', workOrderId);

        set({ dirty: false });
      },

      recalculate: () => {
        const { inputs, ccFields } = get();
        const { outputs, ccResults } = recalcAll(inputs, ccFields);
        set({ outputs, ccResults });
      },
    }),
    {
      name: 'pe-fastener-draft',
      partialize: (state) => ({
        inputs: state.inputs,
        ccFields: state.ccFields,
        tas105Inputs: state.tas105Inputs,
        workOrderId: state.workOrderId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const { outputs, ccResults } = recalcAll(state.inputs, state.ccFields ?? defaultCCFields);
          state.outputs = outputs;
          state.ccResults = ccResults;
          if (!state.ccFields) state.ccFields = defaultCCFields;
          if (state.tas105Inputs.rawValues_lbf.length >= 2) {
            state.tas105Outputs = calculateTAS105(state.tas105Inputs);
          }
        }
      },
    }
  )
);
