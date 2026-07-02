# Pre-Commit Checklist: [FEATURE NAME]

**Thread**: `[short-slug]`  ·  **Date**: [DATE]

> The quality gate before a spec is committed or handed off — spec-kit's checklist primitive,
> PM-flavored. If any box can't be checked, it's a finding, not a formality. Surface unchecked
> items loudly (output conventions §3).

## Outcome & framing
- [ ] Outcome stated as a customer/business change, not a feature (§1).
- [ ] "Why now" / urgency is explicit.
- [ ] User/segment named; out-of-scope edges drawn.

## Evidence & honesty
- [ ] Every load-bearing claim is **cited** or **labeled an assumption** — none blurred.
- [ ] Evidence triangulates where it can (customer + data + vision); thin legs noted.
- [ ] **⚠ Data gaps** section is filled — nothing fabricated to cover a hole.
- [ ] Any unreachable source (e.g. warehouse re-auth) is flagged with its fix.

## Specification quality
- [ ] User stories prioritized; P1 alone delivers a meaningful slice.
- [ ] Acceptance scenarios are testable (Given/When/Then).
- [ ] Success criteria are measurable and tech-agnostic; unmeasurable ones marked `[NEEDS CLARIFICATION]`.
- [ ] Open questions captured (not silently dropped).

## Pressure test (NON-NEGOTIABLE)
- [ ] Devil's-advocate pass run (§9): gaps, risks, edge cases, strongest counter-argument.
- [ ] Bottom line recorded: ready to commit, or the short list to resolve first.

## Handoff readiness
- [ ] If proceeding to eng: handoff bridge identified; any issue-writing flagged as a
      write-to-source-of-truth needing explicit confirmation (Constitution VII).

**Gate result:** ☐ Ready to commit  ·  ☐ Resolve findings first → [list]
