# Connector: Data Warehouse (Kusto / `canonical`)

**Status:** connected (via the **githubazure** identity — see auth note). **Use for:** the
quantitative "data/evidence" leg of triangulation (Constitution II) — adoption, accounts, plans,
measures.

## Where the data is

- **Cluster:** `https://gh-analytics.eastus.kusto.windows.net/`
- **Database:** `canonical` (69 tables)
- **Example tables:** `account_hierarchy_dotcom_*`, `account_measures_*`, `plans_all`, `accounts_all`.
- Query language: **KQL** (Kusto). Discover schema before querying (`.show tables`, sample a few rows).

## ⚠ CRITICAL — auth is via `githubazure`, NOT `microsoft.com`

This is the single most important operational detail in the harness.

- Warehouse access lives in the **GitHubAzure tenant** (`profile.yml` `identity.warehouse_tenant`)
  (authorized viewers are in group `azure-all-hubbers`), as `profile.yml` `identity.warehouse_login`.
- The **default** `az login` is often the operator's `microsoft.com` identity (tenant
  `72f988bf-86f1-41af-91ab-2d7cd011db47`), which has **NO warehouse access.** That tenant mismatch —
  not a missing entitlement — is the usual cause of a block.

### The re-auth runbook (token expires periodically)

When a query returns **`not authorized`** / **`not authorized to read database`** (or similar
Kusto auth errors), the token has expired or the wrong identity is active. **Do not retry blindly,
and never fabricate data.** Surface this to the operator, verbatim and plainly (substitute the
values from `profile.yml`):

```text
⚠ Data gap — warehouse re-auth needed
  Why: Kusto returned "not authorized to read database" — your githubazure token has expired
       (or the active az login is the microsoft.com identity, which has no warehouse access).
  Fix: run this, then sign in as <identity.warehouse_login>:
       az login --tenant <identity.warehouse_tenant> --use-device-code
  Impact: I can't pull the quantitative leg right now — any conclusion below rests on customer +
          vision evidence only until this is reconnected.
```

After the operator re-auths, retry the query.

### Never-fabricate rule (restated, because it matters most here)

If the warehouse is unreachable, **flag the gap and stop — do not invent numbers, trends, or
table contents.** A POV missing its data leg is honest; a POV with a fabricated number is harmful.

## Fallback (almost certainly unnecessary)

If the operator ever genuinely **lacks the entitlement** (not just an expired token), the documented
fix is a PR to `github/warehouse-config` at `kusto/ghdwprod/canonical/database.yml` adding their
githubazure identity (`profile.yml` `identity.warehouse_login`) as a viewer, with a stamp from
`#enterprise-core-metrics`. This is a **write to a source of truth** — explain consequences and
confirm before proposing it (Constitution VII). Expected to be unnecessary; the expired-token path
above is the normal case.

## What to pull it for

- **SENSE:** size and weight signal (how many accounts/plans affected → the impact leg).
- **SHAPE:** quantify an outcome's success metric with real measures.
- **ALIGN:** the numeric backbone of a POV or stakeholder update; week-over-week movement.

## Using it well

- Cite as `[warehouse: <table>]` and show the query when a number is load-bearing.
- Inspect schema first; don't assume column names. Test against a small sample before trusting a rollup.
