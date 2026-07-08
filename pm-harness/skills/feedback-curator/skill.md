# Skill: Feedback Curator / Signal Triage  ·  Phase ① SENSE

> Curate raw signal across the connectors, cluster recurring customer pain, and **weight each
> cluster by impact × urgency × effort against roadmap and capacity** — surfacing what's *rising*
> with its weighting, never a bare list. The top-ranked item is the natural input to SHAPE.

This skill inherits the whole foundation (see `../README.md`) — it does not restate it.

---

## When to use

You ask "what's rising?", "what should I be paying attention to?", "triage this signal", or
"curate the feedback" — you need the noise turned into a ranked, weighted read of what matters now.
Not for shaping a spec (that's SHAPE) or writing the stakeholder update (that's ALIGN). This skill
**stops at the ranked triage**; it hands the top mover to SHAPE.

## What it produces

A ranked triage artifact from `../../.specify/templates/signal-triage-template.md`: clustered
signals scored by **impact × urgency × effort vs. capacity** (Constitution III), every row cited or
labeled an assumption, with a **⚠ Data gaps** callout and an explicit evidence-vs-assumption split.

## Operating principles for this skill (from the Constitution)

1. **Weight, don't list (NON-NEGOTIABLE for SENSE).** When the harness surfaces what's rising, it
   shows **impact × urgency × effort weighed against roadmap and capacity** — never a bare list
   (Constitution III).
2. **Triangulate each cluster.** A cluster backed by only one leg (customer *or* data *or* vision)
   is flagged thin; pull the missing legs where reachable (Constitution II).
3. **Evidence ≠ assumptions, always separated.** Every signal is cited to a connector or labeled an
   assumption. **Never fabricate** volumes, trends, or quotes (Constitution IV).
4. **Flag data gaps out loud.** Surface what's unknown/unreachable *for* the operator (incl. warehouse
   re-auth) rather than making them mine for it.
5. **Minimal but loud about the top movers.** Lead with what's rising and why; don't narrate the
   whole corpus (output conventions).

---

## Flow

### Step 0 — Orient (interruption-safe)

- If resuming, read the thread's resume snapshot first and re-orient in one short block: north star,
  where things stand, and the next action. At any pause, write/update the snapshot
  (`../../foundation/memory/`).

### Step 1 — Frame the scope

- Restate the triage scope: **which signal** (segment / area / theme), **why now**, and **the lens**
  (e.g. enterprise feedback this week). Confirm the scope before gathering — a triage of the wrong
  corpus wastes the pull.

### Step 2 — Gather signal from connectors — `before_triage` hook

- Pull across all five sources, each line carrying its source tag:
  - **Customer feedback** — recurring pain, real items quoted + cited
    `[customer-feedback: data/issues/<id>]`. Prefer the high-priority rollup and response log
    described in `../../foundation/connectors/customer-feedback.md` when you need curated synthesis
    or prior precedent.
  - **Slack** — what's surfacing in discussion before it reaches an issue `[slack: #channel]`.
    Private/DM search needs the operator's per-use consent — ask first.
  - **GitHub** — recent issues/PRs/discussions by label/area `[gh: org/repo#NNN]`.
  - **Web** — external/market context as a supporting leg only `[web: domain]`.
  - **Warehouse** — size/impact metrics `[warehouse: <table>]`. On a "not authorized" error,
    **surface the re-auth runbook** and mark the impact leg a gap — do **not** invent numbers.

### Step 3 — Cluster recurring pain

- Group raw items into **clusters of the same underlying pain**, not surface phrasing. Each cluster
  carries its constituent cited items so the rollup stays traceable.

### Step 4 — Weight each cluster (Constitution III)

- Score every cluster on **Impact** (how many / how badly — the warehouse leg where reachable),
  **Urgency** (what makes it matter now), and **Effort** (rough size), then weigh against
  **roadmap + capacity**. Make the weighting visible per row; this is the whole point of SENSE.

### Step 5 — Separate assumptions & flag gaps

- Move every uncited inference into the **assumptions** split — never let it pass as evidence.
- Fill the **⚠ Data gaps** callout: what's unknown, what was unreachable + its fix (incl. warehouse
  re-auth), and which weighting each gap leaves soft. A thin (one-leg) cluster is named as such.

### Step 6 — Rank

- Order clusters by their weighting into a ranked table. Ties and close calls are noted, not hidden;
  the ranking is a judgment shown with its inputs, not a black-box score.

### Step 7 — Present to the operator (output conventions)

- Lead with the **top movers and why they rose** (minimal-but-loud) — not the full corpus.
- Show the ranked table with **impact · urgency · effort · weighting · recommended next action**.
- Make the **evidence/assumption split and ⚠ data gaps** impossible to miss.
- Where the ranking is genuinely close, show the contenders **neutrally with stakes, then the call.**

### Step 8 — Hand off to SHAPE

- Name the top-ranked cluster as the candidate to spec, and offer the bridge: its cited evidence
  becomes the input to `../prd-spec-framer/skill.md` (SHAPE). **Do not** start shaping here — the
  hand-off is an offer, not an action.

---

## Done =

A ranked triage where the top movers lead, every cluster is weighted by impact × urgency × effort
against capacity, every signal is cited or labeled an assumption, gaps are explicit and
unfabricated, and the top item is teed up for SHAPE — never a bare list.
