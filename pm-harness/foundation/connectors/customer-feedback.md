# Connector: Customer Feedback

**Status:** connected. **Use for:** customer pain signal — the "customer" leg of triangulation
(Constitution II).

## Sources

1. **Live repo:** `github/customer-feedback` (reach via the GitHub connector / `gh`).
2. **Local structured corpus:** `~/.copilot/repos/customer-feedback/` — a working copy with
   curated structure:
   - `data/issues/` — the raw/structured feedback items.
   - `pm-response-log/` — how PM has responded to feedback (precedent, tone, commitments).
   - `high-priority-feedback-reports/` — already-curated high-priority synthesis.

## Quick check

```bash
ls ~/.copilot/repos/customer-feedback/data/issues | head
ls ~/.copilot/repos/customer-feedback/high-priority-feedback-reports
```

## What to pull it for

- **SENSE:** cluster and weight recurring pain (impact × urgency × effort).
- **SHAPE (PRD/Spec Framer):** supporting evidence for an outcome — real customer quotes/items,
  cited.
- **ALIGN:** the customer-pain backbone of a POV or stakeholder update.

## Using it well

- **Quote real items, cite them** (`[customer-feedback: data/issues/<id>]` or `[gh: github/customer-feedback#NNN]`).
- Check `pm-response-log/` before proposing a stance — there may be existing precedent or commitments.
- Prefer `high-priority-feedback-reports/` when you need an already-curated rollup rather than raw items.

## Graceful failure

- Local corpus path missing → fall back to the live repo via `gh`; if neither is reachable, flag
  "no customer-feedback access" and mark the customer leg of any POV as a ⚠ Data gap. Never invent
  customer quotes or volumes.
