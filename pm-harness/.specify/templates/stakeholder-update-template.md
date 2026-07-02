# Stakeholder Update: [INITIATIVE / AUDIENCE]

**Thread**: `[short-slug]`  ·  **Period**: [DATE → DATE]  ·  **Status**: Draft → Drafting → Pressure-tested → Ready to send

> Executive-friendly **ALIGN** artifact: translates the week's work into **business value**, not
> implementation. Outcomes first, no jargon, honest about in-flight work and blockers. Read-only:
> this drafts an update; it posts nothing. Aim for a **~5-minute read.** Fill top-to-bottom
> (Constitution I, IV; output conventions §1–§3).

---

## 1. Headline *(mandatory, lead here)*

**Overall:** 🟢 On track | 🟡 At risk | 🔴 Blocked — [one plain sentence on where this initiative stands].
**Why it matters:** [the outcome / user-or-business value at stake this period].

> Lead with the outcome and a single honest status. A busy exec should get the gist from this line alone.

## 2. What shipped *(2–3 user-facing themes — NOT a PR dump)*

Group related changes into **2–3 themes** stated as **user/business value.** Use stakeholder-friendly
verbs — **Launched / Fixed / Improved / Added / Enabled / Reduced** — never *Implemented / Refactored /
Migrated*. Quantify impact **only where data exists** (cite it); otherwise describe the benefit plainly.

- **[Theme — the user outcome]:** [what changed, in plain language] [cite source if a number is used]
- **[Theme — the user outcome]:** [what changed, in plain language]
- **[Theme — the user outcome]:** [what changed, in plain language]

> Translate, don't transcribe: "Refactored DB queries with indexing" → "Made searches feel
> near-instant." Three themes a stakeholder understands beat ten PR titles they don't.

## 3. Metrics *(week-over-week — cited, never fabricated)*

Each row carries its source. Show the **change + a plain-language "what it means."** No source → leave
a loud ⚠ gap (§5); never invent a number.

| Metric | This period | Last period | Change | What it means |
|--------|-------------|-------------|--------|---------------|
| [name] | [value] `[warehouse: <table>]` | [value] | [+/- N · ±N%] | [plain meaning — 📈/📉/➡️ and the likely why] |

> A metric with no source is a guess. If the warehouse is unreachable, the row goes to §5 as a ⚠ gap.

## 4. In-flight *(honest status; blockers loud)*

What's underway, with a realistic indicator and an expected date. Be honest — surface risk early.

| Work (what it enables) | Status | Expected | Note / blocker |
|------------------------|--------|----------|----------------|
| [outcome it enables] | 🟢 On track | [specific date] | [context] |
| [outcome it enables] | 🟡 At risk | [date (+ what's uncertain)] | [the concern] |
| [outcome it enables] | 🔴 Blocked | — | **Needs leadership:** [the specific decision/help, and by when] |

> State what work **enables**, not how it's built. Call out blockers needing leadership attention
> explicitly — a quiet blocker is a missed escalation.

## ⚠ 5. Data gaps

What couldn't be measured this period and why — so no one mistakes a gap for a zero.

- [metric/claim unavailable — and what it leaves unsupported]
- *Warehouse unreachable?* Follow the re-auth runbook in [`data-warehouse.md`](../../foundation/connectors/data-warehouse.md), mark the metric a ⚠ gap, and proceed — never invent a number (Constitution IV).

---

## 🔬 6. Pressure test *(mandatory before Status = Ready to send)*

Run `pm-harness/foundation/pressure-test.md` before this is presented as ready. Summarize:

- **Gaps:** [what's missing or unmeasured]
- **Risks:** [what an exec might mis-read; any over-claim]
- **Honesty check:** [is anything spun? are blockers stated plainly?]
- **Strongest counter-read (steelmanned):** [the least flattering fair interpretation of this update]
- **Bottom line:** [ready to send, or the 1–3 things to fix first]

---

## 7. Next *(read-only — this update writes nothing)*

- **Top 2–3 for next period:** [the planned work / opportunities, in outcome terms].
- This artifact drafts an update only; it **posts/files nothing** to any source of truth, so no confirm gate applies.
- Headed for an eng decision behind a theme? → **POV Brief** (`../../skills/pov-brief/skill.md`) or **PRD/Spec Framer** (`../../skills/prd-spec-framer/skill.md`).
