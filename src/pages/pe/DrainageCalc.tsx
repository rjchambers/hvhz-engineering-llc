import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PELayout } from "@/components/PELayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Calculator, Loader2, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { runDrainageCalc, DESIGN_RAINFALL, type DrainageCalcInputs, type DrainageCalcOutput } from "@/lib/drainage-calc";
import type { Json } from "@/integrations/supabase/types";

export default function DrainageCalc() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldDataId, setFieldDataId] = useState<string | null>(null);
  const [woData, setWoData] = useState<any>(null);
  const [fieldData, setFieldData] = useState<Record<string, any>>({});

  // PE design params
  const [county, setCounty] = useState("Broward");
  const [rainfallOverride, setRainfallOverride] = useState(false);
  const [rainfallRate, setRainfallRate] = useState("");
  const [pipeSlope, setPipeSlope] = useState<string>("1/8");

  const loadData = useCallback(async () => {
    if (!id || !user) return;
    const { data: wo } = await supabase
      .from("work_orders")
      .select("id, service_type, status, scheduled_date, orders(job_address, job_city, job_zip, job_county)")
      .eq("id", id)
      .single();
    if (!wo) return;
    setWoData(wo);

    // Pre-fill county from order
    const orderCounty = (wo.orders as any)?.job_county ?? "Broward";
    setCounty(orderCounty);

    const { data: fd } = await supabase
      .from("field_data")
      .select("id, form_data, work_order_id")
      .eq("work_order_id", id)
      .maybeSingle();

    if (fd) {
      setFieldDataId(fd.id);
      const d = fd.form_data as Record<string, any>;
      setFieldData(d);
      if (d.pe_county) setCounty(d.pe_county);
      if (d.pe_rainfall_override) {
        setRainfallOverride(true);
        setRainfallRate(String(d.pe_rainfall_rate ?? ""));
      }
      if (d.pe_pipe_slope_assumption) setPipeSlope(d.pe_pipe_slope_assumption);
    }
    setLoaded(true);
  }, [id, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const zones = fieldData.drainage_zones ?? [];
  const primaryDrains = fieldData.primary_drains ?? [];
  const secondaryDrains = fieldData.secondary_drains ?? [];

  const calcResults: DrainageCalcOutput | null = useMemo(() => {
    if (!zones.length) return null;
    const inputs: DrainageCalcInputs = {
      county,
      rainfall_override: rainfallOverride ? parseFloat(rainfallRate) || undefined : undefined,
      pipe_slope_assumption: pipeSlope as any,
      zones,
      primary_drains: primaryDrains,
      secondary_drains: secondaryDrains,
    };
    return runDrainageCalc(inputs);
  }, [county, rainfallOverride, rainfallRate, pipeSlope, zones, primaryDrains, secondaryDrains]);

  const handleSave = async () => {
    if (!id || !user) return;
    setSaving(true);
    const updatedFormData: Record<string, any> = {
      ...fieldData,
      pe_county: county,
      pe_rainfall_rate: rainfallOverride ? parseFloat(rainfallRate) || null : DESIGN_RAINFALL[county] ?? 8.39,
      pe_rainfall_override: rainfallOverride,
      pe_pipe_slope_assumption: pipeSlope,
      pe_calc_results: calcResults,
    };

    const { error } = await supabase.from("field_data").upsert({
      ...(fieldDataId ? { id: fieldDataId } : {}),
      work_order_id: id,
      service_type: "drainage-analysis",
      form_data: updatedFormData as unknown as Json,
      submitted_by: user.id,
    }, { onConflict: "work_order_id" });

    if (error) toast.error("Failed to save: " + error.message);
    else toast.success("Calculation data saved to work order.");
    setSaving(false);
  };

  if (!loaded) return <PELayout><div className="p-6 text-sm text-muted-foreground">Loading…</div></PELayout>;

  const address = woData?.orders
    ? [woData.orders.job_address, woData.orders.job_city, woData.orders.job_zip].filter(Boolean).join(", ")
    : "";

  const designRate = rainfallOverride ? (parseFloat(rainfallRate) || 0) : (DESIGN_RAINFALL[county] ?? 8.39);

  return (
    <PELayout>
      <div className="p-4 lg:p-6 max-w-6xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => navigate(`/pe/review/${id}`)}>
          <ArrowLeft className="h-4 w-4" /> Back to Review
        </Button>

        <div className="flex items-center gap-3 mb-1">
          <Calculator className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-primary">Drainage Analysis Calculations</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{address} · WO #{woData?.id?.slice(0, 8).toUpperCase()}</p>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left column — inputs */}
          <div className="space-y-6">
            {/* Design Criteria */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Design Criteria</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">County</Label>
                  <Select value={county} onValueChange={setCounty}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(DESIGN_RAINFALL).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 bg-muted/50 rounded p-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium">Design Rainfall: {DESIGN_RAINFALL[county] ?? 8.39} in/hr</p>
                    <p className="text-[10px] text-muted-foreground">NOAA Atlas 14, 1-hr 100-yr storm</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">NOAA Atlas 14</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={rainfallOverride} onCheckedChange={setRainfallOverride} />
                  <Label className="text-xs">Override Rainfall Rate</Label>
                </div>
                {rainfallOverride && (
                  <>
                    <Input type="number" step="0.01" value={rainfallRate} onChange={(e) => setRainfallRate(e.target.value)} placeholder="in/hr" className="h-9 text-sm" />
                    <p className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded">Document justification in PE notes.</p>
                  </>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Pipe Slope Assumption (Horizontal)</Label>
                  <Select value={pipeSlope} onValueChange={setPipeSlope}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["1/16", "1/8", "1/4", "1/2"].map((s) => <SelectItem key={s} value={s}>{s}" per ft</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] text-muted-foreground">Code basis: FBC Plumbing 2023 §1106, ASCE 7-22 §8, NOAA Atlas 14</p>
              </CardContent>
            </Card>

            {/* Drainage Zones */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Drainage Zones</CardTitle></CardHeader>
              <CardContent>
                {zones.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>Zone</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Area (sqft)</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {zones.map((z: any) => (
                        <TableRow key={z.zone_id}>
                          <TableCell className="font-medium text-sm">{z.zone_id}</TableCell>
                          <TableCell className="text-sm">{z.description || "—"}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums">{z.area_sqft || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex items-start gap-2 text-amber-700 bg-amber-50 p-2 rounded text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    No drainage zones entered by technician.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Primary Drains */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Primary Drains ({primaryDrains.length})</CardTitle></CardHeader>
              <CardContent>
                {primaryDrains.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Zone</TableHead><TableHead>Diameter</TableHead><TableHead>Type</TableHead><TableHead>Condition</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {primaryDrains.map((d: any) => (
                        <TableRow key={d.drain_id}>
                          <TableCell className="font-medium text-sm">{d.drain_id}</TableCell>
                          <TableCell className="text-sm">{d.zone_id}</TableCell>
                          <TableCell className="text-sm">{d.pipe_diameter_in}"</TableCell>
                          <TableCell className="text-sm">{d.leader_type}</TableCell>
                          <TableCell className="text-sm">{d.condition}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <p className="text-xs text-muted-foreground">No primary drains recorded.</p>}
              </CardContent>
            </Card>

            {/* Secondary Drains */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Secondary Drains ({secondaryDrains.length})</CardTitle></CardHeader>
              <CardContent>
                {secondaryDrains.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Zone</TableHead><TableHead>Type</TableHead><TableHead>Size</TableHead><TableHead>Ht Above</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {secondaryDrains.map((d: any) => (
                        <TableRow key={d.drain_id} className={d.height_above_primary_in < 2 ? "bg-red-50" : ""}>
                          <TableCell className="font-medium text-sm">{d.drain_id}</TableCell>
                          <TableCell className="text-sm">{d.zone_id}</TableCell>
                          <TableCell className="text-sm">{d.secondary_type}</TableCell>
                          <TableCell className="text-sm">{d.secondary_type === "Scupper" ? `${d.scupper_width_in}" wide` : `${d.pipe_diameter_in}"`}</TableCell>
                          <TableCell className="text-sm">{d.height_above_primary_in}"</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <p className="text-xs text-muted-foreground">No secondary drains recorded.</p>}
              </CardContent>
            </Card>
          </div>

          {/* Right column — results */}
          <div className="space-y-6">
            {!calcResults ? (
              <Card><CardContent className="py-8"><p className="text-sm text-muted-foreground text-center">Enter drainage zones and drains to compute results.</p></CardContent></Card>
            ) : (
              <>
                {calcResults.zone_results.map((zr) => (
                  <div key={zr.zone_id} className="space-y-4">
                    {/* Required Flow */}
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Zone {zr.zone_id} — Required Flow</CardTitle></CardHeader>
                      <CardContent>
                        <div className="bg-muted/50 rounded-lg p-3 space-y-1 font-mono text-xs">
                          <p>Design Storm: {zr.rainfall_rate} in/hr (NOAA Atlas 14, 100-yr 1-hr)</p>
                          <p>Drainage Area: {zr.area_sqft} sqft</p>
                          <Separator className="my-1" />
                          <p>Q_required = A × I / 96.23</p>
                          <p>Q_required = {zr.area_sqft} × {zr.rainfall_rate} / 96.23</p>
                          <p className="font-bold">Q_required = {zr.q_required_gpm} gpm    [FBC §1106.1]</p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Primary Adequacy */}
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Zone {zr.zone_id} — Primary Drain Adequacy</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        <Table>
                          <TableHeader><TableRow><TableHead>Drain</TableHead><TableHead>Diam</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Capacity</TableHead><TableHead>Table</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {zr.primary_drains.map((d) => (
                              <TableRow key={d.drain_id}>
                                <TableCell className="text-xs font-medium">{d.drain_id}</TableCell>
                                <TableCell className="text-xs">{d.diameter_in}"</TableCell>
                                <TableCell className="text-xs">{d.leader_type}</TableCell>
                                <TableCell className="text-xs text-right tabular-nums">{d.rated_capacity_gpm} gpm</TableCell>
                                <TableCell className="text-[10px]">{d.fbc_table}</TableCell>
                                <TableCell>
                                  <Badge className={d.rated_capacity_gpm > 0 ? "bg-green-100 text-green-700 text-[10px]" : "bg-red-100 text-red-700 text-[10px]"}>
                                    {d.rated_capacity_gpm > 0 ? "OK" : "N/A"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="flex items-center justify-between text-xs">
                          <span>Total Provided: <strong>{zr.q_primary_provided_gpm} gpm</strong> | Required: <strong>{zr.q_required_gpm} gpm</strong></span>
                          <Badge className={zr.primary_adequate ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                            {zr.primary_adequate ? "PRIMARY ✓ ADEQUATE" : "PRIMARY ✗ DEFICIENT"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Secondary Adequacy */}
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Zone {zr.zone_id} — Secondary Drain Adequacy</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {zr.secondary_drains.length > 0 ? (
                          <>
                            <Table>
                              <TableHeader><TableRow><TableHead>Drain</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Capacity</TableHead><TableHead>Ht</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                              <TableBody>
                                {zr.secondary_drains.map((d) => (
                                  <TableRow key={d.drain_id}>
                                    <TableCell className="text-xs font-medium">{d.drain_id}</TableCell>
                                    <TableCell className="text-xs">{d.type}</TableCell>
                                    <TableCell className="text-xs text-right tabular-nums">{d.rated_capacity_gpm} gpm</TableCell>
                                    <TableCell className="text-xs">{d.height_above_primary_in}"</TableCell>
                                    <TableCell>
                                      {!d.fbc_compliant_height && <span className="text-[10px] text-destructive">⚠ {d.height_above_primary_in}" &lt; 2" min</span>}
                                      {d.fbc_compliant_height && <Badge className="bg-green-100 text-green-700 text-[10px]">OK</Badge>}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            <div className="flex items-center justify-between text-xs">
                              <span>Total Secondary: <strong>{zr.q_secondary_provided_gpm} gpm</strong> | Required: <strong>{zr.q_required_gpm} gpm</strong></span>
                              <Badge className={zr.secondary_adequate ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                                {zr.secondary_adequate ? "SECONDARY ✓ ADEQUATE" : "SECONDARY ✗ DEFICIENT"}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground">FBC §1502.3 — independent secondary drainage required in HVHZ</p>
                          </>
                        ) : (
                          <p className="text-xs text-destructive">No secondary drains — FBC §1502.3 non-compliant</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}

                {/* Overall Compliance */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Overall Compliance Summary</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <ComplianceRow label="Total Required Flow" value={`${calcResults.total_required_gpm} gpm`} />
                      <ComplianceRow label="Total Primary Provided" value={`${calcResults.total_primary_provided_gpm} gpm`} />
                      <ComplianceRow label="Primary System" pass={calcResults.overall_primary_adequate} />
                      <ComplianceRow label="Secondary System (FBC §1502.3)" pass={calcResults.overall_secondary_adequate} />
                      <ComplianceRow label="Overall Status" pass={calcResults.overall_primary_adequate && calcResults.overall_secondary_adequate} />
                    </div>
                  </CardContent>
                </Card>

                {/* Deficiencies */}
                {calcResults.deficiencies.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-1">
                    <p className="text-sm font-semibold text-red-800 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Engineering Deficiencies</p>
                    {calcResults.deficiencies.map((d, i) => (
                      <p key={i} className="text-xs text-red-700">• {d}</p>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving…</> : "Save Calculation Data"}
              </Button>
              <Button variant="outline" onClick={() => navigate(`/pe/review/${id}`)}>
                Back to Review
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PELayout>
  );
}

function ComplianceRow({ label, value, pass }: { label: string; value?: string; pass?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs border-b pb-1">
      <span className="text-muted-foreground">{label}</span>
      {value && <span className="font-medium tabular-nums">{value}</span>}
      {pass !== undefined && (
        <Badge className={pass ? "bg-green-100 text-green-700 text-[10px]" : "bg-red-100 text-red-700 text-[10px]"}>
          {pass ? "PASS" : "FAIL"}
        </Badge>
      )}
    </div>
  );
}
