import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PELayout } from "@/components/PELayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2, Wind, Building2, Home, Link2, ChevronDown, AlertTriangle } from "lucide-react";
import { CalcHeader } from "@/components/pe/CalcHeader";
import { CalcSummaryCard } from "@/components/pe/CalcSummaryCard";
import { CalcDerivation } from "@/components/pe/CalcDerivation";
import { usePEWindStore } from "@/stores/pe-wind-store";
import { useIsMobile } from "@/hooks/use-mobile";

const ZONE_COLORS = {
  'Zone 1 (Field)':   { fill: 'hsl(217 91% 53% / 0.08)', stroke: 'hsl(217 91% 53% / 0.3)', label: 'hsl(217 91% 53%)' },
  'Zone 1E (Edge)':   { fill: 'hsl(217 91% 53% / 0.18)', stroke: 'hsl(217 91% 53% / 0.5)', label: 'hsl(217 91% 53%)' },
  'Zone 2 (Eave)':    { fill: 'hsl(38 92% 44% / 0.15)',  stroke: 'hsl(38 92% 44% / 0.4)',  label: 'hsl(38 92% 44%)' },
  'Zone 2E (Corner)': { fill: 'hsl(0 72% 51% / 0.18)',   stroke: 'hsl(0 72% 51% / 0.5)',   label: 'hsl(0 72% 51%)' },
};

export default function WindMitigationCalc() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  const store = usePEWindStore();
  const { inputs, output, dirty } = store;

  const loadData = useCallback(async () => {
    if (!id || !user) return;
    const { data: wo } = await supabase
      .from("work_orders")
      .select("id, service_type, status, order_id, orders(job_address, job_city, job_zip, job_county, site_context, noa_document_path, noa_document_name)")
      .eq("id", id).single();
    if (!wo) return;
    setOrderData(wo.orders);

    const { data: fdRow } = await supabase
      .from("field_data").select("form_data").eq("work_order_id", id).maybeSingle();
    const fd = (fdRow?.form_data as Record<string, any>) ?? {};
    const siteCtx = ((wo.orders as any)?.site_context as Record<string, any>) ?? {};

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
    <CalcHeader
      title="Wind Mitigation"
      workOrderId={id!}
      address={address}
      onSave={handleSave}
      onReturn={handleReturn}
      saving={saving}
      dirty={dirty}
    />
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
            <FormPanel inputs={inputs} store={store} orderData={orderData} />
          </TabsContent>
          <TabsContent value="results" className="p-4 overflow-y-auto" style={{ height: 'calc(100vh - 112px)' }}>
            <ResultsPanel inputs={inputs} output={output} />
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
          <FormPanel inputs={inputs} store={store} orderData={orderData} />
        </div>
        <div className="flex-1 overflow-y-auto p-4" style={{ height: 'calc(100vh - 56px)' }}>
          <ResultsPanel inputs={inputs} output={output} />
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

// ─── Field helper ───────────────────────────────────────────
function NumField({ label, value, onChange, unit, step = 1, tooltip, disabled }: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; step?: number; tooltip?: string; disabled?: boolean;
}) {
  const inner = (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <Input type="number" value={value || ''} step={step} disabled={disabled}
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

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
  );
}

// ─── Form Panel ─────────────────────────────────────────────
function FormPanel({ inputs, store, orderData }: { inputs: any; store: any; orderData: any }) {
  return (
    <div className="space-y-3">
      {/* Section 1: HVHZ Design Parameters */}
      <Section title="HVHZ Design Parameters" icon={Wind}>
        <NumField label="Basic Wind Speed (V)" value={inputs.V} onChange={v => store.setInput('V', v)} unit="mph" />
        {inputs.V === 185 && (
          <div className="text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded p-2">
            HVHZ mandate per FBC 2023 §1609.1.1
          </div>
        )}
        <div>
          <Label className="text-xs text-muted-foreground">Exposure Category</Label>
          <Select value={inputs.exposureCategory} onValueChange={v => store.setInput('exposureCategory', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="B">B</SelectItem>
              <SelectItem value="C">C (coastal HVHZ default)</SelectItem>
              <SelectItem value="D">D</SelectItem>
            </SelectContent>
          </Select>
          {inputs.exposureCategory !== 'C' && (
            <p className="text-[10px] text-destructive mt-1">⚠ HVHZ typically requires Exposure C</p>
          )}
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
        <div className="grid grid-cols-3 gap-2">
          <NumField label="Kzt" value={inputs.Kzt} onChange={v => store.setInput('Kzt', v)} step={0.01} tooltip="§26.8 — Topographic Factor" />
          <NumField label="Kd" value={inputs.Kd} onChange={v => store.setInput('Kd', v)} step={0.01} tooltip="Table 26.6-1" />
          <NumField label="Ke" value={inputs.Ke} onChange={v => store.setInput('Ke', v)} step={0.01} tooltip="Table 26.9-1" />
        </div>
      </Section>

      {/* Section 2: Building Information */}
      <Section title="Building Information" icon={Building2}>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Year Built" value={inputs.yearBuilt} onChange={v => store.setInput('yearBuilt', v)} />
          <div>
            <Label className="text-xs text-muted-foreground">Occupancy Type</Label>
            <Select value={inputs.occupancyType} onValueChange={v => store.setInput('occupancyType', v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Residential">Residential</SelectItem>
                <SelectItem value="Commercial">Commercial</SelectItem>
                <SelectItem value="Industrial">Industrial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <TextField label="Stories" value={inputs.stories} onChange={v => store.setInput('stories', v)} />
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Width" value={inputs.buildingWidth} onChange={v => store.setInput('buildingWidth', v)} unit="ft" />
          <NumField label="Length" value={inputs.buildingLength} onChange={v => store.setInput('buildingLength', v)} unit="ft" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Wall Height" value={inputs.wallHeight} onChange={v => store.setInput('wallHeight', v)} unit="ft" />
          <NumField label="Mean Roof Height" value={inputs.meanRoofHeight} onChange={v => store.setInput('meanRoofHeight', v)} unit="ft" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Roof Shape</Label>
          <Select value={inputs.roofShape} onValueChange={v => store.setInput('roofShape', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Hip","Gable","Flat","Monoslope","Complex"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Section>

      {/* Section 3: Roof System */}
      <Section title="Roof System" icon={Home}>
        <TextField label="Covering Type" value={inputs.roofCoveringType} onChange={v => store.setInput('roofCoveringType', v)} />
        <div className="grid grid-cols-2 gap-2">
          <TextField label="NOA Number" value={inputs.noaNumber} onChange={v => store.setInput('noaNumber', v)} />
          <div>
            <Label className="text-xs text-muted-foreground">NOA Expiry</Label>
            <Input type="date" value={inputs.noaExpiry} onChange={e => store.setInput('noaExpiry', e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Deck Type</Label>
          <Select value={inputs.deckType} onValueChange={v => store.setInput('deckType', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["OSB","Plywood","Concrete","Steel","Other"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Deck Thickness" value={inputs.deckThickness} onChange={v => store.setInput('deckThickness', v)} />
          <TextField label="Fastener Type" value={inputs.fastenerType} onChange={v => store.setInput('fastenerType', v)} />
        </div>
        <TextField label="Fastener Size" value={inputs.fastenerSize} onChange={v => store.setInput('fastenerSize', v)} />
        {orderData?.noa_document_path && <NOADocLink path={orderData.noa_document_path} name={orderData.noa_document_name} />}
      </Section>

      {/* Section 4: Structural Connections */}
      <Section title="Structural Connections" icon={Link2}>
        <div>
          <Label className="text-xs text-muted-foreground">Roof-to-Wall Connection</Label>
          <Select value={inputs.roofToWallConnection} onValueChange={v => store.setInput('roofToWallConnection', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Clips","Single Wraps","Double Wraps","Hurricane Straps","Embedded","Other"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <TextField label="Connection Spacing (in)" value={inputs.connectionSpacing} onChange={v => store.setInput('connectionSpacing', v)} />
        <div className="flex items-center justify-between">
          <Label className="text-xs">All Openings Protected</Label>
          <Switch checked={inputs.allOpeningsProtected} onCheckedChange={v => store.setInput('allOpeningsProtected', v)} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Garage Door Rated</Label>
          <Switch checked={inputs.garageDoorRated} onCheckedChange={v => store.setInput('garageDoorRated', v)} />
        </div>
      </Section>

      {inputs.noaNumber && (
        <div className="flex items-start gap-2 bg-amber-50 text-amber-800 text-xs p-3 rounded-lg border border-amber-200">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>Verify that NOA-rated design pressure ≥ calculated zone pressure. If NOA rating is less, a different approved system is required.</p>
        </div>
      )}
    </div>
  );
}

// ─── NOA Doc Link ───────────────────────────────────────────
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

// ─── Results Panel ──────────────────────────────────────────
function ResultsPanel({ inputs, output }: { inputs: any; output: any }) {
  if (!output) return <p className="text-sm text-muted-foreground p-4">Enter building dimensions to see results.</p>;

  const worstZone = output.zones.reduce((worst: any, z: any) => Math.abs(z.netPressure) > Math.abs(worst.netPressure) ? z : worst, output.zones[0]);

  return (
    <div className="space-y-4">
      {/* 4A: Building Zone Diagram */}
      <WindZoneDiagram inputs={inputs} output={output} />

      {/* 4B: Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <CalcSummaryCard label="Kz" value={output.Kz.toFixed(4)} />
        <CalcSummaryCard label="qh" value={output.qh.toFixed(2)} unit="psf" />
        <CalcSummaryCard label="Worst Zone" value={`${Math.abs(worstZone.netPressure).toFixed(1)}`} unit="psf" variant="destructive" />
        <CalcSummaryCard label="Zone dim 'a'" value={output.a.toFixed(2)} unit="ft" />
      </div>

      {/* 4C: Derivation */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Velocity Pressure Derivation</CardTitle></CardHeader>
        <CardContent>
          <CalcDerivation lines={[
            `Kz = ${output.Kz.toFixed(4)} (h = ${inputs.meanRoofHeight} ft, Exposure ${inputs.exposureCategory}, Table 26.10-1)`,
            `qh = 0.00256 × ${output.Kz.toFixed(4)} × ${inputs.Kzt} × ${inputs.Kd} × ${inputs.Ke} × ${inputs.V}²`,
            `**qh = ${output.qh.toFixed(2)} psf**`,
            `a = max(min(0.1 × min(W,L), 0.4h), max(0.04 × min(W,L), 3))`,
            `**a = ${output.a.toFixed(2)} ft**`,
          ]} />
        </CardContent>
      </Card>

      {/* 4D: Zone Pressure Table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Zone Pressure Table</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr>
                  <th className="text-left p-2">Zone</th>
                  <th className="text-right p-2">GCpf</th>
                  <th className="text-right p-2">GCpi</th>
                  <th className="text-right p-2">Net (psf)</th>
                  <th className="text-left p-2">Dir</th>
                </tr>
              </thead>
              <tbody>
                {output.zones.map((z: any) => (
                  <tr key={z.zone} className={cn("border-t", z.zone === 'Zone 2E (Corner)' && "text-destructive")}>
                    <td className="p-2 font-medium">{z.zone}</td>
                    <td className="p-2 text-right">{z.GCpf}</td>
                    <td className="p-2 text-right">{z.GCpi}</td>
                    <td className="p-2 text-right font-bold">{z.netPressure}</td>
                    <td className="p-2">{z.direction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 4E: Code Reference */}
      <p className="text-[10px] text-muted-foreground">
        GCpf from ASCE 7-22 Fig. 28.3-1 (gable roof, θ ≤ 7°). GCpi = −0.18 (enclosed). MWFRS pressures per Chapter 28, Envelope Procedure.
      </p>

      {/* 4F: NOA Compliance Warning */}
      {inputs.noaNumber && (
        <div className="flex items-start gap-2 bg-amber-50 text-amber-800 text-xs p-3 rounded-lg border border-amber-200">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>Verify that the NOA-rated design pressure meets or exceeds the calculated zone pressures. If any zone pressure exceeds the NOA rating, a different approved system is required.</p>
        </div>
      )}

      {/* Footer */}
      <p className="text-[10px] text-muted-foreground text-center pb-4">
        Wind pressure calculations per ASCE 7-22, FBC 2023 §1609. All results must be reviewed by a licensed PE.
      </p>
    </div>
  );
}

// ─── Wind Zone Diagram ──────────────────────────────────────
function WindZoneDiagram({ inputs, output }: { inputs: any; output: any }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const W = inputs.buildingWidth;
  const L = inputs.buildingLength;
  const a = output.a;
  const maxDim = Math.max(W, L);
  if (maxDim <= 0) return null;

  const svgW = 400, svgH = 300;
  const padding = 40;
  const scale = (svgW - padding * 2) / maxDim;
  const sw = W * scale, sl = L * scale;
  const sa = a * scale;
  const ox = (svgW - sw) / 2, oy = (svgH - sl - 30) / 2 + 10;

  const zoneMap: Record<string, any> = {};
  output.zones.forEach((z: any) => { zoneMap[z.zone] = z; });

  const rects = [
    // Field (center)
    { zone: 'Zone 1 (Field)', x: ox + sa, y: oy + sa, w: sw - 2 * sa, h: sl - 2 * sa },
    // Edge strips (top/bottom between corners)
    { zone: 'Zone 1E (Edge)', x: ox + sa, y: oy, w: sw - 2 * sa, h: sa },
    { zone: 'Zone 1E (Edge)', x: ox + sa, y: oy + sl - sa, w: sw - 2 * sa, h: sa },
    // Eave strips (left/right between corners)
    { zone: 'Zone 2 (Eave)', x: ox, y: oy + sa, w: sa, h: sl - 2 * sa },
    { zone: 'Zone 2 (Eave)', x: ox + sw - sa, y: oy + sa, w: sa, h: sl - 2 * sa },
    // Corners
    { zone: 'Zone 2E (Corner)', x: ox, y: oy, w: sa, h: sa },
    { zone: 'Zone 2E (Corner)', x: ox + sw - sa, y: oy, w: sa, h: sa },
    { zone: 'Zone 2E (Corner)', x: ox, y: oy + sl - sa, w: sa, h: sa },
    { zone: 'Zone 2E (Corner)', x: ox + sw - sa, y: oy + sl - sa, w: sa, h: sa },
  ];

  const hoveredZone = hovered ? zoneMap[hovered] : null;
  const colors = ZONE_COLORS as Record<string, any>;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs">Building Zone Diagram</CardTitle></CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full">
          {/* Building outline */}
          <rect x={ox} y={oy} width={sw} height={sl} fill="hsl(var(--muted) / 0.3)" stroke="hsl(var(--border))" strokeWidth={1} />

          {rects.map((r, i) => {
            const c = colors[r.zone] || colors['Zone 1 (Field)'];
            const isHovered = hovered === r.zone;
            return (
              <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h}
                fill={hovered && !isHovered ? c.fill.replace(/[\d.]+\)$/, '0.03)') : c.fill}
                stroke={c.stroke} strokeWidth={isHovered ? 2 : 0.5}
                className="cursor-pointer transition-opacity"
                onMouseEnter={() => setHovered(r.zone)}
                onMouseLeave={() => setHovered(null)} />
            );
          })}

          {/* Dimension labels */}
          <text x={ox + sw / 2} y={oy + sl + 18} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">{W} ft</text>
          <text x={ox - 14} y={oy + sl / 2} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))"
            transform={`rotate(-90, ${ox - 14}, ${oy + sl / 2})`}>{L} ft</text>
          <text x={ox + sa / 2} y={oy - 6} textAnchor="middle" fontSize={8} fill="hsl(var(--muted-foreground))">a={a.toFixed(1)} ft</text>

          {/* Legend */}
          <rect x={svgW - 140} y={6} width={134} height={74} rx={4} fill="hsl(var(--card))" stroke="hsl(var(--border))" />
          {output.zones.map((z: any, i: number) => {
            const c = colors[z.zone] || colors['Zone 1 (Field)'];
            return (
              <g key={i}>
                <rect x={svgW - 134} y={12 + i * 16} width={8} height={8} fill={c.label} rx={1} />
                <text x={svgW - 122} y={19 + i * 16} fontSize={8} fill="hsl(var(--foreground))">
                  {z.zone.replace(/Zone /, 'Z')}: {Math.abs(z.netPressure)} psf
                </text>
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hovered && hoveredZone && (
            <g>
              <rect x={ox + sw / 2 - 90} y={oy + sl + 24} width={180} height={22} rx={4}
                fill="hsl(var(--popover))" stroke="hsl(var(--border))" />
              <text x={ox + sw / 2} y={oy + sl + 39} textAnchor="middle" fontSize={10} fontWeight="600" fill="hsl(var(--foreground))">
                {hoveredZone.zone}: {hoveredZone.netPressure} psf ({hoveredZone.direction})
              </text>
            </g>
          )}
        </svg>
      </CardContent>
    </Card>
  );
}
