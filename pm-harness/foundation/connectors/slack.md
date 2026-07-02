# Connector: Slack

**Status:** connected. **Use for:** organizational context — threads, channels, and people.

## Capabilities

- Search public messages/files, read channels and threads, look up users and profiles.

## Consent rule (important)

- **Public channel** search/read: available.
- **Private channels and DMs:** searching these requires **the operator's explicit per-use consent.**
  Before running any private/DM search, **ask first** and explain what will be searched and why.
  This is a privacy boundary — treat it like Constitution VII (explain, then proceed on confirm).

## What to pull it for

- **SENSE:** what's surfacing in discussion that hasn't reached an issue yet.
- **ALIGN:** meeting prep, finding the relevant thread/decision, identifying stakeholders.

## Using it well

- Cite as `[slack: #channel]` or `[slack: thread]`; don't quote private content without consent.
- Prefer narrow, modifier-scoped searches (channel, author, date) over broad sweeps.

## Graceful failure

- Search unavailable or consent declined → flag the gap; proceed with other sources and note Slack
  context is missing. Never paraphrase or invent what "someone probably said."

## Wiring note (allowlist + token efficiency)

- **Known gap:** this doc says "connected," but the dispatcher `tools:` allowlist in
  `.github/agents/pm-harness.agent.md` currently exposes **no Slack tool** — so a running skill cannot
  actually reach Slack and will (correctly) flag the ⚠ gap and degrade. To close it, add a Slack MCP/tool
  and allowlist it; or, if you don't want the dependency, soften this status to "read via the operator."
- **Wire it leanly.** A tool's schema sits in context on every turn it's exposed. Add only the few Slack
  tools a skill needs — search, read thread, read channel, look up user — and allowlist exactly those.
  A broad mount is always-on token cost for capability you won't use (same principle as
  `microsoft365.md` → "Wiring it efficiently").
