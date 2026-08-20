# Web Market Discovery — convergence and boundaries

Driftless had two information surfaces: the governed warehouse (supplier
discovery, opportunity discovery, market history) and targeted Web Evidence,
which verifies a claim about an entity someone already named.

Neither could answer the question a commercial user actually asks first:

> *Vendo estructuras metálicas. ¿Quién está construyendo plantas en Nuevo León?*

Nobody has named the organization yet. There is no tender, because the project is
private. There is no award, because nothing was procured. The signal exists only
as something a publisher printed. That is the gap `discover_web_market_signals`
closes, and this document is the boundary around it.

## The invariant this change is for

**One implementation of the Parallel Search transport, shared by every
capability that needs it.**

Before, `radar/adapters/parallel.adapter.ts` implemented both
`DiscoveryProviderPort` (FindAll — exhaustive discovery) and
`EvidenceWebProviderPort` (Search). It was registered in two Nest modules, and
Nest providers are module-scoped, so there were **two objects and two circuit
breakers over one upstream**: targeted verification could keep calling a provider
the Radar had already declared down, and vice versa.

| | before | after |
|---|---|---|
| files containing `/v1/search` | 1 | 1 |
| classes implementing the Search port | 1 (also FindAll) | 1 (Search only) |
| modules registering that class | 2 | 1 |
| runtime instances / circuit breakers for Search | 2 | 1 |
| capabilities on that instance | verification | verification + discovery + the Radar's paid gateway |
| FindAll reachable from `research-providers/` | yes, via the bound class | no — different class, different directory, different token |

The Search half was **extracted**, not rewritten:
`research-providers/adapters/parallel-search.adapter.ts`. The Radar's FindAll
adapter keeps only the verbs that start a discovery run, and the Radar's own
`WebResearchGateway` now injects the shared instance through
`WEB_RESEARCH_PROVIDER` instead of re-binding the class.

FindAll keeps its **own** breaker on purpose. A discovery run is minutes long and
priced per match; a search is one cheap synchronous call. One shared breaker
would let a discovery outage open the circuit on verification — availability
coupling between two capabilities that share nothing but a vendor.

## What the two web capabilities share, and what they do not

Shared, in exactly one place each:

| Concern | Where |
|---|---|
| HTTP client, request body, retry, circuit breaker | `research-providers/adapters/parallel-search.adapter.ts` |
| Retry policy and breaker primitives | `research-providers/adapters/resilience.ts` |
| "May this call happen", provider failure classification | `research-providers/web-search.execution.ts` |
| Egress gate (no contacts, URLs, SQL, credentials, rows) | `forbiddenEgressIn` in `web-evidence.contract.ts` |
| Excerpt sanitation | `sanitizeExcerpt` in `web-evidence.contract.ts` |
| Untrusted-content fence | `research-providers/web-untrusted.ts` |
| Evidence id minting, source domain | `webEvidenceId` / `sourceDomainOf` in `web-evidence.contract.ts` |
| Session identity (`session_id` = the run id) | the adapter |
| Run budget, evidence ledger, audit | `cognitive/market-research/research-web-surface.ts` |
| Citation resolution | `cognitive/market-research/research-citations.ts` |

Separate, because the semantics are genuinely different:

| | `search_web_evidence` | `discover_web_market_signals` |
|---|---|---|
| Starts from | a named entity and a claim | a market signal and a place |
| Answers | is this true? | who is doing this? |
| Can return unknown entities | no | **yes** |
| Vocabulary | supported / contradicted / unverified | discovered / verified / uncertain / contradicted |
| Reachable as a model tool | yes | **no** — the router selects it as a protocol |
| Promises exhaustiveness | n/a | **never**, and says so on every result |

## Budget and stop conditions

**Two successful provider calls per run, shared.** Not two each. The run's
`ResearchWebSurface` owns the ceiling; both capabilities reserve from it, and a
refused reservation is still recorded in the audit with its own platform id.

A discovery protocol spends at most:

1. one discovery search, and
2. one grouped verification call over the top ≤5 candidates.

Stop conditions, all terminal, all checked:

- the brief is invalid → refuse before spending;
- the run's web budget is spent → stop, audited;
- the provider failed → stop, audited, **warehouse untouched**;
- no candidate cleared extraction → stop with an honest zero;
- `target_results` reached → verification covers the top slice;
- verification finished → done.

There is no loop that can run twice. HTTP-level retry inside the adapter still
applies to transient failures and is observable through the attempt count; it
never re-runs a *run-level* call.

Economic budget today is a **call budget**. The adapter prices a search and the
shared executor refuses anything whose worst case exceeds
`WEB_SEARCH_MAX_USD_PER_CALL` (0.05 USD), so cost is bounded — but the run does
not yet accumulate spend across calls. The extension point is
`EvidenceWebUsage.costUsd`, already returned by the adapter and already recorded
per attempt; accumulating it into a per-run monetary ceiling is a small change in
`ResearchWebSurface` and deliberately not made here rather than inventing an
accounting that nothing consumes.

## Deletion ledger

| File / symbol | Action | Reachability evidence | Condition |
|---|---|---|---|
| `radar/ports/web-search-provider.port.ts` | **deleted** | no importer; proven by `web-search-topology.spec.ts` before deletion | immediate |
| `radar/ports/source-family.ts` | **deleted** | no importer; same spec | immediate |
| `radar/adapters/parallel.adapter.ts` — `capabilities/estimate/health/search/fetch/extract/cancel` | **deleted** | the class no longer declares `EvidenceWebProviderPort`; guarded by `web-search-topology.spec.ts` | immediate |
| `radar/adapters/parallel.types.ts` — `ParallelSearchResult`, `ParallelSearchResponse` | **moved** to `research-providers/adapters/parallel-search.types.ts` | the only importer was the adapter's search half | converged |
| `radar/adapters/resilience.ts` | **shim retained** | live consumers: `coldiq.adapter.ts`, `exa.adapter.ts`, `apollo.adapter.ts` | delete once those three import `research-providers/adapters/resilience` directly — a one-line change each plus a grep |
| `radar.module.ts` — `{ provide: WEB_RESEARCH_PROVIDER, useExisting: ParallelAdapter }` | **deleted** | the token now resolves through the imported `ResearchProvidersModule` | immediate; re-adding it recreates the second instance and fails the topology spec |
| `WebEvidenceService` — provider execution, health probe, failure mapping | **delegated** | duplicated with the discovery service | converged into `web-search.execution.ts` |
| `WebEvidenceToolBelt` — call counter, evidence ledger, audit array | **delegated** | duplicated per capability | converged into `ResearchWebSurface` |
| `WebSearchMode` value `exhaustive` | **renamed** to `thorough` | no production consumer besides the tier mapping | immediate — no tier demonstrates enumeration, and the old name read as a promise |
| `radar/adapters/exa.adapter.ts` (`ExaAdapter`) | **retained** | bound in no module; referenced only by its own spec | out of scope: it implements the legacy transport port and its migration is a separate adapter rewrite |
| `WebResearchGateway`, `ExhaustiveDiscoveryGatewayService`, FindAll, pricing, credits, approvals | **retained** | live Radar callers | none — these are the Radar's product, not legacy |

## What is NOT reachable from this capability

Enforced mechanically, not by review:

- **FindAll / exhaustive discovery** — the Search class does not have the verbs;
  `research-providers.architecture.spec.ts` sweeps `findall`, `/v1beta`,
  `match_limit`, `createrun`, `streamrun`, `draftfrombrief` across the whole
  layer, adapters included.
- **Contact enrichment / people search** — swept in the same spec plus
  `market-research.architecture.spec.ts`; the brief refuses people vocabulary,
  and a planned query naming a person is dropped rather than repaired.
- **A second provider, a second HTTP surface, a second runner, a second
  synthesis** — no controller, no entity, no repository in either layer, and the
  audit tool vocabulary is closed to the warehouse operations plus exactly two
  web capabilities.
- **A model-authored URL, id or date** — every identifying field is re-derived
  from the platform's own ledger, and a candidate citing an id the platform never
  issued is dropped before it can be rendered.

## Contracts

Verification, unchanged and backwards-compatible:

```ts
search_web_evidence {
  objective: string, entities: string[], claims_to_verify: string[],
  freshness_days: number | null, max_results: number
}
```

Discovery, new:

```ts
discover_web_market_signals {
  objective: string,          // required, ≤300 chars
  signals: string[],          // 1–4, must name market EVENTS
  geographies: string[],      // 0–3
  freshness_days: number,     // 1–730, defaults to 365 and is declared
  exclusions: string[],       // 0–5
  target_results: number      // 1–10
}
```

`additionalProperties: false`. There is no provider, processor, mode, raw query
list, host allowlist, output schema, enrichment flag, people field, warehouse row
or SQL — every one of those is either a vendor concept or an unbounded-spend
concept, and the platform owns all of them.

A brief that cannot be answered honestly is refused **recoverably**:

```json
{
  "error": "web_discovery_brief_too_broad",
  "why": "...",
  "missing": ["signals"],
  "suggested_correction": { "signals": ["nueva planta"] }
}
```

## Deduplication and independence

Merging is conservative and never fuzzy. Two candidates merge only when they
share a **verified domain** (the host's label matches the organization name) or
the **same normalized name AND the same stated geography**.

- "ABC Industrial" in Monterrey and in Puebla stay two candidates.
- "Grupo Brisas" and "Grupo Hotelero Brisas" stay two candidates.
- Two articles about the same project from the same company consolidate, keeping
  **all** the evidence, and record the alternate spellings and the merge rule.

Independence collapses syndication: one publisher is one origin however many of
its pages came back, and the same headline on three hosts is one origin. A
candidate is only promoted to `verified` when a **new** origin says something
compatible.

## Comparing this against Parallel's Task API, later

Not implemented, and deliberately not integrated on intuition. When we run it:

- **Arm A** — this workflow over Search: bounded planning, one discovery call,
  extraction under a strict schema, dedupe, ranking, one verification call.
- **Arm B** — the Task API on the same broad question, same objective, same
  output criteria.

Score both on the metrics in the live-eval runbook: useful candidates in the top
10, human precision, duplicates, candidates without evidence, fabricated URLs,
unresolvable evidence, calls, latency, cost, and lift over warehouse-only.

Decision rule, agreed before the numbers exist:

- if the Search workflow is close enough in quality at materially lower latency
  and cost, keep it and do not add a second provider surface;
- if the Task API materially improves depth and coverage on broad questions,
  adopt it as an explicit **deep-research escalation** behind its own budget and
  approval — never as a silent replacement for this protocol.

## See also

- `docs/market-data/web-market-discovery-live-eval.md` — the runbook. Nothing in
  it has been run.
- `docs/market-data/web-evidence-live-smoke.md` — the verification smoke test.
- `docs/market-data/commercial-intelligence-v1.md` — the harness this capability
  composes into.
