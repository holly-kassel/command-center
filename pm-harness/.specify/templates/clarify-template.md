# Clarify Log: [FEATURE NAME]

**Thread**: `[short-slug]`  ·  **Date**: [DATE]

> Structured Q&A *before* commit — spec-kit's clarify primitive, PM-flavored. The harness asks the
> highest-leverage questions one at a time, neutrally, with the stakes of each answer. Goal: resolve
> the `[NEEDS CLARIFICATION]` markers and unstated assumptions before a spec is treated as committed.

## How to run it
1. Pull the open questions from the spec's §7 and any unstated assumptions the pressure-test found.
2. **Rank** by leverage — ask what most changes the outcome/scope first.
3. Ask **one question at a time**, each with **why it matters / the stakes of each answer** (so the
   operator decides, not guesses). Offer neutral options where they exist.
4. Record the decision and **fold it back into the spec** (evidence, assumption, or scope edge).

## Log
| # | Question | Why it matters / stakes | Decision | Folded into spec? |
|---|----------|-------------------------|----------|-------------------|
| 1 | [q] | [stakes of each answer] | [operator's call] | §[n] ✅ |
| 2 | [q] | [stakes] | [decision] | §[n] |

## Still open
- [anything unresolved → stays a `[NEEDS CLARIFICATION]` in the spec, not silently dropped]
