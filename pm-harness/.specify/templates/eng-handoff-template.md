# Eng Handoff: [SPEC / OUTCOME]

**Thread**: `[short-slug]`  ·  **Spec**: [link/slug]  ·  **Status**: Draft → Pre-write (awaiting confirm) → Filed

> Write-capable **ALIGN** artifact: turns a **committed** spec into eng-ready GitHub issues. This is
> the harness's **trust boundary** — nothing is filed until the pre-write confirm block (§4) is shown
> and the operator gives explicit approval. Read-only until then. Fill top-to-bottom; the write never
> happens before §4's Y/N gate (Constitution VII; preconditions in
> [`commands/eng-handoff.md`](../commands/eng-handoff.md)).

---

## 1. Precondition gate *(mandatory — handoff is refused unless ALL pass)*

The spec must be **Committed** before any issue can be filed. Check each:

| Gate | Required | Status |
|------|----------|--------|
| `/clarify` passed (no open clarifications) | yes | ☐ |
| `/checklist` passed | yes | ☐ |
| Pressure-test run (gaps/risks/counter-read) | yes | ☐ |
| Evidence vs. assumptions separated | yes | ☐ |
| ⚠ Data gaps explicit | yes | ☐ |

**Verdict:** ☐ **Committed — proceed** | ☐ **NOT committed — refuse**

> If NOT committed: name exactly what's missing, route back to the **PRD/Spec Framer**
> (`../../skills/prd-spec-framer/skill.md`, SHAPE), and **stop here** — do not fill §4–§6, do not
> offer a write (Constitution V).

## 2. GitHub state refresh *(read-only — `before_eng_handoff` hook)*

Current issues/PRs/projects this handoff should attach to, so we don't duplicate or collide.

- [related issue / PR / project] `[gh: org/repo#NN]`
- [existing work to attach to / avoid duplicating]

> This hook only **reads**. It refreshes context; it files nothing. The write is gated by §4 below.

## 3. Outcome → plan / tasks *(translate; keep it outcome-led)*

**Committed outcome:** [the user/business outcome in one plain sentence — the *why* eng inherits].
**Success criteria:** [how we'll know it worked — testable, from the spec].

The eng plan, broken into tasks (the bridge to spec-kit's `plan`/`tasks`). Each task → one candidate
issue below.

| # | Task (outcome-led) | Maps to success criterion |
|---|--------------------|---------------------------|
| 1 | [task] | [criterion] |
| 2 | [task] | [criterion] |

> Lead each with the outcome, not an implementation checklist — eng gets the *why*, not just the *what*.

---

## ⚠️ 4. PRE-WRITE CONFIRM — nothing is filed above this line ⚠️

> **This is the trust boundary.** The block below describes a **write to a source of truth**.
> It is shown to the operator **before** anything is created. Filing happens **only** after an explicit
> "yes" at the Y/N gate. Implied approval ("just queue it," "you know what to do") is **not** a yes —
> if that's all we have, re-show this block and wait (Constitution VII).

**▶ What will be created**

- **Repo:** `[org/repo]`
- **Issue count:** **[N]**
- **Exact issues:**

  | # | Exact title | One-line body |
  |---|-------------|---------------|
  | 1 | `[exact issue title]` | [one-line body] |
  | 2 | `[exact issue title]` | [one-line body] |
  | … | … | … |

- **Consequence:** these issues will be **visible to others** in `[org/repo]` and are **not trivially
  undone** (closing ≠ deleting; notifications fire on create).

**▶ Alternatives (pick one)**

- **A — Draft for review first:** write these issue bodies into this artifact for you to edit; file
  nothing yet. *(Safer, slower.)*
- **B — File directly:** create all **[N]** issues now, exactly as listed above. *(Faster, immediately public.)*

**▶ Gate — explicit confirmation required**

> **File [N] issues in `[org/repo]` as listed above? (Y / N)**
> A specific "yes" (e.g. *"Yes, file all [N] in `[org/repo]`"*) is required to proceed. Anything
> ambiguous → treated as **No**; this block is re-surfaced.

---

## 5. Write path *(stated only after an explicit "yes" — described, not executed, in any dry run)*

On explicit confirmation, the exact write that would run:

```text
# Option: spec-kit
taskstoissues  --repo [org/repo]   # converts the §3 tasks into the §4 issues

# Option: per-issue
gh issue create --repo [org/repo] --title "[exact title]" --body "[one-line body]"   # ×N
```

> In a **dry / validation** context this is **described, not run.** No issue numbers or links are
> invented (Constitution IV).

## 6. Post-filing summary *(only after a real write — read back to verify)*

What was **actually** created (links so the operator can verify):

| # | Title | Link |
|---|-------|------|
| 1 | [title] | `[gh: org/repo#NN]` |
| 2 | [title] | `[gh: org/repo#NN]` |

- **Snapshot:** updated to `Status = Filed` with the links above (`../../foundation/memory/`).
- Report only what truly happened — a failed create is stated plainly, never a fabricated success.
