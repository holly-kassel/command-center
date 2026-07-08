# Command: /eng-handoff — the bridge to the real engineering loop

> When a spec is committed and ready to **prototype or build**, this is the labeled doorway from the
> PM harness into spec-kit's genuine engineering loop. We hand-vendored the PM side (Option A) and
> deliberately did **not** pre-install the code-heavy steps — this bridge pulls them at the moment
> you need them, so the daily PM surface stays clean.

## Preconditions
- The spec has passed **/clarify**, **/checklist**, and the **pressure-test** (Status = Committed).
- Evidence and assumptions are separated; ⚠ data gaps are explicit.

## What this bridge does
1. **Confirms readiness** and re-states the outcome + success criteria from the spec.
2. **Pulls spec-kit's real loop** when prototyping is wanted. Upstream: `github/spec-kit`,
   `templates/commands/`. The genuine steps, in order:
   - `plan` — turn the committed spec into a technical plan.
   - `tasks` — break the plan into concrete build tasks.
   - `analyze` / `implement` — stand up the prototype.
   - `taskstoissues` — convert tasks into GitHub issues for an eng team.
3. **Translates** between the spec's outcomes and the eng plan's "how" in both directions
   (Constitution VII) — the operator stays oriented without reading code.

## ⚠ Trust boundary — writes to a source of truth
`taskstoissues` (and anything that **files or edits GitHub**) is a **write to a source of truth.**
Before any of it runs:
- Explain **exactly what will be created** (which repo, how many issues, titles), and that it's
  visible to others and not trivially undone.
- Lay out alternatives (e.g. draft the issues for review first vs. file directly).
- **Wait for the operator's explicit confirmation.** Never file silently.

> The full issue-writing **Eng Handoff skill** (with the confirm-and-file flow built in) lives at
> `../../skills/eng-handoff/skill.md`. This bridge documents the path into spec-kit and enforces the
> trust boundary; the skill runs the precondition gate, the pre-write disclosure, and the explicit
> confirm-before-file flow.

## Output
A short handoff summary: the committed outcome, the eng steps to run, and — if issues are to be
filed — the explicit consequence-and-confirm prompt before anything is written.
