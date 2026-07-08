# Connector: GitHub

**Status:** connected. **Use for:** issues, pull requests, projects, discussions, repo activity.

## Auth

`gh` CLI, authenticated as the operator's GitHub account. Scopes: `repo`, `project`, `read:org`, `workflow`.
Prefer the `gh` CLI for all GitHub operations (issues, PRs, projects, runs).

## Quick check

```bash
gh auth status            # confirm the operator's account is authed
```

## Common reads (safe, no writes)

```bash
gh issue list   --repo <org/repo> --state open --limit 50
gh pr list      --repo <org/repo> --state merged --search "merged:>=2026-06-01"
gh issue view   <n> --repo <org/repo>
gh search issues "<query>" --owner <org>
gh project item-list <number> --owner <org>      # project boards
```

## What to pull it for

- **SENSE:** what's rising — recent issues/PRs/discussions, by label/area.
- **ALIGN:** evidence for a POV; meeting prep; the basis for an eng handoff.

## Writes = trust boundary

Anything that **creates or changes** GitHub state (filing an issue, commenting, editing a project)
is a **write to a source of truth.** Per Constitution VII, **explain the consequence and get
explicit confirmation first** — never file or comment silently. (The issue-writing Eng Handoff
skill that does this lives in a later iteration.)

## Graceful failure

- `gh auth status` failing → flag "GitHub not authenticated" with the re-login step; don't guess
  issue contents.
- Cite every pulled item as `[gh: org/repo#NNN]`.
