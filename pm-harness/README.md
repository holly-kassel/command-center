# PM Harness

> A PM thought-partner that **senses** signal, **shapes** it into specs, **aligns** stakeholders, and
> **remembers** context across an interrupted day. Tuned by default for a strategy-minded,
> frequently-interrupted PM — but the operator (name, role, technical depth, pronouns, preferences)
> is configured in [`profile.yml`](profile.yml), so anyone can retarget it. **One harness, many skills.**

<!-- AI-assisted disclosure -->

> **AI-assisted:** This harness and its skills/templates were built with GitHub Copilot
> (agent-assisted), reviewed by a human PM.

## You are here

```text
SENSE ──▶ SHAPE ──▶ ALIGN ──▶ REMEMBER ──▶ (back to SENSE)
 signal    intent     POV /        north star +
 curated   → spec     handoff      resume snapshots
 ▲ you are here (this iteration: Eng Handoff, ALIGN — the write/confirm skill)
```

- **① SENSE** — curate signal; weight impact × urgency × effort. ✅ **Feedback Curator is built.**
- **② SHAPE** — turn intent into a PRD/spec; clarify gaps; pressure-test. ✅ **PRD/Spec Framer is built.**
- **③ ALIGN** — evidence-backed POV, eng handoff, stakeholder updates. ✅ **POV Brief + Stakeholder Update + Eng Handoff are built.**
- **④ REMEMBER** — the constitution + resume snapshots threading through every phase. ✅ **foundation built.**

## How to use it

1. Open the **PM Harness agent** (`.github/agents/pm-harness.agent.md`) in Copilot.
2. Give it an outcome or a half-formed idea — e.g. _"I want faster onboarding for enterprise admins
   because trials stall on setup."_
3. It runs the **PRD/Spec Framer**: gathers cited evidence, separates assumptions, flags data gaps,
   drafts testable stories + success criteria, **clarifies**, and **pressure-tests** before you commit.
4. When a spec is committed and you want to prototype, it opens the **engineering handoff bridge**
   into spec-kit's real build loop — explaining consequences before anything is filed.

## What you can count on (the conventions)

- **Options laid out neutrally with their stakes, then a clear recommendation at the end.**
- **Every claim cited; data gaps flagged out loud; nothing fabricated.**
- **Minimal by default, loud about what actually matters.**
- **Consequences explained before anything risky, technical, or irreversible — then it waits for you.**
- **Your state is preserved** so you can drop a task and pick it back up cheaply.

## What's inside

```text
pm-harness/
├─ README.md                     ← you are here
├─ profile.yml                   ← the operator config (edit this to retarget the harness)
├─ .specify/                     ← spec-kit backbone (adapted, PM-flavored)
│  ├─ memory/constitution.md     ← your north star + operating profile + product principles
│  ├─ templates/                 ← prd-spec · signal-triage · pov-brief · stakeholder-update · eng-handoff · clarify · checklist · resume-snapshot
│  ├─ commands/                  ← constitution · specify · clarify · checklist · eng-handoff (bridge)
│  └─ extensions.yml             ← hooks wiring the connectors into the loop (loaded lazily, at hook time)
├─ foundation/                   ← shared by every skill
│  ├─ core.md                    ← always-on digest + safety floor (loaded with profile.yml; rest on demand)
│  ├─ operating-profile.md       ← the default operator model (profile.yml overrides name/role/depth/prefs)
│  ├─ output-conventions.md      ← how every reply is shaped
│  ├─ pressure-test.md           ← the devil's-advocate mode
│  ├─ connectors/                ← github · customer-feedback · slack · web · data-warehouse · microsoft365 (scaffold)
│  └─ memory/                    ← resume snapshots for graceful re-entry
└─ skills/
   ├─ feedback-curator/skill.md  ← SENSE: curate + weight + rank signal
   ├─ prd-spec-framer/skill.md   ← SHAPE: intent → spec
   ├─ pov-brief/skill.md         ← ALIGN: take & defend a position
   ├─ stakeholder-update/skill.md ← ALIGN: translate the week into an exec update
   └─ eng-handoff/skill.md       ← ALIGN: committed spec → issues (write/confirm boundary)
```

## Glossary (plain language)

- **Constitution** — the harness's permanent rulebook: your north star + how you work. It overrides
  everything else.
- **Spec / PRD** — the structured doc that captures the outcome, evidence, stories, and success
  criteria for a piece of work.
- **Connector** — a wired source the harness reads from: GitHub, customer feedback, Slack, the web,
  and the data warehouse — plus **Microsoft 365** (Word/Excel/Outlook/OneDrive/SharePoint), a read +
  gated-write connector that is **scaffolded, not yet wired**.
- **Resume snapshot** — a small saved "where I left off" note so you can stop and come back without
  losing the thread.
- **Pressure-test** — the harness playing devil's advocate: surfacing gaps, risks, edge cases, and
  the strongest argument against, before you commit.
- **Hook / extension** — the official spec-kit seam that lets the harness pull connector evidence
  into the loop without modifying spec-kit itself.
- **Trust boundary** — anything that _writes_ to a shared source of truth (like filing GitHub
  issues); the harness always explains and confirms before crossing it.

## Backbone

The SHAPE + ALIGN machinery adapts **[github/spec-kit](https://github.com/github/spec-kit)**
(Spec-Driven Development). The SENSE + REMEMBER layers are custom — engineering has no equivalent.
Adapted by hand and PM-flavored, with a labeled bridge back to spec-kit's real engineering loop for
when you prototype.
