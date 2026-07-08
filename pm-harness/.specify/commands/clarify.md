# Command: /clarify

> Resolve a spec's open questions and unstated assumptions through structured Q&A *before* commit.
> Adapted from spec-kit's clarify command. Uses `../templates/clarify-template.md`.

## Steps
1. **Gather** the `[NEEDS CLARIFICATION]` markers from the spec's §7 plus any unstated assumptions
   the pressure-test surfaced.
2. **Run the `before_clarify` hook** (`../extensions.yml`) — if a question could be answered by a
   source (e.g. "how many accounts?" → warehouse), pull it instead of asking the operator.
3. **Rank** remaining questions by leverage (what most changes outcome/scope first).
4. **Ask one at a time**, neutrally, each with **the stakes of each answer** so the operator decides rather
   than guesses. Offer neutral options where they exist.
5. **Fold each decision back into the spec** — as evidence, assumption, or a scope edge — and log it.
6. Anything still unresolved stays an explicit `[NEEDS CLARIFICATION]` — never silently dropped.

## Output
An updated spec with markers resolved, plus a clarify log of questions → stakes → decisions.
