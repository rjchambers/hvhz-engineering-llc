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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Calculator, Loader2, Lock } from "lucide-react";
import { computeWindPressures, FASTENER_SPACING, type WindCalcResults } from "@/lib/wind-calc";
import type { Json } from "@/integrations/supabase/types";

export default function FastenerCalc() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldDataId, setFieldDataId] = useState<string | null>(null);
  const [woData, setWoData] = useState<any>(null);

  const [buildingWidth, setBuildingWidth] = useState("");
  const [buildingLength, setBuildingLength] = useState("");
  const [eaveHeight, setEaveHeight] = useState("");
  const [meanRoofHeight, setMeanRoofHeight] = useState("");
  const [roofType, setRoofType] = useState("");
  const [deckType, setDeckType] = useState("");
  const [fastenerType, setFastenerType] = useState("");
  const [fastenerSize, setFastenerSize] = useState("");
  const [fieldZoneSpacing, setFieldZoneSpacing] = useState("");
  const [perimeterZoneSpacing, setPerimeterZoneSpacing] = useState("");
  const [cornerZoneSpacing, setCornerZoneSpacing] = useState("");
  const [noaSystem, setNoaSystem] = useState("");

  const loadData = useCallback(async () => {
    if (!id || !user) return;
    const { data: wo } = await supabase
      .from("work_orders")
      .select("id, service_type, status, scheduled_date, orders(job_address, job_city, job_zip, job_county)")
      .eq("id", id)
      .single();
    if (!wo) return;
    setWoData(wo);

    const { data: fd } = await supabase
      .from("field_data")
      .select("id, form_data, work_order_id")
      .eq("work_order_id", id)
      .maybeSingle();

    if (fd) {
      setFieldDataId(fd.id);
      const d = fd.form_data as Record<string, any>;
      setBuildingWidth(d.building_width_ft?.toString() ?? "");
      setBuildingLength(d.building_length_ft?.toString() ?? "");
      setEaveHeight(d.eave_height_ft?.toString() ?? "");
      setMeanRoofHeight(d.mean_roof_height_ft?.toString() ?? "");
      setRoofType(d.roof_type ?? "");
      setDeckType(d.deck_type ?? "");
      setFastenerType(d.fastener_type ?? "");
      setFastenerSize(d.fastener_size ?? "");
      setFieldZoneSpacing(d.field_zone_spacing ?? "");
      setPerimeterZoneSpacing(d.perimeter_zone_spacing ?? "");
      setCornerZoneSpacing(d.corner_zone_spacing ?? "");
      setNoaSystem(d.noa_system ?? "");
    }
    setLoaded(true);
  }, [id, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const W = parseFloat(buildingWidth) || 0;
  const L = parseFloat(buildingLength) || 0;
  const h = parseFloat(meanRoofHeight) || 0;
  const canCalc = W > 0 && L > 0 && h > 0;

  const calcResults: WindCalcResults | null = useMemo(() => {
    if (!canCalc) return null;
    return computeWindPressures({ V: 185, Kzt: 1.0, Kd: 0.85, Ke: 1.0, W, L, h });
  }, [W, L, h, canCalc]);

  const handleSave = async () => {
    if (!id || !user) return;
    setSaving(true);
    const formData: Record<string, any> = {
      building_width_ft: W || null,
      building_length_ft: L || null,
      eave_height_ft: parseFloat(eaveHeight) || null,
      mean_roof_height_ft: h || null,
      roof_type: roofType,
      deck_type: deckType,
      fastener_type: fastenerType,
      fastener_size: fastenerSize,
      field_zone_spacing: fieldZoneSpacing,
      perimeter_zone_spacing: perimeterZoneSpacing,
      corner_zone_spacing: cornerZoneSpacing,
      noa_system: noaSystem,
      basic_wind_speed: 185,
      ...(calcResults ? {
        computed_Kz: calcResults.Kz,
        computed_qh: calcResults.qh,
        computed_zone_a: calcResults.a,
        computed_zones: calcResults.zones,
      } : {}),
    };

    const { error } = await supabase.from("field_data").upsert({
      ...(fieldDataId ? { id: fieldDataId } : {}),
      work_order_id: id,
      service_type: "fastener-calculation",
      form_data: formData,
      submitted_by: user.id,
    }, { onConflict: "work_order_id" });

    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success("Fastener calculation data saved.");
    }
    setSaving(false);
  };

  if (!loaded) return <PELayout><div className="p-6 text-sm text-muted-foreground">Loading…</div></PELayout>;

  const address = woData?.orders
    ? [woData.orders.job_address, woData.orders.job_city, woData.orders.job_zip].filter(Boolean).join(", ")
    : "";

  // Zone dimension for SVG
  const a = calcResults?.a ?? 0;

  return (
    <PELayout>
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => navigate(`/pe/review/${id}`)}>
          <ArrowLeft className="h-4 w-4" /> Back to Review
        </Button>

        <div className="flex items-center gap-3 mb-1">
          <Calculator className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-primary">Fastener Uplift Calculations</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{address} · WO #{woData?.id?.slice(0, 8).toUpperCase()}</p>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Inputs */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Building Dimensions</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Field label="Building Width (ft)" value={buildingWidth} onChange={setBuildingWidth} type="number" />
                <Field label="Building Length (ft)" value={buildingLength} onChange={setBuildingLength} type="number" />
                <Field label="Eave Height (ft)" value={eaveHeight} onChange={setEaveHeight} type="number" />
                <Field label="Mean Roof Height (ft)" value={meanRoofHeight} onChange={setMeanRoofHeight} type="number" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Roof & Fastener Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Roof Type</Label>
                  <Select value={roofType} onValueChange={setRoofType}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Hip","Gable","Flat"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Deck Type</Label>
                  <Select value={deckType} onValueChange={setDeckType}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["OSB","Plywood","Concrete"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Fastener Type" value={fastenerType} onChange={setFastenerType} />
                <Field label="Fastener Size" value={fastenerSize} onChange={setFastenerSize} />
                <Field label="Field Zone Spacing" value={fieldZoneSpacing} onChange={setFieldZoneSpacing} />
                <Field label="Perimeter Zone Spacing" value={perimeterZoneSpacing} onChange={setPerimeterZoneSpacing} />
                <Field label="Corner Zone Spacing" value={cornerZoneSpacing} onChange={setCornerZoneSpacing} />
                <Field label="NOA System" value={noaSystem} onChange={setNoaSystem} />
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 bg-muted/50 rounded p-2">
              <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <p className="text-xs">Basic Wind Speed: <strong>185 mph</strong> (HVHZ, FBC 2023 §1609.1.1)</p>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-6">
            {canCalc && calcResults && (
              <>
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Wind Pressure Results</CardTitle></CardHeader>
                  <CardContent>
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2 font-mono text-xs mb-4">
                      <p>Kz = <strong>{calcResults.Kz}</strong> (h={h}ft, Exposure C)</p>
                      <p>qh = <strong>{calcResults.qh} psf</strong></p>
                      <p>a = <strong>{calcResults.a} ft</strong></p>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60">
                          <tr>
                            <th className="text-left p-2 font-medium">Zone</th>
                            <th className="text-right p-2 font-medium">Net Pressure (psf)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calcResults.zones.map((z) => (
                            <tr key={z.zone} className="border-t">
                              <td className="p-2 font-medium">{z.zone}</td>
                              <td className="p-2 text-right font-bold">{z.netPressure}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Required spacing */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Required Fastener Spacing</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(FASTENER_SPACING).map(([zone, spacing]) => (
                        <div key={zone} className="flex justify-between items-center text-sm border-b pb-2 last:border-0">
                          <span className="font-medium">{zone}</span>
                          <Badge variant="outline">{spacing}</Badge>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-3">PE should verify spacing against NOA requirements.</p>
                  </CardContent>
                </Card>

                {/* Zone plan SVG */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Zone Plan Diagram</CardTitle></CardHeader>
                  <CardContent>
                    <ZonePlanSVG W={W} L={L} a={a} />
                  </CardContent>
                </Card>
              </>
            )}

            {!canCalc && (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Enter building dimensions to compute wind pressures and zone layout.
                </CardContent>
              </Card>
            )}

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

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm" />
    </div>
  );
}

function ZonePlanSVG({ W, L, a }: { W: number; L: number; a: number }) {
  // Normalize to a 300×200 canvas
  const maxDim = Math.max(W, L);
  const scale = 260 / maxDim;
  const sw = W * scale;
  const sl = L * scale;
  const sa = a * scale;
  const ox = (300 - sw) / 2;
  const oy = (220 - sl) / 2;

  return (
    <svg viewBox="0 0 300 260" className="w-full border rounded bg-white">
      {/* Field zone */}
      <rect x={ox} y={oy} width={sw} height={sl} fill="hsl(210, 70%, 90%)" stroke="hsl(210, 50%, 60%)" strokeWidth="1" />
      {/* Perimeter zones */}
      {/* Top perimeter */}
      <rect x={ox + sa} y={oy} width={sw - 2 * sa} height={sa} fill="hsl(45, 90%, 85%)" stroke="hsl(45, 60%, 50%)" strokeWidth="0.5" />
      {/* Bottom perimeter */}
      <rect x={ox + sa} y={oy + sl - sa} width={sw - 2 * sa} height={sa} fill="hsl(45, 90%, 85%)" stroke="hsl(45, 60%, 50%)" strokeWidth="0.5" />
      {/* Left perimeter */}
      <rect x={ox} y={oy + sa} width={sa} height={sl - 2 * sa} fill="hsl(45, 90%, 85%)" stroke="hsl(45, 60%, 50%)" strokeWidth="0.5" />
      {/* Right perimeter */}
      <rect x={ox + sw - sa} y={oy + sa} width={sa} height={sl - 2 * sa} fill="hsl(45, 90%, 85%)" stroke="hsl(45, 60%, 50%)" strokeWidth="0.5" />
      {/* Corner zones */}
      <rect x={ox} y={oy} width={sa} height={sa} fill="hsl(0, 70%, 85%)" stroke="hsl(0, 50%, 50%)" strokeWidth="0.5" />
      <rect x={ox + sw - sa} y={oy} width={sa} height={sa} fill="hsl(0, 70%, 85%)" stroke="hsl(0, 50%, 50%)" strokeWidth="0.5" />
      <rect x={ox} y={oy + sl - sa} width={sa} height={sa} fill="hsl(0, 70%, 85%)" stroke="hsl(0, 50%, 50%)" strokeWidth="0.5" />
      <rect x={ox + sw - sa} y={oy + sl - sa} width={sa} height={sa} fill="hsl(0, 70%, 85%)" stroke="hsl(0, 50%, 50%)" strokeWidth="0.5" />
      {/* Labels */}
      <text x={ox + sw / 2} y={oy + sl / 2} textAnchor="middle" fontSize="11" fill="hsl(210, 50%, 40%)" fontWeight="600">Field</text>
      <text x={ox + sw / 2} y={oy + sl / 2 + 12} textAnchor="middle" fontSize="9" fill="hsl(210, 50%, 50%)">12" o.c.</text>
      <text x={ox + sw / 2} y={oy + sa / 2 + 3} textAnchor="middle" fontSize="8" fill="hsl(45, 60%, 35%)">Perimeter 6" o.c.</text>
      <text x={ox + sa / 2} y={oy + sa / 2 + 3} textAnchor="middle" fontSize="7" fill="hsl(0, 50%, 40%)">Corner</text>
      {/* Dimension labels */}
      <text x={ox + sw / 2} y={oy + sl + 16} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">{W} ft</text>
      <text x={ox - 10} y={oy + sl / 2} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))" transform={`rotate(-90, ${ox - 10}, ${oy + sl / 2})`}>{L} ft</text>
      {/* Legend */}
      <rect x={10} y={232} width={10} height={10} fill="hsl(210, 70%, 90%)" stroke="hsl(210, 50%, 60%)" strokeWidth="0.5" />
      <text x={24} y={241} fontSize="8" fill="hsl(var(--foreground))">Field</text>
      <rect x={60} y={232} width={10} height={10} fill="hsl(45, 90%, 85%)" stroke="hsl(45, 60%, 50%)" strokeWidth="0.5" />
      <text x={74} y={241} fontSize="8" fill="hsl(var(--foreground))">Perimeter</text>
      <rect x={130} y={232} width={10} height={10} fill="hsl(0, 70%, 85%)" stroke="hsl(0, 50%, 50%)" strokeWidth="0.5" />
      <text x={144} y={241} fontSize="8" fill="hsl(var(--foreground))">Corner</text>
      <text x={190} y={241} fontSize="8" fill="hsl(var(--muted-foreground))">a = {(W > 0 && L > 0) ? (a / scale * scale / scale).toFixed(1) : "—"} ft</text>
    </svg>
  );
}
