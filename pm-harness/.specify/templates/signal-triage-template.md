# Signal Triage: [SCOPE / LENS]

**Thread**: `[short-slug]`  ·  **Created**: [DATE]  ·  **Status**: Gathered → Clustered → Weighted → Ranked

> PM-flavored SENSE artifact. Turns raw signal into a **ranked, weighted** read of what's rising —
> **impact × urgency × effort against capacity** (Constitution III), never a bare list. Keeps
> **evidence and assumptions separate**, flags **data gaps**, and tees the top mover up for SHAPE.
> Fill top-to-bottom; rougher lower rows are fine early and tighten as signal firms up.

---

## 1. Scope & lens *(mandatory, lead here)*

**Signal in view:** [segment / area / theme — e.g. enterprise feedback].
**Why now:** [what prompted this triage].
**Capacity context:** [roadmap / capacity this is weighed against — Constitution III].
**Out of scope:** [what this triage is explicitly NOT covering].

## 2. Ranked clusters *(weighted — never a bare list)*

Each row is a cluster of the same underlying pain, scored and ranked. Impact/Urgency/Effort as
**S/M/L/XL** (or H/M/L); Weighting = the judgment call (impact × urgency × effort, vs. capacity).

| # | Signal / cluster | Sources *(cited)* | Impact | Urgency | Effort | Weighting | Recommended next action |
|---|------------------|-------------------|--------|---------|--------|-----------|-------------------------|
| 1 | [cluster name] | `[customer-feedback: …]` `[warehouse: …]` `[gh: …]` | [H/M/L] | [H/M/L] | [S/M/L] | [🔴/🟡/🟢 + why it ranks here] | [spec it / watch / dig deeper] |
| 2 | [cluster name] | `[slack: #…]` `[gh: …]` | … | … | … | … | … |
| 3 | … | … | … | … | … | … | … |

> The top row is the candidate to hand to SHAPE. If two rows are genuinely close, note it rather
> than forcing a false order.

## 3. Evidence *(cited — never fabricated)*

The real items behind the clusters, each carrying its source tag.

- **Customer pain:** [quote/item] `[customer-feedback: data/issues/<id>]`
- **Data / size:** [number/measure] `[warehouse: <table>]`
- **GitHub / discussion:** [signal] `[gh: org/repo#NN]` / `[slack: #channel]`
- **External:** [market/prior art] `[web: domain]`

## 4. Assumptions *(NOT evidence — kept separate on purpose)*

Inferences made where a leg was thin or unreachable. Each is something we'd want to confirm.

- [assumption about volume / urgency / scope]
- [assumption …]

## ⚠ 5. Data gaps

What we don't know and how it softens a weighting. (If a source was unreachable, say so + the fix.)

- [gap — and which row's weighting it leaves soft]
- **Warehouse:** [if "not authorized" — surface the re-auth runbook from
  `../../foundation/connectors/data-warehouse.md`; the impact leg rests on customer + vision only
  until reconnected. Never invent numbers.]

## 6. Thin clusters *(one-leg — flagged per Constitution II)*

Clusters backed by only customer **or** data **or** vision, not triangulated — ranked but marked
soft until a second leg lands.

- [cluster — which leg is missing]

---

## 7. Hand-off to SHAPE *(when a top mover is chosen)*

Top-ranked cluster: **[name]**. Its cited evidence (§3) is the input to the **PRD/Spec Framer**
(`../../skills/prd-spec-framer/skill.md`). Handing off is an **offer**, not an action — SENSE stops
at the ranked triage.
