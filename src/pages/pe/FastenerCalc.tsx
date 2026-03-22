import { useEffect, useState, useCallback } from "react";
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
import { usePEFastenerStore } from "@/stores/pe-fastener-store";
import { isTAS105Required } from "@/lib/fastener-engine";
import { lookupByCounty, FLORIDA_COUNTY_WIND } from "@/lib/county-wind-data";
import { useIsMobile } from "@/hooks/use-mobile";

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
const BASIS_BADGES: Record<string, { cls: string; label: string; icon: string }> = {
  prescriptive: { cls: "bg-blue-100 text-blue-800", label: "NOA Prescriptive", icon: "📋" },
  rational_analysis: { cls: "bg-amber-100 text-amber-800", label: "RAS 117 Rational", icon: "🔩" },
  exceeds_300pct: { cls: "bg-orange-100 text-orange-800", label: "Exceeds 300%", icon: "⚠️" },
  asterisked_fail: { cls: "bg-red-100 text-red-800", label: "Asterisked Fail", icon: "🔴" },
};
const ZONE_COLORS = {
  '3':      { fill: 'hsl(0 72% 51% / 0.18)',   stroke: 'hsl(0 72% 51% / 0.5)',   label: 'hsl(0 72% 51%)' },
  '2':      { fill: 'hsl(38 92% 44% / 0.15)',   stroke: 'hsl(38 92% 44% / 0.4)',  label: 'hsl(38 92% 44%)' },
  '1':      { fill: 'hsl(45 93% 47% / 0.10)',   stroke: 'hsl(45 93% 47% / 0.3)',  label: 'hsl(45 93% 47% / 0.8)' },
  '1prime': { fill: 'hsl(217 91% 53% / 0.08)',  stroke: 'hsl(217 91% 53% / 0.2)', label: 'hsl(217 91% 53% / 0.6)' },
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
  const { inputs, outputs, tas105Inputs, tas105Outputs, dirty } = store;

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

    // Only load if this is a different work order than what's persisted
    if (store.workOrderId !== id) {
      store.loadFromFieldData(fd, siteCtx, id);
    }
    setLoaded(true);
  }, [id, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await store.saveToFieldData(id);
      toast.success("Calculation saved. Results will appear in the signed report.");
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };

  const handleReturn = async () => {
    if (dirty && id) await store.saveToFieldData(id);
    navigate(`/pe/review/${id}`);
  };

  if (!loaded) {
    return (
      <PELayout>
        <div className="flex items-center justify-center h-[calc(100vh-56px)]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PELayout>
    );
  }

  const address = orderData
    ? [orderData.job_address, orderData.job_city, orderData.job_zip].filter(Boolean).join(", ")
    : "";

  const headerBar = (
    <div className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => navigate(`/pe/review/${id}`)}>
        <ArrowLeft className="h-4 w-4" /> Back to Review
      </Button>
      <div className="hidden sm:flex items-center gap-2 text-sm">
        <span className="font-semibold text-primary">FastenerCalc HVHZ</span>
        {address && <span className="text-muted-foreground text-xs truncate max-w-[260px]">· {address}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-1">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
        <Button size="sm" onClick={handleReturn} className="gap-1">
          Return <ArrowRight className="h-3.5 w-3.5" />
        </Button>
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
            <FormPanel inputs={inputs} store={store} orderData={orderData} tas105Inputs={tas105Inputs} tas105Outputs={tas105Outputs} />
          </TabsContent>
          <TabsContent value="results" className="p-4 overflow-y-auto" style={{ height: 'calc(100vh - 112px)' }}>
            <ResultsPanel inputs={inputs} outputs={outputs} tas105Outputs={tas105Outputs} />
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
          <FormPanel inputs={inputs} store={store} orderData={orderData} tas105Inputs={tas105Inputs} tas105Outputs={tas105Outputs} />
        </div>
        <div className="flex-1 overflow-y-auto p-4" style={{ height: 'calc(100vh - 56px)' }}>
          <ResultsPanel inputs={inputs} outputs={outputs} tas105Outputs={tas105Outputs} />
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
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 space-y-3">
        {children}
      </CollapsibleContent>
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
  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs max-w-[200px]">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// ─── Form Panel ─────────────────────────────────────────────
function FormPanel({ inputs, store, orderData, tas105Inputs, tas105Outputs }: {
  inputs: any; store: any; orderData: any; tas105Inputs: any; tas105Outputs: any;
}) {
  const countyLabel = inputs.county === 'miami_dade' ? 'Miami-Dade' : inputs.county === 'broward' ? 'Broward' : 'Other';
  const countyInfo = lookupByCounty(countyLabel);
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
      {/* Section 1: Site & Code */}
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
        {countyInfo?.note && (
          <div className="text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded p-2">{countyInfo.note}</div>
        )}
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
            <SelectContent>
              {['I','II','III','IV'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
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

      {/* Section 2: Wind & Exposure */}
      <Section title="Wind & Exposure" icon={Wind}>
        <NumField label="Basic Wind Speed (V)" value={inputs.V} onChange={v => store.setInput('V', v)} unit="mph" />
        <div>
          <Label className="text-xs text-muted-foreground">Exposure Category</Label>
          <Select value={inputs.exposureCategory} onValueChange={v => store.setInput('exposureCategory', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['B','C','D'].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          {inputs.isHVHZ && inputs.exposureCategory !== 'C' && (
            <p className="text-[10px] text-destructive mt-1">⚠ HVHZ requires Exposure C</p>
          )}
        </div>
        <NumField label="Kzt" value={inputs.Kzt} onChange={v => store.setInput('Kzt', v)} step={0.01} tooltip="§26.8 — Topographic Factor" />
        <NumField label="Kd" value={inputs.Kd} onChange={v => store.setInput('Kd', v)} step={0.01} tooltip="Table 26.6-1" />
        <NumField label="Ke" value={inputs.Ke} onChange={v => store.setInput('Ke', v)} step={0.01} tooltip="Table 26.9-1" />
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
      </Section>

      {/* Section 3: Building Geometry */}
      <Section title="Building Geometry" icon={Building2}>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Length" value={inputs.buildingLength} onChange={v => store.setInput('buildingLength', v)} unit="ft" />
          <NumField label="Width" value={inputs.buildingWidth} onChange={v => store.setInput('buildingWidth', v)} unit="ft" />
        </div>
        <NumField label="Mean Roof Height (h)" value={inputs.h} onChange={v => store.setInput('h', v)} unit="ft" />
        <NumField label="Parapet Height" value={inputs.parapetHeight} onChange={v => store.setInput('parapetHeight', v)} unit="ft" />
        <p className="text-[10px] text-muted-foreground">Low-slope (≤ 7°) only. Zone geometry per ASCE 7-22 Fig. 30.3-2A.</p>
      </Section>

      {/* Section 4: Roof System */}
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
            <SelectContent>
              {DECK_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Section>

      {/* Section 5: Fastener / Assembly */}
      <Section title="Fastener / Assembly" icon={Wrench}>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Sheet Width (SW)" value={inputs.sheetWidth_in} onChange={v => store.setInput('sheetWidth_in', v)} unit="in" step={0.125} />
          <NumField label="Lap Width (LW)" value={inputs.lapWidth_in} onChange={v => store.setInput('lapWidth_in', v)} unit="in" step={0.5} />
        </div>
        <div>
          <NumField label="Fastener Value (Fy)" value={inputs.Fy_lbf} onChange={v => store.setInput('Fy_lbf', v)} unit="lbf" step={0.1}
            disabled={inputs.fySource === 'tas105' && tas105Outputs?.pass} />
          {inputs.fySource === 'tas105' && tas105Outputs?.pass && (
            <p className="text-[10px] text-amber-700 mt-1">Design Fy set to MCRF = {tas105Outputs.MCRF_lbf} lbf from TAS 105 field test</p>
          )}
        </div>
        <NumField label="Initial Rows (n)" value={inputs.initialRows} onChange={v => store.setInput('initialRows', Math.max(2, Math.round(v)))} step={1} />
      </Section>

      {/* Section 6: Product Approval / NOA */}
      <Section title="Product Approval / NOA" icon={FileText}>
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
        <div>
          <Label className="text-xs text-muted-foreground">Approval Number</Label>
          <Input value={inputs.noa.approvalNumber} onChange={e => store.setNOA('approvalNumber', e.target.value)} className="h-8 text-sm font-mono" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Manufacturer</Label>
            <Input value={inputs.noa.manufacturer ?? ''} onChange={e => store.setNOA('manufacturer', e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Product / System</Label>
            <Input value={inputs.noa.productName ?? ''} onChange={e => store.setNOA('productName', e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">System Number</Label>
          <Input value={inputs.noa.systemNumber ?? ''} onChange={e => store.setNOA('systemNumber', e.target.value)} className="h-8 text-sm font-mono" />
        </div>
        <NumField label="Max Design Pressure (MDP)" value={Math.abs(inputs.noa.mdp_psf)} onChange={v => store.setNOA('mdp_psf', -Math.abs(v))} unit="psf" />
        <p className="text-[10px] text-muted-foreground">Tested uplift capacity of Zone 1 prescriptive pattern.</p>
        <div>
          <Label className="text-xs text-muted-foreground">MDP Basis</Label>
          <Select value={inputs.noa.mdp_basis ?? 'asd'} onValueChange={v => store.setNOA('mdp_basis', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="asd">ASD Level</SelectItem>
              <SelectItem value="ultimate">Ultimate (will be ÷2 per TAS 114)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Asterisked Assembly (*)</Label>
          <Switch checked={inputs.noa.asterisked} onCheckedChange={v => store.setNOA('asterisked', v)} />
        </div>
        {inputs.noa.asterisked && (
          <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded p-2">
            Asterisked assemblies cannot be extrapolated beyond their listed MDP.
          </div>
        )}
        {orderData?.noa_document_path && (
          <NOADocLink path={orderData.noa_document_path} name={orderData.noa_document_name} />
        )}
      </Section>

      {/* Section 7: Insulation Board */}
      <Section title="Insulation Board" icon={Layers} defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Board Length" value={inputs.boardLength_ft} onChange={v => store.setInput('boardLength_ft', v)} unit="ft" />
          <NumField label="Board Width" value={inputs.boardWidth_ft} onChange={v => store.setInput('boardWidth_ft', v)} unit="ft" />
        </div>
        <NumField label="Insulation Fy" value={inputs.insulation_Fy_lbf} onChange={v => store.setInput('insulation_Fy_lbf', v)} unit="lbf" />
      </Section>

      {/* Section 8: TAS 105 */}
      {showTAS105 && (
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
          <div>
            <Label className="text-xs text-muted-foreground">Deck Condition Notes</Label>
            <Input value={tas105Inputs.deckConditionNotes ?? ''} onChange={e => store.setTAS105Meta({ deckConditionNotes: e.target.value })} className="h-8 text-sm" />
          </div>
          <TAS105ValueGrid values={tas105Inputs.rawValues_lbf} onChange={store.setTAS105Values} />
          {tas105Outputs && <TAS105Stats outputs={tas105Outputs} />}
          {tas105Inputs.rawValues_lbf.length >= 5 && tas105Outputs && (
            <TAS105Histogram values={tas105Inputs.rawValues_lbf} mean={tas105Outputs.mean_lbf} mcrf={tas105Outputs.MCRF_lbf} pass={tas105Outputs.pass} />
          )}
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
      📄 View Client-Uploaded NOA Document {name && `(${name})`}
    </a>
  );
}

// ─── TAS 105 Value Grid ─────────────────────────────────────
function TAS105ValueGrid({ values, onChange }: { values: number[]; onChange: (v: number[]) => void }) {
  const [csvInput, setCsvInput] = useState('');
  const slots = Math.max(values.length + 1, 5);
  const padded = [...values, ...Array(Math.max(0, slots - values.length)).fill(0)];

  const updateAt = (i: number, v: number) => {
    const next = [...padded];
    next[i] = v;
    onChange(next.filter(x => x > 0));
  };

  const importCSV = () => {
    const parsed = csvInput.split(/[,\s]+/).map(Number).filter(n => !isNaN(n) && n > 0);
    if (parsed.length > 0) {
      onChange([...values, ...parsed]);
      setCsvInput('');
      toast.success(`${parsed.length} values imported`);
    }
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
      <Button variant="ghost" size="sm" className="text-xs mt-1" onClick={() => onChange([...values, 0])}>
        + Add Sample
      </Button>
      <div className="flex gap-1 mt-2">
        <Input placeholder="Paste CSV: 350, 420, 380…" value={csvInput} onChange={e => setCsvInput(e.target.value)} className="h-7 text-xs flex-1" />
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={importCSV}>Import</Button>
      </div>
    </div>
  );
}

// ─── TAS 105 Stats ──────────────────────────────────────────
function TAS105Stats({ outputs }: { outputs: any }) {
  return (
    <div className="bg-muted/50 rounded p-3 text-xs space-y-1 font-mono">
      <p>n = {outputs.n}, X̄ = {outputs.mean_lbf} lbf, σ = {outputs.stdDev_lbf} lbf</p>
      <p>t = {outputs.tFactor.toFixed(3)} ({outputs.n >= 10 ? 'n ≥ 10' : 'conservative'})</p>
      <p className="font-bold">MCRF = {outputs.MCRF_lbf} lbf</p>
      <Badge className={cn("text-[10px]", outputs.pass ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
        {outputs.pass ? '✅ PASS (≥ 275 lbf)' : '🔴 FAIL (< 275 lbf)'}
      </Badge>
    </div>
  );
}

// ─── TAS 105 Histogram ──────────────────────────────────────
function TAS105Histogram({ values, mean, mcrf, pass }: { values: number[]; mean: number; mcrf: number; pass: boolean }) {
  const min = Math.min(...values, mcrf, 275) - 20;
  const max = Math.max(...values, mean) + 20;
  const range = max - min || 1;
  const bins = 8;
  const binWidth = range / bins;
  const histogram = Array(bins).fill(0);
  values.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
    if (idx >= 0) histogram[idx]++;
  });
  const maxCount = Math.max(...histogram, 1);
  const w = 240, h = 80, barW = w / bins;

  return (
    <svg viewBox={`0 0 ${w} ${h + 16}`} className="w-full border rounded bg-card">
      {histogram.map((count, i) => (
        <rect key={i} x={i * barW + 1} y={h - (count / maxCount) * h} width={barW - 2}
          height={(count / maxCount) * h} fill="hsl(var(--primary) / 0.3)" rx={1} />
      ))}
      {/* Mean line */}
      <line x1={((mean - min) / range) * w} y1={0} x2={((mean - min) / range) * w} y2={h}
        stroke="white" strokeWidth={1.5} strokeDasharray="4 2" />
      {/* MCRF line */}
      <line x1={((mcrf - min) / range) * w} y1={0} x2={((mcrf - min) / range) * w} y2={h}
        stroke={pass ? 'hsl(142 71% 45%)' : 'hsl(0 72% 51%)'} strokeWidth={2} />
      {/* 275 threshold */}
      <line x1={((275 - min) / range) * w} y1={0} x2={((275 - min) / range) * w} y2={h}
        stroke="hsl(0 72% 51%)" strokeWidth={1} strokeDasharray="3 3" />
      <text x={((mean - min) / range) * w} y={h + 10} textAnchor="middle" fontSize={8} fill="hsl(var(--muted-foreground))">X̄</text>
      <text x={((mcrf - min) / range) * w} y={h + 10} textAnchor="middle" fontSize={8} fill={pass ? 'hsl(142 71% 45%)' : 'hsl(0 72% 51%)'}>MCRF</text>
    </svg>
  );
}

// ─── Results Panel ──────────────────────────────────────────
function ResultsPanel({ inputs, outputs, tas105Outputs }: { inputs: any; outputs: any; tas105Outputs: any }) {
  if (!outputs) return <p className="text-sm text-muted-foreground p-4">Enter parameters to see results.</p>;

  return (
    <div className="space-y-4">
      {/* 3A: Interactive Zone Diagram */}
      <ZoneDiagram inputs={inputs} outputs={outputs} />

      {/* 3B: Summary Cards */}
      <SummaryCards outputs={outputs} />

      {/* 3C: Velocity Pressure Derivation */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Velocity Pressure Derivation</CardTitle></CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded p-3 font-mono text-[11px] space-y-1">
            <p>Kh = {outputs.Kh} (Exp {inputs.exposureCategory}, h = {inputs.h} ft)</p>
            <p>qh,ASD = 0.00256 × {outputs.Kh} × {inputs.Kzt} × {inputs.Kd} × {inputs.Ke} × {inputs.V}² × 0.6</p>
            <p className="font-bold">qh,ASD = {outputs.qh_ASD} psf</p>
          </div>
        </CardContent>
      </Card>

      {/* 3D: Zone Pressures & Attachment Basis */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Zone Pressures & Attachment Basis</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr><th className="text-left p-2">Zone</th><th className="text-right p-2">P (psf)</th><th className="text-right p-2">Width (ft)</th><th className="p-2">Attachment Basis</th><th className="text-right p-2">Extrap Factor</th></tr>
              </thead>
              <tbody>
                {outputs.noaResults.map((nr: any) => (
                  <tr key={nr.zone} className="border-t">
                    <td className="p-2 font-medium">{nr.zone}</td>
                    <td className="p-2 text-right font-bold">{Math.abs(nr.P_psf).toFixed(1)}</td>
                    <td className="p-2 text-right">{outputs.zonePressures.zoneWidth_ft}</td>
                    <td className="p-2">
                      <Badge className={cn("text-[10px]", BASIS_BADGES[nr.basis]?.cls)}>
                        {BASIS_BADGES[nr.basis]?.icon} {BASIS_BADGES[nr.basis]?.label}
                      </Badge>
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", extrapColor(nr.extrapFactor))}
                            style={{ width: `${Math.min(nr.extrapFactor / 3 * 100, 100)}%` }} />
                        </div>
                        <span className="font-mono">{nr.extrapFactor.toFixed(2)}×</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 3E: Fastener Pattern Results */}
      {inputs.systemType !== 'adhered' ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs">Fastener Pattern Results — RAS {inputs.systemType === 'single_ply' ? '137' : '117'}</CardTitle>
              <span className="text-[10px] text-muted-foreground font-mono">Fy = {inputs.Fy_lbf} lbf ({inputs.fySource === 'tas105' ? 'TAS 105' : 'NOA'})</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr><th className="p-2">Zone</th><th className="text-right p-2">P</th><th className="p-2">Basis</th><th className="text-right p-2">Rows</th><th className="text-right p-2">RS</th><th className="text-right p-2">FS Calc</th><th className="text-right p-2 font-bold">FS Used</th><th className="text-right p-2">D/R</th><th className="p-2">½</th></tr>
                </thead>
                <tbody>
                  {outputs.fastenerResults.map((fr: any) => (
                    <tr key={fr.zone} className="border-t">
                      <td className="p-2 font-medium">{fr.zone}</td>
                      <td className="p-2 text-right">{fr.P_psf}</td>
                      <td className="p-2"><Badge className={cn("text-[9px]", BASIS_BADGES[fr.noaCheck.basis]?.cls)}>{fr.noaCheck.basis === 'prescriptive' ? 'NOA' : 'RAS'}</Badge></td>
                      <td className="p-2 text-right">{fr.n_rows}</td>
                      <td className="p-2 text-right font-mono">{fr.RS_in}"</td>
                      <td className="p-2 text-right font-mono">{fr.FS_calculated_in}"</td>
                      <td className="p-2 text-right font-bold font-mono">{fr.FS_used_in}"</td>
                      <td className="p-2 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", drColor(fr.demandRatio))}
                              style={{ width: `${Math.min(fr.demandRatio * 100, 100)}%` }} />
                          </div>
                          <span className="font-mono text-[10px]">{(fr.demandRatio * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="p-2">{fr.halfSheetRequired ? '⚠️' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4">
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
              <Info className="h-4 w-4 inline mr-1" />
              Adhered Membrane System — No mechanical fastener spacing applies. Verify adhesive bond ≥ zone pressures per NOA / TAS 124.
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3F: Pattern Summary (permit-ready) */}
      {inputs.systemType !== 'adhered' && outputs.fastenerResults.length > 0 && (
        <PatternSummary inputs={inputs} outputs={outputs} />
      )}

      {/* 3G: Insulation Board Fasteners */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Insulation Board Fasteners (RAS 117 §8)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {outputs.insulationResults.map((ir: any) => (
              <div key={ir.zone} className="border rounded p-2 text-xs">
                <p className="font-semibold">Zone {ir.zone}</p>
                <p className="text-muted-foreground">{ir.P_psf} psf</p>
                <p className="font-bold">{ir.N_used} fasteners</p>
                <p className="text-[10px] text-muted-foreground">{ir.layout}</p>
                {ir.N_used > ir.N_prescribed && <p className="text-[10px] text-amber-600">Exceeds prescriptive ({ir.N_prescribed})</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 3H: TAS 105 Results */}
      {tas105Outputs && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs">TAS 105 Results</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs font-mono space-y-1">
              <p>n = {tas105Outputs.n}, X̄ = {tas105Outputs.mean_lbf} lbf, σ = {tas105Outputs.stdDev_lbf} lbf, t = {tas105Outputs.tFactor.toFixed(3)}</p>
              <p className="font-bold">MCRF = {tas105Outputs.MCRF_lbf} lbf
                <Badge className={cn("ml-2 text-[10px]", tas105Outputs.pass ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                  {tas105Outputs.pass ? '✅ PASS' : '🔴 FAIL'}
                </Badge>
              </p>
            </div>
            {!tas105Outputs.pass && (
              <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-800 space-y-1">
                <p className="font-semibold">Remediation Required:</p>
                <ol className="list-decimal ml-4 space-y-0.5">
                  <li>Verify test methodology</li>
                  <li>Consider alternative fastener</li>
                  <li>Provide deck repair specification</li>
                  <li>Re-test after repair</li>
                </ol>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3I: Warnings */}
      {outputs.warnings.length > 0 && (
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

      {/* 3J: Footer */}
      <p className="text-[10px] text-muted-foreground text-center pb-4">
        FastenerCalc HVHZ provides calculations as a design aid based on FBC 8th Edition, ASCE 7-22, and Florida Test Protocols (RAS 117, 128, 137, TAS 105). All results must be reviewed and approved by a licensed PE.
      </p>
    </div>
  );
}

// ─── Pattern Summary Card ───────────────────────────────────
function PatternSummary({ inputs, outputs }: { inputs: any; outputs: any }) {
  const [copied, setCopied] = useState(false);
  const lines = outputs.fastenerResults.map((fr: any) => {
    const basis = fr.noaCheck.basis === 'prescriptive' ? 'NOA' : 'RAS 117';
    const half = fr.halfSheetRequired ? ' [HALF SHEET]' : '';
    return `Zone ${fr.zone}: ${fr.FS_used_in}" o.c. at ${inputs.lapWidth_in}" lap + ${fr.FS_used_in}" o.c. at ${fr.n_rows} rows (${basis})${half}`;
  });
  const text = `NOA: ${inputs.noa.approvalNumber || '—'} | MDP: ${Math.abs(inputs.noa.mdp_psf)} psf\n\n${lines.join('\n')}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs">Pattern Summary — Permit-Ready</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleCopy}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-[10px] text-muted-foreground mb-2">NOA: {inputs.noa.approvalNumber || '—'} | MDP: {Math.abs(inputs.noa.mdp_psf)} psf</p>
        <div className="bg-muted/50 rounded p-3 font-mono text-[11px] space-y-0.5">
          {lines.map((line: string, i: number) => <p key={i}>{line}</p>)}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Summary Cards ──────────────────────────────────────────
function SummaryCards({ outputs }: { outputs: any }) {
  const z3 = outputs.noaResults.find((r: any) => r.zone === '3');
  const minFS = outputs.fastenerResults.length > 0 ? outputs.minFS_in : null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      <MetricCard label="qh (ASD)" value={`${outputs.qh_ASD} psf`} />
      <MetricCard label="Zone 3" value={`${z3 ? Math.abs(z3.P_psf).toFixed(1) : '—'} psf`} className="text-red-600" />
      <MetricCard label="Zone 3 Extrap" value={`${z3 ? z3.extrapFactor.toFixed(2) : '—'}× of 3.0×`}
        className={z3 ? (z3.extrapFactor < 2 ? 'text-green-600' : z3.extrapFactor <= 3 ? 'text-amber-600' : 'text-red-600') : ''} />
      <MetricCard label="Min FS" value={minFS != null ? `${minFS}"` : '—'}
        className={minFS != null && minFS < 6 ? 'text-red-600' : ''} />
      <MetricCard label="NOA MDP" value={`${Math.abs(outputs.noaResults[0]?.MDP_psf || 0)} psf`} />
    </div>
  );
}

function MetricCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="border rounded-lg p-2 text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-bold font-mono", className)}>{value}</p>
    </div>
  );
}

// ─── Interactive Zone Diagram ───────────────────────────────
function ZoneDiagram({ inputs, outputs }: { inputs: any; outputs: any }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const W = inputs.buildingWidth;
  const L = inputs.buildingLength;
  const a = outputs.zonePressures.zoneWidth_ft;
  const maxDim = Math.max(W, L);
  const svgW = 400, svgH = 300;
  const padding = 40;
  const scale = (svgW - padding * 2) / maxDim;
  const sw = W * scale, sl = L * scale;
  const sa = a * scale;
  const ox = (svgW - sw) / 2, oy = (svgH - sl - 30) / 2 + 10;

  const has1prime = L > 2 * a && W > 2 * a;
  const zp = outputs.zonePressures;
  const fr = outputs.fastenerResults;

  const getFR = (zone: string) => fr.find((f: any) => f.zone === zone);

  const zoneRects = [
    // Zone 1' (field) — draw first, underneath
    ...(has1prime ? [{
      zone: "1'", x: ox + sa, y: oy + sa, w: sw - 2 * sa, h: sl - 2 * sa,
      fill: ZONE_COLORS['1prime'].fill, stroke: ZONE_COLORS['1prime'].stroke, dash: true,
    }] : []),
    // Zone 1 (inner ring strips)
    { zone: '1', x: ox + sa, y: oy, w: sw - 2 * sa, h: sa, fill: ZONE_COLORS['1'].fill, stroke: ZONE_COLORS['1'].stroke },
    { zone: '1', x: ox + sa, y: oy + sl - sa, w: sw - 2 * sa, h: sa, fill: ZONE_COLORS['1'].fill, stroke: ZONE_COLORS['1'].stroke },
    { zone: '1', x: ox, y: oy + sa, w: sa, h: sl - 2 * sa, fill: ZONE_COLORS['1'].fill, stroke: ZONE_COLORS['1'].stroke },
    { zone: '1', x: ox + sw - sa, y: oy + sa, w: sa, h: sl - 2 * sa, fill: ZONE_COLORS['1'].fill, stroke: ZONE_COLORS['1'].stroke },
    // Zone 2 perimeter strips (same as zone 1 here for simplified rendering — overlaid)
    // Zone 3 corners
    { zone: '3', x: ox, y: oy, w: sa, h: sa, fill: ZONE_COLORS['3'].fill, stroke: ZONE_COLORS['3'].stroke },
    { zone: '3', x: ox + sw - sa, y: oy, w: sa, h: sa, fill: ZONE_COLORS['3'].fill, stroke: ZONE_COLORS['3'].stroke },
    { zone: '3', x: ox, y: oy + sl - sa, w: sa, h: sa, fill: ZONE_COLORS['3'].fill, stroke: ZONE_COLORS['3'].stroke },
    { zone: '3', x: ox + sw - sa, y: oy + sl - sa, w: sa, h: sa, fill: ZONE_COLORS['3'].fill, stroke: ZONE_COLORS['3'].stroke },
  ];

  // Also add Zone 2 strips between corners
  const z2Rects = [
    { zone: '2', x: ox + sa, y: oy, w: sw - 2 * sa, h: sa, fill: ZONE_COLORS['2'].fill, stroke: ZONE_COLORS['2'].stroke },
    { zone: '2', x: ox + sa, y: oy + sl - sa, w: sw - 2 * sa, h: sa, fill: ZONE_COLORS['2'].fill, stroke: ZONE_COLORS['2'].stroke },
    { zone: '2', x: ox, y: oy + sa, w: sa, h: sl - 2 * sa, fill: ZONE_COLORS['2'].fill, stroke: ZONE_COLORS['2'].stroke },
    { zone: '2', x: ox + sw - sa, y: oy + sa, w: sa, h: sl - 2 * sa, fill: ZONE_COLORS['2'].fill, stroke: ZONE_COLORS['2'].stroke },
  ];

  // Correct layering: field → zone2 → zone3
  const allRects = [
    ...(has1prime ? [zoneRects[0]] : []), // 1' field
    ...z2Rects, // Zone 2
    ...zoneRects.filter(r => r.zone === '3'), // Zone 3 corners
  ];

  const hoveredFR = hovered ? getFR(hovered) : null;
  const hoveredP = hovered === '3' ? zp.zone3 : hovered === '2' ? zp.zone2 : hovered === '1' ? zp.zone1 : hovered === "1'" ? zp.zone1prime : null;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs">Zone Diagram</CardTitle></CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full">
          {/* Building outline */}
          <rect x={ox} y={oy} width={sw} height={sl} fill="hsl(var(--muted) / 0.3)" stroke="hsl(var(--border))" strokeWidth={1} />

          {allRects.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h}
              fill={hovered && hovered !== r.zone ? r.fill.replace(/[\d.]+\)$/, '0.05)') : r.fill}
              stroke={r.stroke} strokeWidth={hovered === r.zone ? 2 : 0.5}
              strokeDasharray={(r as any).dash ? '4 2' : undefined}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHovered(r.zone)}
              onMouseLeave={() => setHovered(null)} />
          ))}

          {/* Dimension labels */}
          <text x={ox + sw / 2} y={oy + sl + 18} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">{W} ft</text>
          <text x={ox - 14} y={oy + sl / 2} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))"
            transform={`rotate(-90, ${ox - 14}, ${oy + sl / 2})`}>{L} ft</text>
          {/* Zone width bracket */}
          <text x={ox + sa / 2} y={oy - 6} textAnchor="middle" fontSize={8} fill="hsl(var(--muted-foreground))">a={a} ft</text>

          {/* Pressure legend */}
          <rect x={svgW - 130} y={6} width={124} height={80} rx={4} fill="hsl(var(--card))" stroke="hsl(var(--border))" />
          {[
            { z: "1'", p: zp.zone1prime, c: ZONE_COLORS['1prime'].label },
            { z: '1', p: zp.zone1, c: ZONE_COLORS['1'].label },
            { z: '2', p: zp.zone2, c: ZONE_COLORS['2'].label },
            { z: '3', p: zp.zone3, c: ZONE_COLORS['3'].label },
          ].map((item, i) => (
            <g key={i}>
              <rect x={svgW - 124} y={12 + i * 18} width={8} height={8} fill={item.c} rx={1} />
              <text x={svgW - 112} y={19 + i * 18} fontSize={9} fill="hsl(var(--foreground))">
                Z{item.z}: {Math.abs(item.p).toFixed(1)} psf
              </text>
            </g>
          ))}

          {/* Hover tooltip */}
          {hovered && hoveredP != null && (
            <g>
              <rect x={ox + sw / 2 - 80} y={oy + sl + 24} width={160} height={hovered && hoveredFR ? 36 : 22} rx={4}
                fill="hsl(var(--popover))" stroke="hsl(var(--border))" />
              <text x={ox + sw / 2} y={oy + sl + 38} textAnchor="middle" fontSize={10} fontWeight="600" fill="hsl(var(--foreground))">
                Zone {hovered}: P = {Math.abs(hoveredP).toFixed(1)} psf
              </text>
              {hoveredFR && (
                <text x={ox + sw / 2} y={oy + sl + 52} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
                  FS: {hoveredFR.FS_used_in}" o.c. × {hoveredFR.n_rows} rows
                </text>
              )}
            </g>
          )}
        </svg>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ────────────────────────────────────────────────
function extrapColor(f: number) {
  if (f < 2) return 'bg-green-500';
  if (f <= 2.7) return 'bg-amber-500';
  if (f <= 3) return 'bg-orange-500';
  return 'bg-red-500';
}
function drColor(dr: number) {
  if (dr < 0.75) return 'bg-green-500';
  if (dr <= 0.95) return 'bg-amber-500';
  return 'bg-red-500';
}
