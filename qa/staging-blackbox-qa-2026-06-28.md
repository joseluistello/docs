# Staging Blackbox QA — CLI/MCP/API
**Date:** 2026-06-28
**Branch:** `claude/driftless-staging-blackbox-qa-31y5rx`
**Scope:** Staging — CLI v0.26.0, MCP tool-registry, REST API surface
**Method:** Source-level blackbox (staging API blocked by proxy policy from this environment; CLI unit tests + deep code inspection)

---

## Environment

```
CLI version:   v0.26.0 (built from source — apps/cli)
MCP version:   tool-registry.ts (current HEAD)
Git remote:    http://local_proxy@127.0.0.1:41729/git/joseluistello/Driftless
DRIFTLESS_API_URL: https://api-staging.driftless.icu (blocked by proxy, 403)
Node:          v22.22.2
Test method:   vitest run + CLI help/arg testing + source code review
```

---

## Test Suite Results

```
topic-schema:   55/55 pass
CLI unit tests: 212/213 pass — 1 FAIL (git.spec.ts)
MCP unit tests:  62/62 pass
```

---

## Issues Found

---

### BUG-01 · `getGitRemote()` silently returns null for proxy-format git remotes
**Severity:** HIGH
**Surface:** CLI
**Exact command:** Any workspace-dependent CLI command run in a Claude Code remote environment

**Git remote URL in this environment:**
`http://local_proxy@127.0.0.1:41729/git/joseluistello/Driftless`

**Root cause:** `getGitRemote()` (`apps/cli/src/git.ts`) branches on whether the URL contains `@`. The proxy URL has `local_proxy@127.0.0.1`, so it hits the SSH parsing path. The SSH path splits on `:` and checks that exactly 2 segments remain — but `41729/git/joseluistello/Driftless` has 4, so the function returns `null`.

**Expected:** Either `getGitRemote()` handles standard HTTP remotes with port numbers (these are common in managed CI/cloud environments), or workspace resolution falls through cleanly to a helpful error rather than "no git remote found."

**Actual:**
```
$ driftless context list
Error: no git remote found.
```

**Evidence:** Unit test `src/git.spec.ts:71` fails in this environment:
```
TypeError: .toMatch() expects to receive a string, but got undefined
```
The test calls the live `getGitRemote()` without mocking — it exposes the production bug.

**Suggested validation:**
1. `git config --get remote.origin.url` in a Claude Code remote env → confirm proxy URL
2. Call `getGitRemote()` directly → confirm it returns null
3. Fix: add a HTTPS-with-port path: `URL.hostname`/`URL.pathname` parsing that ignores the port

---

### BUG-02 · All workspace-dependent commands fail with misleading "no git remote found" instead of proper errors
**Severity:** HIGH
**Surface:** CLI
**Commands affected:** `context search`, `context list`, `context get`, `area list`, `collection list`, `collection records`, `broker connections`, `broker invoke`, `project list`, `project get`

**Exact command:**
```bash
export DRIFTLESS_API_KEY=drift_...
export DRIFTLESS_API_URL=https://api-staging.driftless.icu
driftless context search   # no query — should say "Usage: ..."
driftless collection get   # no id — should say "Error: `collection get <id>`"
driftless broker invoke    # no args — should say "Error: 'broker invoke' needs..."
```

**Expected:** Argument validation errors specific to each command.
**Actual:** All print `Error: no git remote found.` — the workspace resolver fires before argument checking.

**Root cause:** `resolveWorkspaceSlug()` is called at the top of every command handler before argument validation. When the API is unreachable and no workspace is cached, it exits with the git remote error. Argument validation that would produce a useful message never runs.

**Suggested validation:** Run each command above with no arguments; observe whether the error is workspace-related or argument-related. Fix: validate required positional args before calling `resolveWorkspaceSlug()`.

---

### BUG-03 · Unit test BUG-01 repro: `git.spec.ts` calls live `getGitRemote()` without mocking
**Severity:** MEDIUM
**Surface:** CLI test suite
**File:** `apps/cli/src/git.spec.ts:71`

**Test:**
```ts
it('parses standard https and ssh URLs', () => {
  expect(getGitRemote()?.org).toMatch(/^[a-zA-Z0-9_.-]+$/)  // ← calls LIVE git
})
```

**Expected:** Test passes regardless of the git remote URL format in the test environment.
**Actual:** Fails when git remote is in proxy format (`http://user@host:port/path/org/repo`).

```
FAIL  src/git.spec.ts > getGitRemote > parses standard https and ssh URLs
TypeError: .toMatch() expects to receive a string, but got undefined
```

**Suggested validation:** Mock `execSync` with known URL strings; test the parsing logic, not the live environment.

---

### BUG-04 · `context search` limit default differs between CLI (server's 50) and MCP (5)
**Severity:** MEDIUM
**Surface:** CLI help text vs MCP tool schema

**CLI help says:**
```
--limit <n>   Cap results server-side (server hard-caps at 50; default 50)
```

**MCP tool schema:**
```ts
// apps/mcp/src/tools/tool-registry.ts
const DEFAULT_SEARCH_LIMIT = 5
const MAX_SEARCH_LIMIT = 20
```

**Expected:** Consistent default and maximum across CLI and MCP.
**Actual:** An agent using the CLI gets up to 50 results; an agent using MCP gets 5 results by default (max 20). Worse — the CLI help mentions `server hard-caps at 50`, which is now a lie for MCP users (hard cap is 20 via MCP).

**Suggested validation:**
1. `driftless context search "auth" --json | jq length` → observe count
2. `tools/call driftless_context_search { query: "auth" }` → observe count
3. Compare. Fix: align defaults, or document the difference explicitly in MCP tool description.

---

### BUG-05 · `driftless_broker` MCP tool is hidden by default with no discoverability signal
**Severity:** MEDIUM
**Surface:** MCP tools/list

**Exact request:**
```json
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

**Expected:** Either `driftless_broker` appears in `tools/list`, or the response carries a hint: "broker available — set DRIFTLESS_BROKER_ENABLED=true".
**Actual:** `driftless_broker` is silently absent from `tools/list` unless the server env has `DRIFTLESS_BROKER_ENABLED=true`. The CLI `driftless broker --help` surfaces it; MCP does not. An agent parsing MCP tools cannot know the broker exists.

**Code:**
```ts
// apps/mcp/src/tools/tool-registry.ts
if (!this.brokerEnabled()) {
  this.tools = this.tools.filter((tool) => tool.name !== 'driftless_broker')
}
```

**Suggested validation:** `tools/list` on staging with broker flag off → confirm broker absent, no hint.
**Fix candidates:** (a) Always include `driftless_broker` in tools/list but return a 503 on call; (b) Add a `next_action` hint in the `driftless_areas` or `driftless_workspaces` tool result pointing to broker when the flag is off.

---

### BUG-06 · `collection records --status X` without `--limit` fetches unbounded (legacy endpoint)
**Severity:** MEDIUM
**Surface:** CLI

**Exact command:**
```bash
driftless collection records <collection-id> --status in_progress
```

**CLI help claims:** `bounded server-side; follow nextCursor to page`
**Actual:** When only `--status` is given (no `--limit` or `--cursor`), the code sends to the legacy endpoint that returns a bare array with no pagination:

```ts
// apps/cli/src/commands/collection.ts:110-124
// F10.2 — read bounded server-side: --limit/--cursor go to the keyset endpoint
// (any of them opts into the { records, nextCursor } envelope per F10.1).
// --status alone keeps the legacy bare-array shape; unwrap handles both.
const params = new URLSearchParams()
if (str('status')) params.set('status', str('status')!)
if (str('limit')) params.set('limit', str('limit')!)
if (str('cursor')) params.set('cursor', str('cursor')!)
```

A collection with 1,000 records filtered to `status=in_progress` returns all of them unbounded. No `nextCursor` is emitted, so the agent doesn't know it's an unbounded response.

**Expected:** Help text should say "bounded when --limit is given; --status alone is unbounded".
**Fix candidate:** Send a default server-side limit even when only `--status` is set, or remove the legacy path and always use the keyset envelope.

**Suggested validation:**
1. Create a collection with 100+ records in `in_progress` status
2. `driftless collection records <id> --status in_progress` → observe record count, check for nextCursor

---

### BUG-07 · `broker connections --help` and all broker subcommand `--help` show parent help
**Severity:** LOW
**Surface:** CLI

**Exact command:**
```bash
driftless broker connections --help
driftless broker operations --help
driftless broker invoke --help
```

**Expected:** Help specific to the `connections` (or `operations`, `invoke`, etc.) subcommand.
**Actual:** Shows the full `broker --help` text. The `--help` flag is consumed at the top of `brokerCommand()` before subcommand dispatch.

**Code:**
```ts
// apps/cli/src/commands/broker.ts
if (flags['help'] === true || sub === 'help') { printHelp(); process.exit(0) }
```

This means there is no per-subcommand help for broker. An agent running `broker operations --help` expecting to learn about the `--refresh` flag gets the full reference dump instead.

**Suggested validation:** Run each subcommand with `--help` and confirm output is identical. Not a crash — just poor UX.

---

### BUG-08 · MCP `driftless_project` action:'list' has no limit parameter; large workspace returns all
**Severity:** MEDIUM
**Surface:** MCP

**Exact call:**
```json
{"name":"driftless_project","arguments":{"action":"list"}}
```

**Expected:** Paginated response with `has_more`/cursor hints; or at minimum a documented bound.
**Actual:** The implementation:
```ts
case 'list': {
  const status = typeof args['status'] === 'string' ? args['status'] : 'active'
  return this.api.get(`/workspaces/${workspace}/projects?status=${encodeURIComponent(status)}`, ctx)
}
```
No `limit` param sent; no `has_more` field in response. A workspace with 200 active projects returns them all, potentially flooding the agent context.

**Suggested validation:** Create 50+ projects on staging; call `driftless_project action:'list'` via MCP → observe if all are returned.
**Fix:** Add `limit`/`offset` params to schema; emit `{ items, count, has_more }` envelope.

---

### BUG-09 · MCP `driftless_collection` action:'list' also has no limit
**Severity:** LOW-MEDIUM
**Surface:** MCP

Same pattern as BUG-08 — `action:'list'` for collections:
```ts
case 'list': {
  const query = this.queryString(args, ['status'])
  return this.api.get(`/workspaces/${workspace}/collections${query}`, ctx)
}
```

No limit. A workspace with many collections returns them all. The MCP `driftless_areas` action:'list' uses a hard 40-item cap client-side; `driftless_collection` does not.

---

### BUG-10 · Smoke test uses non-workspace-scoped `/topics/retrieve` endpoint
**Severity:** LOW
**Surface:** REST API smoke test

**File:** `scripts/harness/smoke.sh:line ~175`

```bash
retrieve_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 \
  -X POST -H "X-API-Key: $SMOKE_KEY" -H "Content-Type: application/json" \
  -d '{"query":"smoke","files":["src/smoke/probe.ts"],"limit":1}' \
  "$SMOKE_URL/api/v1/topics/retrieve" ...)
```

**MCP code uses:**
```ts
this.api.post(`/workspaces/${workspace}/topics/retrieve`, body, ctx)
// → POST /api/v1/workspaces/{slug}/topics/retrieve
```

The smoke test tests `POST /api/v1/topics/retrieve` (no workspace in path), while the actual MCP-called endpoint is workspace-scoped. If the server resolves workspace from the auth key for the bare endpoint, the smoke test passes but doesn't verify the actual MCP path. If the server requires the workspace slug, the smoke test passes on a different code path than MCP uses in production.

**Suggested validation:** Compare response of both endpoints with the same payload.

---

### BUG-11 · `context list --suggested` and `--all` fetch unbounded from CLI (large workspaces)
**Severity:** LOW-MEDIUM
**Surface:** CLI

**Code:**
```ts
// apps/cli/src/commands/context.ts:325
const canBoundServerSide = !flags['suggested'] && !flags['all']
if (canBoundServerSide) {
  const serverLimit = explicitLimit ?? (isJSON ? null : 40)
  if (serverLimit != null) query.push(`limit=${serverLimit}`)
}
```

When `--suggested` or `--all` is used, the server request has no `limit` parameter. A workspace with 10,000 topics triggers an unbounded fetch, then a client-side sort and slice. This is a memory/latency risk for large workspaces.

**Suggested validation:** On a staging workspace with 200+ topics:
1. `driftless context list --suggested --json | jq length` → observe count
2. `driftless context list --all --json | jq length` → observe count

---

## Summary

| ID | Surface | Severity | Title |
|----|---------|----------|-------|
| BUG-01 | CLI | HIGH | `getGitRemote()` fails for proxy-style git remote URLs |
| BUG-02 | CLI | HIGH | Workspace error masks argument validation in all commands |
| BUG-03 | CLI tests | MEDIUM | `git.spec.ts` uses live git remote — fails in proxy envs |
| BUG-04 | CLI/MCP | MEDIUM | `context search` default limit 50 (CLI) vs 5 (MCP) |
| BUG-05 | MCP | MEDIUM | `driftless_broker` silently hidden in `tools/list` |
| BUG-06 | CLI | MEDIUM | `collection records --status` unbounded (no limit = legacy path) |
| BUG-07 | CLI | LOW | Broker subcommand `--help` shows parent help |
| BUG-08 | MCP | MEDIUM | `driftless_project action:'list'` unbounded, no has_more |
| BUG-09 | MCP | LOW-MEDIUM | `driftless_collection action:'list'` unbounded, no has_more |
| BUG-10 | Smoke | LOW | Smoke tests wrong endpoint for `/topics/retrieve` |
| BUG-11 | CLI | LOW-MEDIUM | `context list --suggested/--all` unbounded server fetch |

**Highest-severity staging blockers:**
- **BUG-01** and **BUG-02** together mean any agent operating in a Claude Code remote environment (proxy git remote, no cached workspace) cannot use ANY CLI command that resolves a workspace. This affects onboarding, first-use after rotating a key, and CI that sets DRIFTLESS_API_KEY but has no prior login state.
- **BUG-04** means agents using CLI and agents using MCP see systematically different result sets for the same search query.
- **BUG-05** means the broker surface is invisible to MCP agents unless they know to look at the CLI help for feature flag hints.

**Bugs found:** 11
**Duplicate cards skipped:** 0 (first QA run; no prior cards to deduplicate against)
**New cards to create:** 11
