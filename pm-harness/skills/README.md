# Skills

> Skills are narrowly-scoped operations on top of the shared foundation. They don't re-implement
> the basics — every skill **inherits** the Constitution, operating profile, output conventions,
> connectors, pressure-test mode, and memory. A skill just defines *its* job and flow.

## What every skill inherits (don't re-state it — reference it)

- **Constitution** — `../.specify/memory/constitution.md` (governing principles).
- **Operating profile** — `../foundation/operating-profile.md` (how the operator thinks).
- **Output conventions** — `../foundation/output-conventions.md` (options+stakes → recommend; cite; flag gaps; minimal-but-loud).
- **Connectors** — `../foundation/connectors/` (5 sources + graceful-failure + never-fabricate).
- **Pressure-test** — `../foundation/pressure-test.md` (devil's-advocate mode).
- **Memory** — `../foundation/memory/` (resume snapshots for interruption).

## The four-phase loop & where skills land

| Phase | Skills | Status |
|-------|--------|--------|
| ① SENSE | **Feedback Curator** · Signal Triage | ✅ this iteration |
| ② SHAPE | **PRD/Spec Framer** · Clarify · Checklist | ✅ built |
| ③ ALIGN | **POV Brief** · **Stakeholder Update** · **Eng Handoff** (writes) | ✅ POV Brief + Stakeholder Update + Eng Handoff built |
| ④ REMEMBER | Constitution · Resume Snapshot | ✅ foundation |

## Catalog

- **[feedback-curator/](feedback-curator/skill.md)** — [SENSE] raw signal → clustered, **weighted (impact × urgency × effort vs. capacity)**,
  ranked triage; top mover hands off to SHAPE. **Built (iteration 2).**
- **[prd-spec-framer/](prd-spec-framer/skill.md)** — [SHAPE] outcomes + intent → a structured,
  evidence-backed, pressure-tested PRD/spec. **Built (iteration 1).**
- **[pov-brief/](pov-brief/skill.md)** — [ALIGN] take and defend a position: triangulated evidence,
  options weighed neutrally, recommendation last, pressure-tested. Read-only. **Built (iteration 2).**
- **[stakeholder-update/](stakeholder-update/skill.md)** — [ALIGN] translate the period's work into an
  executive-friendly update: **2–3 user-value themes** (not a PR dump), cited week-over-week metrics,
  honest 🟢🟡🔴 in-flight + blockers. Read-only. **Built (iteration 2).**
- **[eng-handoff/](eng-handoff/skill.md)** — [ALIGN] **⚠ the write/trust-boundary skill** (distinct
  from the read-only POV Brief / Stakeholder Update): turns a **committed** spec into GitHub issues.
  Verifies Committed status first, then states exactly what will be filed (repo, count, titles) and
  **waits for explicit confirmation before any write** (Constitution VII). **Built (iteration 2).**

*Later:* (ALIGN phase complete — SENSE · SHAPE · ALIGN all built; REMEMBER is foundation.)
