# F0.1 — Performance budgets & workflow scope

The explicit performance contract for the program. Numbers are **targets**, measured on the
large local fixture (F0.4) via the harness (F9.1), warm cache excluded unless noted. p50/p95
are server-side latency for the API call; CLI/MCP add transport + (de)serialization on top,
which is why payload ceilings and connection reuse (F4.2) matter as much as query time.

## Latency budgets (hot workflows)

| Workflow | Surface | Endpoint / tool | p50 | p95 |
|---|---|---|---|---|
| List MCP tools | MCP | `tools/list` | 50 ms | 150 ms |
| Topic search | API/MCP/CLI | `driftless_context_search`, `GET /topics/search` | 120 ms | 350 ms |
| Unified retrieve | API/MCP/CLI | `context retrieve` (F1.5) | 150 ms | 400 ms |
| Topics for files | API/MCP/CLI | `driftless_context_get_for_files`, `GET /topics/match-files` | 120 ms | 350 ms |
| Topic get | API/MCP/CLI | `driftless_context_get`, `GET /topics/:slug` | 60 ms | 180 ms |
| Collection records | API/MCP/CLI | `driftless_collection_record` list | 120 ms | 350 ms |
| Broker operations | API/CLI | `GET …/broker/connections/:provider/operations` | 250 ms* | 800 ms* |
| Broker invoke | API/CLI | `POST …/broker/connections/:provider/invoke` | bound by provider | bound by provider |

\* Broker operations/invoke cross the Nango boundary and a live provider; their budget is the
Driftless overhead **around** the provider call (auth, lookup, audit write), not the provider's
own latency. Cache operation metadata (F7.2/F7.3) so listing operations does not require a live
round-trip on every invoke.

## Payload ceilings (single read response, JSON, uncompressed)

| Read | Default ceiling | Notes |
|---|---|---|
| `tools/list` | 80 KiB | Internal latency/context budget, not an external provider limit; compact schemas (F3.1) and paginate beyond (F3.2). |
| list/search results page | 40 KB | enforce `limit`, default `view=brief` |
| single topic (`full`) | 50 KB | `brief` view drops `content`/`components` |
| collection records page | 40 KB | paginate (F6.2) |
| broker records page | 40 KB | hard-cap output size (F7.4) |
| market-data envelope (`driftless_market_data`) | 50 KB | pass-whole-or-refuse, never trimmed — see below |

Ceilings are enforced by regression tests (F2.2) and the gates in `gates.md`.

**Hard backstop (T7):** every MCP tool response — static and synthesized —
passes through a byte governor at `ToolRegistry.call` capped at **50 KB**
(`DRIFTLESS_MCP_RESPONSE_MAX_BYTES` overrides). Under the cap responses are
verbatim; over it the largest lists/strings are shrunk and the response
carries `truncated: true` + a hint (never a silent cut). The per-read
ceilings above are what well-behaved envelopes should hit; the governor is
the guarantee that an unbounded upstream payload (e.g. a raw provider
operations list) can never flood an agent's context. Enforced by
`apps/mcp/src/tools/response-budget.spec.ts` with worst-case fixtures.

**Market-data is the one envelope this backstop never trims.** Every
`driftless_market_data` response (`schemaVersion: 'market-data/domain/1'`)
carries an opaque page cursor bound to its exact filter set and corpus
snapshot; the governor's usual last-resort shrinking (halving the largest
array/string) would desynchronize that cursor from the page actually
returned. `ToolRegistry.governed()` special-cases it instead, the same way
it already special-cases the `bounded_live` record envelope: under the
50 KB cap the envelope passes through **verbatim** — coverage, provenance
and semantic warnings intact; over the cap it returns an explicit
`RESULT_TOO_LARGE` rather than a shrunk page, so the caller narrows the
query or lowers `limit` and retries instead of trusting a `nextCursor` that
no longer matches what it received.

## Retrieval quality bars

Measured by the ranking eval harness (F1.6) on a labeled query set:

- **Recall@10 ≥ 0.90** — the right topic is in the top 10 for known queries.
- **MRR ≥ 0.70** — the right topic ranks high, not just present.
- **No regression** vs the current ranking on the labeled set when search moves to indexed
  full-text (F1.2) and match-files candidate selection is redesigned (F1.3).

## Scope (workflows in this program)

Topics (search / retrieve / get-files / get), Collections (records / context /
retrieve), Integrations/Broker (operations / invoke / records),
sync, and context retrieval. Dashboard/web read paths are **out of scope** except where they
reuse the same API endpoints being optimized.
