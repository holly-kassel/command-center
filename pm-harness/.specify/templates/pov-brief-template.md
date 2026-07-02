# POV Brief: [THE DECISION / QUESTION]

**Thread**: `[short-slug]`  ·  **Created**: [DATE]  ·  **Status**: Draft → Triangulating → Pressure-tested → Firm

> PM-flavored decision/argument artifact for **ALIGN**. Takes a **position** and defends it: frames
> the question, triangulates the evidence (**customer + data + vision**), weighs the options
> **neutrally**, and lands the recommendation **last** — after a pressure-test. Read-only: this brief
> makes the case, it writes nothing. Fill top-to-bottom; the recommendation comes after the options
> and the pressure-test, never before (Constitution II, V; output conventions §1).

---

## 1. The question *(mandatory, lead here)*

**The call:** [the decision in one sentence — a prioritization call, build-vs-not, or strategic stance].
**Why it matters now:** [the outcome at stake and the urgency — why decide this now].
**Who needs aligning:** [the stakeholders this POV has to move].
**Out of scope:** [what this POV is explicitly NOT deciding].

> Frame the right question first. A POV that answers the wrong question aligns no one.

## 2. The POV *(one-liner)*

**Our point of view:** [the position in one sentence — the stance we're prepared to defend].
**Triangulation:** customer ☐ · data ☐ · vision ☐  →  **Thin-leg flag:** [SOLID | ⚠ THIN — rests on one leg]

> If only one leg is checked, mark **⚠ THIN** and soften the one-liner until a second leg lands
> (Constitution II). A one-legged POV is a hunch, not a position.

## 3. Evidence *(triangulated, cited — never fabricated)*

What we actually know, each line tagged with its source **and** the leg it serves.

- **Customer:** [quote/item] `[customer-feedback: …]`
- **Data:** [number/measure] `[warehouse: <table>]`
- **Vision / landscape:** [related issue, decision, prior art] `[gh: org/repo#NN]` / `[slack: #channel]` / `[web: domain]`

## 4. Assumptions *(NOT evidence — kept separate on purpose)*

Inferences made where evidence is absent. Each is a thing we'd want to confirm.

- [assumption about users / market / capacity]
- [assumption …]

## 5. Options weighed *(neutral; stakes for each; recommendation comes later)*

Lay out the real options — **including do-nothing** — fairly, without steering. Stakes = upside /
downside / what it trades off. For a prioritization call, weigh **impact × urgency × effort vs
capacity** (Constitution III).

| Option | What it is | Stakes (upside · downside · cost/trade-off) |
|--------|-----------|---------------------------------------------|
| A | [option] | [upside · downside · what it costs] |
| B | [option] | [upside · downside · what it costs] |
| Do nothing | [hold / status quo] | [upside · downside · cost of inaction] |

> Don't pre-load the framing toward the pick. The operator reads the landscape before the call.

## ⚠ 6. Data gaps

What we don't know yet and how it weakens the position. (If a source was unreachable, say so + the fix.)

- [gap — and which conclusion it leaves unsupported]
- *Warehouse unreachable?* Follow the re-auth runbook in [`data-warehouse.md`](../../foundation/connectors/data-warehouse.md) and mark the **data leg a gap** — never invent numbers (Constitution IV).

---

## 🔬 7. Pressure test *(mandatory before Status = Firm)*

Run `pm-harness/foundation/pressure-test.md` **before** the recommendation is presented as firm. Summarize:

- **Gaps:** […]
- **Risks:** […]
- **Edge cases:** […]
- **Strongest counter-argument (steelmanned):** [the best case AGAINST this POV, stated fairly]
- **Bottom line:** [ready to go firm, or the 1–3 things to resolve first]

---

## 8. Recommendation *(LAST — after options and pressure-test)*

**The call:** [the recommended position].
**Why it wins:** [the one or two reasons it beats the alternatives, grounded in §3].

> If §2's thin-leg flag is still ⚠ THIN, this is **provisional pending the missing leg**, not firm.

## 9. Risks & what would change our mind

- **Risks of this call:** [what could go wrong, who it hurts, how likely / how bad].
- **What would change our mind:** [the evidence or events that would flip the recommendation —
  keeps the POV falsifiable and re-openable, not a one-way door].

---

## 10. Where next *(read-only — this brief writes nothing)*

- **Settles a build decision?** → shape it with the **PRD/Spec Framer** (`../../skills/prd-spec-framer/skill.md`, SHAPE).
- **Headed to a stakeholder audience?** → the **Stakeholder Update** skill (ALIGN, later iteration).
- This artifact makes the case only; it does **not** write to any source of truth, so no confirm gate applies.
