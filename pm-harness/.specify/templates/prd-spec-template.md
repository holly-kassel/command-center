# PRD / Spec: [FEATURE NAME]

**Thread**: `[short-slug]`  ·  **Created**: [DATE]  ·  **Status**: Draft → Clarifying → Pressure-tested → Committed

> PM-flavored adaptation of spec-kit's spec template. Leads with **outcomes**, keeps **evidence and
> assumptions separate**, flags **data gaps**, and ends with a **pressure-test** before commit.
> Fill top-to-bottom; it's fine to leave lower sections rough early and tighten them as solutioning
> progresses (Constitution I).

---

## 1. Outcome & intent *(mandatory, lead here)*
**The win:** [the outcome in one sentence — the change for the customer/business, not the feature].
**Why now:** [urgency — what makes this matter at this moment].
**Who it's for:** [the user / segment].
**Out of scope:** [what this is explicitly NOT, so the edges are clear].

> Leave the "how" open here. Solutions come after the outcome and evidence are agreed.

## 2. Evidence *(cited — never fabricated)*
What we actually know, each line carrying its source tag.
- **Customer pain:** [quote/item] `[customer-feedback: …]`
- **Data:** [number/measure] `[warehouse: <table>]`
- **GitHub/discussion:** [signal] `[gh: org/repo#NN]` / `[slack: #channel]`
- **External:** [prior art/context] `[web: domain]`

## 3. Assumptions *(NOT evidence — kept separate on purpose)*
Reasonable defaults chosen where evidence is absent. Each is a thing we'd want to confirm.
- [assumption about users / scope / environment]
- [assumption …]

## ⚠ 4. Data gaps
What we don't know yet and how it weakens the case. (If a source was unreachable, say so + the fix.)
- [gap — and what conclusion it leaves unsupported]

## 5. User stories *(prioritized; each independently valuable)*
### Story 1 — [title] (P1)
[plain-language journey]
**Why this priority:** [value]
**Acceptance scenarios:**
1. **Given** [state], **When** [action], **Then** [outcome]
2. **Given** …, **When** …, **Then** …

### Story 2 — [title] (P2)
[…] **Acceptance scenarios:** 1. **Given**/ **When**/ **Then** …

> Add stories as needed. P1 alone should still deliver a meaningful slice.

## 6. Success criteria *(measurable, technology-agnostic)*
- **SC-001**: [measurable outcome, e.g. "X% of users complete … in under N min"]
- **SC-002**: [business/satisfaction metric]
> Tie each back to the Outcome in §1. If a criterion can't be measured, mark it `[NEEDS CLARIFICATION]`.

## 7. Open questions
- `[NEEDS CLARIFICATION: …]` — resolved via the Clarify pass (see clarify-template.md).

## 8. Show-don't-tell *(optional but encouraged)*
[link/sketch/example/prototype that makes the intent concrete — leadership bias toward this].

---

## 🔬 9. Pressure test *(mandatory before Status = Committed)*
Run `pm-harness/foundation/pressure-test.md`. Summarize here:
- **Gaps:** […]
- **Risks:** […]
- **Edge cases:** […]
- **Strongest counter-argument:** […]
- **Bottom line:** [ready to commit, or the 1–3 things to resolve first]

---

## 10. Handoff *(when committed)*
Ready for the **Engineering handoff bridge** (`../commands/eng-handoff.md`) → spec-kit's real
`plan` / `tasks` / `implement` / `taskstoissues` for prototyping. Filing issues is a write to a
source of truth — confirm consequences first (Constitution VII).
