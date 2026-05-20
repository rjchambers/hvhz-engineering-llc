# Fastener Engine Upgrade — RAS 117 Cross-Reference & Architectural Split

**Status:** Pre-implementation review
**Scope:** `src/lib/fastener-engine.ts`, `src/pages/pe/FastenerCalc.tsx`, `src/stores/pe-fastener-store.ts`
**Reference:** FBC 8th Edition (2023), Test Protocols for HVHZ — RAS 117-20, RAS 137, TAS 105-20, TAS 114, ASCE 7-22 Ch. 26 & 30

> **Important caveat.** This document was drafted by cross-referencing the current `fastener-engine.ts` against publicly available summaries of the standards. Formula-specific items marked **[VERIFY]** must be confirmed against the actual published RAS 117 / TAS 105 PDFs by a Florida-licensed PE before merging any change. Do not stamp drawings off these recommendations alone.

---

## 1. Why split base sheet and insulation calculations

RAS 117-20 itself covers two distinct scopes in one document:

1. **Bonding or Mechanical Attachment of Insulation Panels**
2. **Mechanical Attachment of Anchor and/or Base Sheets to Substrates**

The current `calculateFastener()` treats them as a single pipeline with the insulation calc as a small afterthought (`calcInsulation`, line 253–257). That conflates two different physical problems:

| Aspect | Base sheet | Insulation panel |
|---|---|---|
| Geometry | 1-D — fasteners along a lap line (rows × spacing) | 2-D — grid pattern across a 4×4 or 4×8 board |
| Primary failure mode | Fastener withdrawal from deck | Withdrawal + **stress-plate pull-through** of board + board crushing |
| Capacity input | `Fb` from TAS 105 field test (or NOA listed MDP) | `F_assembly` from NOA pull-test of the full board-plate-fastener stack |
| Tested standard | TAS 105 (field) | TAS 114 (assembly), TAS 105 (deck), often FM 4470 cross-reference |
| Stress plate | Sometimes (cap nails / discs) | Always — typically ≥ 2.7" diameter |
| Zone-density rule | Increase row count, then halve sheet width | Increase fasteners per board, denser grid |
| Output | `n_rows`, `FS_in` (lap spacing) | `N_per_board`, grid layout (rows × cols), edge distance |
| Allowable spacing min | 6" o.c. in lap **[VERIFY]** | 6" from board edge, 12" max on-center within grid **[VERIFY]** |

A single function trying to serve both ends up either over-simplifying insulation (current state) or coupling the data model in ways that block future NOA-driven prescriptive lookups.

---

## 2. Proposed module split

Restructure `src/lib/fastener-engine.ts` into:

```
src/lib/fasteners/
  zone-pressures.ts       # shared — ASCE 7-22 qh, GCp, zone widths
  noa-compatibility.ts    # shared — MDP extrapolation rules, asterisked checks
  tas-105.ts              # shared — statistical analysis of field withdrawal
  base-sheet-engine.ts    # NEW — RAS 117 § Base Sheet rational analysis
  insulation-engine.ts    # NEW — RAS 117 § Insulation rational analysis
  index.ts                # orchestrator: calls both, merges warnings
```

The existing `FastenerInputs`, `FastenerOutputs`, and the wizard UI keep their public shape. The orchestrator handles backward compatibility while the internals split.

### 2.1 Shared: `zone-pressures.ts`

Pulled out of the current engine, **with the zone-width bug fixed** (see §3.1). Exposes:

```ts
export function calcQhASD(V, exposure, h, Kzt, Kd, Ke): number
export function calcZonePressures(
  inputs: { V, exposure, h, parapet, GCpi, buildingL, buildingW },
  ewa_ft2: number
): { zone1prime, zone1, zone2, zone3, a_ft }
```

Both base-sheet and insulation engines call this with their **own** effective wind area:

- Base sheet: `ewa_membrane_ft2` (default 10 sq ft per fastener)
- Insulation: `ewa_insulation_ft2` (default = board area, typically 32 sq ft for 4×8)

### 2.2 New: `base-sheet-engine.ts`

```ts
export interface BaseSheetInputs {
  zonePressures: ZonePressures;          // from zone-pressures.ts
  Fb_lbf: number;                         // MCRF from TAS 105 or NOA F_listed
  fbSource: 'tas105' | 'noa';
  mos: number;                            // 2.0 default per RAS 117 [VERIFY]
  sheetWidth_in: number;
  lapWidth_in: number;
  maxRows: number;                        // hard cap, typically 5–6
  minFS_in: number;                       // 6.0 typical [VERIFY]
  maxFS_in: number;                       // 12.0 typical [VERIFY]
  allowHalfSheet: boolean;
  noaCheck: NOAZoneResult[];
}

export interface BaseSheetZoneResult {
  zone: '1\'' | '1' | '2' | '3';
  P_psf: number;
  n_rows: number;
  FS_required_in: number;                 // raw calc
  FS_used_in: number;                     // rounded to nearest 0.5"
  halfSheetRequired: boolean;
  Fb_allowable_lbf: number;               // = Fb / mos
  F_demand_lbf: number;
  demandRatio: number;                    // demand / allowable (MoS already in denom)
  status: 'ok' | 'half_sheet' | 'fail';
}

export function calculateBaseSheet(inputs: BaseSheetInputs): BaseSheetZoneResult[]
```

Solver outline (replaces `solveRowsAndFS`):

```
NW = sheetWidth - lapWidth
Fb_allow = Fb / mos                      // explicit MoS, not baked into FS≥6 heuristic
for n = 1 .. maxRows:
  // tributary area per fastener = (NW/n) × FS  in² → /144 ft²
  // F_demand = P × A = P × (NW × FS) / (n × 144)
  // require F_demand ≤ Fb_allow
  // → FS_required = (Fb_allow × n × 144) / (P × NW)
  FS_req = (Fb_allow × n × 144) / (abs(P) × NW)
  FS_use = clamp(round(FS_req, 0.5), minFS_in, maxFS_in)
  if FS_use ≥ minFS_in and FS_req ≥ minFS_in:
    return { n, FS_req, FS_use, halfSheet=false, status='ok' }
if allowHalfSheet:
  repeat above with NW/2, mark halfSheet=true, status='half_sheet'
return { n=maxRows, FS_req, FS_use, status='fail' }   // explicit failure, not silent clamp
```

### 2.3 New: `insulation-engine.ts`

```ts
export interface InsulationInputs {
  zonePressures: ZonePressures;
  board_L_ft: number;
  board_W_ft: number;
  F_assembly_lbf: number;                 // from NOA-listed assembly test
  fSource: 'noa_assembly' | 'tas105_plus_plate';
  mos: number;                            // 2.0 [VERIFY]
  plateDiameter_in: number;               // ≥ 2.7 [VERIFY]
  minEdgeDistance_in: number;             // 6 typical [VERIFY]
  prescriptivePerZone?: Record<Zone, number>;  // override from NOA when present
}

export interface InsulationZoneResult {
  zone: '1\'' | '1' | '2' | '3';
  P_psf: number;
  N_calc: number;                         // raw rational analysis
  N_prescribed: number;                   // per zone, deck/NOA-driven
  N_used: number;                         // governing
  layout: { rows: number; cols: number; rowSpacing_in: number; colSpacing_in: number };
  edgeDistance_in: number;
  plateDiameter_in: number;
  F_allowable_lbf: number;
  demandRatio: number;
  status: 'ok' | 'fail';
}

export function calculateInsulation(inputs: InsulationInputs): InsulationZoneResult[]
```

Solver outline:

```
A_board = board_L_ft × board_W_ft
F_allow = F_assembly / mos
for each zone:
  N_calc = ceil( (abs(P) × A_board) / F_allow )
  N_pres = prescriptivePerZone[zone] ?? defaultPrescriptive(zone, board_W_ft, board_L_ft)
  N = max(N_calc, N_pres)
  layout = chooseGridLayout(N, board_L_ft, board_W_ft, minEdgeDistance_in)
  // chooseGridLayout returns the most uniform rectangular grid (rows × cols) where
  // rows × cols >= N, every fastener is ≥ minEdgeDistance_in from any board edge,
  // and spacings are as even as possible.
  validate spacings against NOA limits
```

Default prescriptive table (placeholder, **[VERIFY]** against RAS 117 tables):

| Zone | 4×4 board (16 sf) | 4×8 board (32 sf) |
|---|---|---|
| 1 (field) | 4 | 5 |
| 1' (interior field) | 4 | 4 |
| 2 (perimeter) | 6 | 8 |
| 3 (corner) | 8 | 12 |

### 2.4 Shared: `tas-105.ts`

Currently in `calculateTAS105`. Two issues to fix here (see §3.2 and §3.3 below).

### 2.5 Shared: `noa-compatibility.ts`

Current `checkNOACompatibility` is mostly fine — just confirm the 3.0× extrapolation limit **[VERIFY]** (older editions used 2.0×).

### 2.6 Orchestrator: `index.ts`

```ts
export function calculateFastener(inputs: FastenerInputs): FastenerOutputs {
  const warnings = validateInputs(inputs);
  const qh = calcQhASD(...);
  const zp_membrane = calcZonePressures(building, exposure, qh, ewa_membrane);
  const zp_insulation = calcZonePressures(building, exposure, qh, ewa_insulation);
  const noaResults = checkNOACompatibility(zp_membrane, mdp_eff, asterisked);

  const baseSheet = inputs.systemType === 'adhered'
    ? []
    : calculateBaseSheet({ zonePressures: zp_membrane, ...baseSheetInputs });

  const insulation = needsInsulationAttachment(inputs)
    ? calculateInsulation({ zonePressures: zp_insulation, ...insulationInputs })
    : [];

  return combineResults({ qh, zp_membrane, zp_insulation, noaResults, baseSheet, insulation, warnings });
}
```

This keeps the existing public API. The wizard UI gets two clearly-labelled output panels: "Base Sheet Attachment" and "Insulation Attachment".

---

## 3. Engine defects to fix during the split

### 3.1 Zone width formula is wrong — **HIGH**

`src/lib/fastener-engine.ts:179`

```ts
export function getZoneWidth(h: number): number { return 0.6 * h; }
```

ASCE 7-22 §30.2 defines the zone parameter `a` as:

```
a = min( 0.1 × least_horiz_dim, 0.4 × h )
    subject to  a ≥ max( 0.04 × least_horiz_dim, 3 ft )
```

The current formula ignores plan dimensions entirely. Two consequences:

- For tall, narrow buildings it overstates `a`, pushing more roof area into Zone 2/3 and inflating fastener counts.
- The `has1prime` check (line 186) compares `L > 2a` and `W > 2a` against the wrong `a`, so Zone 1' may be applied/withheld incorrectly.

**Fix:** make `getZoneWidth(h, L, W)` and use the ASCE formula.

### 3.2 TAS 105 statistical method may use the wrong factor — **HIGH [VERIFY]**

`src/lib/fastener-engine.ts:226–243` uses Student's t-factors (one-sided confidence interval on the mean):

```ts
MCRF = mean − t × stdDev
```

A confidence interval on the *mean* is the wrong tool — what you actually want for design is a one-sided **tolerance limit** on individual future fastener values. TAS 105 historically specified a K-factor table for this purpose; K-factors are materially larger than t-factors at the same `n`:

| n | t (one-sided 95%) | K (90% conf / 90% coverage, approx) |
|---|---|---|
| 3 | 2.92 | ~5.0 |
| 5 | 2.13 | ~3.4 |
| 10 | 1.83 | ~2.4 |
| 20 | 1.73 | ~2.0 |

The MCRF the engine reports is therefore roughly 15–40% optimistic depending on `n`. **Confirm the exact K-table TAS 105-20 prescribes and replace.** If TAS 105 in fact still uses Student-t (some editions did), document that decision in the code.

### 3.3 Margin of safety is implicit, not explicit — **HIGH**

`src/lib/fastener-engine.ts:212, 322`

The solver requires `FS ≥ 6.0` and reports `demandRatio = F_demand / Fy`. The MoS = 2 from RAS 117 is *baked into* the FS ≥ 6 heuristic; it's not visible in the demand ratio. So a reported `DR = 0.95` actually corresponds to ~1.9 against the RAS 117 requirement, which is misleading on the report.

**Fix:** introduce explicit `mos` field on inputs, compute `F_allowable = Fb / mos`, compute `DR = F_demand / F_allowable`. The reported number then directly answers "am I passing RAS 117".

### 3.4 Silent clamp instead of FAIL — **HIGH**

`src/lib/fastener-engine.ts:222` falls out of the half-sheet loop with whatever spacing it last computed, and `:322` clamps `FS_used` to a 4" floor. The result: in zones that cannot be brought into compliance, the engine emits a non-compliant pattern with status='warning' instead of failing.

**Fix:** explicit `status = 'fail'` return when even half-sheets at max rows cannot reach `minFS_in`, and set `overallStatus = 'fail'`.

### 3.5 Insulation density not zone-differentiated — **HIGH**

`src/lib/fastener-engine.ts:254`

```ts
const N_pres = boardArea >= 28 ? 4 : 2;
```

Per industry guidance and RAS 117 enhanced-zone rules, prescribed minimums should escalate by zone (Zone 3 corner typically 8–12 per 4×8 board, vs 4–5 in Zone 1). A flat 2-or-4 across all zones is non-conservative in corners and is the most likely place a stamped drawing would fail review.

**Fix:** addressed natively by the new `insulation-engine.ts` per §2.3.

### 3.6 Roof slope not validated — **MEDIUM**

Header comment says "Low-slope (≤ 7°) mechanically attached roofing systems ONLY". `FastenerInputs` has no slope field, so steep-slope tile/shingle inputs silently get low-slope GCp values.

**Fix:** add `roofSlope_deg: number` to inputs; reject anything > 7° with a clear error pointing to the steep-slope procedure (different chapter of ASCE 7).

### 3.7 GCp table asymptote — **MEDIUM**

`src/lib/fastener-engine.ts:163–168` is a two-point log fit from EWA = 10 to 200 sq ft for each zone. ASCE 7-22 Fig 30.3-2A actually extends to 500 sq ft for Zones 1/2 and has a curve shape that a single log-segment may not capture cleanly past 100 sq ft. For insulation EWA (32 sq ft for a 4×8) the result is acceptable, but worth a side-by-side plot against the figure.

**Fix:** replace with a 3-point fit at (10, 100, 500) sq ft per zone, or just hard-code the figure's piecewise expression.

### 3.8 Risk Category accepted but unused — **MEDIUM**

`inputs.riskCategory` is taken in but never referenced. Either remove it from the input shape, or use it to validate that the supplied `V` matches the ASCE 7-22 hazard maps for the Risk Category at the site.

### 3.9 Section reference drift — **LOW**

- `:269` cites `§26.12.3` for partial enclosure; ASCE 7-22 has this at **§26.13.3**.
- `:263` cites `FBC §1521` for recover restriction; verify section number in 8th Edition.
- `:268` cites `TAS 114` for ASD/Ultimate basis; verify whether `TAS 114` or `RAS 137` is the operative citation for the ÷2 conversion.

Sweep `reference:` strings during the refactor.

### 3.10 Adhered systems short-circuit is correct but loud — **LOW**

The adhered path runs through `validateFastenerInputs()` which assumes mechanical attachment, producing irrelevant warnings. Have the orchestrator skip irrelevant validations for adhered systems and present a clean "RAS 117 not applicable — see TAS 124 NOA" status.

### 3.11 No fastener length / embedment field — **LOW**

RAS 117 also requires minimum deck embedment (typically 1" wood, ¾" steel, full-depth concrete). Not modelled. Add `fastenerLength_in`, `deckThickness_in`, validate embedment per deck type.

### 3.12 Half-sheet warning doesn't tell the field crew where — **LOW**

Engine flags `halfSheetZones: ['3']` but the technician needs "use half sheets within Zone 3 corners (X ft from each corner)". Add a `halfSheetLocations` field with the corner/perimeter geometry already computed in `zonePressures`.

---

## 4. Data model additions to support NOA-driven pattern lookup

The cleanest long-term fix to the "rational analysis vs prescriptive" branching is to source the prescriptive pattern directly from each NOA. Suggested schema additions:

```sql
CREATE TABLE noa_assemblies (
  id UUID PRIMARY KEY,
  noa_number TEXT NOT NULL,
  approval_type TEXT CHECK (approval_type IN ('miami_dade_noa', 'fl_product_approval')),
  manufacturer TEXT,
  product_name TEXT,
  system_number TEXT,
  scope TEXT CHECK (scope IN ('base_sheet', 'insulation', 'adhered_membrane')),
  mdp_psf NUMERIC,
  mdp_basis TEXT CHECK (mdp_basis IN ('asd', 'ultimate')),
  asterisked BOOLEAN DEFAULT false,
  -- Prescriptive pattern stored per zone
  prescriptive JSONB,    -- { zone1: { rows: 2, fs_in: 8 }, zone2: {...}, ... }
  -- Capacity inputs for rational analysis
  fb_lbf NUMERIC,         -- for base sheet
  f_assembly_lbf NUMERIC, -- for insulation
  plate_min_diameter_in NUMERIC,
  fastener_min_length_in NUMERIC,
  effective_from DATE,
  effective_to DATE
);
```

When the PE picks an NOA, the engine should:

1. Validate the NOA `scope` matches the calc being run (base sheet or insulation).
2. Use the NOA's prescriptive pattern as `N_prescribed` (insulation) or as the starting `n_rows` / `FS_in` (base sheet).
3. Use the NOA's `fb_lbf` or `f_assembly_lbf` for rational analysis.
4. Reject the calc if the user supplies a `tas105` MCRF that exceeds the NOA's tested capacity (TAS 105 is for the deck; can't claim a higher capacity than the NOA tested for the assembly).

---

## 5. Implementation order

1. **Sprint 1 — high-priority defects** (§3.1, §3.3, §3.4) and module split scaffold (§2.1, §2.2, §2.3, §2.6). Behaviour preserved for adhered and prescriptive paths.
2. **Sprint 2 — statistical correctness** (§3.2): replace t-factor with K-factor after PE sign-off on the exact table.
3. **Sprint 3 — insulation rigor** (§3.5 already covered by Sprint 1 split; add §3.7 GCp refit).
4. **Sprint 4 — validation hardening** (§3.6 slope, §3.8 risk category, §3.11 embedment).
5. **Sprint 5 — NOA data model** (§4): unlocks prescriptive-from-NOA workflow.
6. **Sprint 6 — UX polish** (§3.9 reference sweep, §3.10 adhered cleanup, §3.12 half-sheet location output).

Each sprint should be deployable on its own and gated by a PE review of the test cases.

---

## 6. Test plan additions

Add `src/test/fastener/` with at least:

- `zone-pressures.test.ts` — golden values from ASCE 7-22 worked examples at h = 15, 30, 60 ft; exposure B/C/D; with and without parapet.
- `base-sheet-engine.test.ts` — known assembly (e.g., a published NOA worked example) at multiple zones, verify `n_rows` and `FS_in`.
- `insulation-engine.test.ts` — 4×4 and 4×8 boards at P = 30/60/90/120 psf, verify grid layouts.
- `tas-105.test.ts` — published sample data sets, verify MCRF matches the standard's worked example.
- `noa-compatibility.test.ts` — boundary cases at MDP, 1.5× MDP, 2.5× MDP, 3.1× MDP, asterisked.

Hold a 100% pass rate on these as the gate for any future engine change.
