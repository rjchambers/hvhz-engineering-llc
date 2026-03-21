import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PELayout } from "@/components/PELayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, AlertTriangle, XCircle, Info, Eye } from "lucide-react";
import { calculateFastener, type FastenerInputs, type FastenerOutputs } from "@/lib/fastener-engine";
import type { Json } from "@/integrations/supabase/types";

const SYSTEM_LABELS: Record<string, string> = { modified_bitumen: "Modified Bitumen (RAS 117)", single_ply: "Single-Ply TPO/EPDM (RAS 137)", adhered: "Adhered Membrane (TAS 124)" };
const DECK_LABELS: Record<string, string> = { plywood: "Plywood", structural_concrete: "Structural Concrete", steel_deck: "Steel Deck", wood_plank: "Wood Plank", lw_concrete: "LW Insulating Concrete", Plywood: "Plywood", OSB: "Plywood (OSB)", "Structural Concrete": "Structural Concrete", "Steel Deck": "Steel Deck", "Wood Plank": "Wood Plank", "LW Insulating Concrete": "LW Insulating Concrete" };
const ZONE_COLORS: Record<string, string> = { "1'": "bg-blue-50 border-blue-200", "1": "bg-yellow-50 border-yellow-200", "2": "bg-amber-50 border-amber-200", "3": "bg-red-50 border-red-200" };
const BASIS_BADGES: Record<string, { cls: string; label: string }> = {
  prescriptive: { cls: "bg-blue-100 text-blue-800", label: "NOA Prescriptive" },
  rational_analysis: { cls: "bg-amber-100 text-amber-800", label: "RAS 117 Rational" },
  exceeds_300pct: { cls: "bg-red-100 text-red-800", label: "Exceeds 3×" },
  asterisked_fail: { cls: "bg-red-100 text-red-800", label: "Asterisked — Blocked" },
};

function normDeckType(v: string): string {
  const map: Record<string, string> = { Plywood: "plywood", OSB: "plywood", "Structural Concrete": "structural_concrete", "Steel Deck": "steel_deck", "Wood Plank": "wood_plank", "LW Insulating Concrete": "lw_concrete" };
  return map[v] ?? v;
}
function normConstructionType(v: string): string {
  const map: Record<string, string> = { "New Construction": "new", Reroof: "reroof", Recover: "recover" };
  return map[v] ?? v;
}
function normEnclosure(v: string): string {
  const map: Record<string, string> = { Enclosed: "enclosed", "Partially Enclosed": "partially_enclosed", Open: "open" };
  return map[v] ?? v;
}

export default function FastenerCalc() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [woData, setWoData] = useState<any>(null);
  const [fd, setFd] = useState<Record<string, any>>({});

  const loadData = useCallback(async () => {
    if (!id || !user) return;
    const { data: wo } = await supabase.from("work_orders").select("id, service_type, status, scheduled_date, orders(job_address, job_city, job_zip, job_county)").eq("id", id).single();
    if (!wo) return;
    setWoData(wo);
    const { data: fdRow } = await supabase.from("field_data").select("form_data").eq("work_order_id", id).maybeSingle();
    if (fdRow) setFd(fdRow.form_data as Record<string, any>);
    setLoaded(true);
  }, [id, user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Build inputs from tech-submitted field data
  const fyValue = fd.tas105_mean_lbf ?? fd.fy_lbf ?? 29.48;
  const fySource = fd.tas105_mean_lbf ? "tas105" : "noa";

  const inputs: FastenerInputs | null = useMemo(() => {
    const W = parseFloat(fd.building_width_ft) || 0;
    const L = parseFloat(fd.building_length_ft) || 0;
    const h = parseFloat(fd.mean_roof_height_ft) || 0;
    const mdp = parseFloat(fd.noa_mdp_psf) || 0;
    if (!W || !L || !h) return null;
    return {
      V: 185,
      exposureCategory: (fd.exposure_category ?? "C") as "B" | "C" | "D",
      h,
      Kzt: parseFloat(fd.Kzt) || 1.0,
      Kd: 0.85,
      Ke: parseFloat(fd.Ke) || 1.0,
      enclosure: normEnclosure(fd.enclosure_type ?? "Enclosed") as any,
      riskCategory: (fd.risk_category ?? "II") as any,
      buildingLength: L,
      buildingWidth: W,
      parapetHeight: parseFloat(fd.parapet_height_ft) || 0,
      systemType: (fd.system_type ?? "modified_bitumen") as any,
      deckType: normDeckType(fd.deck_type ?? "Plywood") as any,
      constructionType: normConstructionType(fd.construction_type ?? "New Construction") as any,
      existingLayers: fd.existing_layers === "2+" ? 2 : 1,
      sheetWidth_in: parseFloat(fd.sheet_width_in) || 39.375,
      lapWidth_in: parseFloat(fd.lap_width_in) || 4,
      Fy_lbf: parseFloat(String(fyValue)) || 29.48,
      fySource: fySource as any,
      initialRows: parseInt(fd.initial_rows) || 4,
      noa: {
        approvalType: (fd.noa_approval_type === "FL Product Approval" ? "fl_product_approval" : "miami_dade_noa") as any,
        approvalNumber: fd.noa_number ?? "",
        manufacturer: fd.noa_manufacturer,
        productName: fd.noa_product,
        systemNumber: fd.noa_system_number,
        mdp_psf: mdp,
        mdp_basis: (fd.noa_mdp_basis === "Ultimate (will be ÷2 per TAS 114)" ? "ultimate" : "asd") as any,
        asterisked: fd.noa_asterisked ?? false,
      },
      boardLength_ft: parseFloat(fd.insulation_board_length_ft) || 4,
      boardWidth_ft: parseFloat(fd.insulation_board_width_ft) || 8,
      insulation_Fy_lbf: parseFloat(fd.insulation_fy_lbf) || parseFloat(String(fyValue)) || 29.48,
      county: (fd.county === "Miami-Dade" ? "miami_dade" : fd.county?.toLowerCase() ?? "broward") as any,
      isHVHZ: true,
      ewa_membrane_ft2: fd.ewa_membrane_ft2 ? parseFloat(fd.ewa_membrane_ft2) : 10,
    };
  }, [fd, fyValue, fySource]);

  const calcOutputs: FastenerOutputs | null = useMemo(() => {
    if (!inputs) return null;
    return calculateFastener(inputs);
  }, [inputs]);

  if (!loaded) return <PELayout><div className="p-6 text-sm text-muted-foreground">Loading…</div></PELayout>;

  const address = woData?.orders ? [woData.orders.job_address, woData.orders.job_city, woData.orders.job_zip].filter(Boolean).join(", ") : "";
  const W = parseFloat(fd.building_width_ft) || 0;
  const L = parseFloat(fd.building_length_ft) || 0;
  const a = calcOutputs?.zonePressures?.zoneWidth_ft ?? 0;
  const systemType = fd.system_type ?? "modified_bitumen";

  return (
    <PELayout>
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        {/* Header */}
        <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => navigate(`/pe/review/${id}`)}>
          <ArrowLeft className="h-4 w-4" /> Back to Review
        </Button>
        <div className="flex items-center gap-3 mb-1">
          <Eye className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-primary">Fastener Uplift Calculation Review</h1>
        </div>
        <div className="flex items-center gap-3 mb-6">
          <p className="text-sm text-muted-foreground">{address} · WO #{woData?.id?.slice(0, 8).toUpperCase()}</p>
          {calcOutputs && (
            <Badge className={cn("text-sm px-3 py-1", calcOutputs.overallStatus === "ok" ? "bg-green-100 text-green-800" : calcOutputs.overallStatus === "warning" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800")}>
              {calcOutputs.overallStatus.toUpperCase()}
            </Badge>
          )}
        </div>

        {!inputs ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 inline mr-2" />
            Technician has not submitted complete building dimensions. Send work order back for revision.
          </div>
        ) : calcOutputs && (
          <div className="space-y-6">
            {/* Card 1: Submitted Parameters */}
            <Card className="border-l-4 border-l-teal-500">
              <CardHeader className="pb-3"><CardTitle className="text-sm">Submitted Parameters</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                  <Param label="Design Wind Speed" value="185 mph" />
                  <Param label="County" value={fd.county ?? "—"} />
                  <Param label="Exposure" value={fd.exposure_category ?? "C"} />
                  <Param label="Risk Category" value={fd.risk_category ?? "II"} />
                  <Param label="Enclosure" value={fd.enclosure_type ?? "Enclosed"} />
                  <Param label="Construction" value={fd.construction_type ?? "—"} />
                  <Param label="Kzt" value={fd.Kzt ?? "1.0"} />
                  <Param label="Kd" value="0.85" />
                  <Param label="Width × Length" value={`${fd.building_width_ft ?? "—"} × ${fd.building_length_ft ?? "—"} ft`} />
                  <Param label="Mean Roof Height" value={`${fd.mean_roof_height_ft ?? "—"} ft`} />
                  <Param label="Parapet" value={`${fd.parapet_height_ft ?? 0} ft`} />
                  <Param label="Deck Type" value={DECK_LABELS[fd.deck_type] ?? fd.deck_type ?? "—"} />
                  <Param label="System Type" value={SYSTEM_LABELS[fd.system_type] ?? fd.system_type ?? "—"} />
                  <Param label="Sheet Width" value={fd.sheet_width_in ? `${fd.sheet_width_in}"` : "N/A"} />
                  <Param label="Lap Width" value={fd.lap_width_in ? `${fd.lap_width_in}"` : "N/A"} />
                  <Param label="Initial Rows" value={fd.initial_rows ?? "4"} />
                  <Param label="NOA Number" value={fd.noa_number ?? "—"} />
                  <Param label="Manufacturer" value={fd.noa_manufacturer ?? "—"} />
                  <Param label="MDP" value={`${fd.noa_mdp_psf ?? "—"} psf (${fd.noa_mdp_basis ?? "ASD"})`} />
                  <Param label="Asterisked" value={fd.noa_asterisked ? "Yes" : "No"} />
                  <Param label="Fy (lbf)" value={String(fyValue)} />
                  <Param label="Fy Source" value={fySource === "tas105" ? "TAS 105" : "NOA"} />
                  {fd.tas105_mean_lbf && (
                    <Param label="TAS 105 Mean" value={`${fd.tas105_mean_lbf} lbf — ${fd.tas105_agency ?? ""} ${fd.tas105_date ?? ""}`} />
                  )}
                  <Param label="Board Size" value={`${fd.insulation_board_length_ft ?? 4} × ${fd.insulation_board_width_ft ?? 8} ft`} />
                  <Param label="Insulation Fy" value={`${fd.insulation_fy_lbf ?? fyValue} lbf`} />
                  <Param label="EWA Membrane" value={fd.ewa_membrane_ft2 ? `${fd.ewa_membrane_ft2} ft²` : "10 ft² (default)"} />
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Wind Pressure Results */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Wind Pressure Results</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded p-3 font-mono text-xs space-y-1">
                  <p>{calcOutputs.derivation.eq_26_10_1}</p>
                  <p>{calcOutputs.derivation.qh_asd}</p>
                  <p>{calcOutputs.derivation.eq_30_3_1}</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-muted/50 rounded p-2"><p className="text-muted-foreground">qh,ASD</p><p className="font-bold">{calcOutputs.qh_ASD} psf</p></div>
                  <div className="bg-muted/50 rounded p-2"><p className="text-muted-foreground">Kh</p><p className="font-bold">{calcOutputs.Kh}</p></div>
                  <div className="bg-muted/50 rounded p-2"><p className="text-muted-foreground">Zone Width</p><p className="font-bold">{calcOutputs.zonePressures.zoneWidth_ft} ft</p></div>
                  <div className="bg-muted/50 rounded p-2"><p className="text-muted-foreground">GCpi</p><p className="font-bold">{calcOutputs.GCpi}</p></div>
                </div>
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

            {/* Card 3: Fastener Attachment Schedule */}
            {systemType !== "adhered" ? (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Fastener Pattern — RAS {systemType === "single_ply" ? "137" : "117"}</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-2">Fy = {fyValue} lbf ({fySource === "tas105" ? "TAS 105" : "NOA"})</p>
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
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                    <span>Min field spacing: {calcOutputs.minFS_in}" o.c.</span>
                    {calcOutputs.maxExtrapolationFactor > 3 && <Badge className="bg-red-100 text-red-800 text-[10px]">Assembly change required</Badge>}
                    {calcOutputs.maxExtrapolationFactor > 2.7 && calcOutputs.maxExtrapolationFactor <= 3 && <Badge className="bg-amber-100 text-amber-800 text-[10px]">Approaching limit</Badge>}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="py-4 text-sm text-muted-foreground">Adhered membrane — verify adhesive bond strength ≥ zone pressures per NOA / TAS 124.</CardContent></Card>
            )}

            {/* Card 4: Insulation */}
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

            {/* Card 5: Zone Plan SVG */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Zone Plan Diagram</CardTitle></CardHeader>
              <CardContent><ZonePlanSVG W={W} L={L} a={a} zp={calcOutputs.zonePressures} /></CardContent>
            </Card>

            {/* Card 6: Derivation */}
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

            {/* Card 7: Warnings */}
            {calcOutputs.warnings.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Warnings & Code Compliance</CardTitle></CardHeader>
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
          </div>
        )}

        {/* Bottom action bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-8 pt-4 border-t lg:sticky lg:bottom-0 lg:bg-background lg:pb-4">
          <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10" onClick={() => navigate(`/pe/review/${id}`)}>
            Send Back for Revision
          </Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate(`/pe/review/${id}`)}>
            Return to Sign & Seal →
          </Button>
        </div>
      </div>
    </PELayout>
  );
}

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-dashed border-muted">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
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
      <text x={24} y={241} fontSize="7" fill="hsl(var(--muted-foreground))">1'/1</text>
      <rect x={50} y={232} width={10} height={10} fill="hsl(45, 90%, 85%)" stroke="hsl(45, 60%, 50%)" strokeWidth="0.5" />
      <text x={64} y={241} fontSize="7" fill="hsl(var(--muted-foreground))">2</text>
      <rect x={80} y={232} width={10} height={10} fill="hsl(0, 70%, 85%)" stroke="hsl(0, 50%, 50%)" strokeWidth="0.5" />
      <text x={94} y={241} fontSize="7" fill="hsl(var(--muted-foreground))">3</text>
    </svg>
  );
}
