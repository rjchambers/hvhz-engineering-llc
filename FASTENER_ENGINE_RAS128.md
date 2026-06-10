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

### ⚠️ Provenance of the table values

The Table 1/2 numbers are **computed** from the RAS 128 procedure (ASCE 7-22),
not transcribed from the printed RAS 128 PDF (the FL code sites were not
retrievable in the build environment). They should match to within rounding, but
**verify against the printed RAS 128 Table 1/2 (8th Ed.) before relying on the
tabular "no signed/sealed calc" path** for a permit. Swapping in transcribed
values is a localized change in `ras128.ts`.

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

## 4. Citation fixes

- `reportLayout.ts`: **RAS 128 was mislabeled "Insulation Board Attachment"** —
  corrected to "Applicable Wind ASD Pressures for Low-Slope Roofs (per ASCE 7)".
  RAS 117 / RAS 137 / TAS 105 descriptions corrected to their actual titles.

---

## 5. Verification

- `bun run test` — **60 passing** (was 26): adds the RAS 128 procedure, table,
  prescriptive, cross-engine reconciliation, and sealed-report back-test suites.

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
