import { useEffect, useState, useCallback } from "react";
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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Loader2, Droplets, Map, CircleDot, Shield, Eye, ChevronDown, AlertTriangle, CheckCircle, Plus
} from "lucide-react";
import { CalcHeader } from "@/components/pe/CalcHeader";
import { CalcSummaryCard } from "@/components/pe/CalcSummaryCard";
import { CalcDerivation } from "@/components/pe/CalcDerivation";
import { CalcStatusBadge } from "@/components/pe/CalcStatusBadge";
import { usePEDrainageStore } from "@/stores/pe-drainage-store";
import { DESIGN_RAINFALL } from "@/lib/drainage-calc";
import { useIsMobile } from "@/hooks/use-mobile";

export default function DrainageCalc() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  const store = usePEDrainageStore();
  const { county, rainfallOverride, rainfallRate, pipeSlope, zones, primaryDrains, secondaryDrains, output, dirty } = store;

  const loadData = useCallback(async () => {
    if (!id || !user) return;
    const { data: wo } = await supabase
      .from("work_orders")
      .select("id, service_type, status, order_id, orders(job_address, job_city, job_zip, job_county, site_context)")
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
      title="Drainage Analysis"
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
            <FormPanel store={store} />
          </TabsContent>
          <TabsContent value="results" className="p-4 overflow-y-auto" style={{ height: 'calc(100vh - 112px)' }}>
            <ResultsPanel output={output} county={county} rainfallOverride={rainfallOverride} rainfallRate={rainfallRate} />
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
          <FormPanel store={store} />
        </div>
        <div className="flex-1 overflow-y-auto p-4" style={{ height: 'calc(100vh - 56px)' }}>
          <ResultsPanel output={output} county={county} rainfallOverride={rainfallOverride} rainfallRate={rainfallRate} />
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

// ─── Form Panel ─────────────────────────────────────────────
function FormPanel({ store }: { store: any }) {
  const { county, rainfallOverride, rainfallRate, pipeSlope, zones, primaryDrains, secondaryDrains } = store;
  const designRate = DESIGN_RAINFALL[county] ?? 8.39;

  return (
    <div className="space-y-3">
      {/* Section 1: Design Criteria */}
      <Section title="Design Criteria" icon={Droplets}>
        <div>
          <Label className="text-xs text-muted-foreground">County</Label>
          <Select value={county} onValueChange={(v) => {
            store.setCounty(v);
            toast.info(`Rainfall rate updated for ${v} County.`);
          }}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(DESIGN_RAINFALL).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded p-2">
          <p className="font-medium">{county}: {designRate} in/hr</p>
          <p className="text-[10px]">NOAA Atlas 14, 1-hr 100-yr design storm</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={rainfallOverride} onCheckedChange={store.setRainfallOverride} />
          <Label className="text-xs">Override Rainfall Rate</Label>
        </div>
        {rainfallOverride && (
          <>
            <Input type="number" step="0.01" value={rainfallRate ?? ""} onChange={e => store.setRainfallRate(parseFloat(e.target.value) || null)} placeholder="in/hr" className="h-8 text-sm" />
            <p className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">PE override active — document justification in notes.</p>
          </>
        )}
        <div>
          <Label className="text-xs text-muted-foreground">Pipe Slope Assumption</Label>
          <Select value={pipeSlope} onValueChange={store.setPipeSlope}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["1/16", "1/8", "1/4", "1/2"] as const).map(s => <SelectItem key={s} value={s}>{s}" per ft</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="text-[10px] text-muted-foreground">FBC Plumbing 2023 §1101–1106 · NOAA Atlas 14 · 100-yr 1-hr design storm</p>
      </Section>

      {/* Section 2: Drainage Zones */}
      <Section title={`Drainage Zones (${zones.length})`} icon={Map}>
        {zones.length > 0 ? zones.map((z: any, i: number) => (
          <ZoneCard key={z.zone_id} zone={z} index={i} onUpdate={store.updateZone} />
        )) : (
          <div className="flex items-start gap-2 text-amber-700 bg-amber-50 p-2 rounded text-xs border border-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            No drainage zones entered by technician.
          </div>
        )}
        {zones.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            Total: {zones.reduce((s: number, z: any) => s + (z.area_sqft || 0), 0).toLocaleString()} sqft
          </p>
        )}
      </Section>

      {/* Section 3: Primary Drains */}
      <Section title={`Primary Drains (${primaryDrains.length})`} icon={CircleDot}>
        {primaryDrains.length > 0 ? primaryDrains.map((d: any, i: number) => (
          <DrainRow key={d.drain_id} drain={d} index={i} onUpdate={store.updatePrimaryDrain} />
        )) : <p className="text-xs text-muted-foreground">No primary drains recorded.</p>}
        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => store.addPrimaryDrain({
          drain_id: `P${primaryDrains.length + 1}`, zone_id: zones[0]?.zone_id ?? 'A',
          location_description: '', drain_type: 'Interior', pipe_diameter_in: 4,
          leader_type: 'Vertical', pipe_slope: pipeSlope, condition: 'Good',
          strainer_present: true, strainer_condition: 'Good', photo_tag: '',
        })}>
          <Plus className="h-3 w-3" /> Add Drain
        </Button>
      </Section>

      {/* Section 4: Secondary Drains */}
      <Section title={`Secondary Drains (${secondaryDrains.length})`} icon={Shield}>
        <p className="text-[10px] text-blue-700 bg-blue-50 p-1.5 rounded border border-blue-200">
          FBC §1502.3 — independent secondary drainage required in HVHZ
        </p>
        {secondaryDrains.length > 0 ? secondaryDrains.map((d: any, i: number) => (
          <SecondaryDrainRow key={d.drain_id} drain={d} index={i} onUpdate={store.updateSecondaryDrain} />
        )) : <p className="text-xs text-muted-foreground">No secondary drains recorded.</p>}
        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => store.addSecondaryDrain({
          drain_id: `S${secondaryDrains.length + 1}`, zone_id: zones[0]?.zone_id ?? 'A',
          secondary_type: 'Overflow Drain', location_description: '', pipe_diameter_in: 4,
          height_above_primary_in: 2, condition: 'Good', photo_tag: '',
        })}>
          <Plus className="h-3 w-3" /> Add Secondary Drain
        </Button>
      </Section>

      {/* Section 5: Field Observations (read-only) */}
      <Section title="Field Observations" icon={Eye} defaultOpen={false}>
        <p className="text-xs text-muted-foreground">Data from technician field inspection. Read-only summary.</p>
      </Section>
    </div>
  );
}

// ─── Zone Card ──────────────────────────────────────────────
function ZoneCard({ zone, index, onUpdate }: { zone: any; index: number; onUpdate: (i: number, patch: any) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="border rounded p-2 text-xs">
      <div className="flex justify-between items-center">
        <span className="font-medium">Zone {zone.zone_id}</span>
        <button className="text-[10px] text-primary hover:underline" onClick={() => setEditing(!editing)}>
          {editing ? 'Close' : 'Edit'}
        </button>
      </div>
      <p className="text-muted-foreground">{zone.description || '—'}</p>
      {editing ? (
        <div className="mt-2 space-y-1">
          <Input type="number" value={zone.area_sqft || ''} onChange={e => onUpdate(index, { area_sqft: parseFloat(e.target.value) || 0 })}
            className="h-7 text-xs" placeholder="Area (sqft)" />
        </div>
      ) : (
        <p className="font-mono mt-1">{zone.area_sqft?.toLocaleString() ?? '—'} sqft</p>
      )}
    </div>
  );
}

// ─── Drain Row ──────────────────────────────────────────────
function DrainRow({ drain, index, onUpdate }: { drain: any; index: number; onUpdate: (i: number, patch: any) => void }) {
  return (
    <div className="border rounded p-2 text-xs grid grid-cols-5 gap-1 items-center">
      <span className="font-medium">{drain.drain_id}</span>
      <span>{drain.zone_id}</span>
      <Select value={String(drain.pipe_diameter_in)} onValueChange={v => onUpdate(index, { pipe_diameter_in: parseInt(v) })}>
        <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {[2,3,4,5,6,8,10].map(d => <SelectItem key={d} value={String(d)}>{d}"</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={drain.leader_type} onValueChange={v => onUpdate(index, { leader_type: v })}>
        <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="Vertical">Vertical</SelectItem>
          <SelectItem value="Horizontal">Horizontal</SelectItem>
        </SelectContent>
      </Select>
      <span className={cn("text-[10px]", drain.condition === 'Good' ? 'text-green-600' : drain.condition === 'Fair' ? 'text-amber-600' : 'text-red-600')}>
        {drain.condition}
      </span>
    </div>
  );
}

// ─── Secondary Drain Row ────────────────────────────────────
function SecondaryDrainRow({ drain, index, onUpdate }: { drain: any; index: number; onUpdate: (i: number, patch: any) => void }) {
  return (
    <div className="border rounded p-2 text-xs grid grid-cols-4 gap-1 items-center">
      <span className="font-medium">{drain.drain_id}</span>
      <span>{drain.secondary_type}</span>
      <span>{drain.pipe_diameter_in ? `${drain.pipe_diameter_in}"` : drain.scupper_width_in ? `${drain.scupper_width_in}" scupper` : '—'}</span>
      <span className={cn("text-[10px]", drain.height_above_primary_in >= 2 ? 'text-green-600' : 'text-red-600')}>
        {drain.height_above_primary_in}" above
      </span>
    </div>
  );
}

// ─── Results Panel ──────────────────────────────────────────
function ResultsPanel({ output, county, rainfallOverride, rainfallRate }: {
  output: any; county: string; rainfallOverride: boolean; rainfallRate: number | null;
}) {
  if (!output) return <p className="text-sm text-muted-foreground p-4">Enter drainage zones and drains to see results.</p>;

  const designRate = rainfallOverride && rainfallRate ? rainfallRate : (DESIGN_RAINFALL[county] ?? 8.39);
  const worstCapacity = output.zone_results.length > 0
    ? Math.min(...output.zone_results.map((z: any) => z.q_primary_provided_gpm / Math.max(z.q_required_gpm, 0.1) * 100))
    : 0;

  return (
    <div className="space-y-4">
      {/* 5A: Zone Diagram */}
      <DrainageZoneDiagram zones={output.zone_results} />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <CalcSummaryCard label="Design Rate" value={`${designRate}`} unit="in/hr" />
        <CalcSummaryCard label="Total Required" value={`${output.total_required_gpm}`} unit="gpm" />
        <CalcSummaryCard label="Total Provided" value={`${output.total_primary_provided_gpm}`} unit="gpm"
          variant={output.overall_primary_adequate ? "success" : "destructive"} />
        <CalcSummaryCard label="Worst Zone" value={`${worstCapacity.toFixed(0)}%`}
          variant={worstCapacity >= 100 ? "success" : worstCapacity >= 70 ? "warning" : "destructive"} />
      </div>

      {/* 5B: Per-Zone Capacity Gauges */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Per-Zone Capacity</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {output.zone_results.map((zr: any) => {
            const pct = zr.q_required_gpm > 0 ? (zr.q_primary_provided_gpm / zr.q_required_gpm) * 100 : 0;
            return (
              <div key={zr.zone_id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">Zone {zr.zone_id}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{pct.toFixed(0)}% capacity</span>
                    <CalcStatusBadge status={pct >= 100 ? "pass" : pct >= 70 ? "warning" : "fail"}
                      label={pct >= 100 ? "ADEQUATE" : pct >= 70 ? "MARGINAL" : "DEFICIENT"} />
                  </div>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all",
                    pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500")}
                    style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Required: {zr.q_required_gpm} gpm | Provided: {zr.q_primary_provided_gpm} gpm
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 5C: Per-Zone Drain Tables */}
      {output.zone_results.map((zr: any) => (
        <Card key={zr.zone_id}>
          <CardHeader className="pb-2"><CardTitle className="text-xs">Zone {zr.zone_id} — Flow Analysis</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <CalcDerivation lines={[
              `Q_required = A × I / 96.23`,
              `Q_required = ${zr.area_sqft} × ${zr.rainfall_rate} / 96.23`,
              `**Q_required = ${zr.q_required_gpm} gpm    [FBC §1106.1]**`,
            ]} />

            {/* Primary */}
            {zr.primary_drains.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr><th className="p-2 text-left">Drain</th><th className="p-2 text-right">Diam</th><th className="p-2">Type</th><th className="p-2 text-right">Capacity</th><th className="p-2 text-left">Table</th></tr>
                  </thead>
                  <tbody>
                    {zr.primary_drains.map((d: any) => (
                      <tr key={d.drain_id} className="border-t">
                        <td className="p-2 font-medium">{d.drain_id}</td>
                        <td className="p-2 text-right">{d.diameter_in}"</td>
                        <td className="p-2">{d.leader_type}</td>
                        <td className="p-2 text-right font-mono">{d.rated_capacity_gpm} gpm</td>
                        <td className="p-2 text-[10px]">{d.fbc_table}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span>Total: <strong>{zr.q_primary_provided_gpm} gpm</strong></span>
              <CalcStatusBadge status={zr.primary_adequate ? "pass" : "fail"}
                label={zr.primary_adequate ? "PRIMARY ADEQUATE" : "PRIMARY DEFICIENT"} />
            </div>

            {/* Secondary */}
            {zr.secondary_drains.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr><th className="p-2 text-left">Drain</th><th className="p-2">Type</th><th className="p-2 text-right">Capacity</th><th className="p-2 text-right">Height</th><th className="p-2">FBC</th></tr>
                  </thead>
                  <tbody>
                    {zr.secondary_drains.map((d: any) => (
                      <tr key={d.drain_id} className="border-t">
                        <td className="p-2 font-medium">{d.drain_id}</td>
                        <td className="p-2">{d.type}</td>
                        <td className="p-2 text-right font-mono">{d.rated_capacity_gpm} gpm</td>
                        <td className="p-2 text-right">{d.height_above_primary_in}"</td>
                        <td className="p-2">
                          {d.fbc_compliant_height
                            ? <Badge className="bg-green-100 text-green-700 text-[10px]">✓</Badge>
                            : <Badge className="bg-red-100 text-red-700 text-[10px]">✗ &lt;2"</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span>Total Secondary: <strong>{zr.q_secondary_provided_gpm} gpm</strong></span>
              <CalcStatusBadge status={zr.secondary_adequate ? "pass" : "fail"}
                label={zr.secondary_adequate ? "SECONDARY ADEQUATE" : "SECONDARY DEFICIENT"} />
            </div>
          </CardContent>
        </Card>
      ))}

      {/* 5D: Overall Compliance */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Overall Compliance Matrix</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                {[
                  ["Total Required", `${output.total_required_gpm} gpm`, undefined],
                  ["Total Primary Provided", `${output.total_primary_provided_gpm} gpm`, undefined],
                  ["Primary System", undefined, output.overall_primary_adequate],
                  ["Secondary System (FBC §1502.3)", undefined, output.overall_secondary_adequate],
                  ["Overall", undefined, output.overall_primary_adequate && output.overall_secondary_adequate],
                ].map(([label, val, pass], i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 text-muted-foreground">{label as string}</td>
                    <td className="p-2 text-right font-medium">
                      {val ? (val as string) : (
                        <CalcStatusBadge status={(pass as boolean) ? "pass" : "fail"} label={(pass as boolean) ? "PASS" : "FAIL"} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 5E: Deficiencies */}
      {output.deficiencies.length > 0 ? (
        <Card className="border-red-200">
          <CardContent className="pt-4 space-y-1.5">
            {output.deficiencies.map((d: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 p-2 rounded">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {d}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded p-3">
          <CheckCircle className="h-4 w-4" />
          No engineering deficiencies identified.
        </div>
      )}

      {/* 5F: Footer */}
      <p className="text-[10px] text-muted-foreground text-center pb-4">
        Drainage analysis per FBC Plumbing 2023 §1101–1106, FBC Building 2023 §1502, NOAA Atlas 14. All results must be reviewed by a licensed PE.
      </p>
    </div>
  );
}

// ─── Drainage Zone Diagram ──────────────────────────────────
function DrainageZoneDiagram({ zones }: { zones: any[] }) {
  if (!zones.length) return null;

  const totalArea = zones.reduce((s, z) => s + (z.area_sqft || 1), 0);
  const svgW = 400, svgH = 200;
  const padding = 20;
  const usableW = svgW - padding * 2;
  const usableH = svgH - padding * 2;

  // Layout zones as proportional rectangles
  const cols = Math.ceil(Math.sqrt(zones.length));
  const rows = Math.ceil(zones.length / cols);
  const cellW = usableW / cols;
  const cellH = usableH / rows;

  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs">Drainage Zone Diagram</CardTitle></CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full">
          {zones.map((z, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = padding + col * cellW + 2;
            const y = padding + row * cellH + 2;
            const w = cellW - 4;
            const h = cellH - 4;
            const adequate = z.primary_adequate;
            const isHovered = hovered === z.zone_id;

            return (
              <g key={z.zone_id}
                onMouseEnter={() => setHovered(z.zone_id)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer">
                <rect x={x} y={y} width={w} height={h} rx={4}
                  fill={adequate ? 'hsl(142 71% 45% / 0.12)' : 'hsl(0 72% 51% / 0.12)'}
                  stroke={adequate ? 'hsl(142 71% 45% / 0.6)' : 'hsl(0 72% 51% / 0.6)'}
                  strokeWidth={isHovered ? 2.5 : 1}
                  opacity={hovered && !isHovered ? 0.4 : 1} />
                <text x={x + w / 2} y={y + h / 2 - 6} textAnchor="middle" fontSize={11} fontWeight="600"
                  fill="hsl(var(--foreground))">Zone {z.zone_id}</text>
                <text x={x + w / 2} y={y + h / 2 + 8} textAnchor="middle" fontSize={9}
                  fill="hsl(var(--muted-foreground))">{z.area_sqft?.toLocaleString()} sqft</text>
                <text x={x + w / 2} y={y + h / 2 + 20} textAnchor="middle" fontSize={8}
                  fill={adequate ? 'hsl(142 71% 45%)' : 'hsl(0 72% 51%)'}>
                  {adequate ? '✓ Adequate' : '✗ Deficient'}
                </text>
                {/* Drain icons */}
                {z.primary_drains.map((d: any, di: number) => (
                  <circle key={di} cx={x + 12 + di * 14} cy={y + h - 10} r={4}
                    fill={d.condition === 'Good' ? 'hsl(217 91% 53% / 0.6)' : d.condition === 'Fair' ? 'hsl(38 92% 44% / 0.6)' : 'hsl(0 72% 51% / 0.6)'}
                    stroke="hsl(var(--border))" strokeWidth={0.5} />
                ))}
              </g>
            );
          })}
        </svg>
      </CardContent>
    </Card>
  );
}
