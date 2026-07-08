# Skill: PRD / Spec Framer  ·  Phase ② SHAPE

> Turn an outcome + intent into a **structured, evidence-backed, pressure-tested PRD/spec** — the
> kind the operator can hand to eng or a stakeholder with confidence. Built on spec-kit's `specify` +
> `clarify` + `checklist` primitives, PM-flavored: **lead with outcomes, separate evidence from
> assumptions, flag data gaps, and pressure-test before commit.**

This skill inherits the whole foundation (see `../README.md`) — it does not restate it.

---

## When to use

You have an intent — "I want `<outcome>` for `<user>` because `<why>`" — and need it shaped into
a spec. Anywhere from a vague idea to a half-formed doc. Not for ranking signal (that's SENSE) or
writing the stakeholder update (that's ALIGN).

## What it produces

A spec file from `../../.specify/templates/prd-spec-template.md`, progressing through:
`Draft → Clarifying → Pressure-tested → Committed`, plus a clarify log and a completed checklist.

## Operating principles for this skill (from the Constitution)

1. **Outcomes first, "how" open.** Lead with the win and success criteria; don't pre-solve.
   Tighten into acceptance criteria *progressively* as solutioning advances (Constitution I).
2. **Evidence ≠ assumptions, always separated.** Every claim is cited to a connector or labeled an
   assumption. **Never fabricate.** (Constitution IV.)
3. **Flag data gaps out loud.** Surface what's unknown/unreachable *for* the operator (incl. warehouse
   re-auth) rather than making them find it.
4. **Show, don't tell.** Bias toward a concrete example/sketch/prototype when it lands the intent
   faster than prose (leadership preference).
5. **Pressure-test before commit (NON-NEGOTIABLE).** Devil's-advocate pass runs before Status =
   Committed (Constitution V).

---

## Flow

### Step 0 — Orient (interruption-safe)

- If resuming, read the thread's resume snapshot first and re-orient in one short block (north star,
  where we are, and the next action). At any pause, write/update the snapshot (`../../foundation/memory/`).

### Step 1 — Capture the outcome (§1)

- Restate the operator's intent as: **the win** (customer/business change, not a feature), **why now**,
  **who it's for**, **out of scope**. Confirm you've got the outcome right before gathering evidence.

### Step 2 — Gather evidence from connectors (§2) — `before_specify` hook

- Pull supporting signal relevant to the outcome:
  - **Customer feedback** — real pain, quoted + cited `[customer-feedback: …]`.
  - **Warehouse** — size/impact metrics `[warehouse: <table>]`. If it returns "not authorized,"
    **surface the re-auth runbook** and mark the data leg a gap — do **not** invent numbers.
  - **GitHub / Slack / web** — related issues, discussion, prior art, each cited.
- Keep everything pulled in **§2 Evidence**, each line carrying its source tag.

### Step 3 — Separate assumptions & flag gaps (§3, §4)

- Move every uncited inference into **§3 Assumptions** — never let it masquerade as evidence.
- Fill **⚠ §4 Data gaps**: what's unknown, what was unreachable + its fix, and what conclusion each
  gap leaves unsupported. (Triangulation honesty — Constitution II.)

### Step 4 — Draft stories & success criteria (§5, §6)

- Prioritized user stories (P1 alone = a meaningful slice), each with **testable** Given/When/Then
  acceptance scenarios.
- **Measurable, tech-agnostic success criteria** tied back to §1. Unmeasurable → `[NEEDS CLARIFICATION]`.
- Add a **show-don't-tell** artifact (§8) when useful.

### Step 5 — Clarify the gaps (`/clarify`) — `before_clarify` hook

- Pull answers from sources where possible; only ask the operator what data can't settle.
- Ask **one question at a time**, neutrally, **with the stakes of each answer**, so they decide.
- Fold each decision back into the spec; log it. Unresolved → stays an explicit marker.

### Step 6 — Pressure-test (§9, NON-NEGOTIABLE)

- Run `../../foundation/pressure-test.md`: **gaps · risks · edge cases · strongest counter-argument ·
  bottom line.** Be a sharp partner, not contrarian — the job is to make it stronger.
- Record the result in §9.

### Step 7 — Checklist gate (`/checklist`)

- Run the pre-commit checklist. Any unchecked box is a **finding** surfaced loudly, ranked.
- Verdict: **Ready to commit**, or **resolve findings first** (the short list).

### Step 8 — Present to the operator (output conventions)

- Lead with **what needs their attention and why** (minimal-but-loud).
- Where choices remain, show **options neutrally with stakes, then a recommendation at the end.**
- Make the **evidence/assumption split and ⚠ data gaps** impossible to miss.
- If committing and heading to eng: name the **handoff bridge** and flag that filing issues is a
  write-to-source-of-truth needing explicit confirmation (`../../.specify/commands/eng-handoff.md`).

---

## Done =

A spec where the outcome leads, every claim is cited or labeled an assumption, gaps are explicit
and unfabricated, stories/criteria are testable, and the pressure-test + checklist have run — ready
to commit or with a clear short list of what to resolve first.
