# Connectors

> The harness's five wired sources of truth (plus Microsoft 365, scaffolded). SENSE and ALIGN both
> pull from here. In iteration 1 these are **documented capabilities + usage runbooks** (how to reach
> each source, what lives there, and how to fail gracefully) — not executable scripts. They're injected
> into the spec-kit loop through `../../.specify/extensions.yml` hooks so skills get evidence without
> forking spec-kit.

## The sources

| # | Connector | Use for | Mode | Doc |
|---|-----------|---------|------|-----|
| 1 | **GitHub** | issues, PRs, projects, discussions | read (+ gated write via Eng Handoff) | [github.md](github.md) |
| 2 | **Customer feedback** | the feedback corpus + PM response log | read | [customer-feedback.md](customer-feedback.md) |
| 3 | **Slack** | threads, channels, people | read | [slack.md](slack.md) |
| 4 | **Web research** | public, external context | read (public only) | [web-research.md](web-research.md) |
| 5 | **Data warehouse** | quantitative metrics (Kusto / `canonical`) | read | [data-warehouse.md](data-warehouse.md) |
| 6 | **Microsoft 365** | Office artifacts — Word, Excel, Outlook, OneDrive, SharePoint | read + **gated draft-first write** · **scaffold (not yet wired)** | [microsoft365.md](microsoft365.md) |

> **Microsoft 365 is the only read-*and*-write connector besides GitHub, and its write is gated even
> more tightly:** content is always drafted locally and refined first, then promoted to M365 only on the
> operator's explicit permission, with extra caution for shared SharePoint/Teams spaces vs. the
> operator's own OneDrive. See [microsoft365.md](microsoft365.md). It is **scaffolded, not yet wired** —
> until an MCP server is configured it reads as unreachable and the harness degrades gracefully.

## Governing policy — graceful failure & never fabricate

This policy is **non-negotiable** and inherited from the Constitution (Principle IV).

1. **A source is reachable, or it isn't — say which.** If a connector errors, times out, or needs
   re-auth, **state that plainly and flag the gap.** Never quietly skip it.
2. **Never fabricate to cover a gap.** Do not invent numbers, quotes, issue IDs, or trends when a
   source is unreachable. A flagged ⚠ Data gap is always better than a fake fact.
3. **Cite everything that *is* reachable.** Each pulled fact carries its source tag (see
   `../output-conventions.md` §2).
4. **Degrade, don't halt.** If one source is down, proceed with the others and clearly mark what's
   missing and how it weakens the conclusion (e.g. "no quantitative leg — POV rests on customer +
   vision only," per triangulation, Constitution II).
5. **Consent where required.** Slack private/DM search needs the operator's per-use consent (see slack.md).
6. **Re-auth is surfaced, not worked around.** Especially the warehouse — see its runbook.
7. **M365 writes are draft-first, promote-on-permission.** Office docs are drafted locally and refined
   first, then written to Microsoft 365 only on the operator's explicit permission — with extra caution
   for shared SharePoint/Teams spaces vs. the operator's own OneDrive (see microsoft365.md).

## Failure-message shape

When a source can't be reached, surface it like this — short, with the fix and the impact:

```text
⚠ Data gap — <source> unreachable
  Why: <e.g. warehouse token expired / "not authorized to read database">
  Fix: <the exact step the operator can take, e.g. the az login command>
  Impact: <what this conclusion is missing without it>
```
