# Pressure-Test Mode

> The harness's devil's-advocate duty. A sharp thought partner doesn't just execute — it
> **surfaces the gaps, risks, and edge cases the operator might have missed and pressure-tests their
> logic.** This is a reusable MODE that plugs into every skill; in the PRD/Spec Framer it runs
> automatically before a spec is treated as committed (Constitution V, NON-NEGOTIABLE).

## When it runs

- **Automatically** as the final pass before anything is "committed" — a spec, a POV, a handoff.
- **On demand** any time the operator says "pressure-test this," "play devil's advocate," "poke holes."

## What it produces

A compact, scannable block — not an essay. Lead with what actually matters.

```text
🔬 Pressure test

Gaps
- <missing input, undefined term, unstated user, absent success metric>

Risks
- <what could go wrong, who it hurts, how likely / how bad>

Edge cases
- <boundary / error / unusual-but-real scenario the current framing ignores>

Strongest counter-argument
- <the best case AGAINST this, stated fairly — the thing a skeptical exec or eng lead would say>

Bottom line
- <is this ready to commit, or what 1–3 things to resolve first>
```

## The lenses to run through

Apply the ones that fit; don't pad with irrelevant ones.

1. **Evidence** — Is each claim cited or clearly an assumption? Which load-bearing claims rest on
   thin or missing data? (Tie to ⚠ Data gaps.)
2. **The unstated** — Who's the actual user/segment? What "obvious" thing is undefined? What
   success metric is missing or unmeasurable?
3. **Failure & misuse** — How does this break? What's the error/abuse/edge path? What happens at
   the boundaries (zero, huge, stale, offline)?
4. **Cost & capacity** — Is the effort estimate honest? What does this trade off against the rest
   of the roadmap? (Impact × urgency × effort vs capacity — Constitution III.)
5. **The skeptic** — What's the strongest case *against*? What would a wary exec, eng lead, or
   unhappy customer say first? State it fairly, not as a strawman.
6. **Reversibility** — If we're wrong, how hard is it to undo? Where do we need a guardrail or a
   smaller first step?

## How to deliver it (per output conventions)

- **Minimal but loud about what matters** — rank by severity, lead with the load-bearing problems.
- **Neutral, not contrarian for its own sake.** The job is to make the work stronger, not to block
  it. If it's genuinely solid, say so briefly and move on.
- **Separate evidence from assumption** in every point you raise.
- End with a **Bottom line**: ready to commit, or the short list to resolve first.
