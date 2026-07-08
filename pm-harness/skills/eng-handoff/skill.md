# Skill: Eng Handoff  ·  Phase ③ ALIGN

> Turn a **committed spec** into engineering work — "the spec is ready; file the issues so eng can
> build it." The harness's **one write-capable skill**: it can create GitHub issues, a write to a
> source of truth. So its core is **not** drafting — it's the **confirm-before-write trust boundary**
> (Constitution VII). It explains exactly what will be created, offers alternatives, and **waits for
> the operator's explicit confirmation** before anything is filed. Distinct from the read-only POV Brief
> (takes a position) and Stakeholder Update (reports status): this one **acts on the world.**

This skill inherits the whole foundation (see `../README.md`) — it does not restate it.

---

## When to use

You have a spec you're ready to **hand to engineering** — "file the issues," "turn this spec into
issues," "hand this off to eng," "get this into the build queue." The job is to translate the
committed outcome into eng-ready issues **and** to cross the trust boundary safely: nothing gets
filed until you've seen exactly what will be created and said yes. Not for shaping the spec itself
(that's SHAPE / the PRD-Spec Framer) and not for an exec update (that's the Stakeholder Update).
Unlike every other skill, this one **writes to a source of truth** — so the confirm gate is the
feature, not a formality.

## What it produces

A handoff artifact from `../../.specify/templates/eng-handoff-template.md`, progressing through:
`Draft → Pre-write (awaiting confirm) → Filed`. It restates the committed outcome + success
criteria, translates them into a plan/tasks (the bridge to spec-kit's `plan`/`tasks`), and lands on
an explicit **pre-write confirm block** — repo, issue count, exact titles + one-line bodies,
alternatives, and a Y/N gate. After an explicit yes, it states the exact write it would run and
(post-filing) summarizes what was created with links so the operator can read back and verify.

## Operating principles for this skill (from the Constitution)

1. **Confirm before any write (NON-NEGOTIABLE, the heart of this skill).** Filing issues is a write
   to a source of truth. Before anything is created, explain **exactly what will happen** — repo,
   count, titles — that it's **visible to others and not trivially undone**, lay out alternatives,
   and **wait for explicit confirmation.** Never file silently; never treat implied approval as a
   yes (Constitution VII).
2. **Precondition gate — only committed specs cross.** The handoff requires a spec at Status =
   **Committed** (passed /clarify, /checklist, pressure-test; evidence/assumptions split; ⚠ data
   gaps explicit). An uncommitted spec is refused and routed back to SHAPE — no write is even
   offered (Constitution V).
3. **Translate both directions.** Restate the committed outcome + success criteria in plain terms so
   the operator stays oriented without reading code, and translate them into the eng plan/tasks the issues
   will carry (Constitution VII).
4. **Never fabricate.** No invented issue numbers, links, or "filed!" confirmations. In any dry /
   validation context, **describe** the call that would run rather than executing it; report only
   what actually happened (Constitution IV).
5. **Outcomes first.** Issues lead with the user/business outcome and success criteria, not an
   implementation checklist — eng inherits the *why*, not just the *what* (Constitution I).

---

## Flow

### Step 0 — Orient (interruption-safe)

- If resuming, read the thread's resume snapshot first and re-orient in one short block (north star,
  where we are, and the next action). At any pause, write/update the snapshot (`../../foundation/memory/`).

### Step 1 — Precondition gate: is the spec Committed? (§1, NON-NEGOTIABLE)

- Verify the spec is **Committed**: it passed **/clarify**, **/checklist**, and the **pressure-test**;
  evidence and assumptions are separated; ⚠ data gaps are explicit (Constitution V; the preconditions
  in `../../.specify/commands/eng-handoff.md`).
- If it is **not** committed, **refuse the handoff.** Name exactly what's missing (e.g. "no checklist
  pass," "pressure-test not run," "open clarifications") and route back to the **PRD/Spec Framer**
  (SHAPE). **Do not proceed to any write, and do not even offer the write path.**

### Step 2 — Refresh GitHub state (§2) — `before_eng_handoff` hook

- Run the existing `before_eng_handoff` hook (`../../.specify/extensions.yml`) to pull current
  issues/PRs/projects so the handoff attaches to **current** state (e.g. don't duplicate an issue
  that already exists). This hook is **read-only** — it refreshes context; it does **not** file
  anything. Filing is gated by confirmation below, not by the hook.

### Step 3 — Translate outcome → plan / tasks (§3)

- Restate the committed **outcome + success criteria** in plain language, then translate them into
  the eng **plan/tasks** the issues will carry — the bridge to spec-kit's `plan` and `tasks`
  (`../../.specify/commands/eng-handoff.md`). Keep it outcome-led so the operator stays oriented without
  reading code (Constitution I, VII). Each task becomes a candidate issue in the next step.

### Step 4 — Pre-write disclosure (§4, MANDATORY — the heart of the skill)

- **Before anything is filed,** state **exactly** what will be created:
  - **which repo** (e.g. `org/repo`),
  - **how many** issues,
  - the **exact title** of each, plus a **one-line body** each,
  - and explicitly that these will be **visible to others and not trivially undone.**
- This is the consequence half of the consequence-and-confirm gate (Constitution VII). No vague
  "I'll file some issues" — the operator sees the precise blast radius first.

### Step 5 — Offer alternatives (§4)

- Lay out the real choices, neutrally:
  - **Draft-for-review first** — write the issue bodies into the handoff artifact for the operator to edit
    before any are filed (safer, slower), vs.
  - **File directly** — create them now as listed (faster, immediately public).
- State the stakes of each so they pick with eyes open (output conventions §1).

### Step 6 — Wait for explicit confirmation (§4, NON-NEGOTIABLE)

- **Never file silently.** Wait for an **explicit, specific** yes ("yes, file all 4 in `org/repo`").
- **Implied or ambiguous approval is NOT confirmation** — "just get it into the queue," "you know
  what to do," "sounds good" do **not** authorize a write. On anything less than an explicit yes,
  **re-surface the consequence-and-confirm prompt** (repo, count, titles, "visible / not trivially
  undone", Y/N) and keep waiting. The default is **don't write.**

### Step 7 — State the exact write path (§5)

- Only on an explicit yes: state the **exact write** it would invoke — spec-kit's `taskstoissues`,
  or `gh issue create` per task with the listed titles/bodies and target repo.
- **In any dry / validation / "don't actually create" context, DESCRIBE the call — do not execute
  it.** Say precisely what *would* run; file nothing; invent no issue numbers or links
  (Constitution IV).

### Step 8 — Post-write read-back (§6)

- After a real filing, summarize **what was actually created**: each issue's title and **link**
  `[gh: org/repo#NN]`, so the operator can **read back and verify**. Update the resume snapshot to "Filed"
  with the links. Report only what truly happened — if a create failed, say so; never paper over it
  with a fabricated success.

---

## Done =

The spec's Committed status was verified first (or the handoff was refused with exactly what's
missing, routed back to SHAPE, and no write offered); GitHub state was refreshed read-only; the
committed outcome + success criteria were translated into eng plan/tasks; and — the core — **nothing
was filed until the operator saw exactly what would be created (repo, count, exact titles + one-line
bodies, "visible / not trivially undone"), was offered draft-first vs. file-directly, and gave
explicit confirmation.** Implied approval never triggered a write; in any dry context the call was
described, not executed; and a real filing ended with verifiable links read back to them — no
fabricated issues, numbers, or confirmations.
