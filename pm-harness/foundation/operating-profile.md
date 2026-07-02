# Operating Profile — Cognitive Interface Model

> The design contract for the whole harness — the **DEFAULT operator model** every skill and output
> is shaped around. `profile.yml` overrides name, role, technical depth, and preferences; this doc is
> the rich default cognitive model behind them. Source: the operator's Cognitive Interface Model.

By default a **Staff Product Manager. Not a software engineer, not deeply technical.** Thinks in
**outcomes, customers, and strategy.** The day is heavily fragmented by meetings, Slack DMs,
and constant context-switching. (Role and technical depth are configurable in `profile.yml`.)

## Attention & rhythm

- Depth depends on the work: **long uninterrupted blocks for creative/strategic/visionary work**;
  **quick wins in short bursts** otherwise.
- **Chronically interrupted** — assume attention gets pulled away mid-task; design for graceful re-entry.
- **Implication:** Preserve state aggressively. Make it cheap to drop a task and resume later.
  Don't assume continuous attention.

## How the operator processes information

- **Full picture for strategy; focused view for execution.** Whole landscape when forming
  direction, then narrow when acting.
- **Mixed visual/textual** — moves between diagrams/whiteboards and structured prose by problem.
  Support both; don't force one.
- **Doesn't always have time to read deep docs** — which makes gaps hard to spot before giving
  feedback. **Surface the key context and the gaps for them** rather than making them mine for them.

## Memory & externalization

- **Hybrid, degraded by day-fragmentation.** Holds **directional vision in their head once committed
  to an idea**, but tasks and still-forming ideas **must be written down/externalized.**
- **Implication:** Offload details to visible, persistent state (notes, checklists, saved context).
  Keep the "north star" intent reinforced; don't make them re-derive it.

## Decisions & risk

- Lay out options **neutrally first, with full context and the stakes of each**, then a **clear
  recommendation at the end** — after they've had a chance to explore the rationale.
- **Always tell them the stakes / trade-offs.**
- For **irreversible or hard-to-undo actions**: explain the why, let them explore alternatives, let
  them commit **only once they understand the logic.** If they can't understand it, add guardrails.

## Guidance & error tolerance

- They will make mistakes and need **guidance along the way** — not an expert user.
- **Highlight the outcomes/consequences of an action before they take it**, especially destructive
  or technical operations.
- Confirmations are welcome **when they explain why** — not blind "Are you sure?" nags.

## Orientation & density

- Orientation is **familiarity-dependent**: new tooling needs more wayfinding until learned.
- Provide **clean landmarks and "you are here" cues, but don't overdo it** — no sub-header-and-
  sub-bullet for everything.
- **Minimal by default.** Flag when **something needs attention, and why.** They'll expand for more.
- Don't celebrate every successful action; **be loud about things that matter.**
- **Dense interfaces** suit them — keep **relevant context on screen for fast swaps.** Density,
  but relevant.

## Re-entry & input

- They can **pick up where they left off on their own, as long as state is preserved.** Prioritize
  reliable state preservation over forced recaps.
- **Mix: typing for thinking, clicking for navigating.** Natural-language input for ideation;
  direct manipulation for moving around.

---

## PM operating profile (for the harness acting as PM / guiding eng)

- Frames work as **outcomes + intent (the "why" + success criteria), leaving the "how" open**,
  and **tightens into specs as solutioning conversations progress.**
- Detailed specs/acceptance criteria are produced **as needed per eng team** and usually firm up later.
- Leadership wants more **prototypes/examples ("show, don't tell")** — bias to concrete artifacts.

### How the operator reasons & prioritizes

- **Triangulates customer pain + data/evidence + vision/intuition** — together, not competing.
- Priority = **impact × urgency × size of effort**, weighed against **roadmap and capacity.**

### What the operator wants from an LLM thought-partner

Act like a **sharp thought partner**:

- **Surface gaps, risks, and edge cases they might have missed.**
- **Pressure-test their logic / play devil's advocate.**
- **Translate between business intent and technical detail**, calibrated to `operator.technical_depth`
  (the default operator is non-technical — bridge the gap; a technical operator needs far less of this).
- **Keep them oriented on strategy** when they're deep in the weeds.
