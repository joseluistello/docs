# F0.5 — Standards charter (MCP · CLI · API · SQL · Broker)

The non-negotiable standards this program holds *before* implementation. Each standard maps to
the cards it governs. "Cite" links are the authoritative spec; where a spec is internal, the
charter itself is the citation.

## MCP

- **MCP 2025-06-18 compliance.** Tools advertise `inputSchema`; reads also advertise
  `outputSchema` and return `structuredContent`. Source: MCP spec 2025-06-18 (tools, structured
  output, pagination). Governs: F3.1, F3.3, F3.4, F3.5.
- **Structured outputs for all read tools.** Every read tool returns machine-typed content, not
  prose blobs, so agents parse without heuristics. Governs: F3.4, F3.5.
- **Paginated `tools/list`.** Support `cursor`; never dump the full tool set unbounded.
  Governs: F3.2.
- **Compact schemas.** Tool schemas trimmed to what the model needs; descriptions terse.
  Governs: F3.1. Ceiling: see `budgets.md`.
- **Streamable HTTP behavior.** Long operations stream; the transport stays within MCP's
  Streamable HTTP semantics. Governs: F3.x, F10.3.

## CLI

- **Consistent read flags.** `--view`, `--limit`, `--cursor` mean the same thing everywhere.
  Governs: F4.3.
- **Connection reuse.** Keep-alive HTTP agent on the API client — no fresh TCP/TLS per call.
  Governs: F4.2.
- **Fast start.** Command modules lazy-loaded; `driftless` cold start is not gated by loading
  every command. Governs: F4.1.
- **Help by workflow.** Help is organized around what the user is trying to do, not an
  alphabetical command dump. Governs: F4.4.

## API

- **Pagination + views contract.** List endpoints take `limit`/`cursor` and a `view`
  (`brief`/`full`); `brief` is the default for lists. Governs: F2.1, F4.3, F5.2, F6.2.
- **Standard error contract.** Predictable error shape and status codes across endpoints.
  Governs: F2.1.
- **Payload views standardized.** One vocabulary for partial vs full payloads across the API.
  Governs: F2.1, F2.2.

## SQL

- **Filter and sort in SQL, not in memory.** No "load all then filter/sort in Node." Governs:
  F1.1, F5.1, F5.3, F6.1.
- **EXPLAIN/ANALYZE evidence required.** Every hot-path query change ships a query plan showing
  index use and no full scans on large tables. Governs: F0.7, F1.x, F5.x, F6.x.
- **Anti-N+1.** Batch related reads (history, backlinks, counts); query-count budget enforced.
  Governs: F1.4, F4338 (anti-N+1 tests), F5.1, F6.1.
- **Indexes are first-class.** New hot filters/sorts get covering indexes in a migration.
  Governs: F1.2, F6.5.

## Nango / Broker

- **No agent scripting.** Normal agents call broker `operations`/`invoke`/`records`; they do
  **not** author, edit, or deploy Nango integration scripts. That is a privileged,
  human-reviewed action. Governs: F7.0, and the skill routing F8.5.
- **Operation metadata is materialized.** Don't `listActions` live on every invoke; cache
  operation metadata and refresh deliberately. Governs: F7.2, F7.3.
- **Rate limits & transient failures are explicit.** Nango 429s/5xx are retried with backoff and
  surfaced as typed errors, never as opaque failures. Governs: F7.5.
- **Output size is bounded.** Broker records/action output is capped and paginated. Governs:
  F7.4.

## Rollout / backward compatibility

- **Backward-compatible defaults.** New endpoints/params ship behind defaults that preserve
  existing behavior; old shapes keep working through the transition. Governs: F10.1.
- **Surface contracts are snapshotted.** CLI/MCP/API contracts are snapshot-tested so a change
  that breaks a consumer fails CI, not production. Governs: F0.6, F8.7.
- **Staging → main with evidence.** Optimizations move to main only with the gate evidence from
  `gates.md` attached. Governs: F10.1–F10.4.
