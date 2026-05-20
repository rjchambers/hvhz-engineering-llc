# Fastener Engine — RAS 117-20 Verification Report

**Standard:** 2020 Florida Test Protocols for HVHZ, 7th Edition — RAS 117-20
**Sections verified:** §9 (Insulation Attachment), §10 (Anchor/Base Sheet), §12 (Bitumen/Adhesive)
**Engine file under test:** `src/lib/fastener-engine.ts` @ commit on `claude/fix-orders-pipeline-sync-mG7Po`
**Method:** Replay the standard's worked examples through the engine and compare outputs.

> Note: This verification supersedes formula-specific items in `FASTENER_ENGINE_UPGRADE.md`. Three items in that document were wrong and are corrected in §5 below.

---

## 1. RAS 117 §9 — Insulation Attachment

### What the standard says

> **§9.1.2 General Equation:** `(Known # of fasteners / max design pressure) = (unknown # of fasteners / elevated design pressure)`
> "All fractions shall be rounded **up** to the next whole number."

Linear proportional extrapolation from the NOA's tested field-area pattern. **No fastener-withdrawal capacity is required as an input** — the NOA's field pattern is the basis.

### Worked example (§9.1.1)

- NOA MDP = -45 psf
- NOA field pattern = 4 fasteners per 4'×4' panel
- Zone pressures: 1' = -37, 1 = -64, 2 = -84, 3 = -115

| Zone | Calc | RAS expected |
|---|---|---|
| 1 | 4 × (64/45) = 5.69 → 6 | **6** |
| 2 | 4 × (84/45) = 7.47 → 8 | **8** |
| 3 | 4 × (115/45) = 10.22 → 11 | **11** |

### Engine replay

`fastener-engine.ts:253–257`:

```ts
const N_req = Math.ceil((Math.abs(P)*boardArea)/Fy),
      N_pres = boardArea>=28?4:2,
      N_used = Math.max(N_req,N_pres);
```

The engine's `(P × A) / Fy` is **mathematically equivalent** to RAS's `N_field × (P / MDP)` if and only if:

```
Fy = MDP × A_board / N_field = 45 × 16 / 4 = 180 lbf
```

Plugging Fy = 180:

| Zone | Engine N_req | Engine N_used | RAS expected | Match |
|---|---|---|---|---|
| 1 @ 64 | ceil(64×16/180) = 6 | max(6, 2) = **6** | 6 | ✅ |
| 2 @ 84 | ceil(84×16/180) = 8 | max(8, 2) = **8** | 8 | ✅ |
| 3 @ 115 | ceil(115×16/180) = 11 | max(11, 2) = **11** | 11 | ✅ |

### Status: **MATH-EQUIVALENT, INTERFACE-WRONG**

The arithmetic produces the right answer, but **only if the user supplies the derived `f_y`** rather than a fastener withdrawal value. The current input field labels it as a fastener capacity (lbf/fastener), which would lead a PE to enter the wrong number. The engine should:

1. Take `MDP_psf` and `N_field` from the NOA, derive `f_y = MDP × A / N_field` internally.
2. Or change the input label to "f_y per §10.4.3" and document.
3. Replace the `N_pres = boardArea >= 28 ? 4 : 2` rule (`fastener-engine.ts:254`) — the prescriptive minimum is the **NOA's field pattern**, not a hard-coded table.

### Missing rules from §9

| Rule | Status in engine |
|---|---|
| §9.2 — N_zone > 3 × N_field triggers "additional testing as determined by the building official" | Engine currently **blocks** the calc at 3× MDP. Should be a **warning** triggering PE judgement, not a hard block. |
| §9.3 — Panel overlapping zones gets the more stringent density across the whole panel | Not modeled. |
| §9.4 — Multilayer: top panel density governs (unless top is bonded; then base layer governs) | Not modeled — only one insulation layer is supported. |
| §9.5 — Base sheet may be attached *through* insulation with insulation fasteners | Not modeled. |

---

## 2. RAS 117 §10 — Anchor/Base Sheet Attachment

### What the standard says

> **§10.4.5 General Equation:** `FS = (f_y × 144) / (P × RS)`
> NOTE: "The row spacing is merely the **net width of the sheet divided by the number of rows**."
> "All fractions shall be rounded **down** to the next whole number."
> "Generally, side lap fastener spacing should not exceed 12 in. o.c."

Where:
- `f_y` = "fastener value" derived per §10.4.3 = `MDP × (sq ft per fastener)`
- `RS` = `NW / n` where NW = sheet width − side lap, n = number of fastener rows
- Steel deck (§10.1): "fastener spacing shall be in increments of 6 in. o.c."

### Worked example (§10.4)

- Sheet 36" wide, 4" side lap → NW = 32" = 2.67 ft
- NOA pattern: 3 rows (1 side-lap + 2 staggered center), FS = 12" o.c., RS = 24" between center rows
- 75 fasteners per square → 1.33 sq ft/fastener → f_y = 45 × 1.33 = **60 lbf**
- RS for elevated zones (3 evenly-spaced rows in NW=32"): **10.7"**

| Zone | Calc | Rounded | RAS pattern |
|---|---|---|---|
| 1 @ 64 | (60×144)/(64×10.7) = 12.6" | floor → 12" | 3 rows @ 10.7" RS, **FS = 12"** |
| 2 @ 84 | (60×144)/(84×10.7) = 9.6" | floor → 9" | 3 rows @ 10.7" RS, **FS = 9"** |
| 3 @ 115 | (60×144)/(115×8) = 9.0" — *with RS bumped to 8" (n=4)* | floor → 9" | 4 rows @ 8" RS, **FS = 9"** |

### Engine replay

`fastener-engine.ts:207–224`:

```ts
let n = initialN;                       // = 3
while (n <= 6) {
  const RS = NW_in / (n - 1),           // ⚠️ BUG: should be NW / n
        FS = (Fy * 144) / (absP * RS);
  if (FS >= 6.0) return { n, RS, FS, halfSheet: false };   // ⚠️ 6" floor not in §10
  n++;
}
// half-sheet fallback (NW/2, repeat)   // ⚠️ §10 uses MORE ROWS, not half sheets
```

And `fastener-engine.ts:322`:

```ts
const FS_used = Math.max(Math.min(Math.floor(FS*2)/2, 12), 4);  // ⚠️ floors to 0.5", not whole inch
```

Tracing with Fy=60, NW=32, initialN=3:

| Zone | n | RS (engine) | RS (RAS) | FS_calc (engine) | FS_used (engine) | FS (RAS) |
|---|---|---|---|---|---|---|
| 1 @ 64 | 3 | **16.0** | 10.7 | 8.4 | **8.0** | **12** ❌ |
| 2 @ 84 | 3 | **16.0** | 10.7 | 6.4 | **6.0** | **9** ❌ |
| 3 @ 115 | 3→4 | 32/(4−1)=**10.7** | 8.0 | 7.0 | **7.0** | **9** ❌ |

### Status: **FAIL** in all three zones

Root cause for Zones 1 & 2: `RS = NW/(n−1)` should be `RS = NW/n`. The wrong RS inflates the denominator of FS, producing a tighter (smaller) fastener spacing — *more conservative* than the standard requires. Customers are being over-fastened. Engineering judgment by the PE would still be defensible, but it doesn't match the standard's worked example.

Root cause for Zone 3: combination of wrong RS formula and engine accepting n=3 because FS=7" passes its internal `≥ 6` heuristic. The standard does not state a 6" floor on FS in §10 — it states a 12" maximum. The standard's worked example bumps to n=4 for Zone 3 (giving RS=8") for what appears to be engineering judgement around minimum practical spacing.

### Confirmed bugs

| # | Location | Bug | Severity |
|---|---|---|---|
| B1 | `fastener-engine.ts:212`, `:218` | `RS = NW/(n−1)` — should be `NW/n` per §10 NOTE | **HIGH** |
| B2 | `fastener-engine.ts:213`, `:219` | `FS >= 6.0` threshold — not in §10, only 12" max is | **MEDIUM** |
| B3 | `fastener-engine.ts:322` | `Math.floor(FS*2)/2` — rounds to nearest 0.5"; §10 requires floor to next whole inch | **HIGH** |
| B4 | `fastener-engine.ts:216–223` | Half-sheet fallback — §10 uses *additional rows*, not half-sheet width | **MEDIUM** |
| B5 | `fastener-engine.ts` interface | `Fy_lbf` user input is ambiguous; §10.4.3 requires derivation from NOA pattern | **HIGH** |

### Missing rules from §10

| Rule | Status |
|---|---|
| §10.1 — Steel deck: FS in increments of 6" o.c. | Not enforced. |
| §10.5 — Recover applications: must use **insulation fasteners and bearing plates**, not base sheet fasteners or nails | Not validated. |
| §10.6 — Buildings > 60 ft mean roof height: same procedure applies | Engine currently rejects h > 60 ft (`validateFastenerInputs` line 262). This is wrong for §10 (RAS 117), though ASCE 7-22 Ch. 30 Envelope Procedure does cap at h=60. The h>60 case requires the Directional Procedure for pressures, but the §10 RAS 117 attachment calc still applies. The error message should distinguish. |

---

## 3. RAS 117 §12 — Bonded / Adhered Application

### What the standard says

> §12.2 — "Not less than 85 percent of each insulation panel shall be in contact with the substrate and bonded with asphalt or adhesive, unless a specific intermittent adhesive attachment pattern is detailed in the roof assembly manufacturer's Product Approval."
> §12.6 — **"No extrapolation for the elevated pressure zones, as defined by ASCE 7, shall be allowed in adhered roof assemblies."**
> §12.6.1 — TAS 124 testing alternative:
>   - Minimum 4 test specimens per roof level
>   - Minimum 2 tests in each elevated pressure zone (perimeter and corner)
>   - +1 test per 25 squares of elevated pressure zone area
>   - **"A 1.45:1 margin of safety shall be applied to the test results."**

### Engine replay

`fastener-engine.ts:308–313`:

```ts
if (inputs.systemType === 'adhered') {
  warnings.push({ level: 'info', message: 'Adhered membrane: Verify NOA listed adhesive bond strength (psf) ≥ all zone pressures. No row spacing applies.', reference: 'TAS 124' });
  // ... returns with fastenerResults: []
}
```

### Status: **PARTIAL**

The engine correctly skips fastener row/spacing calc for adhered systems, but:

- Does not validate that the NOA's tested MDP ≥ each elevated zone pressure (because **no extrapolation is allowed**, every zone must independently meet MDP).
- Does not model the TAS 124 testing alternative or its **1.45:1 margin of safety**.
- Does not prompt for or capture the 85% bonding requirement (§12.2) at intake.

### Confirmed bugs

| # | Location | Bug | Severity |
|---|---|---|---|
| B6 | `fastener-engine.ts:308–313` | Adhered path doesn't enforce "no extrapolation" rule explicitly — every zone P must be ≤ MDP, no `extrapFactor` allowed | **MEDIUM** |
| B7 | `fastener-engine.ts` overall | No TAS 124 test-result intake or 1.45:1 MoS evaluation | **MEDIUM** |

---

## 4. Other defects confirmed against the standard

### B8: NOA compatibility 3× rule (`fastener-engine.ts:202`)

**Engine:** at extrapFactor > 3.0, sets `basis = 'exceeds_300pct'` and `blocksCalculation = true`, then emits an error.

**Standard §9.2:** "If the data extrapolation results in a number of fasteners for an elevated pressure zone which **exceeds 300 percent of that for the field area**, additional testing, as determined by the building official, **may be required** to confirm the performance of the Roof System Assembly."

The standard says *may require additional testing* — not *prohibits the calc*. The engine over-blocks. **Severity: MEDIUM.** Fix: change to a warning that flags the design for AHJ review, but allow the calc output (so the PE can decide whether to commission additional testing or specify a higher-MDP assembly).

Also: §9.2 only applies to **insulation** (§9). The "300 percent of field area" rule is **not stated in §10** for base sheets. The engine applies the 3× rule to base sheet zones as well, which is not supported by the standard text I have. Flag this for §10-only-or-not verification.

### B9: ASCE section reference (`fastener-engine.ts:269`)

`reference: '§26.12.3'` — ASCE 7-22 partial enclosure / GCpi is at **§26.13.3**.

### B10: "RAS 117 §6" references (`fastener-engine.ts:124, 296–300`)

`ras117_fs:'FS = (Fy × 144) / (|P| × RS) [RAS 117 §6 rational analysis]'`

The actual equation lives in **RAS 117 §10.4.5** (anchor/base sheet) and **§9.1.2** (insulation, different form). §6 references should be replaced.

---

## 5. Corrections to `FASTENER_ENGINE_UPGRADE.md`

The previous upgrade plan made three claims that the actual RAS 117 PDF refutes. They must be revised:

| Previous claim | Actual standard says | Revised action |
|---|---|---|
| §3.3 — "RAS 117 requires MoS = 2.0; add explicit MoS multiplier" | §12.6.1 specifies **1.45:1** for adhered TAS 124 testing. **No explicit MoS** is stated in §9 or §10 for mechanical attachment — the safety margin is baked into the NOA's tested MDP, and the rational analysis is pure proportional extrapolation. | **RETRACT.** Do not add a `mos: 2.0` input. For adhered, add a separate 1.45 factor on TAS 124 test results. For mechanical, do not double-apply a MoS. |
| §3.2 — "TAS 105 uses K-factor tolerance limits, not Student-t" | RAS 117 §§9, 10, 12 do not reference any TAS 105 statistical analysis. The capacity input (`f_y`) is **derived from NOA MDP and field pattern**, not from a TAS 105 statistical analysis. | **HOLD until TAS 105 PDF is reviewed.** The TAS 105 path in the engine (`calculateTAS105`, line 236) governs field withdrawal testing for substrate verification, which is a separate workflow from the RAS 117 attachment calc. Whether t-factor or K-factor applies is a TAS 105 question, not a RAS 117 question. |
| §3.4 — "Engine should FAIL when FS < 6" minimum" | §10 does not state a 6" minimum FS. It states a **12" maximum** on side lap spacing and requires "rounded down to next whole number." | **REVISE.** Remove the 6" minimum from the solver; instead enforce the 12" max and the next-row escalation when FS calc is impractical. PE can override with engineering judgment as the standard's own example does for Zone 3. |

The other items in `FASTENER_ENGINE_UPGRADE.md` (zone-width formula §3.1, silent clamp behavior §3.4 partially, insulation zone-density §3.5, slope guard §3.6, reference drift §3.9, NOA data model §4) remain valid.

---

## 6. Recommended fix order with code

### Fix #1 — Row spacing formula (B1) — 2-line change

```ts
// fastener-engine.ts:212 and :218
- const RS = NW_in / (n - 1), FS = (Fy * 144) / (absP * RS);
+ const RS = NW_in / n,       FS = (Fy * 144) / (absP * RS);
```

This single change brings Zones 1 and 2 of the §10 worked example into exact agreement.

### Fix #2 — FS rounding (B3) — 1 line

```ts
// fastener-engine.ts:322
- const FS_used = Math.max(Math.min(Math.floor(FS*2)/2, 12), 4);
+ const FS_used = Math.min(Math.floor(FS), 12);   // floor to whole inch per §10
```

Remove the 4" floor (no longer needed once B2 is fixed) and round to whole inch per the standard.

### Fix #3 — Drop the 6" FS heuristic and add row escalation (B2, B4)

```ts
export function solveRowsAndFS(Fy: number, P: number, NW_in: number, initialN: number, maxRows = 6) {
  const absP = Math.abs(P);
  if (absP === 0) return { n: initialN, RS: NW_in / initialN, FS: 12, status: 'ok' as const };

  for (let n = initialN; n <= maxRows; n++) {
    const RS = NW_in / n;
    const FS_calc = (Fy * 144) / (absP * RS);
    const FS = Math.min(Math.floor(FS_calc), 12);   // §10: floor + 12" cap

    // §10 doesn't mandate a minimum FS, but practical install limits do.
    // Bump to next n if FS < installation minimum (PE-configurable, typically 6").
    if (FS < 6 && n < maxRows) continue;

    return { n, RS: Math.round(RS * 10) / 10, FS, status: 'ok' as const };
  }
  return { n: maxRows, RS: NW_in / maxRows, FS: 0, status: 'fail' as const };
}
```

(Remove the half-sheet branch entirely — §10 does not endorse it.)

### Fix #4 — Insulation calc rewrite (§1 Status finding)

Replace `calcInsulation` with the direct proportional form:

```ts
interface InsulationInputs {
  P_zone: number;
  N_field: number;    // from NOA
  MDP_psf: number;    // from NOA
  zone: string;
}

function calcInsulation({ P_zone, N_field, MDP_psf, zone }: InsulationInputs): InsulationZoneResult {
  const ratio = Math.abs(P_zone) / Math.abs(MDP_psf);
  const N_calc = Math.ceil(N_field * ratio);
  const exceeds300 = ratio > 3.0;
  return {
    zone,
    P_psf: Math.round(Math.abs(P_zone) * 100) / 100,
    N_required: N_calc,
    N_prescribed: N_field,
    N_used: Math.max(N_calc, N_field),
    extrapolationRatio: Math.round(ratio * 100) / 100,
    requiresAdditionalTesting: exceeds300,
    layout: chooseGridLayout(Math.max(N_calc, N_field), /* board dims */),
  };
}
```

Inputs change from `(P, A, Fy)` to `(P, N_field, MDP)`. Wire the NOA field pattern through the form.

### Fix #5 — Adhered system extrapolation prohibition (B6)

```ts
if (inputs.systemType === 'adhered') {
  // §12.6 — no extrapolation allowed
  for (const nr of noaResults) {
    if (Math.abs(nr.P_psf) > Math.abs(mdp_eff)) {
      warnings.push({
        level: 'error',
        message: `Adhered system: Zone ${nr.zone} pressure (${Math.abs(nr.P_psf).toFixed(1)} psf) exceeds NOA MDP (${Math.abs(mdp_eff).toFixed(1)} psf). RAS 117 §12.6 prohibits extrapolation — select a higher-MDP assembly or commission TAS 124 testing per §12.6.1 (1.45:1 MoS).`,
        reference: 'RAS 117 §12.6',
      });
    }
  }
  // ... existing return
}
```

### Fix #6 — Steel deck increment (§10.1)

After `FS_used` is computed, if `deckType === 'steel_deck'`:

```ts
FS_used = Math.floor(FS_used / 6) * 6;   // step down to next 6" increment
if (FS_used < 6) FS_used = 0;            // fail
```

### Fix #7 — Recover applications (§10.5)

```ts
if (inputs.constructionType === 'recover') {
  warnings.push({
    level: 'error',
    message: 'RAS 117 §10.5: Recover applications must use approved insulation fasteners and bearing plates. Anchor/base sheet fasteners or nails are not permitted.',
    reference: 'RAS 117 §10.5',
  });
}
```

---

## 7. Open questions for PE review

1. **TAS 105 statistical method.** The K-factor vs t-factor question raised in `FASTENER_ENGINE_UPGRADE.md` §3.2 cannot be answered from RAS 117. Need TAS 105-20 sections defining the MCRF formula. *Action: please share TAS 105 PDF if available.*

2. **"Asterisked" NOA assemblies.** Engine has logic for `noa.asterisked` (line 19, 201). RAS 117 §§9, 10, 12 don't mention asterisked status. This may be NOA-document-specific language rather than a RAS 117 concept. *Action: confirm where the asterisk concept is defined.*

3. **Buildings > 60 ft.** §10.6 says "the example above shall also apply." But the engine rejects h > 60 ft outright. Confirm whether the rejection should be limited to the *ASCE 7 Envelope Procedure* (which is correct to cap at 60), allowing the §10 attachment calc to proceed with pressures derived a different way for taller buildings.

4. **6" minimum FS — engineering judgment override?** Should the engine offer the PE a configurable minimum FS (6" default) that escalates rows, but doesn't block? The standard doesn't mandate 6"; this is industry practice. Make it explicit and configurable.

5. **f_y derivation.** Should the input shape change from `Fy_lbf` (a single number) to `(MDP_psf, N_field, NW_in, RS_field_in)` with the engine deriving f_y per §10.4.3? This better matches how a PE would read from the NOA.

---

## 8. Summary scorecard

| Section | Standard behavior | Engine behavior | Status |
|---|---|---|---|
| §9 Insulation extrapolation | N = N_field × P/MDP, round up | Math-equivalent given right inputs | ⚠️ Interface |
| §9.2 300% rule | Triggers additional testing | Blocks calculation | ❌ Wrong |
| §9.3 Overlap rule | More stringent density across panel | Not modeled | ❌ Missing |
| §9.4 Multilayer rule | Top panel density (or base if top adhered) | Not modeled | ❌ Missing |
| §9.5 Through-insulation base sheet | Allowed | Not modeled | ❌ Missing |
| §10 Base sheet FS = (f_y × 144)/(P × RS) | RS = NW/n, FS rounded down to whole inch | RS = NW/(n−1), FS rounded to 0.5" | ❌ **FAIL** |
| §10.1 Steel deck 6" increments | Required | Not enforced | ❌ Missing |
| §10.5 Recover = insulation fasteners only | Required | Not enforced | ❌ Missing |
| §10.6 h > 60 ft | Same procedure | Blocks at h > 60 | ⚠️ Conflated with ASCE Ch.30 |
| §12.2 85% bonding | Required | Not captured | ❌ Missing |
| §12.6 Adhered no extrapolation | Mandatory | Engine doesn't validate | ❌ Missing |
| §12.6.1 TAS 124 + 1.45:1 MoS | Test option | Not modeled | ❌ Missing |

---

## Next step

Fix #1 (the `NW/(n-1)` → `NW/n` change) is a 2-line patch that aligns Zone 1 and Zone 2 of the §10 worked example exactly. Want me to make that change plus #2 and #3 in a focused commit so you can verify the worked example end-to-end in the calculator UI, before tackling the larger architectural split?
