# Market data — the semantic API

## What changed, and why

Driftless used to reach GTM Fábrica over a private HTTP **Query API** that
served two tools to the model: `describe_schema` and `query_sql_readonly`. The
model wrote SQL.

That interface required a model to hold the warehouse's entire semantics in its
head on every call — schema, joins, cardinalities, JSONB shapes, geographic
normalization, strong versus approximate identity, currency, amount
granularity, temporality, coverage, licensing, and the limit on which contacts
may be exhibited. The observed cost was wrong SQL, unnecessarily expensive
searches, timeouts, blended currencies and granularities, weak joins treated as
identity, lexical false positives, misread procurement semantics, calls burned
repairing queries, and a skill that grew to compensate.

> **SQL is an interface for analysts. The semantic API is the interface for
> agents.**

The model now chooses a typed business operation. It does not choose SQL, joins,
scopes or any critical semantics.

The current domain protocols, targeted Web Evidence boundary, Workbench and
evaluation/deletion gates are consolidated in
[`commercial-intelligence-v1.md`](./commercial-intelligence-v1.md).

## The route

```
user / client
      ↓
Driftless HTTP API and Chat
      ↓
semantic domain services (Nest)
      ↓
parameterized read-only repositories
      ↓
named TypeORM DataSource "gtm"
      ↓
private PostgreSQL + TLS + read-only role
```

There is no HTTP between the two repos, no MCP hop, no gRPC, no second
microservice, no second pool, and no path from a model to SQL. The agent tools
and the HTTP controllers call the **same** services in process — the tools do
not call the controllers over HTTP.

Every read runs inside one transaction:

```sql
BEGIN;  -- REPEATABLE READ
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = 8000;
```

`REPEATABLE READ` pins one snapshot so rows and the coverage they are reported
against cannot come from different corpora. `READ ONLY` is a second, independent
guarantee alongside the database role. The timeout is `LOCAL`, so one slow
operation cannot widen the budget for the next user of that pooled connection.

## Ownership

| GTM Fábrica owns | Driftless owns |
|---|---|
| Source Packs, extraction, ingestion | authentication, workspace scope |
| canonical publication, `market_data` schema | controllers, DTOs, OpenAPI |
| forward-only migrations, provenance, coverage | semantic contracts and refusals |
| serving projections, rebuildable | read-only repositories, domain services |
| data integrity, display/licence gates on read | agent tools, Mastra runtime, skills |
| | ResearchReport, sessions, artifacts, telemetry |

## Endpoints

All workspace-scoped. None is `@Public()`.

```
POST /api/v1/workspaces/:slug/market-data/suppliers/search
GET  /api/v1/workspaces/:slug/market-data/suppliers/:sourceSlug/:sourceRecordId

POST /api/v1/workspaces/:slug/market-data/opportunities/search
GET  /api/v1/workspaces/:slug/market-data/opportunities/:id

POST /api/v1/workspaces/:slug/market-data/awards/search
POST /api/v1/workspaces/:slug/market-data/awards/history
POST /api/v1/workspaces/:slug/market-data/awards/aggregate

POST /api/v1/workspaces/:slug/market-data/risks/search
POST /api/v1/workspaces/:slug/market-data/permits/search

GET  /api/v1/workspaces/:slug/market-data/coverage
GET  /api/v1/workspaces/:slug/market-data/capabilities
GET  /api/v1/workspaces/:slug/market-data/capabilities/compact
```

`GET award-suppliers/:rfc/history` is retired. History moved to
`POST awards/history` alongside every other multi-row operation, because a
history that pages needs the same cursor/limit body every search already
takes — a path parameter had nowhere to carry either. The route is gone, not
redirected: a caller still on the old path gets a 404, not a compatibility
shim.

`GET capabilities` accepts an optional `facets` query parameter
(comma-separated dimension names, e.g. `?facets=procedure_type,mark_kind`) that
restricts both the computation and the response to the named corpus
dimensions; an unrecognized name is refused as `unknown_facet` with the ones
that exist. `GET capabilities/compact` is the same bounded, source-aware
projection the agent runtimes are injected, for an integrator that wants it
without the full observed-value catalogue.

## Agent tools

`search_suppliers`, `get_supplier`, `search_opportunities`, `get_opportunity`,
`search_awards`, `get_supplier_history`, `aggregate_awards`, `search_risks`,
`search_permits` — nine warehouse operations, up from seven.

`search_risks` answers "is this party carrying a published adverse mark?" —
an EFOS barred-supplier listing or a sanción/inhabilitación
(`mark_kind: efos | sancion`), never a judicial conviction and never the whole
of a party's regulatory history: a party can carry several marks, including
published exonerations. `rfc` is the only strong identity in this relation and
is structurally validated before it reaches the corpus; `entity_name` is
always approximate, resolved exact-first and then by trigram similarity, and
never has a free-text search document behind it the way opportunities and
awards do.

`search_permits` answers "does this party hold a published permit, concession
or capex commitment?" — a granted right recorded at load time, never a live
operational verification that a plant is generating or a concession is being
worked today. Identity runs the other way from every other relation here:
`holder_rfc` is strong where published, but the two live sources
(`energia-cne`, `concesiones-mineras`) publish no RFC on almost any row, so
`holder_name` — resolved exact-first, then by similarity, exactly like
`supplier_name` — is the join this relation was actually built around.

`aggregate_awards` accepts `order_by: total_amount | award_count` (default:
`total_amount`). A group keyed by `supplier_rfc` also returns
`supplierNameLabel`, the most frequent published spelling inside that RFC
group. The label is for display only: grouping, counting and identity remain
RFC-based, and rows without an RFC are excluded from an RFC ranking.

Coverage and capabilities are **not** tools. Coverage rides on every response;
capabilities are injected by the runtime.

Capabilities are now TWO layers. The semantic contract — operations, identity,
amounts, dates, contacts, matching — is code-owned and versioned with the schema.
The value lists beside each exact filter are read from the LIVE licensed corpus
on every load, in one bounded `GROUPING SETS` query per physical relation, and
stamped with the corpus basis they were read against. The 6.1M-row directory is
never scanned for facets: its dimensions are declared `not_enumerated`, because
the frozen profile could not complete an exact field profile over it and a
sample presented as a census would be worse than no list. The HTTP route returns
the complete lists; the runtime is injected a compact, source-aware rendering
that declares anything it dropped. Making a model spend a call to
discover a system the platform already knows is ceremony, and on a bounded
budget ceremony is the difference between an answer and a partial.

The model never receives: a SQL schema, table names, `describe_schema`,
`query_sql_readonly`, the ability to submit SQL, join rules, private fields, a
DSN, or a database credential.

### The tenth operation: `search_web_evidence`

The nine above read the governed warehouse. One more closes what the warehouse
structurally cannot hold — recency, an announced expansion, a private project, a
corporate publication, external confirmation that something is still active.

It is a **capability, never a provider**. The domain never names an executor,
and nothing about one may reach a prompt, a `ResearchReport`, a citation label or
the frontend. Two mechanical guards enforce it:
`research-providers/research-providers.architecture.spec.ts` and
`cognitive/market-research/market-research.architecture.spec.ts`.

```
{ objective, entities[≤5], claims_to_verify[≤5], freshness_days|null, max_results[≤10] }
```

There is no provider configuration, no callback URL, no model-authored output
schema, no discovery depth and no match limit — those fields do not exist on the
type, so they cannot be passed. A request with no entity and no claim, or an
objective too general to target a source, is refused as `web_query_too_broad`
with a concrete correction **before** anything is spent.

The result is provider-neutral and citable:

```
search_id · objective · claims[] · evidence[] · contradictions[] · unverified_claims[] · coverage
```

`search_id`, `evidence_id`, `observed_at` and `source_domain` are
**platform-owned**, exactly like `coverage` and `provenance` on a warehouse
envelope. A URL a model wrote is never accepted as provenance: the model cites an
evidence id and the platform resolves the record from its own ledger.

A claim's `status` describes **retrieval, not truth**. `supported` means at least
one citable source came back and none of them denied the claim; `contradicted` is
absorbing and can never be overturned by agreeing sources; `unverified` means
nothing citable came back. Contradiction detection is a closed, declared marker
list, not a model call — a probabilistic answer to "may this be reported as
support" is worse than no answer.

**Budget: two searches per run, on a pool market-data calls never consume.** The
third is refused with `web_budget_exhausted` and still recorded in the audit — a
refused attempt that leaves no row reads as a model that simply stopped asking.
Every attempt is audited under the operation name `search_web_evidence`, in the
same `queryAudit` as warehouse calls, so a run is reconstructible from one place.

Web failures are typed — `web_search_unavailable`, `web_query_too_broad`,
`web_budget_exhausted`, `web_results_unverified`, `web_provider_timeout` — and
none of them is critical. A web gap that stays open is a gap; it never removes a
warehouse row and never turns an answered question into "no answer". A deployment
with no executor configured is a supported deployment: the tool is not offered,
the web method is not loaded into the skill, and the run says which gap it could
not close.

Exhaustive discovery and contact enrichment are **unreachable** from this
capability. It holds a port whose whole surface is
`capabilities/estimate/health/search/fetch/extract/cancel` and calls exactly one
of those; a recording proxy in
`research-providers/web-evidence.service.spec.ts` asserts which methods are
touched, so the guarantee is a runtime fact and not only a source scan.

## The envelope

```
schema_version · request_id · operation · interpreted_request · results · page
coverage · corpus_basis · semantic_warnings · provenance · diagnostics
```

`coverage`, `corpus_basis`, `semantic_warnings` and `provenance` are
**platform-owned**: readable by the model, writable only by the layer. Those are
precisely the fields a model would shade if it could reach them, and coverage in
particular is the only thing that separates "this query returned nothing" from
"this market does not exist".

## Agent Observation — one truth, three derivations

The envelope is the right shape for an API client and the wrong shape for a
bounded model context. Rather than a second result, the layer derives from it —
deterministically, in `services/agent-observation.ts`:

```
canonical envelope
├── audit attributes / trace     toAuditAttributes()
├── AgentObservation             toAgentObservation()
└── client presentation          (the dashboard reads the envelope directly)
```

An `AgentObservation` is never persisted, computes no fact, and duplicates no
query logic. Its shared half is identical across all nine warehouse operations:

```
schema_version · operation · identity · filters · facts
visibility · coverage · items · caveats
```

- **identity** — `strong` / `approximate` / `unresolved` / `not_applicable`,
  once per observation rather than repeated per row. This is what stops a name
  resolved by similarity from being reported as a company.
- **filters** — the normalized filters that actually ran, in the caller's own
  snake_case vocabulary. `currency`, `amount_scope` and `order_by` live here,
  which is what makes an aggregate total a quantity and a ranking legible as
  "by count" or "by amount".
- **facts** — what the SERVER computed (an award count, a summed total, a date
  range). Never recomputed downstream from the rows that happened to fit.
- **visibility** — `matched` / `shown` / `more_available`, clamped so `shown`
  can never exceed `matched` and a trimmed row always sets `more_available`.
- **coverage** — `status` / `as_of` / `relations` / `corpus_rows`. `complete`
  means complete within the declared corpus AND the filters above; an undeclared
  or undated corpus yields `unknown`. `corpus_rows` sits here, away from the
  visibility numbers, because beside them it was read as a result count.
- **caveats** — the canonical `semantic_warnings`, as `{ code, note }`. The
  compact wording lives in `services/envelope.ts` beside the canonical wording,
  keyed by the same closed union, so the two cannot drift.

Item projections are per-operation; everything above is shared. The projection
is an **allowlist**, so a field the contract does not name cannot ride through —
which is how a search response stays incapable of exhibiting a contact
coordinate even if an upstream row carried one. `get_supplier` remains the one
operation that exhibits licensed contacts.

Which derivation a surface reads is one option on the tool belt:
`observationProfile: 'full' | 'agent_observation'`. Chat SELECTS a derivation;
it does not author one. Research stays on `full` because it cites
platform-issued query ids and needs provenance inside the observation itself.
CLI and MCP call the services directly and are unaffected.

The trace half carries operational metadata only — operation, relation family,
rows read vs returned, `has_more`, identity basis, coverage status, a corpus
digest, elapsed ms and warning codes. No name, no amount, no row, no contact.
Provenance and evidence stay in the canonical result: a trace explains how the
system worked and is never a second place a claim can be sourced from.

## Pagination

Keyset, never `OFFSET`. One uniform `PageInfo` (`limit` / `returned` /
`hasMore` / `nextCursor`) on every multi-row operation — search, `awards/history`
and `awards/aggregate` alike, so a caller does not learn a second pagination
shape for history or a third for aggregates. Default page 20, maximum 50,
`limit + 1` fetched so `hasMore` is a fact rather than a guess. Aggregate
groups are a different quantity from search rows — a summarized population,
not a raw record — so they default to 50 and cap at 200; one constant
(`MAX_PAGE_LIMIT` / `MAX_AGGREGATE_LIMIT` in `market-data.cursor.ts`) is the
only place either ceiling is set, so a DTO's `@Max()` and the service's own
clamp cannot drift apart. The cursor is opaque and bound to the contract
version, the corpus basis, the normalized filters and the query, which
produces two refusals with different recoveries: `invalid_cursor` when the
caller changed a filter, `cursor_stale` when the corpus moved underneath them.

## Semantic refusals

Every refusal is a `DomainException` carrying an `ErrorCode` from
`ops/error-codes.ts`, so it flows through `GlobalExceptionFilter` with the same
`code` / `message` / `request_id` / `retryable` envelope as every other error.
Alongside it travels `why`, often `allowed_values`, and usually
`suggested_correction` — because a refusal here is normally a misunderstanding,
and the useful answer is the correction.

`query_too_broad` · `unknown_state` · `invalid_observed_kind` ·
`invalid_mark_kind` · `invalid_cursor` · `cursor_stale` ·
`deadline_not_available` · `amount_requires_currency_and_scope` ·
`supplier_name_is_approximate` · `weak_identity_join` ·
`unsupported_aggregation` · `unknown_filter_value` · `unknown_facet` ·
`amount_scope_not_published` · `group_by_identity_not_published` ·
`text_query_not_searchable` · `literal_query_too_short` ·
`market_data_timeout` · `market_data_unavailable` ·
`serving_projection_unavailable`

`invalid_mark_kind` is `search_risks`'s equivalent of `invalid_observed_kind`:
`mark_kind` outside `efos | sancion` is refused with the allowed pair rather
than silently matching nothing. `unknown_facet` is the same discipline applied
to `GET capabilities?facets=` — a dimension name the capability contract does
not compute observed values for is refused with the ones it does, before any
query runs. `amount_scope_not_published` and `group_by_identity_not_published`
are the two ways `aggregate_awards` can return zero rows for a reason that is
NOT "no such market": rows match every filter but carry none of the requested
`(currency, amount_scope)` pair, or the requested `group_by` dimension is one
no matching row publishes — both are diagnosed by one bounded probe and refused
with the pairs or the reason, never served as a silent empty total.

`unknown_filter_value` is the one that earns its keep most often. An exact filter
over publisher text is the easiest way in the whole surface to manufacture a lie:
`contracting_type: "Obra Pública"` against a publisher who wrote `Obra Publica`
runs, returns nothing, and reads as a fact about the market. So when a search
returns nothing AND an exact categorical filter was applied, the layer checks —
in one bounded scan, only on that path — whether the corpus carries those values
at all, and refuses with the ones it does carry. A filter that returned rows is
self-evidently valid and never pays for the check.

No refusal ever contains SQL, a DSN, a token, an internal hostname or a stack.

## Matching

Four mechanisms, ordered by strength, and every result says which one produced
it in `match.matchMethod`:

| Method | Mechanism | What a hit means |
|---|---|---|
| `exact` | structured equality, or a name matched exactly after accent/case folding | the strongest available — identity only where the field IS identity |
| `full_text` | GIN-indexed `tsvector` over published prose, Spanish-stemmed and accent-insensitive | the words appear |
| `trigram` | word-similarity over a folded name | a candidate organization |
| `literal_fallback` | bounded substring probe against an indexed `title \|\| description` | those characters appear somewhere |

The layer chooses, from the query's shape, and declares the choice. A single
token carrying punctuation or digits is a code and takes the literal path; prose
takes full text. Entity names never take either: `buyer`, `supplier_name`,
`entity_name` and `holder_name` are RESOLVED — normalized-exact first,
similarity only if exact finds nothing — and what reaches the database is an
equality over the publisher spellings the resolver chose. The resolution is
reported in `interpretedRequest.normalizations`, so a caller can always see
which organizations were searched. Risks has no free-text search document at
all: a party's name is either given exactly, resolved to publisher spellings,
or not searched — there is no `full_text` or `literal_fallback` path into it.

Municipality follows the same rule and for the same reason: fuzzy geography
answers about several towns at once and says so nowhere. Human input resolves to
one canonical spelling inside an already-stated state; the filter is exact.

## Direct headless clients

The semantic HTTP API is the implementation. CLI and MCP are protocol skins:
they preserve the same envelopes and never invoke `MarketResearchRunner`, a
model gateway, SQL, web search or enrichment. ChatGPT, Claude, Codex or a human
at the CLI supplies the planning and synthesis. The internal runner remains a
separate consumer for Driftless chat and automations.

MCP exposes one compact `driftless_market_data` tool because `tools/list` has a
60 KB session budget. Its `action` maps to the granular CLI and HTTP surfaces:

| MCP action | CLI | HTTP |
|---|---|---|
| `market_capabilities` | `driftless market capabilities` | `GET /market-data/capabilities` |
| `search_suppliers` | `driftless market suppliers search` | `POST /market-data/suppliers/search` |
| `get_supplier` | `driftless market suppliers get` | `GET /market-data/suppliers/:sourceSlug/:sourceRecordId` |
| `search_opportunities` | `driftless market opportunities search` | `POST /market-data/opportunities/search` |
| `get_opportunity` | `driftless market opportunities get` | `GET /market-data/opportunities/:id` |
| `search_awards` | `driftless market awards search` | `POST /market-data/awards/search` |
| `get_supplier_history` | `driftless market awards history` | `POST /market-data/awards/history` |
| `aggregate_awards` | `driftless market awards aggregate` | `POST /market-data/awards/aggregate` |
| `search_risks` | `driftless market risks search` | `POST /market-data/risks/search` |
| `search_permits` | `driftless market permits search` | `POST /market-data/permits/search` |

Coverage is not a separate atomic action: every operation envelope already
carries the coverage relevant to its answer, while capabilities provides
discovery. Adding a duplicate coverage action would consume permanent MCP
schema budget without unlocking a new question.

## The physical layer

`market_data_serving.supplier_search` lives in GTM Fábrica (migration 0051). It
is derived, disposable and never a source of truth; a build is invisible until
complete; publication refuses an incomplete projection, a duplicate observation
key, a stale corpus basis or a contact-boundary leak; rollback is one pointer
move; and the licence gate is applied on READ.

**Tenders and awards have no projection, and they no longer need one.** The
earlier statement here — that the evidence measured them completing and did not
justify physical work — was drawn from facet and aggregate queries. It was never
drawn from a TEXT SEARCH, because the semantic API did not have one yet. When it
did, the shape was pathological: `title ILIKE '%q%' OR description ILIKE '%q%'`
is unindexable, so the planner estimated one row, got ten thousand, and on that
estimate re-probed the licence gate once per candidate row.

Migration 0054 fixes it in place rather than with a second projection: a stored
weighted `tsvector` on `tender_records` and `award_records`, a GIN index, folded
trigram and btree indexes on the entity names, and a licence gate evaluated once
as an `InitPlan` instead of once per row. Measured on a synthetic corpus at the
cardinalities the frozen profile recorded, for one page of a text search:

| | buffers | rows touched | licence-gate scans |
|---|---|---|---|
| before | 31,769 | the whole relation | one per candidate row |
| after | 2,302 | only what matched | one |

A projection would have bought a second copy of 112,264 rows, a build pipeline,
a publication pointer and a staleness rule, to buy nothing the index does not.
Full evidence: `gtm-fabrica/docs/market-data/search-plan-evidence.md` and
`scripts/market-data/search-plan-benchmark.js`.

## Deletion ledger

| Removed | Previous consumer | Replacement | Reachability proof |
|---|---|---|---|
| `lib/market-data/query-api.js` (GTM) | Driftless `MarketDataQueryApiClient` | direct PostgreSQL read | consumer deleted in the same change; `customer-boundary.test.js` asserts no `createServer` in `lib/` or `bin/` |
| `bin/fabrica-query-api.js` (GTM) | `SERVICE_MODE=query-api` entrypoint | — | entrypoint dispatch removed; a stale `SERVICE_MODE` now exits 4, asserted in CI |
| `contracts/market-data/v1/query-api.schema.json` (GTM) | Driftless pinned its checksum | schema/migrations are the cross-repo contract | `verify-contract-bundle.js` no longer references it and still passes |
| `test/market-data-query-api.test.js` (GTM) | — | `customer-boundary.test.js` absence assertions | test of a deleted transport |
| `scripts/market-data/query-api-smoke.sh` (GTM) | CI smoke | — | CI step removed |
| GTM CI Query API boot/smoke steps | `build-source-pack.yml` | default-mode + stale-SERVICE_MODE assertions | workflow edited in place |
| `EXPOSE 8931` (GTM Dockerfile) | Query API listener | — | nothing listens |
| `market-data-query-api.client.ts` (+spec) | `MarketResearchModule` | `MarketDataModule` services | module rewired; suite green |
| `market-data.port.ts` | runner, chat, fixtures | `MarketDataToolServices` | all three rewired |
| `cognitive/market-research/market-data.tools.ts` (SQL belt) | `market-research.runner.ts` | `market-data/tools/market-data.tools.ts` | runner rewired |
| `market-data-surface.spec.ts` | policed the two-tool surface | `market-data.architecture.spec.ts` | replaced by a stronger guard |
| `MARKET_DATA_API_URL` / `_TOKEN` | config, client, harness | `GTM_VAULT_DATABASE_URL` | now a boot-time refusal, with a test |
| `describe_schema` pre-flight | runner | injected capabilities | `load_capabilities` spends 0 calls, asserted |
| `invalid_sql`, `unsafe_query`, `schema_changed` | error policy | `market_data_refused`, `serving_projection_unavailable` | policy table rewritten |
| Query API boot in `research-staging.sh` | local lab | one API + one database URL | harness rewritten |

### Legacy audited and PRESERVED, with the reason

| Kept | Why |
|---|---|
| `lib/market-data/query.js`, `tools.js`, `cli.js` (GTM) | LIVE operator/eval consumers: `bin/fabrica.js`, `blind-probe.js`, `five-question-smoke.js`, `explain-benchmark.js`, the eval harness and ~10 tests. `describe_schema`/`query_sql_readonly` are now unambiguously the operator surface. Deleting the SQL engine with its HTTP wrapper would remove the only way to diagnose the warehouse. |
| `radar/adapters/postgres-market-intelligence.adapter.ts` and the MI gateway, workflow, tools and contracts | **Audited, not deleted, and this is a deliberate call.** Its SQL targets `market_intelligence.*`, which gtm-fabrica migration `0030_retire_signal_model.sql` dropped with `DROP SCHEMA … CASCADE` — so it is very likely dead at the data layer. But (a) it is import-reachable from live customer-facing chat routing (`chat.service.ts` gates two branches on it, `chat-tools.ts` exposes three tools, `experience-v2` type-depends on `CapabilityBundle`); (b) the new semantic API does **not** substitute market SIGNALS — that is a different product surface; and (c) the reachability proof that would settle it is a runtime probe against the real warehouse, which this environment cannot run. Removing it would delete a chat capability rather than remove dead weight from this substitution. **See "What to verify" below.** |
| `libs/intelligence` | LIVE. `chat/experience-v2/coverage-map.ts` imports `TEMAS`, `NOTAS_ESTRATEGIA`, `NOMBRE_GEOGRAFIA`, `normalizar`, `demuestraDe`, `nombreGeografia` from it, and coverage-map is reachable from `ChatService`. |
| `apps/api/src/intelligence/` | LIVE as an operator/eval surface through `pnpm intel:eval` (`evals/intelligence/run.mjs`). The former `apps/api` `intel` entrypoint was removed: it only validated two environment variables and then threw because its staging adapter was never wired; `intel:eval` remains the functional harness. |
| `radar/` generally | Customer-facing routes plus live billing/credits dependencies. Deletion here is reachability-driven, and nothing in `radar/` other than the MI adapter was implicated by this substitution. |
| `evals/market-research/gold/materialize.mjs` | Uses the existing semantic HTTP operations with a case-to-operation registry. Cases whose SQL gold needs joins, ranking, cross-relation composition, or a missing portable corpus digest are refused with typed statuses; no new operation is invented and the reviewed cases/gold SQL remain intact. |

## What to verify before removing the market-intelligence adapter

One probe settles it. Against the real GTM warehouse, as any role:

```sql
SELECT to_regprocedure('market_intelligence.discover_capabilities_v1()') IS NULL
    AND to_regnamespace('market_intelligence') IS NULL AS signal_model_is_gone;
```

If that returns `true`, the adapter cannot work and the whole MI path
(`postgres-market-intelligence.adapter.ts`, `ports/market-intelligence-gateway.port.ts`,
`planning/mastra-market-intelligence-workflow.ts`, `planning/market-intelligence-tools.ts`,
`planning/market-intelligence-tool-schemas.ts`, the `MARKET_INTELLIGENCE_GATEWAY`
binding in `radar.module.ts`, the three tools in `chat-tools.ts`, and the two
`ChatService` branches gated on it) is dead and can be removed. Keep
`planning/capability-bundle.contract.ts` — `experience-v2/coverage-map.ts`
type-depends on it.

## Manual infrastructure cleanup (not performed here)

This change touches no infrastructure. After merging and deploying:

1. Delete the Render service **GTM Query API Staging**.
2. Delete `MARKET_DATA_API_URL` from every Driftless environment. The API now
   **refuses to boot** if it is still set, so this must happen with the deploy.
3. Delete `MARKET_DATA_API_TOKEN` from every environment and from the secret
   store.
4. Close the ingress/port opened for the Query API (8931) if one exists.
5. Keep only the private PostgreSQL connection Driftless uses
   (`GTM_VAULT_DATABASE_URL`), its TLS CA and the read-only role.
6. Confirm `market_data_reader` can `SELECT` on
   `market_data_serving.supplier_search` and on nothing else in that schema.
7. Build and publish the first `supplier_search` projection
   (`node scripts/market-data/build-supplier-search.js --build`) — until one is
   active, supplier search returns `serving_projection_unavailable` by design.
