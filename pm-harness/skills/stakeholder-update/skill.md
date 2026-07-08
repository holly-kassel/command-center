# Skill: Stakeholder Update  ·  Phase ③ ALIGN

> Translate a period's work into an **executive-friendly update** — "here's what shipped (as user
> value, not PR titles), what the numbers say, what's in-flight, and what's blocked." A **read-only**
> communication artifact: it drafts the update, it doesn't take a position (that's the POV Brief),
> doesn't build the thing (SHAPE), and doesn't file anything (Eng Handoff). PM-flavored: **outcomes over
> implementation, group work into themes, no jargon, quantify only with cited data, and be honest
> about in-flight work and blockers.**

This skill inherits the whole foundation (see `../README.md`) — it does not restate it.

---

## When to use

You need to **tell stakeholders where things stand** — a weekly status update, an initiative
roll-up, an exec summary. The audience is **leadership, cross-functional partners, executives**: busy,
non-technical, outcome-focused. The job is to translate the messy week (PRs, fixes, metrics) into a
clear story of business value that reads in **~5 minutes.** Not for taking a stance to win a decision
(that's the POV Brief) and not for shaping a build (that's SHAPE). It produces an update — it **writes
nothing to a source of truth and posts nowhere.**

## What it produces

A stakeholder update from `../../.specify/templates/stakeholder-update-template.md`, progressing
through: `Draft → Drafting → Pressure-tested → Ready to send`. The update leads with a headline
status, groups shipped work into **2–3 user-facing themes**, shows week-over-week metrics (cited) with
plain-language meaning, gives an honest in-flight section with 🟢🟡🔴 indicators and blockers, and
names data gaps loudly.

## Operating principles for this skill (from the Constitution)

1. **Outcomes first, not activity.** Lead with business value and user impact — what changed *for
   people* — never a list of implementation work (Constitution I). "Launched secure login" beats
   "implemented OAuth 2.0 with JWT refresh."
2. **Translate both directions; kill the jargon.** Bridge technical → business so a non-technical
   exec gets it instantly. Use stakeholder verbs (**Launched/Fixed/Improved/Added/Enabled/Reduced**);
   avoid *Implemented/Refactored/Migrated* (Constitution VII).
3. **Evidence ≠ assumptions. Never fabricate a number.** Every metric is cited to the warehouse or
   another source. Warehouse "not authorized" → **link** the re-auth runbook, mark the metric a ⚠
   gap, and proceed without inventing data (Constitution IV).
4. **Honest and balanced.** Surface risk and blockers plainly — no spin. An update that hides an
   at-risk item is a missed escalation, not a tidy report.
5. **Pressure-test before ready (NON-NEGOTIABLE).** Before the update is presented as ready to send,
   check for over-claims, spin, and the least-flattering fair reading (Constitution V).

---

## Flow

### Step 0 — Orient (interruption-safe)

- If resuming, read the thread's resume snapshot first and re-orient in one short block (north star,
  where we are, and the next action). At any pause, write/update the snapshot (`../../foundation/memory/`).

### Step 1 — Frame the update (§1)

- Pin down **who it's for** (leadership / cross-functional / exec), the **period** it covers, and the
  **initiative(s)** in scope. Land a single honest **headline status** (🟢🟡🔴) and the one-line
  outcome at stake. A stakeholder should get the gist from the headline alone.

### Step 2 — Gather the period's signal from connectors (§2, §3) — `before_status` hook

- Pull what actually happened and what the numbers say:
  - **GitHub** — merged PRs, closed issues, releases for the period, each cited `[gh: org/repo#NN]`
    (the raw material to translate, **not** to paste verbatim).
  - **Warehouse** — week-over-week measures `[warehouse: <table>]` (the metrics leg). If it returns
    "not authorized," **link** the re-auth runbook and mark the metric a ⚠ gap — do **not** invent
    numbers.
  - **Customer feedback / Slack / web** — outcomes worth surfacing (a fixed top complaint, a launch
    reaction), each cited.
- Keep raw items tagged with their source; they become themes in the next step, not a PR dump.

### Step 3 — Translate work into themes (§2)

- Group the raw changes into **2–3 user-facing themes** stated as **business value**, not
  implementation. Ten PR titles become two or three things a stakeholder understands.
- Rewrite every line with a **stakeholder verb** and the outcome: "Refactored DB queries with
  indexing" → "**Improved** search speed — results feel near-instant." Quantify **only** where cited
  data backs it; otherwise describe the benefit plainly without a fake number.

### Step 4 — Frame the metrics (§3)

- For each load-bearing metric, show **this period vs last, the change (+/− and %), and a
  plain-language "what it means"** (📈/📉/➡️ and the likely why). Cite the source on every row.
- Connect movement back to the initiative's goal where you can. A metric with no source is a guess —
  it goes to §5 as a gap, never into the table as a number.

### Step 5 — Report in-flight honestly (§4)

- For ongoing work, state **what it enables** (not how it's built), a realistic **🟢🟡🔴 indicator**,
  and a **specific expected date** (with the uncertainty if any). Call out **blockers needing
  leadership attention explicitly** — what decision/help is needed, and by when. Be honest; surface
  risk early (Constitution IV).

### Step 6 — Flag the data gaps (⚠ §5)

- Fill **⚠ §5 Data gaps**: what couldn't be measured this period and why (incl. warehouse re-auth via
  the linked runbook), so no one mistakes a gap for a zero. A named gap is honest; a papered-over one
  with a guessed number is harmful (Constitution IV).

### Step 7 — Pressure-test (§6, NON-NEGOTIABLE)

- **Before** the update is presented as ready to send, run `../../foundation/pressure-test.md`:
  **gaps · risks · honesty check · strongest counter-read · bottom line.** **Steelman the least
  flattering fair interpretation** — would an exec read this as spin? Is any blocker buried? Record
  the result in §6 (Constitution V).

### Step 8 — Hand off (output conventions)

- Present to the operator **minimal-but-loud**, copy-paste ready: lead with the **headline status**, make the
  **themes, the cited metrics, and the ⚠ gaps/blockers impossible to miss**, and keep the whole thing
  to a **~5-minute read.**
- Name the bridges where useful: a theme hiding an open decision → the **POV Brief** (ALIGN) or
  **PRD/Spec Framer** (SHAPE). This skill itself **writes nothing and posts nothing** — no
  confirmation gate needed (like the POV Brief).

---

## Done =

An update where the headline status is honest, shipped work reads as **2–3 user-value themes** (not a
PR dump) in stakeholder language, every metric is cited with its week-over-week change and plain
meaning (or flagged a ⚠ gap, never fabricated), in-flight work is honest with 🟢🟡🔴 and blockers
called out for leadership — pressure-tested for spin, and short enough to read in ~5 minutes.
