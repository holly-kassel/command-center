# Connector: Microsoft 365 (Word, Excel, Outlook, OneDrive, SharePoint)

**Status:** wired - Microsoft 365 via the WorkIQ M365 MCP (OneDrive/Word/SharePoint reads + create). The capabilities and rules below are the runbook for when an
M365 MCP server is connected; until then this source reads as **unreachable** and the harness degrades
gracefully (flag the ⚠ gap, continue with the other connectors — see `README.md`). Wiring it up is two
steps: (1) configure an M365 MCP server (Microsoft Graph based, e.g. `ms-365-mcp-server`, or a local
Word/Excel automation server); (2) add its tools to the dispatcher allowlist in
`.github/agents/pm-harness.agent.md` and set `identity.m365_*` in `profile.yml`. **Do step 2 leanly —
see "Wiring it efficiently" below.**

**Use for:** producing and reading first-class Office artifacts — a stakeholder update as a `.docx`, a
metrics table as an `.xlsx`, reading an existing strategy doc or spreadsheet for context.

## Capabilities

- **Read** (a normal evidence leg): open and read Word docs, Excel workbooks/sheets, Outlook mail and
  calendar, and OneDrive / SharePoint files the operator can already access.
- **Write** (a trust boundary — see the write protocol below): create a new Word/Excel doc, or update
  an existing one, in the operator's OneDrive or a shared SharePoint / Teams location.

All access is **user-scoped** through the operator's own Microsoft 365 identity and respects M365
licensing and compliance boundaries. The harness never sees more than the operator can.

## Identity and auth

- M365 access uses the operator's identity from `profile.yml` — `identity.m365_login` in tenant
  `identity.m365_tenant` (this may differ from the `warehouse_*` githubazure identity; they are separate).
- Default write target is `identity.m365_onedrive_path` (the operator's own space).
- Shared writes are only allowed to a location named in `identity.m365_sharepoint_allow` (see profile).

### Re-auth runbook (Graph token expires periodically)

When a call returns an **auth / token-expired / consent-required** error, the Graph token has expired
or consent is missing. **Do not retry blindly, and never fabricate file contents.** Surface it plainly:

```text
⚠ Source gap — Microsoft 365 re-auth needed
  Why: Graph returned an auth/consent error — the M365 token has expired or consent wasn't granted.
  Fix: re-authenticate the M365 MCP server as <identity.m365_login> (tenant <identity.m365_tenant>)
       and grant the requested file/mail scopes.
  Impact: I can't read or write Office docs right now — anything below rests on the other connectors
          only until this is reconnected.
```

After the operator re-auths, retry.

## The write protocol — draft first, promote on explicit permission (NON-NEGOTIABLE)

Writing to M365 is a **write to a source of truth** (Constitution VII) and is gated more tightly than
filing an issue. Every M365 write follows two stages:

1. **Stage 1 — local draft.** Always produce the content as a **local draft file first** (Markdown or
   a local export), and let the operator **read and refine** it. Nothing touches M365 in this stage.
2. **Stage 2 — promote ("extend") to M365.** Only after the operator gives **explicit permission to
   promote that refined draft** does anything get written to M365. Implied approval is never a yes
   (same gate as the Eng Handoff skill). Before promoting, disclose: the **exact destination** (OneDrive
   vs which SharePoint site/library/folder), the **file name**, whether it is a **new file or an edit
   to an existing one**, and **who can see it**.

The operator never gets a surprise cloud document. They refine a draft, then say "promote it," and only
then does it land.

## Tiered caution — OneDrive is flexible, shared spaces get extra care

The blast radius of a write depends on **where** it lands. Treat the two tiers differently:

| Tier | Destination | Posture |
|------|-------------|---------|
| **A — personal** | the operator's **OneDrive** (`identity.m365_onedrive_path`) | **More flexible.** Creating a **new** doc is low-friction: still draft-first and still confirm the promote, but the audience is just the operator. This is the **default** target. |
| **B — shared** | **SharePoint / Teams** shared sites and libraries | **More caution.** Only to a location in `identity.m365_sharepoint_allow`. **Prefer creating a new doc over editing one in place**; never overwrite an existing shared file without naming it exactly and getting a separate explicit yes. Disclose **who can see it** before promoting. A shared write is visible to others and not trivially undone. |

When in doubt, default to Tier A (OneDrive) and let the operator move it to a shared space themselves.

## What to pull it for

- **SHAPE / ALIGN (read):** read an existing PRD, one-pager, or planning spreadsheet for context before
  drafting — cite what you find, don't restate it as your own.
- **ALIGN (write, draft-first):** export a finished **Stakeholder Update** as a `.docx`, or a SENSE /
  metrics table as an `.xlsx`, for stakeholders who don't live in GitHub. The skill drafts; the promote
  to M365 is the gated write.

## Using it well

- Cite reads as `[m365: <file or path>]` (e.g. `[m365: OneDrive/Updates/2026-Q2.docx]`); never quote a
  shared/confidential doc beyond what the operator asked for.
- Keep internal/confidential content inside M365 and GitHub — it is **never** sent to the web connector.
- One artifact, one purpose: don't silently fan a draft out to multiple destinations.

## Graceful failure

- Server not configured, unreachable, or consent declined → flag the ⚠ gap and proceed with the other
  connectors; say plainly that the Office read/export is missing. **Never invent file contents, a
  document link, or a "saved!" confirmation.** A flagged gap always beats a fabricated artifact.

## Wiring it efficiently (token + memory)

A tool's **schema** (name + description + parameters) sits in the model's context on **every turn the
tool is exposed**, whether or not it is called. A full Graph MCP server can publish **200+ tools** — that
is thousands of always-resident tokens. The connector doc you are reading, by contrast, is loaded lazily
(only at hook time) and costs ~0 until then. So the efficiency lever is **how many tools you expose**, not
tools-vs-doc. When you do step 2 above:

- **Expose a minimal subset, not the whole server.** A handful — list/find file, read file, create doc,
  (optionally) update doc — covers the harness's needs. Skip mail/calendar/Teams tools unless a skill
  actually uses them.
- **Allowlist exactly those in `tools:`.** The dispatcher's `tools:` array filters what is surfaced to the
  model, so a narrow allowlist directly cuts always-on schema tokens. Don't allowlist a tool you won't call.
- **Gate exposure to where it's needed.** Prefer mounting M365 only for the export/publish path (the
  `before_publish` hook) rather than globally — the same lazy principle the harness uses for docs.
- **Prefer a compact return format.** Use the server's token-optimized output (e.g. TOON) over verbose
  JSON, especially for Excel ranges — large cell dumps are the biggest result-side cost.
- **Let tools carry data, not the prompt.** Fetch live, use, discard; pair with resume snapshots
  (`../memory/`) so state lives on disk, not in context. This protects memory capacity.
