import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import {
  runDrainageCalc, DESIGN_RAINFALL,
  type DrainageCalcInputs, type DrainageCalcOutput,
  type DrainageZone, type DrainEntry, type SecondaryEntry,
  type BuildingOpening, type FlowArrow,
} from '@/lib/drainage-calc';

interface PEDrainageState {
  county: string;
  rainfallOverride: boolean;
  rainfallRate: number | null;
  pipeSlope: '1/16' | '1/8' | '1/4' | '1/2';
  zones: DrainageZone[];
  primaryDrains: DrainEntry[];
  secondaryDrains: SecondaryEntry[];
  output: DrainageCalcOutput | null;
  dirty: boolean;
  workOrderId: string | null;

  // Plan sheet fields
  buildingWidthFt: number;
  buildingLengthFt: number;
  openings: BuildingOpening[];
  parapetWalls: string[];
  flowArrows: FlowArrow[];

  setCounty: (county: string) => void;
  setRainfallOverride: (on: boolean) => void;
  setRainfallRate: (rate: number | null) => void;
  setPipeSlope: (slope: '1/16' | '1/8' | '1/4' | '1/2') => void;
  updateZone: (index: number, zone: Partial<DrainageZone>) => void;
  updatePrimaryDrain: (index: number, drain: Partial<DrainEntry>) => void;
  addPrimaryDrain: (drain: DrainEntry) => void;
  updateSecondaryDrain: (index: number, drain: Partial<SecondaryEntry>) => void;
  addSecondaryDrain: (drain: SecondaryEntry) => void;
  loadFromFieldData: (fd: Record<string, any>, siteCtx: Record<string, any>, woId: string) => void;
  saveToFieldData: (workOrderId: string) => Promise<void>;
  recalculate: () => void;

  // Plan setters
  setBuildingDimensions: (w: number, l: number) => void;
  setParapetWalls: (walls: string[]) => void;
  setOpenings: (openings: BuildingOpening[]) => void;
  setFlowArrows: (arrows: FlowArrow[]) => void;
  moveDrain: (type: 'primary' | 'secondary', index: number, pos: { pos_x: number; pos_y: number }) => void;
}

function buildInputs(state: Pick<PEDrainageState, 'county' | 'rainfallOverride' | 'rainfallRate' | 'pipeSlope' | 'zones' | 'primaryDrains' | 'secondaryDrains'>): DrainageCalcInputs {
  return {
    county: state.county,
    rainfall_override: state.rainfallOverride && state.rainfallRate ? state.rainfallRate : undefined,
    pipe_slope_assumption: state.pipeSlope,
    zones: state.zones,
    primary_drains: state.primaryDrains,
    secondary_drains: state.secondaryDrains,
  };
}

function calc(state: Pick<PEDrainageState, 'county' | 'rainfallOverride' | 'rainfallRate' | 'pipeSlope' | 'zones' | 'primaryDrains' | 'secondaryDrains'>): DrainageCalcOutput | null {
  if (!state.zones.length) return null;
  return runDrainageCalc(buildInputs(state));
}

export const usePEDrainageStore = create<PEDrainageState>()(
  persist(
    (set, get) => ({
      county: 'Broward',
      rainfallOverride: false,
      rainfallRate: null,
      pipeSlope: '1/8',
      zones: [],
      primaryDrains: [],
      secondaryDrains: [],
      output: null,
      dirty: false,
      workOrderId: null,
      buildingWidthFt: 0,
      buildingLengthFt: 0,
      openings: [],
      parapetWalls: [],
      flowArrows: [],

      setCounty: (county) => {
        const s = { ...get(), county };
        set({ county, output: calc(s), dirty: true });
      },
      setRainfallOverride: (on) => {
        const s = { ...get(), rainfallOverride: on };
        set({ rainfallOverride: on, output: calc(s), dirty: true });
      },
      setRainfallRate: (rate) => {
        const s = { ...get(), rainfallRate: rate };
        set({ rainfallRate: rate, output: calc(s), dirty: true });
      },
      setPipeSlope: (slope) => {
        const s = { ...get(), pipeSlope: slope };
        set({ pipeSlope: slope, output: calc(s), dirty: true });
      },
      updateZone: (index, patch) => {
        const zones = [...get().zones];
        zones[index] = { ...zones[index], ...patch };
        const s = { ...get(), zones };
        set({ zones, output: calc(s), dirty: true });
      },
      updatePrimaryDrain: (index, patch) => {
        const primaryDrains = [...get().primaryDrains];
        primaryDrains[index] = { ...primaryDrains[index], ...patch };
        const s = { ...get(), primaryDrains };
        set({ primaryDrains, output: calc(s), dirty: true });
      },
      addPrimaryDrain: (drain) => {
        const primaryDrains = [...get().primaryDrains, drain];
        const s = { ...get(), primaryDrains };
        set({ primaryDrains, output: calc(s), dirty: true });
      },
      updateSecondaryDrain: (index, patch) => {
        const secondaryDrains = [...get().secondaryDrains];
        secondaryDrains[index] = { ...secondaryDrains[index], ...patch };
        const s = { ...get(), secondaryDrains };
        set({ secondaryDrains, output: calc(s), dirty: true });
      },
      addSecondaryDrain: (drain) => {
        const secondaryDrains = [...get().secondaryDrains, drain];
        const s = { ...get(), secondaryDrains };
        set({ secondaryDrains, output: calc(s), dirty: true });
      },

      loadFromFieldData: (fd, siteCtx, woId) => {
        const county = siteCtx?.county || fd.pe_county || fd.county || 'Broward';
        const rainfallOverride = fd.pe_rainfall_override ?? false;
        const rainfallRate = fd.pe_rainfall_rate ? parseFloat(String(fd.pe_rainfall_rate)) : null;
        const pipeSlope = (fd.pe_pipe_slope_assumption ?? '1/8') as any;
        const zones: DrainageZone[] = fd.drainage_zones ?? [];
        const primaryDrains: DrainEntry[] = fd.primary_drains ?? [];
        const secondaryDrains: SecondaryEntry[] = fd.secondary_drains ?? [];
        const buildingWidthFt = fd.building_width_ft ?? 0;
        const buildingLengthFt = fd.building_length_ft ?? 0;
        const openings: BuildingOpening[] = fd.building_openings ?? [];
        const parapetWalls: string[] = fd.parapet_walls ?? [];
        const flowArrows: FlowArrow[] = fd.flow_arrows ?? [];

        const state = { county, rainfallOverride, rainfallRate, pipeSlope, zones, primaryDrains, secondaryDrains };
        set({
          ...state,
          buildingWidthFt,
          buildingLengthFt,
          openings,
          parapetWalls,
          flowArrows,
          output: calc(state),
          dirty: false,
          workOrderId: woId,
        });
      },

      saveToFieldData: async (workOrderId) => {
        const s = get();
        const formPatch: Record<string, any> = {
          pe_override_applied: true,
          pe_override_timestamp: new Date().toISOString(),
          pe_county: s.county,
          pe_rainfall_override: s.rainfallOverride,
          pe_rainfall_rate: s.rainfallOverride ? s.rainfallRate : DESIGN_RAINFALL[s.county] ?? 8.39,
          pe_pipe_slope_assumption: s.pipeSlope,
          drainage_zones: s.zones,
          primary_drains: s.primaryDrains,
          secondary_drains: s.secondaryDrains,
          building_width_ft: s.buildingWidthFt,
          building_length_ft: s.buildingLengthFt,
          building_openings: s.openings,
          parapet_walls: s.parapetWalls,
          flow_arrows: s.flowArrows,
        };

        const { data: existing } = await supabase
          .from('field_data').select('form_data').eq('work_order_id', workOrderId).maybeSingle();
        const merged = { ...((existing?.form_data as any) || {}), ...formPatch };

        await supabase.from('field_data').update({
          form_data: merged as any,
          calculation_results: s.output as any,
        }).eq('work_order_id', workOrderId);

        set({ dirty: false });
      },

      recalculate: () => {
        const s = get();
        set({ output: calc(s) });
      },

      // Plan setters
      setBuildingDimensions: (w, l) => set({ buildingWidthFt: w, buildingLengthFt: l, dirty: true }),
      setParapetWalls: (walls) => set({ parapetWalls: walls, dirty: true }),
      setOpenings: (openings) => set({ openings, dirty: true }),
      setFlowArrows: (arrows) => set({ flowArrows: arrows, dirty: true }),
      moveDrain: (type, index, pos) => {
        if (type === 'primary') {
          const primaryDrains = [...get().primaryDrains];
          primaryDrains[index] = { ...primaryDrains[index], ...pos };
          set({ primaryDrains, dirty: true });
        } else {
          const secondaryDrains = [...get().secondaryDrains];
          secondaryDrains[index] = { ...secondaryDrains[index], ...pos };
          set({ secondaryDrains, dirty: true });
        }
      },
    }),
    {
      name: 'pe-drainage-draft',
      partialize: (state) => ({
        county: state.county,
        rainfallOverride: state.rainfallOverride,
        rainfallRate: state.rainfallRate,
        pipeSlope: state.pipeSlope,
        zones: state.zones,
        primaryDrains: state.primaryDrains,
        secondaryDrains: state.secondaryDrains,
        workOrderId: state.workOrderId,
        buildingWidthFt: state.buildingWidthFt,
        buildingLengthFt: state.buildingLengthFt,
        openings: state.openings,
        parapetWalls: state.parapetWalls,
        flowArrows: state.flowArrows,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.output = calc(state);
        }
      },
    }
  )
);
