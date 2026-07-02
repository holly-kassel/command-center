# Skill: POV Brief  ·  Phase ③ ALIGN

> Take and defend a **position** to align stakeholders — "here's our point of view on `<X>`, the
> triangulated evidence behind it, the options weighed neutrally, the recommendation, and what would
> change our mind." A **read-only** decision/argument artifact: it makes the case, it doesn't build
> the thing (that's SHAPE) or file anything (that's the Eng Handoff). PM-flavored: **triangulate the
> position, separate evidence from assumptions, flag data gaps, weigh options neutrally, and
> pressure-test the call before it's presented as firm.**

This skill inherits the whole foundation (see `../README.md`) — it does not restate it.

---

## When to use

You need to take a **stance and align people behind it** — a prioritization call ("should we
prioritize `<X>` over `<Y>`?"), a build-vs-not, or a strategic position ("what's our take on `<X>`?").
The job is to make the argument: triangulate the evidence, weigh the options fairly, and land a
defensible recommendation. Not for turning intent into a build spec (that's SHAPE) and not for an
executive status update (that's the Stakeholder Update). It produces a brief — it **writes nothing
to a source of truth.**

## What it produces

A POV brief from `../../.specify/templates/pov-brief-template.md`, progressing through:
`Draft → Triangulating → Pressure-tested → Firm`. The brief states the question, the POV one-liner,
the triangulated evidence (cited), the options weighed neutrally with their stakes, the
recommendation **last**, and the risks + what-would-change-our-mind.

## Operating principles for this skill (from the Constitution)

1. **Outcome-framed, not activity.** The POV is about the customer/business outcome at stake, not a
   list of work done (Constitution I).
2. **Triangulate — the credibility test.** The position rests on **customer + data + vision**
   together. A POV standing on only one leg is flagged **THIN** and softened until a second leg
   lands. This is the heart of a credible POV (Constitution II).
3. **Prioritization calls get weighed.** Where the POV is a ranking, weigh **impact × urgency ×
   effort against roadmap and capacity** — show the weighting, not a bare verdict (Constitution III).
4. **Evidence ≠ assumptions, always separated. Never fabricate.** Every claim is cited to a
   connector or labeled an assumption. Warehouse "not authorized" → surface the re-auth runbook and
   mark the data leg a ⚠ gap; never invent numbers (Constitution IV).
5. **Pressure-test before firm (NON-NEGOTIABLE).** Steelman the counter-position and name what would
   change the call **before** the recommendation is presented as firm (Constitution V).

---

## Flow

### Step 0 — Orient (interruption-safe)

- If resuming, read the thread's resume snapshot first and re-orient in one short block (north star,
  where we are, and the next action). At any pause, write/update the snapshot (`../../foundation/memory/`).

### Step 1 — Frame the question / decision (§1)

- Restate what's being decided as a single sharp question: **the call** (prioritization / build-vs-not /
  stance), **why it matters now**, **who's affected / who needs aligning**, **what's out of scope.**
  Confirm you've framed the right question before gathering evidence — a POV answering the wrong
  question aligns no one.

### Step 2 — Gather evidence from connectors (§3) — `before_pov` hook

- Pull signal across all three legs of triangulation:
  - **Customer feedback** — real pain, quoted + cited `[customer-feedback: …]` (the customer leg).
  - **Warehouse** — size/impact measures `[warehouse: <table>]` (the data leg). If it returns "not
    authorized," **surface the re-auth runbook** and mark the data leg a ⚠ gap — do **not** invent
    numbers.
  - **GitHub / Slack / web** — related issues, decisions, prior art, competitive context, each cited
    (vision/landscape inputs; check `pm-response-log/` for existing precedent before taking a stance).
- Keep everything pulled in **§3 Evidence**, each line carrying its source tag and which leg it serves.

### Step 3 — Triangulate the position (§3, §4, §2)

- Confirm the POV draws on **customer + data + vision together**, not one cherry-picked leg.
- Move every uncited inference into **§4 Assumptions** — never let it pose as evidence.
- If the position rests on a single leg (e.g. data unreachable, or only one customer anecdote), set
  the **§2 thin-leg flag = THIN** and soften the one-liner until a second leg lands (Constitution II).

### Step 4 — Weigh the options neutrally (§5)

- Lay out the real options — **including the do-nothing / status-quo option** — each with its
  **stakes**: upside, downside, and what it costs/trades off. State them **neutrally**, without
  pre-loading toward your pick (output conventions §1).
- Where the POV is a prioritization call, weigh **impact × urgency × effort against capacity** and
  show that weighting (Constitution III) — not a bare ranking.

### Step 5 — Flag the data gaps (⚠ §6)

- Fill **⚠ §6 Data gaps**: what's unknown, what was unreachable + its fix (incl. warehouse re-auth),
  and **which conclusion each gap leaves unsupported.** A POV that names its gaps is honest; one that
  papers over them with a guess is harmful (Constitution IV).

### Step 6 — Pressure-test the recommendation (§7, NON-NEGOTIABLE)

- **Before** the recommendation is presented as firm, run `../../foundation/pressure-test.md`:
  **gaps · risks · edge cases · strongest counter-argument · bottom line.** **Steelman the
  counter-position** — state the best case *against* the POV fairly — and **name what would change
  the call.** Be a sharp partner, not contrarian. Record the result in §7 (Constitution V).

### Step 7 — State the recommendation last (§8)

- After the options and the pressure-test, land the **recommendation** and the one or two reasons it
  wins over the others. This comes **last** — the operator reads the landscape and the counter-case before
  the call (output conventions §1). If the thin-leg flag is still THIN, say the recommendation is
  **provisional pending the missing leg**, not firm.

### Step 8 — Name risks & what-would-change-it (§9)

- List the **risks** of the recommended position (what could go wrong, who it hurts) and the
  explicit **what-would-change-our-mind** triggers — the evidence or events that would flip the call.
  This keeps the POV falsifiable and re-openable, not a one-way door.

### Step 9 — Hand off (output conventions)

- Present to the operator **minimal-but-loud**: lead with what needs their attention; make the
  **evidence/assumption split and ⚠ data gaps impossible to miss**; show **options neutrally with
  stakes, recommendation at the end.**
- If the POV settles a build decision and they want to shape it into a spec, name the bridge to the
  **PRD/Spec Framer** (SHAPE). If it's headed for a stakeholder audience, name the **Stakeholder
  Update** (ALIGN). This skill itself **writes nothing** — no confirmation gate needed.

---

## Done =

A brief where the question is sharp, the position triangulates customer + data + vision (or is
flagged THIN until it does), every claim is cited or labeled an assumption, gaps are explicit and
unfabricated, the options are weighed neutrally with their stakes, and the recommendation lands
**last** — pressure-tested, with its risks and what-would-change-our-mind named.
