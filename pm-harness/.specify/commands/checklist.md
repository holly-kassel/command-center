# Command: /checklist

> Run the pre-commit quality gate on a spec before it's committed or handed off. Adapted from
> spec-kit's checklist command. Uses `../templates/checklist-template.md`.

## Steps
1. Open `../templates/checklist-template.md` against the spec.
2. Walk every item: outcome framing, evidence-vs-assumption honesty, ⚠ data gaps filled,
   spec quality (testable stories, measurable criteria), and the **non-negotiable pressure-test pass**.
3. Treat any unchecked box as a **finding, not a formality** — surface findings loudly
   (output conventions §3), ranked by severity.
4. Record the gate result: **Ready to commit**, or **Resolve findings first** with the short list.

## Output
A completed checklist with a clear gate verdict. If not ready, the 1–3 things to fix.
