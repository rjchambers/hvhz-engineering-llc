import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PELayout } from "@/components/PELayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Save, Loader2, MapPin, Wind, Building2, Home, Wrench,
  FileText, Layers, TestTube, ChevronDown, AlertCircle, AlertTriangle, Info, Copy, Check
} from "lucide-react";
import { usePEFastenerStore, type CCCalcFields } from "@/stores/pe-fastener-store";
import { isTAS105Required } from "@/lib/fastener-engine";
import { lookupByCounty, FLORIDA_COUNTY_WIND } from "@/lib/county-wind-data";
import { useIsMobile } from "@/hooks/use-mobile";
import type { FastenerCalcResults } from "@/lib/wind-calc";

// ─── Constants ──────────────────────────────────────────────
const SYSTEM_LABELS: Record<string, string> = {
  modified_bitumen: "Modified Bitumen", single_ply: "Single-Ply TPO/EPDM/PVC", adhered: "Adhered Membrane"
};
const SYSTEM_META: Record<string, { sub: string; ref: string }> = {
  modified_bitumen: { sub: "BUR / Mod-Bit", ref: "RAS 117" },
  single_ply: { sub: "TPO · EPDM · PVC", ref: "RAS 137" },
  adhered: { sub: "Full Bond / SA", ref: "TAS 124" },
};
const DECK_OPTIONS = [
  { value: "plywood", label: "Plywood" },
  { value: "structural_concrete", label: "Structural Concrete" },
  { value: "steel_deck", label: "Steel Deck" },
  { value: "wood_plank", label: "Wood Plank" },
  { value: "lw_concrete", label: "LW Insulating Concrete" },
];
const ZONE_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  '3':      { fill: 'hsl(0 72% 51% / 0.18)',   stroke: 'hsl(0 72% 51% / 0.5)',   label: 'hsl(0 72% 51%)' },
  '2':      { fill: 'hsl(38 92% 44% / 0.15)',   stroke: 'hsl(38 92% 44% / 0.4)',  label: 'hsl(38 92% 44%)' },
  '1':      { fill: 'hsl(45 93% 47% / 0.10)',   stroke: 'hsl(45 93% 47% / 0.3)',  label: 'hsl(45 93% 47% / 0.8)' },
  "1'":     { fill: 'hsl(217 91% 53% / 0.08)',  stroke: 'hsl(217 91% 53% / 0.2)', label: 'hsl(217 91% 53% / 0.6)' },
};

// ─── Main Component ─────────────────────────────────────────
export default function FastenerCalc() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [woData, setWoData] = useState<any>(null);
  const [orderData, setOrderData] = useState<any>(null);

  const store = usePEFastenerStore();
  const { inputs, outputs, ccFields, ccResults, tas105Inputs, tas105Outputs, dirty } = store;

  const loadData = useCallback(async () => {
    if (!id || !user) return;
    const { data: wo } = await supabase
      .from("work_orders")
      .select("id, service_type, status, order_id, orders(job_address, job_city, job_zip, job_county, site_context, noa_document_path, noa_document_name)")
      .eq("id", id).single();
    if (!wo) return;
    setWoData(wo);
    setOrderData(wo.orders);
    const { data: fdRow } = await supabase
      .from("field_data").select("form_data").eq("work_order_id", id).maybeSingle();
    const fd = (fdRow?.form_data as Record<string, any>) ?? {};
    const siteCtx = ((wo.orders as any)?.site_context as Record<string, any>) ?? {};
    if (store.workOrderId !== id) store.loadFromFieldData(fd, siteCtx, id);
    setLoaded(true);
  }, [id, user]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const serverSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!dirty || !id) return;
    clearTimeout(serverSaveTimer.current);
    serverSaveTimer.current = setTimeout(async () => {
      try { await store.saveToFieldData(id); } catch { /* Silent */ }
    }, 10000);
    return () => clearTimeout(serverSaveTimer.current);
  }, [dirty, id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try { await store.saveToFieldData(id); toast.success("Calculation saved."); }
    catch { toast.error("Failed to save"); }
    setSaving(false);
  };

  const handleReturn = async () => {
    if (dirty && id) await store.saveToFieldData(id);
    navigate(`/pe/review/${id}`);
  };

  if (!loaded) {
    return (<PELayout><div className="flex items-center justify-center h-[calc(100vh-56px)]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></PELayout>);
  }

  const address = orderData ? [orderData.job_address, orderData.job_city, orderData.job_zip].filter(Boolean).join(", ") : "";

  const headerBar = (
    <div className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => navigate(`/pe/review/${id}`)}>
        <ArrowLeft className="h-4 w-4" /> Back to Review
      </Button>
      <div className="hidden sm:flex items-center gap-2 text-sm">
        <span className="font-semibold text-primary">FastenerCalc HVHZ — C&C</span>
        {address && <span className="text-muted-foreground text-xs truncate max-w-[260px]">· {address}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-1">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
        </Button>
        <Button size="sm" onClick={handleReturn} className="gap-1">Return <ArrowRight className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <PELayout>
        {headerBar}
        <Tabs defaultValue="inputs" className="flex-1">
          <TabsList className="w-full rounded-none border-b">
            <TabsTrigger value="inputs" className="flex-1">Inputs</TabsTrigger>
            <TabsTrigger value="results" className="flex-1">Results</TabsTrigger>
          </TabsList>
          <TabsContent value="inputs" className="p-4 overflow-y-auto" style={{ height: 'calc(100vh - 112px)' }}>
            <FormPanel inputs={inputs} ccFields={ccFields} store={store} orderData={orderData} tas105Inputs={tas105Inputs} tas105Outputs={tas105Outputs} />
          </TabsContent>
          <TabsContent value="results" className="p-4 overflow-y-auto" style={{ height: 'calc(100vh - 112px)' }}>
            <ResultsPanel inputs={inputs} ccFields={ccFields} ccResults={ccResults} outputs={outputs} tas105Outputs={tas105Outputs} />
          </TabsContent>
        </Tabs>
      </PELayout>
    );
  }

  return (
    <PELayout>
      {headerBar}
      <div className="flex flex-1 min-h-0">
        <div className="w-[420px] shrink-0 border-r overflow-y-auto p-4" style={{ height: 'calc(100vh - 56px)' }}>
          <FormPanel inputs={inputs} ccFields={ccFields} store={store} orderData={orderData} tas105Inputs={tas105Inputs} tas105Outputs={tas105Outputs} />
        </div>
        <div className="flex-1 overflow-y-auto p-4" style={{ height: 'calc(100vh - 56px)' }}>
          <ResultsPanel inputs={inputs} ccFields={ccFields} ccResults={ccResults} outputs={outputs} tas105Outputs={tas105Outputs} />
        </div>
      </div>
    </PELayout>
  );
}

// ─── Collapsible Section ────────────────────────────────────
function Section({ title, icon: Icon, defaultOpen = true, children }: {
  title: string; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-lg">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors rounded-t-lg">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 space-y-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

// ─── Field helpers ──────────────────────────────────────────
function NumField({ label, value, onChange, unit, step = 1, tooltip, disabled }: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; step?: number; tooltip?: string; disabled?: boolean;
}) {
  const inner = (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <Input type="number" value={value} step={step} disabled={disabled}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="h-8 text-sm font-mono" />
        {unit && <span className="text-xs text-muted-foreground whitespace-nowrap">{unit}</span>}
      </div>
    </div>
  );
  if (!tooltip) return inner;
  return (<Tooltip><TooltipTrigger asChild>{inner}</TooltipTrigger><TooltipContent side="right" className="text-xs max-w-[200px]">{tooltip}</TooltipContent></Tooltip>);
}

// ─── Form Panel ─────────────────────────────────────────────
function FormPanel({ inputs, ccFields, store, orderData, tas105Inputs, tas105Outputs }: {
  inputs: any; ccFields: CCCalcFields; store: any; orderData: any; tas105Inputs: any; tas105Outputs: any;
}) {
  const countyLabel = inputs.county === 'miami_dade' ? 'Miami-Dade' : inputs.county === 'broward' ? 'Broward' : 'Other';
  const tas105Req = isTAS105Required(inputs.deckType, inputs.constructionType);
  const showTAS105 = tas105Req.required || inputs.fySource === 'tas105';

  const handleCountyChange = (val: string) => {
    const key = val === 'Miami-Dade' ? 'miami_dade' : val === 'Broward' ? 'broward' : 'other';
    store.setInput('county', key);
    const lookup = lookupByCounty(val);
    if (lookup) {
      store.setInput('V', lookup.V_mph);
      store.setInput('exposureCategory', lookup.exposureSuggestion);
      store.setInput('isHVHZ', lookup.isHVHZ);
      toast.info(`Wind parameters updated for ${val} County.`);
    }
  };

  return (
    <div className="space-y-3">
      {/* 1: Site & Code */}
      <Section title="Site & Code" icon={MapPin}>
        <div>
          <Label className="text-xs text-muted-foreground">County</Label>
          <Select value={countyLabel} onValueChange={handleCountyChange}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(FLORIDA_COUNTY_WIND).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Construction Type</Label>
          <Select value={inputs.constructionType} onValueChange={v => store.setInput('constructionType', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New Construction</SelectItem>
              <SelectItem value="reroof">Reroof</SelectItem>
              <SelectItem value="recover">Recover</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Risk Category</Label>
          <Select value={inputs.riskCategory} onValueChange={v => store.setInput('riskCategory', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{['I','II','III','IV'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">HVHZ</Label>
          <div className="flex items-center gap-2">
            <Switch checked={inputs.isHVHZ} onCheckedChange={v => store.setInput('isHVHZ', v)} />
            {inputs.isHVHZ && <Badge className="bg-primary text-primary-foreground text-[10px]">HVHZ</Badge>}
          </div>
        </div>
      </Section>

      {/* 2: Design Criteria */}
      <Section title="Design Criteria" icon={Wind}>
        <NumField label="Basic Wind Speed (V)" value={inputs.V} onChange={v => store.setInput('V', v)} unit="mph" />
        <div>
          <Label className="text-xs text-muted-foreground">Exposure Category</Label>
          <Select value={inputs.exposureCategory} onValueChange={v => store.setInput('exposureCategory', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{['B','C','D'].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
          {inputs.isHVHZ && inputs.exposureCategory !== 'C' && (
            <p className="text-[10px] text-destructive mt-1">⚠ HVHZ requires Exposure C</p>
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Enclosure</Label>
          <Select value={inputs.enclosure} onValueChange={v => store.setInput('enclosure', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="enclosed">Enclosed (GCpi=±0.18)</SelectItem>
              <SelectItem value="partially_enclosed">Partially Enclosed (±0.55)</SelectItem>
              <SelectItem value="open">Open</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <NumField label="Kzt" value={inputs.Kzt} onChange={v => store.setInput('Kzt', v)} step={0.01} tooltip="§26.8 Topographic" />
          <NumField label="Kd" value={inputs.Kd} onChange={v => store.setInput('Kd', v)} step={0.01} tooltip="Table 26.6-1" />
          <NumField label="Ke" value={inputs.Ke} onChange={v => store.setInput('Ke', v)} step={0.01} tooltip="Table 26.9-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Roof Type</Label>
          <Select value={ccFields.roofType} onValueChange={v => store.setCCField('roofType', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Flat">Flat</SelectItem>
              <SelectItem value="Gable">Gable</SelectItem>
              <SelectItem value="Hip">Hip</SelectItem>
              <SelectItem value="Monoslope">Monoslope</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <NumField label="Roof Slope" value={ccFields.slopeDeg} onChange={v => store.setCCField('slopeDeg', v)} unit="°" tooltip="0 for flat, drives GCp table selection" />
        <div className="flex items-center justify-between">
          <Label className="text-xs">Continuous Parapet ≥ 3'</Label>
          <Switch checked={ccFields.hasParapet} onCheckedChange={v => store.setCCField('hasParapet', v)} />
        </div>
        {ccFields.hasParapet && (
          <p className="text-[10px] text-blue-700 bg-blue-50 rounded p-2 border border-blue-200">
            PE may apply reduced Zone 1' pressure per ASCE 7-22 §30.9
          </p>
        )}
      </Section>

      {/* 3: Building Geometry */}
      <Section title="Building Geometry" icon={Building2}>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Length" value={inputs.buildingLength} onChange={v => store.setInput('buildingLength', v)} unit="ft" />
          <NumField label="Width" value={inputs.buildingWidth} onChange={v => store.setInput('buildingWidth', v)} unit="ft" />
        </div>
        <NumField label="Mean Roof Height (h)" value={inputs.h} onChange={v => store.setInput('h', v)} unit="ft" />
        <NumField label="Parapet Height" value={inputs.parapetHeight} onChange={v => store.setInput('parapetHeight', v)} unit="ft" />
      </Section>

      {/* 4: Roof System */}
      <Section title="Roof System" icon={Home}>
        <div className="grid grid-cols-3 gap-2">
          {(['modified_bitumen','single_ply','adhered'] as const).map(sys => (
            <button key={sys} onClick={() => store.setInput('systemType', sys)}
              className={cn("border rounded-lg p-2 text-center transition-all text-xs active:scale-[0.97]",
                inputs.systemType === sys ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50")}>
              <p className="font-medium">{SYSTEM_LABELS[sys]}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{SYSTEM_META[sys].sub}</p>
              <Badge variant="outline" className="text-[9px] mt-1">{SYSTEM_META[sys].ref}</Badge>
            </button>
          ))}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Deck Type</Label>
          <Select value={inputs.deckType} onValueChange={v => store.setInput('deckType', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{DECK_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </Section>

      {/* 5: NOA System Data */}
      <Section title="NOA System Data" icon={FileText}>
        <div>
          <Label className="text-xs text-muted-foreground">Approval Type</Label>
          <Select value={inputs.noa.approvalType} onValueChange={v => store.setNOA('approvalType', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="miami_dade_noa">Miami-Dade NOA</SelectItem>
              <SelectItem value="fl_product_approval">FL Product Approval</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Manufacturer</Label>
            <Input value={inputs.noa.manufacturer ?? ''} onChange={e => store.setNOA('manufacturer', e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">NOA / Approval #</Label>
            <Input value={inputs.noa.approvalNumber} onChange={e => store.setNOA('approvalNumber', e.target.value)} className="h-8 text-sm font-mono" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Page / Option Ref</Label>
            <Input value={ccFields.noaPageRef} onChange={e => store.setCCField('noaPageRef', e.target.value)} className="h-8 text-sm" placeholder="e.g. Page 19/Option #3" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Membrane</Label>
            <Input value={ccFields.membraneDesc} onChange={e => store.setCCField('membraneDesc', e.target.value)} className="h-8 text-sm" placeholder="per NOA" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Insulation</Label>
          <Input value={ccFields.insulationDesc} onChange={e => store.setCCField('insulationDesc', e.target.value)} className="h-8 text-sm" placeholder="N/A" />
        </div>
        <NumField label="Design Pressure (DP)" value={ccFields.designPressure} onChange={v => store.setCCField('designPressure', v)} unit="psf" step={1} tooltip="Negative value from NOA (e.g. -75)" />
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Roll Width (NOA)" value={ccFields.rollWidth} onChange={v => store.setCCField('rollWidth', v)} unit="in" step={0.01} />
          <NumField label="Side Lap (NOA)" value={ccFields.sideLap} onChange={v => store.setCCField('sideLap', v)} unit="in" step={0.5} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Lap Fastener Spacing" value={ccFields.lapFastenerSpacing} onChange={v => store.setCCField('lapFastenerSpacing', v)} unit="in" tooltip="Per NOA" />
          <NumField label="Field Fastener Spacing" value={ccFields.fieldFastenerSpacing} onChange={v => store.setCCField('fieldFastenerSpacing', v)} unit="in" tooltip="Per NOA" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Rows in Lap" value={ccFields.lapRows} onChange={v => store.setCCField('lapRows', Math.max(1, Math.round(v)))} step={1} />
          <NumField label="Rows in Field" value={ccFields.fieldRows} onChange={v => store.setCCField('fieldRows', Math.max(1, Math.round(v)))} step={1} />
        </div>
        {orderData?.noa_document_path && <NOADocLink path={orderData.noa_document_path} name={orderData.noa_document_name} />}
      </Section>

      {/* 6: Legacy Fastener / Assembly */}
      <Section title="Fastener / Assembly (Legacy)" icon={Wrench} defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Sheet Width (SW)" value={inputs.sheetWidth_in} onChange={v => store.setInput('sheetWidth_in', v)} unit="in" step={0.125} />
          <NumField label="Lap Width (LW)" value={inputs.lapWidth_in} onChange={v => store.setInput('lapWidth_in', v)} unit="in" step={0.5} />
        </div>
        <NumField label="Fastener Value (Fy)" value={inputs.Fy_lbf} onChange={v => store.setInput('Fy_lbf', v)} unit="lbf" step={0.1}
          disabled={inputs.fySource === 'tas105' && tas105Outputs?.pass} />
        <NumField label="Initial Rows (n)" value={inputs.initialRows} onChange={v => store.setInput('initialRows', Math.max(2, Math.round(v)))} step={1} />
        <NumField label="MDP (legacy)" value={Math.abs(inputs.noa.mdp_psf)} onChange={v => store.setNOA('mdp_psf', -Math.abs(v))} unit="psf" />
      </Section>

      {/* 7: TAS 105 */}
      {(tas105Req.required || inputs.fySource === 'tas105' || showTAS105) && (
        <Section title="TAS 105 Field Test" icon={TestTube}>
          {tas105Req.required && (
            <Badge className={cn("text-[10px]", inputs.deckType === 'lw_concrete' ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground")}>REQUIRED</Badge>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Testing Agency</Label>
              <Input value={tas105Inputs.testingAgency ?? ''} onChange={e => store.setTAS105Meta({ testingAgency: e.target.value })} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Test Date</Label>
              <Input type="date" value={tas105Inputs.testDate ?? ''} onChange={e => store.setTAS105Meta({ testDate: e.target.value })} className="h-8 text-sm" />
            </div>
          </div>
          <TAS105ValueGrid values={tas105Inputs.rawValues_lbf} onChange={store.setTAS105Values} />
          {tas105Outputs && <TAS105Stats outputs={tas105Outputs} />}
        </Section>
      )}
    </div>
  );
}

// ─── NOA Document Link ──────────────────────────────────────
function NOADocLink({ path, name }: { path: string; name?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from('reports').createSignedUrl(path, 43200).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }, [path]);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
      📄 View NOA Document {name && `(${name})`}
    </a>
  );
}

// ─── TAS 105 Value Grid ─────────────────────────────────────
function TAS105ValueGrid({ values, onChange }: { values: number[]; onChange: (v: number[]) => void }) {
  const [csvInput, setCsvInput] = useState('');
  const slots = Math.max(values.length + 1, 5);
  const padded = [...values, ...Array(Math.max(0, slots - values.length)).fill(0)];
  const updateAt = (i: number, v: number) => { const next = [...padded]; next[i] = v; onChange(next.filter(x => x > 0)); };
  const importCSV = () => {
    const parsed = csvInput.split(/[,\s]+/).map(Number).filter(n => !isNaN(n) && n > 0);
    if (parsed.length > 0) { onChange([...values, ...parsed]); setCsvInput(''); toast.success(`${parsed.length} values imported`); }
  };
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">Pullout Values (lbf)</Label>
      <div className="grid grid-cols-5 gap-1">
        {padded.map((v, i) => (
          <Input key={i} type="number" value={v || ''} placeholder={`#${i + 1}`}
            onChange={e => updateAt(i, parseFloat(e.target.value) || 0)}
            className="h-7 text-xs font-mono px-1 text-center" />
        ))}
      </div>
      <Button variant="ghost" size="sm" className="text-xs mt-1" onClick={() => onChange([...values, 0])}>+ Add Sample</Button>
      <div className="flex gap-1 mt-2">
        <Input placeholder="Paste CSV: 350, 420, 380…" value={csvInput} onChange={e => setCsvInput(e.target.value)} className="h-7 text-xs flex-1" />
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={importCSV}>Import</Button>
      </div>
    </div>
  );
}

function TAS105Stats({ outputs }: { outputs: any }) {
  return (
    <div className="bg-muted/50 rounded p-3 text-xs space-y-1 font-mono">
      <p>n = {outputs.n}, X̄ = {outputs.mean_lbf} lbf, σ = {outputs.stdDev_lbf} lbf</p>
      <p>t = {outputs.tFactor.toFixed(3)}</p>
      <p className="font-bold">MCRF = {outputs.MCRF_lbf} lbf</p>
      <Badge className={cn("text-[10px]", outputs.pass ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
        {outputs.pass ? '✅ PASS (≥ 275 lbf)' : '🔴 FAIL (< 275 lbf)'}
      </Badge>
    </div>
  );
}

// ─── Results Panel ──────────────────────────────────────────
function ResultsPanel({ inputs, ccFields, ccResults, outputs, tas105Outputs }: {
  inputs: any; ccFields: CCCalcFields; ccResults: FastenerCalcResults | null; outputs: any; tas105Outputs: any;
}) {
  if (!ccResults) return <p className="text-sm text-muted-foreground p-4">Enter parameters to see results.</p>;
  const r = ccResults;

  return (
    <div className="space-y-4">
      {/* 1: Pressure Coefficients */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Pressure Coefficients</CardTitle></CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded p-3 font-mono text-[11px] space-y-1">
            <p>Kz = {r.Kz} (h={inputs.h}ft, Exposure {inputs.exposureCategory})</p>
            <p>qz = 0.00256 × {r.Kz} × {inputs.Kzt} × {inputs.Kd} × {inputs.Ke} × {inputs.V}² = <span className="font-bold">{r.qh} psf</span></p>
            <p>Dqz = 0.6 × {r.qh} = <span className="font-bold">{r.Dqz} psf</span> (ASD)</p>
            <p>GCpi = ±{r.GCpi} ({inputs.enclosure === 'enclosed' ? 'Enclosed' : inputs.enclosure === 'partially_enclosed' ? 'Partially Enclosed' : 'Open'})</p>
            <p className="text-muted-foreground">{r.gcpTableName}</p>
          </div>
        </CardContent>
      </Card>

      {/* 2: Uplift Pressures */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Uplift Pressures — C&C</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr><th className="p-2 text-left">Zone</th><th className="p-2 text-right">GCp</th><th className="p-2 text-right">P = Dqz[(GCp)-(GCpi)]</th><th className="p-2 text-right font-bold">psf</th></tr>
              </thead>
              <tbody>
                {r.zones.map(z => (
                  <tr key={z.zone} className="border-t">
                    <td className="p-2 font-medium">{z.zone} ({z.label})</td>
                    <td className="p-2 text-right font-mono">{z.GCp}</td>
                    <td className="p-2 text-right font-mono text-muted-foreground">{r.Dqz} × ({z.GCp} − {r.GCpi})</td>
                    <td className="p-2 text-right font-bold font-mono">{z.pressure.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 3: Zone Widths */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Zone Widths</CardTitle></CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded p-3 font-mono text-[11px] space-y-1">
            {r.zoneWidths.hasZone1Prime && <p>Zone 1' (interior): inside zone boundaries</p>}
            <p>Zone 1 (field): {r.zoneWidths.zone1} ft {r.zoneWidths.hasZone1Prime ? '(0.6h)' : '(a)'}</p>
            <p>Zone 2 (perimeter): {r.zoneWidths.zone2} ft</p>
            <p>Zone 3 (corner): {r.zoneWidths.zone3outer} ft{r.zoneWidths.hasZone1Prime ? `, inner ${r.zoneWidths.zone3inner} ft (0.2h)` : ''}</p>
          </div>
        </CardContent>
      </Card>

      {/* 4: Fastener Calculation Chain */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Fastener Calculation Chain</CardTitle></CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded p-3 font-mono text-[11px] space-y-1">
            <p>Net Width: <span className="font-bold">{r.netWidth}"</span> ({ccFields.rollWidth}" − {ccFields.sideLap}")</p>
            <p>Net Length per Square: <span className="font-bold">{r.netLengthPerSquare} ft</span></p>
            <p>Row Spacing (Zone 1): <span className="font-bold">{r.baseRowSpacing}"</span> ({r.netWidth}" / {ccFields.fieldRows + ccFields.lapRows})</p>
            <p>Fasteners Per Square (FPS): <span className="font-bold">{r.fastenersPerSquare}</span></p>
            <p>Sq Ft Per Fastener: <span className="font-bold">{r.sqftPerFastener}</span></p>
            <p>Fastener Value (Fv): <span className="font-bold">{r.fastenerValue} LBF</span> (DP × 100 / FPS)</p>
          </div>
        </CardContent>
      </Card>

      {/* 5: Computed Spacings */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Computed Spacings</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr><th className="p-2 text-left">Zone</th><th className="p-2 text-right">RS</th><th className="p-2 text-right">Computed</th><th className="p-2">Formula</th></tr>
              </thead>
              <tbody>
                {r.computedSpacings.map(s => {
                  const zPressure = r.zones.find(z => z.zone === s.zone);
                  return (
                    <tr key={s.zone} className="border-t">
                      <td className="p-2 font-medium">{s.zone} ({s.label})</td>
                      <td className="p-2 text-right font-mono">{s.rowSpacing}"</td>
                      <td className="p-2 text-right font-mono">{s.computed}"</td>
                      <td className="p-2 text-[10px] text-muted-foreground font-mono">
                        ({Math.abs(r.fastenerValue)}×144)/({Math.abs(zPressure?.pressure ?? 0).toFixed(1)}×{s.rowSpacing})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 6: Fastener Requirements (permit-ready) */}
      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs">Fastener Requirements — Permit-Ready</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr>
                  <th className="p-2 text-left">Zone</th>
                  <th className="p-2 text-right">Lap Spacing</th>
                  <th className="p-2 text-right"># Rows</th>
                  <th className="p-2 text-right">Field Spacing</th>
                </tr>
              </thead>
              <tbody>
                {r.computedSpacings.map(s => (
                  <tr key={s.zone} className="border-t">
                    <td className="p-2 font-medium">Zone {s.zone} ({s.label})</td>
                    <td className="p-2 text-right font-mono font-bold">{s.lapSpacing}" O.C.</td>
                    <td className="p-2 text-right font-mono font-bold">{s.fieldRows} rows</td>
                    <td className="p-2 text-right font-mono font-bold">{s.final}" O.C.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CopyPatternButton ccResults={r} ccFields={ccFields} inputs={inputs} />
        </CardContent>
      </Card>

      {/* 7: Zone Diagram */}
      <ZoneDiagram inputs={inputs} ccResults={r} />

      {/* 8: Legacy Results (collapsed) */}
      {outputs && inputs.systemType !== 'adhered' && (
        <Collapsible className="border rounded-lg">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors rounded-t-lg">
            <span className="text-xs font-medium text-muted-foreground">Legacy RAS 117 Results</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pb-3">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr><th className="p-2">Zone</th><th className="p-2 text-right">P</th><th className="p-2 text-right">Rows</th><th className="p-2 text-right">RS</th><th className="p-2 text-right">FS</th></tr>
                </thead>
                <tbody>
                  {outputs.fastenerResults?.map((fr: any) => (
                    <tr key={fr.zone} className="border-t">
                      <td className="p-2">{fr.zone}</td>
                      <td className="p-2 text-right">{fr.P_psf}</td>
                      <td className="p-2 text-right">{fr.n_rows}</td>
                      <td className="p-2 text-right font-mono">{fr.RS_in}"</td>
                      <td className="p-2 text-right font-mono font-bold">{fr.FS_used_in}"</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* 9: TAS 105 Results */}
      {tas105Outputs && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs">TAS 105 Results</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xs font-mono space-y-1">
              <p>n = {tas105Outputs.n}, X̄ = {tas105Outputs.mean_lbf} lbf, σ = {tas105Outputs.stdDev_lbf} lbf</p>
              <p className="font-bold">MCRF = {tas105Outputs.MCRF_lbf} lbf
                <Badge className={cn("ml-2 text-[10px]", tas105Outputs.pass ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                  {tas105Outputs.pass ? '✅ PASS' : '🔴 FAIL'}
                </Badge>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 10: Warnings */}
      {outputs?.warnings?.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs">Warnings & Compliance</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {outputs.warnings.map((w: any, i: number) => (
              <div key={i} className={cn("flex items-start gap-2 p-2 rounded border text-xs",
                w.level === 'error' ? 'bg-red-50 border-red-200' : w.level === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200')}>
                {w.level === 'error' ? <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" /> :
                 w.level === 'warning' ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" /> :
                 <Info className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />}
                <div>
                  <p>{w.message}</p>
                  {w.reference && <Badge variant="outline" className="text-[9px] mt-1">{w.reference}</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-[10px] text-muted-foreground text-center pb-4">
        FastenerCalc HVHZ — ASCE 7-22 Ch. 30 C&C · FBC 8th Edition (2023) · RAS 117/128/137 · TAS 105
      </p>
    </div>
  );
}

// ─── Copy Pattern Button ────────────────────────────────────
function CopyPatternButton({ ccResults: r, ccFields, inputs }: { ccResults: FastenerCalcResults; ccFields: CCCalcFields; inputs: any }) {
  const [copied, setCopied] = useState(false);
  const lines = r.computedSpacings.map(s =>
    `Zone ${s.zone} (${s.label}): ${s.lapSpacing}" O.C. lap + ${s.fieldRows} rows @ ${s.final}" O.C.`
  );
  const text = `NOA: ${inputs.noa.approvalNumber || '—'} | DP: ${ccFields.designPressure} psf | V=${inputs.V} mph\n${lines.join('\n')}`;
  const handleCopy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="flex justify-end mt-2">
      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleCopy}>
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy Pattern'}
      </Button>
    </div>
  );
}

// ─── Zone Diagram (C&C) ────────────────────────────────────
function ZoneDiagram({ inputs, ccResults: r }: { inputs: any; ccResults: FastenerCalcResults }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const W = inputs.buildingWidth;
  const L = inputs.buildingLength;
  const zw = r.zoneWidths;
  const maxDim = Math.max(W, L);
  const svgW = 400, svgH = 300;
  const padding = 40;
  const scale = (svgW - padding * 2) / maxDim;
  const sw = W * scale, sl = L * scale;
  const sa = zw.zone2 * scale;
  const ox = (svgW - sw) / 2, oy = (svgH - sl - 30) / 2 + 10;

  const has1p = zw.hasZone1Prime && L > 2 * zw.zone2 && W > 2 * zw.zone2;

  const allRects: { zone: string; x: number; y: number; w: number; h: number; fill: string; stroke: string; dash?: boolean }[] = [];

  // Zone 1' (interior)
  if (has1p) {
    allRects.push({ zone: "1'", x: ox + sa, y: oy + sa, w: sw - 2 * sa, h: sl - 2 * sa,
      fill: ZONE_COLORS["1'"].fill, stroke: ZONE_COLORS["1'"].stroke, dash: true });
  }
  // Zone 2 (perimeter strips)
  allRects.push(
    { zone: '2', x: ox + sa, y: oy, w: sw - 2 * sa, h: sa, fill: ZONE_COLORS['2'].fill, stroke: ZONE_COLORS['2'].stroke },
    { zone: '2', x: ox + sa, y: oy + sl - sa, w: sw - 2 * sa, h: sa, fill: ZONE_COLORS['2'].fill, stroke: ZONE_COLORS['2'].stroke },
    { zone: '2', x: ox, y: oy + sa, w: sa, h: sl - 2 * sa, fill: ZONE_COLORS['2'].fill, stroke: ZONE_COLORS['2'].stroke },
    { zone: '2', x: ox + sw - sa, y: oy + sa, w: sa, h: sl - 2 * sa, fill: ZONE_COLORS['2'].fill, stroke: ZONE_COLORS['2'].stroke },
  );
  // Zone 3 (corners)
  allRects.push(
    { zone: '3', x: ox, y: oy, w: sa, h: sa, fill: ZONE_COLORS['3'].fill, stroke: ZONE_COLORS['3'].stroke },
    { zone: '3', x: ox + sw - sa, y: oy, w: sa, h: sa, fill: ZONE_COLORS['3'].fill, stroke: ZONE_COLORS['3'].stroke },
    { zone: '3', x: ox, y: oy + sl - sa, w: sa, h: sa, fill: ZONE_COLORS['3'].fill, stroke: ZONE_COLORS['3'].stroke },
    { zone: '3', x: ox + sw - sa, y: oy + sl - sa, w: sa, h: sa, fill: ZONE_COLORS['3'].fill, stroke: ZONE_COLORS['3'].stroke },
  );

  const getSpacing = (zone: string) => r.computedSpacings.find(s => s.zone === zone);
  const getZonePressure = (zone: string) => r.zones.find(z => z.zone === zone);

  const hoveredSpacing = hovered ? getSpacing(hovered) : null;
  const hoveredPressure = hovered ? getZonePressure(hovered) : null;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs">Zone Diagram — C&C</CardTitle></CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full">
          <rect x={ox} y={oy} width={sw} height={sl} fill="hsl(var(--muted) / 0.3)" stroke="hsl(var(--border))" strokeWidth={1} />
          {allRects.map((rect, i) => (
            <rect key={i} x={rect.x} y={rect.y} width={rect.w} height={rect.h}
              fill={hovered && hovered !== rect.zone ? rect.fill.replace(/[\d.]+\)$/, '0.05)') : rect.fill}
              stroke={rect.stroke} strokeWidth={hovered === rect.zone ? 2 : 0.5}
              strokeDasharray={rect.dash ? '4 2' : undefined}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHovered(rect.zone)}
              onMouseLeave={() => setHovered(null)} />
          ))}
          {/* Dimension labels */}
          <text x={ox + sw / 2} y={oy + sl + 18} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">{W} ft</text>
          <text x={ox - 14} y={oy + sl / 2} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))"
            transform={`rotate(-90, ${ox - 14}, ${oy + sl / 2})`}>{L} ft</text>
          <text x={ox + sa / 2} y={oy - 6} textAnchor="middle" fontSize={8} fill="hsl(var(--muted-foreground))">
            {zw.hasZone1Prime ? `0.6h=${zw.zone2} ft` : `a=${zw.zone2} ft`}
          </text>
          {/* Legend */}
          <rect x={svgW - 130} y={6} width={124} height={has1p ? 80 : 64} rx={4} fill="hsl(var(--card))" stroke="hsl(var(--border))" />
          {r.zones.map((z, i) => {
            const clr = ZONE_COLORS[z.zone] ?? ZONE_COLORS['1'];
            return (
              <g key={z.zone}>
                <rect x={svgW - 124} y={12 + i * 16} width={8} height={8} fill={clr.label} rx={1} />
                <text x={svgW - 112} y={19 + i * 16} fontSize={9} fill="hsl(var(--foreground))">
                  Z{z.zone}: {Math.abs(z.pressure).toFixed(1)} psf
                </text>
              </g>
            );
          })}
          {/* Hover tooltip */}
          {hovered && hoveredPressure && (
            <g>
              <rect x={ox + sw / 2 - 90} y={oy + sl + 24} width={180} height={hoveredSpacing ? 36 : 22} rx={4}
                fill="hsl(var(--popover))" stroke="hsl(var(--border))" />
              <text x={ox + sw / 2} y={oy + sl + 38} textAnchor="middle" fontSize={10} fontWeight="600" fill="hsl(var(--foreground))">
                Zone {hovered}: P = {Math.abs(hoveredPressure.pressure).toFixed(1)} psf
              </text>
              {hoveredSpacing && (
                <text x={ox + sw / 2} y={oy + sl + 52} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
                  {hoveredSpacing.fieldRows} rows @ {hoveredSpacing.final}" O.C.
                </text>
              )}
            </g>
          )}
        </svg>
      </CardContent>
    </Card>
  );
}
