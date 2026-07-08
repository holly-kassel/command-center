# Command: /specify

> Turn an outcome + intent into a structured PRD/spec using the PM-flavored spec template.
> Adapted from spec-kit's specify command. This is the spine of the **PRD/Spec Framer** skill
> (`../../skills/prd-spec-framer/skill.md`) — see it for the full PM flow.

## Input
The operator's outcome/intent in natural language ("I want <outcome> for <user> because <why>").

## Steps
1. **Run the `before_specify` hook** (`../extensions.yml`) — pull supporting evidence from the
   connectors (customer feedback, warehouse, GitHub, Slack, web) relevant to the outcome.
2. **Open `../templates/prd-spec-template.md`** and fill top-down:
   - §1 Outcome & intent first — the win, why now, who for, out of scope. Leave "how" open.
   - §2 Evidence — cite every pulled fact with its source tag.
   - §3 Assumptions — kept **separate** from evidence.
   - §4 ⚠ Data gaps — what's unknown/unreachable (incl. warehouse re-auth if it fired).
   - §5–7 stories (prioritized, testable acceptance), measurable success criteria, open questions
     as `[NEEDS CLARIFICATION]`.
3. **Don't over-tighten early.** Lower sections can stay rough; they firm up via /clarify.
4. **Hand to /clarify** for the open questions, then /checklist + pressure-test before commit.

## Output
A draft spec file, Status = Draft, with evidence/assumptions cleanly separated and gaps flagged.
