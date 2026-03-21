import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PELayout } from "@/components/PELayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ArrowLeft, Calculator, Loader2, Lock, AlertTriangle, XCircle, Info, CheckCircle, ChevronDown } from "lucide-react";
import { calculateFastener, calculateTAS105, isTAS105Required, type FastenerInputs, type FastenerOutputs, type RoofSystemType, type DeckType, type ConstructionType } from "@/lib/fastener-engine";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

const SYSTEM_LABELS: Record<string, string> = { modified_bitumen: "Modified Bitumen (RAS 117)", single_ply: "Single-Ply TPO/EPDM (RAS 137)", adhered: "Adhered Membrane (TAS 124)" };
const DECK_LABELS: Record<string, string> = { plywood: "Plywood", structural_concrete: "Structural Concrete", steel_deck: "Steel Deck", wood_plank: "Wood Plank", lw_concrete: "LW Insulating Concrete" };
const ZONE_COLORS: Record<string, string> = { "1'": "bg-blue-50 border-blue-200", "1": "bg-yellow-50 border-yellow-200", "2": "bg-amber-50 border-amber-200", "3": "bg-red-50 border-red-200" };
const BASIS_BADGES: Record<string, { cls: string; label: string }> = {
  prescriptive: { cls: "bg-blue-100 text-blue-800", label: "NOA Prescriptive" },
  rational_analysis: { cls: "bg-amber-100 text-amber-800", label: "RAS 117 Rational" },
  exceeds_300pct: { cls: "bg-red-100 text-red-800", label: "Exceeds 3×" },
  asterisked_fail: { cls: "bg-red-100 text-red-800", label: "Asterisked — Blocked" },
};

export default function FastenerCalc() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldDataId, setFieldDataId] = useState<string | null>(null);
  const [woData, setWoData] = useState<any>(null);

  // Inputs
  const [county, setCounty] = useState("broward");
  const [constructionType, setConstructionType] = useState<string>("new");
  const [existingLayers, setExistingLayers] = useState(1);
  const [buildingWidth, setBuildingWidth] = useState("");
  const [buildingLength, setBuildingLength] = useState("");
  const [meanRoofHeight, setMeanRoofHeight] = useState("");
  const [parapetHeight, setParapetHeight] = useState("0");
  const [exposureCategory, setExposureCategory] = useState<"B"|"C"|"D">("C");
  const [riskCategory, setRiskCategory] = useState("II");
  const [enclosure, setEnclosure] = useState<"enclosed"|"partially_enclosed"|"open">("enclosed");
  const [Kzt, setKzt] = useState("1.0");
  const [Ke, setKe] = useState("1.0");
  const [systemType, setSystemType] = useState<string>("modified_bitumen");
  const [deckType, setDeckType] = useState<string>("plywood");
  const [sheetWidth, setSheetWidth] = useState("39.375");
  const [lapWidth, setLapWidth] = useState("4");
  const [initialRows, setInitialRows] = useState("4");
  const [noaApprovalType, setNoaApprovalType] = useState("miami_dade_noa");
  const [noaNumber, setNoaNumber] = useState("");
  const [noaManufacturer, setNoaManufacturer] = useState("");
  const [noaProduct, setNoaProduct] = useState("");
  const [noaSystemNumber, setNoaSystemNumber] = useState("");
  const [noaMdp, setNoaMdp] = useState("");
  const [noaMdpBasis, setNoaMdpBasis] = useState<"asd"|"ultimate">("asd");
  const [noaAsterisked, setNoaAsterisked] = useState(false);
  const [fyLbf, setFyLbf] = useState("29.48");
  const [tas105Raw, setTas105Raw] = useState<number[]>([]);
  const [tas105Agency, setTas105Agency] = useState("");
  const [tas105Date, setTas105Date] = useState("");
  const [boardLength, setBoardLength] = useState("4");
  const [boardWidth, setBoardWidth] = useState("8");
  const [insulationFy, setInsulationFy] = useState("29.48");
  const [ewaMembrane, setEwaMembrane] = useState("");

  const loadData = useCallback(async () => {
    if (!id || !user) return;
    const { data: wo } = await supabase.from("work_orders").select("id, service_type, status, scheduled_date, orders(job_address, job_city, job_zip, job_county)").eq("id", id).single();
    if (!wo) return;
    setWoData(wo);
    const { data: fd } = await supabase.from("field_data").select("id, form_data, work_order_id").eq("work_order_id", id).maybeSingle();
    if (fd) {
      setFieldDataId(fd.id);
      const d = fd.form_data as Record<string, any>;
      if (d.county) setCounty(d.county === "Miami-Dade" ? "miami_dade" : d.county.toLowerCase());
      if (d.construction_type) setConstructionType(d.construction_type === "New Construction" ? "new" : d.construction_type === "Reroof" ? "reroof" : "recover");
      if (d.existing_layers) setExistingLayers(d.existing_layers === "2+" ? 2 : 1);
      if (d.building_width_ft) setBuildingWidth(String(d.building_width_ft));
      if (d.building_length_ft) setBuildingLength(String(d.building_length_ft));
      if (d.mean_roof_height_ft) setMeanRoofHeight(String(d.mean_roof_height_ft));
      if (d.parapet_height_ft) setParapetHeight(String(d.parapet_height_ft));
      if (d.system_type) setSystemType(d.system_type);
      if (d.deck_type) setDeckType(d.deck_type === "Plywood" ? "plywood" : d.deck_type === "OSB" ? "plywood" : d.deck_type === "Structural Concrete" ? "structural_concrete" : d.deck_type === "Steel Deck" ? "steel_deck" : d.deck_type === "Wood Plank" ? "wood_plank" : d.deck_type === "LW Insulating Concrete" ? "lw_concrete" : "plywood");
      if (d.sheet_width_in) setSheetWidth(String(d.sheet_width_in));
      if (d.lap_width_in) setLapWidth(String(d.lap_width_in));
      if (d.initial_rows) setInitialRows(String(d.initial_rows));
      if (d.noa_number) setNoaNumber(d.noa_number);
      if (d.noa_manufacturer) setNoaManufacturer(d.noa_manufacturer);
      if (d.noa_product) setNoaProduct(d.noa_product);
      if (d.noa_system_number) setNoaSystemNumber(d.noa_system_number);
      if (d.noa_mdp_psf) setNoaMdp(String(d.noa_mdp_psf));
      if (d.noa_mdp_basis) setNoaMdpBasis(d.noa_mdp_basis === "Ultimate (will be ÷2 per TAS 114)" ? "ultimate" : "asd");
      if (d.noa_asterisked) setNoaAsterisked(d.noa_asterisked);
      if (d.fy_lbf) setFyLbf(String(d.fy_lbf));
      if (d.pe_tas105_raw_values) setTas105Raw(d.pe_tas105_raw_values);
      else if (d.tas105_raw_values) setTas105Raw(d.tas105_raw_values);
      if (d.pe_tas105_agency) setTas105Agency(d.pe_tas105_agency);
      if (d.pe_tas105_date) setTas105Date(d.pe_tas105_date);
      if (d.insulation_board_length_ft) setBoardLength(String(d.insulation_board_length_ft));
      if (d.insulation_board_width_ft) setBoardWidth(String(d.insulation_board_width_ft));
      if (d.insulation_fy_lbf) setInsulationFy(String(d.insulation_fy_lbf));
      // PE overrides
      if (d.pe_exposure) setExposureCategory(d.pe_exposure);
      if (d.pe_risk_category) setRiskCategory(d.pe_risk_category);
      if (d.pe_enclosure) setEnclosure(d.pe_enclosure);
      if (d.pe_Kzt) setKzt(String(d.pe_Kzt));
      if (d.pe_Ke) setKe(String(d.pe_Ke));
      if (d.pe_ewa_membrane) setEwaMembrane(String(d.pe_ewa_membrane));
    }
    setLoaded(true);
  }, [id, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const W = parseFloat(buildingWidth) || 0;
  const L = parseFloat(buildingLength) || 0;
  const h = parseFloat(meanRoofHeight) || 0;
  const mdp = parseFloat(noaMdp) || 0;
  const canCalc = W > 0 && L > 0 && h > 0 && mdp !== 0;

  const derivedFySource = tas105Raw.length > 0 ? "tas105" : "noa";

  const calcOutputs: FastenerOutputs | null = useMemo(() => {
    if (!canCalc) return null;
    const inputs: FastenerInputs = {
      V: 185, exposureCategory, h, Kzt: parseFloat(Kzt) || 1, Kd: 0.85, Ke: parseFloat(Ke) || 1,
      enclosure, riskCategory: riskCategory as any, buildingLength: L, buildingWidth: W,
      parapetHeight: parseFloat(parapetHeight) || 0, systemType: systemType as RoofSystemType,
      deckType: deckType as DeckType, constructionType: constructionType as ConstructionType,
      existingLayers, sheetWidth_in: parseFloat(sheetWidth) || 39.375, lapWidth_in: parseFloat(lapWidth) || 4,
      Fy_lbf: parseFloat(fyLbf) || 29.48, fySource: derivedFySource as any, initialRows: parseInt(initialRows) || 4,
      noa: { approvalType: noaApprovalType as any, approvalNumber: noaNumber, manufacturer: noaManufacturer, productName: noaProduct, systemNumber: noaSystemNumber, mdp_psf: mdp, mdp_basis: noaMdpBasis, asterisked: noaAsterisked },
      boardLength_ft: parseFloat(boardLength) || 4, boardWidth_ft: parseFloat(boardWidth) || 8,
      insulation_Fy_lbf: parseFloat(insulationFy) || 29.48, county: county as any, isHVHZ: true,
      ewa_membrane_ft2: ewaMembrane ? parseFloat(ewaMembrane) : undefined,
    };
    return calculateFastener(inputs);
  }, [canCalc, W, L, h, exposureCategory, Kzt, Ke, enclosure, riskCategory, parapetHeight, systemType, deckType, constructionType, existingLayers, sheetWidth, lapWidth, fyLbf, derivedFySource, initialRows, noaApprovalType, noaNumber, noaManufacturer, noaProduct, noaSystemNumber, mdp, noaMdpBasis, noaAsterisked, boardLength, boardWidth, insulationFy, county, ewaMembrane]);

  const tas105Result = useMemo(() => {
    if (tas105Raw.length === 0) return null;
    return calculateTAS105({ rawValues_lbf: tas105Raw });
  }, [tas105Raw]);

  const mdpEff = noaMdpBasis === "ultimate" ? mdp / 2 : mdp;

  const handleSave = async () => {
    if (!id || !user) return;
    setSaving(true);
    const existingFd = fieldDataId ? (await supabase.from("field_data").select("form_data").eq("id", fieldDataId).single()).data?.form_data as Record<string, any> ?? {} : {};
    const merged = {
      ...existingFd,
      pe_V: 185, pe_exposure: exposureCategory, pe_risk_category: riskCategory, pe_enclosure: enclosure,
      pe_Kzt: parseFloat(Kzt), pe_Kd: 0.85, pe_Ke: parseFloat(Ke),
      pe_noa_mdp_eff: mdpEff, pe_ewa_membrane: ewaMembrane ? parseFloat(ewaMembrane) : null,
      pe_calc_outputs: calcOutputs ? JSON.parse(JSON.stringify(calcOutputs)) : null,
    };
    const { error } = await supabase.from("field_data").upsert({
      ...(fieldDataId ? { id: fieldDataId } : {}),
      work_order_id: id, service_type: "fastener-calculation", form_data: merged as unknown as Json, submitted_by: user.id,
    }, { onConflict: "work_order_id" });
    if (error) toast.error("Failed to save: " + error.message);
    else toast.success("Fastener calculation data saved.");
    setSaving(false);
  };

  if (!loaded) return <PELayout><div className="p-6 text-sm text-muted-foreground">Loading…</div></PELayout>;
  const address = woData?.orders ? [woData.orders.job_address, woData.orders.job_city, woData.orders.job_zip].filter(Boolean).join(", ") : "";
  const zp = calcOutputs?.zonePressures;
  const a = zp?.zoneWidth_ft ?? 0;

  return (
    <PELayout>
      <div className="p-4 lg:p-6 max-w-6xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => navigate(`/pe/review/${id}`)}>
          <ArrowLeft className="h-4 w-4" /> Back to Review
        </Button>
        <div className="flex items-center gap-3 mb-1">
          <Calculator className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-primary">Fastener Uplift Calculations</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{address} · WO #{woData?.id?.slice(0, 8).toUpperCase()}</p>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* LEFT — Inputs */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Site & Design Parameters</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 bg-muted/50 rounded p-2">
                  <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium">Basic Wind Speed: 185 mph</p>
                    <p className="text-[10px] text-muted-foreground">HVHZ mandate FBC §1620.1</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Locked</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Building Width (ft)" value={buildingWidth} onChange={setBuildingWidth} type="number" />
                  <Field label="Building Length (ft)" value={buildingLength} onChange={setBuildingLength} type="number" />
                  <Field label="Mean Roof Height (ft)" value={meanRoofHeight} onChange={setMeanRoofHeight} type="number" />
                  <Field label="Parapet Height (ft)" value={parapetHeight} onChange={setParapetHeight} type="number" />
                  <div>
                    <Label className="text-xs text-muted-foreground">Exposure</Label>
                    <Select value={exposureCategory} onValueChange={(v) => setExposureCategory(v as any)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="B">B</SelectItem><SelectItem value="C">C (HVHZ)</SelectItem><SelectItem value="D">D</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Risk Category</Label>
                    <Select value={riskCategory} onValueChange={setRiskCategory}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{["I","II","III","IV"].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Enclosure</Label>
                    <Select value={enclosure} onValueChange={(v) => setEnclosure(v as any)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="enclosed">Enclosed</SelectItem><SelectItem value="partially_enclosed">Partially Enclosed</SelectItem><SelectItem value="open">Open</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <LockedParam label="Kd" value="0.85" note="Table 26.6-1" />
                  <div><Label className="text-xs text-muted-foreground">Kzt</Label><Input type="number" value={Kzt} onChange={e=>setKzt(e.target.value)} className="h-9 text-sm" /></div>
                  <div><Label className="text-xs text-muted-foreground">Ke</Label><Input type="number" value={Ke} onChange={e=>setKe(e.target.value)} className="h-9 text-sm" /></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Roof System</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">System Type</Label>
                  <Select value={systemType} onValueChange={setSystemType}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="modified_bitumen">Modified Bitumen</SelectItem><SelectItem value="single_ply">Single-Ply</SelectItem><SelectItem value="adhered">Adhered</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Deck Type</Label>
                  <Select value={deckType} onValueChange={setDeckType}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(DECK_LABELS).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {systemType !== "adhered" && (<>
                  <Field label="Sheet Width (in)" value={sheetWidth} onChange={setSheetWidth} type="number" />
                  <Field label="Lap Width (in)" value={lapWidth} onChange={setLapWidth} type="number" />
                  <Field label="Initial Rows" value={initialRows} onChange={setInitialRows} type="number" />
                </>)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">NOA / Product Approval</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Field label="NOA Number" value={noaNumber} onChange={setNoaNumber} />
                <Field label="Manufacturer" value={noaManufacturer} onChange={setNoaManufacturer} />
                <Field label="Product" value={noaProduct} onChange={setNoaProduct} />
                <Field label="System No." value={noaSystemNumber} onChange={setNoaSystemNumber} />
                <Field label="NOA MDP (psf)" value={noaMdp} onChange={setNoaMdp} type="number" />
                <div>
                  <Label className="text-xs text-muted-foreground">MDP Basis</Label>
                  <Select value={noaMdpBasis} onValueChange={(v) => setNoaMdpBasis(v as any)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="asd">ASD</SelectItem><SelectItem value="ultimate">Ultimate (÷2)</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Switch checked={noaAsterisked} onCheckedChange={setNoaAsterisked} />
                  <Label className="text-xs">Asterisked assembly — extrapolation prohibited</Label>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">Effective ASD MDP: <strong>{Math.abs(mdpEff).toFixed(1)} psf</strong></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Fastener Data</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Fy (lbf)" value={fyLbf} onChange={setFyLbf} type="number" />
                  <div><Label className="text-xs text-muted-foreground">Source</Label><Badge variant="outline">{fySource === "tas105" ? "TAS 105" : "NOA"}</Badge></div>
                  <Field label="Board Length (ft)" value={boardLength} onChange={setBoardLength} type="number" />
                  <Field label="Board Width (ft)" value={boardWidth} onChange={setBoardWidth} type="number" />
                  <Field label="Insulation Fy (lbf)" value={insulationFy} onChange={setInsulationFy} type="number" />
                  <Field label="EWA membrane (ft²)" value={ewaMembrane} onChange={setEwaMembrane} type="number" />
                </div>
                {tas105Result && (
                  <div className="bg-muted/50 rounded p-3 font-mono text-xs space-y-0.5">
                    <p>TAS 105: n={tas105Result.n}, Mean={tas105Result.mean_lbf}, σ={tas105Result.stdDev_lbf}, MCRF={tas105Result.MCRF_lbf} lbf — <span className={tas105Result.pass?"text-green-600":"text-destructive"}>{tas105Result.pass?"PASS":"FAIL"}</span></p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT — Results */}
          <div className="space-y-6">
            {!canCalc ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Enter building dimensions and NOA MDP to compute results.</CardContent></Card>
            ) : calcOutputs && (<>
              {/* Overall Status */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Overall Status</CardTitle></CardHeader>
                <CardContent>
                  <Badge className={cn("text-lg px-4 py-1 mb-4", calcOutputs.overallStatus === "ok" ? "bg-green-100 text-green-800" : calcOutputs.overallStatus === "warning" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800")}>
                    {calcOutputs.overallStatus.toUpperCase()}
                  </Badge>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-muted/50 rounded p-2"><p className="text-muted-foreground">qh,ASD</p><p className="font-bold">{calcOutputs.qh_ASD} psf</p></div>
                    <div className="bg-muted/50 rounded p-2"><p className="text-muted-foreground">Kh</p><p className="font-bold">{calcOutputs.Kh}</p></div>
                    <div className="bg-muted/50 rounded p-2"><p className="text-muted-foreground">Zone Width</p><p className="font-bold">{calcOutputs.zonePressures.zoneWidth_ft} ft</p></div>
                    <div className="bg-muted/50 rounded p-2"><p className="text-muted-foreground">Max Extrap</p><p className={cn("font-bold", calcOutputs.maxExtrapolationFactor > 3 ? "text-destructive" : calcOutputs.maxExtrapolationFactor > 2.7 ? "text-amber-600" : "")}>{calcOutputs.maxExtrapolationFactor.toFixed(2)}×</p></div>
                  </div>
                </CardContent>
              </Card>

              {/* Zone Pressures & NOA Check */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Zone Pressures & NOA Check</CardTitle></CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60"><tr><th className="text-left p-2">Zone</th><th className="text-right p-2">P (psf)</th><th className="text-right p-2">MDP</th><th className="text-right p-2">Factor</th><th className="text-left p-2">Basis</th></tr></thead>
                      <tbody>
                        {calcOutputs.noaResults.map(nr => (
                          <tr key={nr.zone} className="border-t">
                            <td className="p-2 font-medium">{nr.zone}</td>
                            <td className="p-2 text-right font-bold">{Math.abs(nr.P_psf).toFixed(1)}</td>
                            <td className="p-2 text-right">{Math.abs(nr.MDP_psf).toFixed(1)}</td>
                            <td className="p-2 text-right">{nr.extrapFactor.toFixed(2)}×</td>
                            <td className="p-2"><Badge className={cn("text-[10px]", BASIS_BADGES[nr.basis]?.cls)}>{BASIS_BADGES[nr.basis]?.label}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Fastener Pattern Results */}
              {systemType !== "adhered" ? (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Fastener Pattern — RAS {systemType === "single_ply" ? "137" : "117"}</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-2">Fy = {fyLbf} lbf ({fySource === "tas105" ? "TAS 105" : "NOA"})</p>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60"><tr><th className="p-2">Zone</th><th className="text-right p-2">P</th><th className="text-right p-2">Rows</th><th className="text-right p-2">RS</th><th className="text-right p-2">FS</th><th className="text-right p-2">DR</th><th className="p-2">½-Sheet</th></tr></thead>
                        <tbody>
                          {calcOutputs.fastenerResults.map(fr => (
                            <tr key={fr.zone} className={cn("border-t", ZONE_COLORS[fr.zone])}>
                              <td className="p-2 font-medium">{fr.zone}</td>
                              <td className="p-2 text-right">{fr.P_psf}</td>
                              <td className="p-2 text-right">{fr.n_rows}</td>
                              <td className="p-2 text-right">{fr.RS_in}"</td>
                              <td className="p-2 text-right font-bold">{fr.FS_used_in}"</td>
                              <td className="p-2 text-right">{fr.demandRatio}</td>
                              <td className="p-2">{fr.halfSheetRequired ? <Badge className="bg-red-100 text-red-800 text-[10px]">Required</Badge> : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">Min field spacing: {calcOutputs.minFS_in}" o.c.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card><CardContent className="py-4 text-sm text-muted-foreground">Adhered membrane — no row spacing. Verify adhesive bond strength ≥ zone pressures per TAS 124.</CardContent></Card>
              )}

              {/* Insulation */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Insulation Board Fasteners (RAS 117 §8)</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {calcOutputs.insulationResults.map(ir => (
                      <div key={ir.zone} className={cn("border rounded p-3 text-xs", ZONE_COLORS[ir.zone])}>
                        <p className="font-semibold">Zone {ir.zone}</p>
                        <p className="text-muted-foreground">{ir.P_psf} psf</p>
                        <p className="font-bold">{ir.N_used} fasteners ({ir.layout})</p>
                        {ir.N_used > ir.N_prescribed && <p className="text-amber-600 text-[10px]">Exceeds prescriptive ({ir.N_prescribed})</p>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Zone Plan SVG */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Zone Plan Diagram</CardTitle></CardHeader>
                <CardContent><ZonePlanSVG W={W} L={L} a={a} zp={calcOutputs.zonePressures} /></CardContent>
              </Card>

              {/* Derivation */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Calculation Derivation</CardTitle></CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded p-3 font-mono text-xs space-y-1">
                    <p>{calcOutputs.derivation.eq_26_10_1}</p>
                    <p>{calcOutputs.derivation.qh_asd}</p>
                    <p>{calcOutputs.derivation.eq_30_3_1}</p>
                    <p>{calcOutputs.derivation.ras117_fs}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">ASCE 7-22 Eq. 26.10-1, 30.3-1 · RAS 117 §6 · FBC 8th Ed.</p>
                </CardContent>
              </Card>

              {/* Warnings */}
              {calcOutputs.warnings.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Warnings & Code Notes</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {calcOutputs.warnings.map((w, i) => (
                      <div key={i} className={cn("flex items-start gap-2 p-2 rounded border text-xs", w.level === "error" ? "bg-red-50 border-red-200" : w.level === "warning" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200")}>
                        {w.level === "error" ? <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" /> : w.level === "warning" ? <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" /> : <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />}
                        <div><p>{w.message}</p>{w.reference && <Badge variant="outline" className="text-[9px] mt-1">{w.reference}</Badge>}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>)}

            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving…</> : "Save Calculation to Work Order"}
              </Button>
              <Button variant="outline" onClick={() => navigate(`/pe/review/${id}`)}>Back to Review</Button>
            </div>
          </div>
        </div>
      </div>
    </PELayout>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (<div><Label className="text-xs text-muted-foreground">{label}</Label><Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm" /></div>);
}

function LockedParam({ label, value, note }: { label: string; value: string; note: string }) {
  return (<div><Label className="text-xs text-muted-foreground">{label}</Label><div className="flex items-center h-9 px-3 bg-muted rounded text-sm"><Lock className="h-3 w-3 mr-1 text-muted-foreground" />{value}<span className="ml-auto text-[10px] text-muted-foreground">{note}</span></div></div>);
}

function ZonePlanSVG({ W, L, a, zp }: { W: number; L: number; a: number; zp: any }) {
  const maxDim = Math.max(W, L);
  const scale = 260 / maxDim;
  const sw = W * scale, sl = L * scale, sa = a * scale;
  const ox = (300 - sw) / 2, oy = (220 - sl) / 2;
  return (
    <svg viewBox="0 0 300 260" className="w-full border rounded bg-white">
      <rect x={ox} y={oy} width={sw} height={sl} fill="hsl(210, 70%, 90%)" stroke="hsl(210, 50%, 60%)" strokeWidth="1" />
      <rect x={ox + sa} y={oy} width={sw - 2 * sa} height={sa} fill="hsl(45, 90%, 85%)" stroke="hsl(45, 60%, 50%)" strokeWidth="0.5" />
      <rect x={ox + sa} y={oy + sl - sa} width={sw - 2 * sa} height={sa} fill="hsl(45, 90%, 85%)" stroke="hsl(45, 60%, 50%)" strokeWidth="0.5" />
      <rect x={ox} y={oy + sa} width={sa} height={sl - 2 * sa} fill="hsl(45, 90%, 85%)" stroke="hsl(45, 60%, 50%)" strokeWidth="0.5" />
      <rect x={ox + sw - sa} y={oy + sa} width={sa} height={sl - 2 * sa} fill="hsl(45, 90%, 85%)" stroke="hsl(45, 60%, 50%)" strokeWidth="0.5" />
      <rect x={ox} y={oy} width={sa} height={sa} fill="hsl(0, 70%, 85%)" stroke="hsl(0, 50%, 50%)" strokeWidth="0.5" />
      <rect x={ox + sw - sa} y={oy} width={sa} height={sa} fill="hsl(0, 70%, 85%)" stroke="hsl(0, 50%, 50%)" strokeWidth="0.5" />
      <rect x={ox} y={oy + sl - sa} width={sa} height={sa} fill="hsl(0, 70%, 85%)" stroke="hsl(0, 50%, 50%)" strokeWidth="0.5" />
      <rect x={ox + sw - sa} y={oy + sl - sa} width={sa} height={sa} fill="hsl(0, 70%, 85%)" stroke="hsl(0, 50%, 50%)" strokeWidth="0.5" />
      <text x={ox + sw / 2} y={oy + sl / 2 - 4} textAnchor="middle" fontSize="10" fill="hsl(210, 50%, 40%)" fontWeight="600">Zone 1' / 1</text>
      <text x={ox + sw / 2} y={oy + sl / 2 + 8} textAnchor="middle" fontSize="8" fill="hsl(210, 50%, 50%)">{Math.abs(zp.zone1prime).toFixed(1)} / {Math.abs(zp.zone1).toFixed(1)} psf</text>
      <text x={ox + sw / 2} y={oy + sa / 2 + 3} textAnchor="middle" fontSize="8" fill="hsl(45, 60%, 35%)">Zone 2: {Math.abs(zp.zone2).toFixed(1)} psf</text>
      <text x={ox + sa / 2} y={oy + sa / 2 + 3} textAnchor="middle" fontSize="7" fill="hsl(0, 50%, 40%)">Z3</text>
      <text x={ox + sw / 2} y={oy + sl + 16} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">{W} ft</text>
      <text x={ox - 10} y={oy + sl / 2} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))" transform={`rotate(-90, ${ox - 10}, ${oy + sl / 2})`}>{L} ft</text>
      <rect x={10} y={232} width={10} height={10} fill="hsl(210, 70%, 90%)" stroke="hsl(210, 50%, 60%)" strokeWidth="0.5" />
      <text x={24} y={241} fontSize="8" fill="hsl(var(--foreground))">Field (1'/1)</text>
      <rect x={90} y={232} width={10} height={10} fill="hsl(45, 90%, 85%)" stroke="hsl(45, 60%, 50%)" strokeWidth="0.5" />
      <text x={104} y={241} fontSize="8" fill="hsl(var(--foreground))">Perimeter (2)</text>
      <rect x={175} y={232} width={10} height={10} fill="hsl(0, 70%, 85%)" stroke="hsl(0, 50%, 50%)" strokeWidth="0.5" />
      <text x={189} y={241} fontSize="8" fill="hsl(var(--foreground))">Corner (3)</text>
      <text x={245} y={241} fontSize="8" fill="hsl(var(--muted-foreground))">a = {a.toFixed(1)} ft</text>
    </svg>
  );
}
