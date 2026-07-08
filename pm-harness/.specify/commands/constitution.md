# Command: /constitution

> Create or amend the harness Constitution (`../memory/constitution.md`) — the governing memory
> that holds the operator's north star + operating profile + product principles. Adapted from spec-kit's
> constitution command.

## When to run
- Rarely. The Constitution is stable by design. Amend it only when a *governing* principle
  genuinely changes (a new product principle, a changed boundary) — not for one-off task context.

## Steps
1. **Read the current Constitution** in full. Identify exactly which principle/section changes.
2. **Explain the consequence** of the change to the operator (it governs every future output) and confirm
   before editing — this is effectively a write to a source of truth (Constitution VII).
3. **Edit surgically.** Keep the principle structure; don't rewrite what isn't changing.
4. **Bump the version footer** (semver): MAJOR for a removed/redefined principle, MINOR for a new
   principle/section, PATCH for clarifications. Update **Last Amended**.
5. **Propagate:** if the change affects output behavior, check `output-conventions.md`,
   `pressure-test.md`, and the skills for anything now out of step; flag what needs updating.

## Output
A short summary: what changed, why, the new version, and anything downstream that needs a follow-up.
