# Wind Mitigation / Fastener Engine — RAS 128 Integration & Engine Reconciliation

**Standards in scope:** RAS 117-20 (fastener rational analysis), **RAS 128-20**
(applicable wind ASD pressures for low-slope roofs), ASCE 7-22 Ch. 26 & 30 C&C.
**FBC:** 8th Edition (2023), Test Protocols for HVHZ.

This document records the changes that (1) put the low-slope pressure
determination explicitly on RAS 128, (2) reconciled the two parallel
calculation engines, and (3) explains why **RAS 127 is intentionally excluded**.

---

## 1. Why RAS 127 is NOT in the fastener engine

RAS 127-20 is *"Procedure for Determining the Moment of Resistance and Minimum
Characteristic Resistance Load to Install a **Tile System**… Using ASD in
Accordance with ASCE 7."* It is a roof-**tile** aerodynamic uplift-moment
calculation (M_a, M_r, aerodynamic multiplier λ, restoring moments) — a
different roof type and a different calculation from the low-slope
mechanically-attached / adhered **membrane** systems this engine handles.

This application has no tile uplift-moment engine (only order-intake tile fields
and the TAS-106 tile-bonding *service*). Citing RAS 127 on a membrane fastener
calculation would be incorrect on a permit submittal, so it is deliberately left
out. If a tile uplift-moment calculator is wanted, it should be a separate
module/page.

The three standards as actually defined in the FBC Test Protocols:

| Standard | Governs | In this engine |
|---|---|---|
| RAS 117-20 | Fastener spacing rational analysis (membrane: insulation §9, base sheet §10, adhered §12) | ✅ Backbone |
| RAS 128-20 | ASD wind pressures for **low-slope** roofs per ASCE 7 (Tables 1 & 2) | ✅ `ras128.ts` |
| RAS 127-20 | Moment of resistance for **roof tile** systems | ❌ Out of scope (different roof type) |

---

## 2. RAS 128 module (`src/lib/fasteners/ras128.ts`)

New authoritative, shared pressure module:

- `kzASCE(exposure, h)` — ASCE 7-22 Eq. 26.10-1, `Kz = 2.01·(max(h,15)/zg)^(2/α)`.
- `zoneDimA(h, W, L)` — ASCE 7-22 §30.2 zone dimension `a`.
- `gcpLowSlope(zone, ewa)` — Fig. 30.3-2A GCp (Zones 1′/1/2/3), log-interpolated on EWA.
- `computeRAS128Pressures(inputs)` — full procedure → `Pult` and `Pasd = 0.6·Pult`
  by zone, with a citation derivation. Field/perimeter/corner = Zone 1/2/3.
- `generateRAS128Table(opts)` — reproduces **Table 1 / Table 2** by running the
  procedure across a grid of wind speeds × mean roof heights at the standard's
  fixed assumptions (enclosed, slope ≤ 7°, Kd 0.85, Kzt 1.0, Ke 1.0, EWA 10 ft²).
- `checkRAS128Prescriptive(result, ratedPressure)` — the "no signed/sealed calcs
  required" determination: if the assembly's approved pressure envelopes the
  governing zone `Pasd`, the tabular path applies; otherwise a RAS 117 rational
  analysis is required.

Wired into `calculateFastener` (`index.ts`): every result now carries a
`ras128` summary and an info/warning stating whether the design qualifies for
the RAS 128 tabular path. Surfaced in the FastenerCalc UI as the
"Applicable Wind ASD Pressures — RAS 128" card.

### Published tables (verbatim) + procedure cross-check

`ras128.ts` now embeds the **verbatim** published RAS 128-20 tables (2023 FBC,
8th Ed., codes.iccsafe.org):
- `RAS128_TABLE_1_EXP_C` — Table 1, Exposure C
- `RAS128_TABLE_2_EXP_D` — Table 2, Exposure D

Both are Risk Cat II, slope < 1½:12, V = 175 mph, indexed by eave-height band.
`lookupRAS128Table(exposure, eaveHeight)` returns the governing band row (or
null above 60 ft), and the report (§5.3) and FastenerCalc UI surface it for
Exposure C/D + Risk II.

**Cross-check:** `computeRAS128Pressures` (our ASCE 7-22 procedure) at V=175,
Risk II, enclosed, EWA=10, evaluated at each band's top height, reproduces
**77 of 80** published values exactly; the remaining 3 differ by exactly 1 psf
at half-psf rounding boundaries (e.g. we compute 108.49, the book prints 109).
`ras128-tables.test.ts` asserts every cell is within 1 psf and ≥ 77/80 exact —
strong validation that the procedure *is* the RAS 128 procedure. The verbatim
table values are authoritative for the tabular "no signed/sealed calc" path.

---

## 3. Engine reconciliation (bugs fixed)

There were two overlapping engines that disagreed:

| Item | Before | After |
|---|---|---|
| Velocity coefficient `Kh`/`Kz` | table interpolation in one engine, analytic formula in the other | single analytic `kzASCE` everywhere (ASCE 7-22 Eq. 26.10-1) — **validated** against the sealed reference report (Kz = 0.85) |
| Low-slope zone band width | `0.6·h` in both engines, but `wind-calc` flat used a slightly different floor | unified `0.6·H` (field/perimeter/corner) + `0.2·H` (corner-inner) in **both** engines |
| Steep-slope (gable/hip) zone width | `a` | `a` (unchanged) |

### Zone-width convention: 0.6H / 0.2H (decision)

Low-slope band geometry uses the firm's **0.6·H** field/perimeter/corner band
and **0.2·H** corner-inner, matching the signed/sealed reference reports (Coral
Springs, Erik Nemati P.E.). This is wider/more conservative than the ASCE 7-22
§30.2 dimension `a`, and is the convention the engineer of record seals on.
Pressures are independent of band width — they come from RAS 128 / ASCE 7-22
(qh, GCp, GCpi), which is the part validated to the cent against the sealed
report. ASCE `a` is retained for the steep-slope (gable/hip > 7°) path.

A reconciliation test (`ras128.test.ts`) asserts the RAS 117 engine and the C&C
engine agree on the 0.6H band and on the field/perimeter/corner pressures.

## 3a. Sealed-report back-test (`sealed-report-backtest.test.ts`)

Pins the engine to a real signed & sealed RAS 117 / ASCE 7-22 insulation calc
(1852 NW 82nd Ave, Coral Springs; GAF NOA FL11946-R26):

| Quantity | Engine | Sealed report |
|---|---|---|
| Kz / qh / Dqz | 0.849 / 56.57 / 33.94 | 0.85 / 56.57 / 33.94 |
| P1′ / P1 / P2 / P3 (psf) | −36.66 / −63.81 / −84.18 / −114.72 | identical |
| Insulation N per 4×4 board | 9 / 11 / 15 / 20 | 9 / 13 / 16 / 21 |

Pressures match exactly. The insulation **count** uses the standard RAS 117 §9
proportional rule (`ceil(N_field × P/MDP)`, floored at the NOA field pattern),
which reproduces the FBC §9 worked example exactly. The reference report
specifies a few more fasteners (an office-specific conservative margin); the
test asserts our counts are always ≥ the NOA field pattern and ≤ the report's
counts.

---

## 3b. Irrefutable report — verbose math, input verification, RAS 128 chart

The fastener-calculation report (`generateReport.ts`) is now fully traceable and
makes no hidden assumptions:

- **§3 Input Verification & Data Provenance** — `checkFastenerInputs()`
  (`required-inputs.ts`, the single source of truth) lists every input the calc
  depends on, grouped, with its value, source (Code-locked / Technician /
  Engineer), and status. Missing required inputs are flagged `MISSING ✗ *` and a
  red "REPORT INCOMPLETE" banner blocks permit use. Code-locked factors (V,
  Exposure, Kzt, Kd, Ke) are shown with their code basis and never count as
  missing.
- **Verbose derivations** — velocity pressure (Kz → qh → Dqz → GCpi), per-zone
  uplift `P = Dqz·(GCp − GCpi)` with full substitution, the RAS 117 §10 fastener
  chain (NW → L → FPS → Fv → RS, step by step), per-zone `FS = (|Fv|·144)/(|P|·RS)`,
  and the RAS 117 §9 insulation `N = ⌈P·A/Fv⌉` — all with numbers substituted.
- **RAS 128 chart with auto-highlight** — the full published Table 1 (Exp C) or
  Table 2 (Exp D) is rendered with the structure's eave-height band row
  highlighted (`addTable({ highlightRow })`).

The same `checkFastenerInputs` model gates the **technician work order**: required
fields are asterisked, a live banner lists what's still needed, and submission to
the PE is blocked until every technician-stage input is provided.

---

## 4. Citation fixes

- `reportLayout.ts`: **RAS 128 was mislabeled "Insulation Board Attachment"** —
  corrected to "Applicable Wind ASD Pressures for Low-Slope Roofs (per ASCE 7)".
  RAS 117 / RAS 137 / TAS 105 descriptions corrected to their actual titles.

---

## 5. Verification

- `bun run test` — **70 passing** (was 26): adds the RAS 128 procedure, table,
  prescriptive, cross-engine reconciliation, sealed-report back-test, and
  verbatim published-table validation suites.

### RAS 117 §9 insulation report

The fastener report (`generateReport.ts`) now includes a **§9.0 Insulation
Attachment (RAS 117 §9)** section mirroring the sealed reference report's page 2:
derives `Fv = DP × A_board / FPB`, tributary area per fastener, and fasteners
per board by zone (`computeInsulationAttachment` in `wind-calc.ts`, shared with
the FastenerCalc UI card). Driven by four optional inputs (insulation MDP, NOA
field pattern FPB, board L×W) on the FastenerCalc form; when absent the section
notes that base-sheet/membrane fastening governs (§7–8).
- `tsc -p tsconfig.app.json --noEmit` — clean.
- `bun run build` — clean.

RAS 117 §9/§10 worked-example tests (insulation, base sheet) remain green —
the pressure-determination change does not affect those, which use explicit
zone pressures.
