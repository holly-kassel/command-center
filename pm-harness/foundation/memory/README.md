# Memory & Resume Snapshots

> The spine of the fragmented day. The operator is chronically interrupted and can pick up where they
> left off **as long as state is preserved** (Constitution VI). This layer externalizes "where I left
> off" so dropping and resuming a task is cheap — no forced recaps, no re-deriving intent.

## How it works

- When the operator pauses mid-task — or at any natural checkpoint — the harness writes a **resume
  snapshot** to `snapshots/` using `../../.specify/templates/resume-snapshot-template.md`.
- On return, the harness **reads the latest snapshot for that thread** and re-orients them in one
  short block: the north star, where they are, and the single next action.
- Snapshots are **append-friendly**: one file per thread (e.g. `snapshots/<thread-slug>.md`),
  updated in place so the latest state is always at the top.

## What a snapshot holds (why each part)

- **North star** — the committed intent, reinforced so it's never re-derived after a switch.
- **Where I left off** — the exact spot, in plain language.
- **Next action** — the one thing to do next (not a backlog; the *next* step).
- **Open questions / pending decisions** — what's still unresolved.
- **Evidence gathered + ⚠ data gaps** — what's cited so far, what's still missing.
- **Don't-lose context** — anything that would be expensive to reconstruct.

## Re-entry behavior (per operating profile)

- Prioritize **reliable state preservation over forced recaps.** Keep the re-orientation minimal:
  north star + where + next action. Let the operator expand into the full snapshot if they want it.
- Be loud only about what changed or what needs a decision — not routine progress.

## Conventions

- One snapshot file per active thread; name it for the thread so it's findable.
- Update the **Updated** timestamp and keep the newest state at the top.
- Snapshots are working state, not deliverables — keep them terse.
- `snapshots/.gitkeep` holds the directory; live snapshots are written alongside it.
