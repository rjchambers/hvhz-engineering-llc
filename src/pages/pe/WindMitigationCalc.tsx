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
import { ArrowLeft, Calculator, Loader2, Lock, AlertTriangle } from "lucide-react";
import { computeWindPressures, type WindCalcInputs, type WindCalcResults } from "@/lib/wind-calc";
import { format } from "date-fns";
import type { Json } from "@/integrations/supabase/types";

interface FieldDataRow {
  id: string;
  form_data: Json;
  work_order_id: string;
}

export default function WindMitigationCalc() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldDataId, setFieldDataId] = useState<string | null>(null);
  const [woData, setWoData] = useState<any>(null);

  // Building info (pre-filled from field_data)
  const [yearBuilt, setYearBuilt] = useState("");
  const [occupancyType, setOccupancyType] = useState("");
  const [stories, setStories] = useState("");
  const [buildingWidth, setBuildingWidth] = useState("");
  const [buildingLength, setBuildingLength] = useState("");
  const [wallHeight, setWallHeight] = useState("");
  const [meanRoofHeight, setMeanRoofHeight] = useState("");
  const [roofShape, setRoofShape] = useState("");

  // Design parameters
  const [exposureCategory, setExposureCategory] = useState("C");
  const [riskCategory, setRiskCategory] = useState("II");

  // Roof system (pre-filled)
  const [roofCoveringType, setRoofCoveringType] = useState("");
  const [noaNumber, setNoaNumber] = useState("");
  const [noaExpiry, setNoaExpiry] = useState("");
  const [deckType, setDeckType] = useState("");
  const [deckThickness, setDeckThickness] = useState("");
  const [fastenerType, setFastenerType] = useState("");
  const [fastenerSize, setFastenerSize] = useState("");
  const [roofToWallConnection, setRoofToWallConnection] = useState("");
  const [connectionSpacing, setConnectionSpacing] = useState("");

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
      setYearBuilt(d.year_built?.toString() ?? "");
      setOccupancyType(d.occupancy_type ?? "");
      setStories(d.stories?.toString() ?? "");
      setBuildingWidth(d.building_width_ft?.toString() ?? "");
      setBuildingLength(d.building_length_ft?.toString() ?? "");
      setWallHeight(d.wall_height_ft?.toString() ?? "");
      setMeanRoofHeight(d.mean_roof_height_ft?.toString() ?? "");
      setRoofShape(d.roof_shape ?? "");
      setRoofCoveringType(d.roof_covering_type ?? "");
      setNoaNumber(d.noa_number ?? "");
      setNoaExpiry(d.noa_expiry ?? "");
      setDeckType(d.deck_type ?? "");
      setDeckThickness(d.deck_thickness ?? "");
      setFastenerType(d.fastener_type ?? "");
      setFastenerSize(d.fastener_size ?? "");
      setRoofToWallConnection(d.roof_to_wall_connection ?? "");
      setConnectionSpacing(d.connection_spacing_inches?.toString() ?? "");
      // load PE design params if saved
      if (d.exposure_category) setExposureCategory(d.exposure_category);
      if (d.risk_category) setRiskCategory(d.risk_category);
    }
    setLoaded(true);
  }, [id, user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Compute results
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
      year_built: yearBuilt ? parseInt(yearBuilt) : null,
      occupancy_type: occupancyType,
      stories: stories ? parseInt(stories) : null,
      building_width_ft: W || null,
      building_length_ft: L || null,
      wall_height_ft: parseFloat(wallHeight) || null,
      mean_roof_height_ft: h || null,
      roof_shape: roofShape,
      roof_covering_type: roofCoveringType,
      noa_number: noaNumber,
      noa_expiry: noaExpiry || null,
      deck_type: deckType,
      deck_thickness: deckThickness,
      fastener_type: fastenerType,
      fastener_size: fastenerSize,
      roof_to_wall_connection: roofToWallConnection,
      connection_spacing_inches: parseFloat(connectionSpacing) || null,
      // PE design params
      basic_wind_speed: 185,
      exposure_category: exposureCategory,
      risk_category: riskCategory,
      Kd: 0.85, Kzt: 1.0, Ke: 1.0,
      // Computed results
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
      service_type: "wind-mitigation-permit",
      form_data: formData,
      submitted_by: user.id,
    }, { onConflict: "work_order_id" });

    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success("Calculation data saved to work order.");
    }
    setSaving(false);
  };

  if (!loaded) return <PELayout><div className="p-6 text-sm text-muted-foreground">Loading…</div></PELayout>;

  const address = woData?.orders
    ? [woData.orders.job_address, woData.orders.job_city, woData.orders.job_zip].filter(Boolean).join(", ")
    : "";

  return (
    <PELayout>
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => navigate(`/pe/review/${id}`)}>
          <ArrowLeft className="h-4 w-4" /> Back to Review
        </Button>

        <div className="flex items-center gap-3 mb-1">
          <Calculator className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-primary">Wind Mitigation Calculations</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{address} · WO #{woData?.id?.slice(0, 8).toUpperCase()}</p>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left column — inputs */}
          <div className="space-y-6">
            {/* Building Info */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Building Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Field label="Year Built" value={yearBuilt} onChange={setYearBuilt} type="number" />
                <div>
                  <Label className="text-xs text-muted-foreground">Occupancy Type</Label>
                  <Select value={occupancyType} onValueChange={setOccupancyType}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Residential">Residential</SelectItem>
                      <SelectItem value="Commercial">Commercial</SelectItem>
                      <SelectItem value="Industrial">Industrial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Stories" value={stories} onChange={setStories} type="number" />
                <Field label="Building Width (ft)" value={buildingWidth} onChange={setBuildingWidth} type="number" />
                <Field label="Building Length (ft)" value={buildingLength} onChange={setBuildingLength} type="number" />
                <Field label="Wall Height (ft)" value={wallHeight} onChange={setWallHeight} type="number" />
                <Field label="Mean Roof Height (ft)" value={meanRoofHeight} onChange={setMeanRoofHeight} type="number" />
                <div>
                  <Label className="text-xs text-muted-foreground">Roof Shape</Label>
                  <Select value={roofShape} onValueChange={setRoofShape}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Hip","Gable","Flat","Monoslope","Complex"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* HVHZ Design Parameters */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">HVHZ Design Parameters</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 bg-muted/50 rounded p-2">
                  <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium">Basic Wind Speed: 185 mph</p>
                    <p className="text-[10px] text-muted-foreground">HVHZ mandate per FBC 2023 §1609.1.1</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Locked</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Exposure Category</Label>
                    <Select value={exposureCategory} onValueChange={setExposureCategory}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="B">B</SelectItem>
                        <SelectItem value="C">C (coastal HVHZ default)</SelectItem>
                        <SelectItem value="D">D</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Risk Category</Label>
                    <Select value={riskCategory} onValueChange={setRiskCategory}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["I","II","III","IV"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <LockedParam label="Kd" value="0.85" note="Table 26.6-1" />
                  <LockedParam label="Kzt" value="1.0" note="Flat terrain" />
                  <LockedParam label="Ke" value="1.0" note="Sea level" />
                </div>
              </CardContent>
            </Card>

            {/* Roof System */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Roof System</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Field label="Covering Type" value={roofCoveringType} onChange={setRoofCoveringType} />
                <Field label="NOA Number" value={noaNumber} onChange={setNoaNumber} />
                <Field label="NOA Expiry" value={noaExpiry} onChange={setNoaExpiry} type="date" />
                <div>
                  <Label className="text-xs text-muted-foreground">Deck Type</Label>
                  <Select value={deckType} onValueChange={setDeckType}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["OSB","Plywood","Concrete","Steel","Other"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Deck Thickness" value={deckThickness} onChange={setDeckThickness} />
                <Field label="Fastener Type" value={fastenerType} onChange={setFastenerType} />
                <Field label="Fastener Size" value={fastenerSize} onChange={setFastenerSize} />
                <div>
                  <Label className="text-xs text-muted-foreground">Roof-to-Wall Connection</Label>
                  <Select value={roofToWallConnection} onValueChange={setRoofToWallConnection}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Clips","Single Wraps","Double Wraps","Hurricane Straps","Embedded","Other"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Connection Spacing (in)" value={connectionSpacing} onChange={setConnectionSpacing} type="number" />
              </CardContent>
            </Card>

            {noaNumber && (
              <div className="flex items-start gap-2 bg-amber-50 text-amber-800 text-xs p-3 rounded-lg border border-amber-200">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>Verify that NOA-rated design pressure ≥ calculated zone pressure. If NOA rating is less, a different approved system is required.</p>
              </div>
            )}
          </div>

          {/* Right column — results */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Wind Pressure Calculations</CardTitle></CardHeader>
              <CardContent>
                {!canCalc ? (
                  <p className="text-sm text-muted-foreground">Enter building width, length, and mean roof height to compute pressures.</p>
                ) : calcResults && (
                  <div className="space-y-4">
                    {/* Steps */}
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2 font-mono text-xs">
                      <p>Kz = <strong>{calcResults.Kz}</strong> (h={h}ft, Exposure {exposureCategory}, Table 26.10-1)</p>
                      <Separator />
                      <p>qh = 0.00256 × {calcResults.Kz} × 1.0 × 0.85 × 1.0 × 185²</p>
                      <p className="pl-4">= <strong>{calcResults.qh} psf</strong></p>
                      <Separator />
                      <p>a = <strong>{calcResults.a} ft</strong> (zone width dimension)</p>
                    </div>

                    {/* Zone table */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60">
                          <tr>
                            <th className="text-left p-2 font-medium">Zone</th>
                            <th className="text-right p-2 font-medium">GCpf</th>
                            <th className="text-right p-2 font-medium">GCpi</th>
                            <th className="text-right p-2 font-medium">Net (psf)</th>
                            <th className="text-left p-2 font-medium">Dir</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calcResults.zones.map((z) => (
                            <tr key={z.zone} className="border-t">
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

                    <p className="text-[10px] text-muted-foreground">
                      GCpf values from ASCE 7-22 Fig. 28.3-1 (gable roof approximation). GCpi = −0.18 (enclosed building).
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

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

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm" />
    </div>
  );
}

function LockedParam({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-muted/50 rounded p-2 text-center">
      <p className="text-xs font-semibold">{label} = {value}</p>
      <p className="text-[9px] text-muted-foreground">{note}</p>
    </div>
  );
}
