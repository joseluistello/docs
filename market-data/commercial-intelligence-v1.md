# Commercial Intelligence v1 — consolidation and evidence

Status: merged and deployed. Live warehouse, stability and bounded Web
Evidence controls recorded here as of this branch; risks and permits search
shipped afterward as two further warehouse operations — see
[`semantic-api.md`](./semantic-api.md) for the current operation count and
routes.

This document is the integration ledger for the semantic market-data API, the
domain research protocols, targeted Web Evidence, the customer Workbench and
their evaluation program. It records what is physically implemented, what has
been demonstrated live, and what remains transitional. Architecture is not
considered proven merely because hermetic tests pass.

## One product path

```text
question
  → domain router
  → Supplier | Opportunity | History protocol
  → shared semantic tool belt, audit and resource policy
  → one synthesis and platform reconciliation
  → ResearchReport + Work Session artifact
  → /w/:slug/research
```

Mixed questions compose domain protocols; they do not create a fourth physical
domain. Independent objectives may execute concurrently over the same shared
belt. Dependencies are explicit — for example, a supplier search conditioned
on a selected opportunity follows that opportunity search. The universal
model-directed loop remains an exceptional escape for an intent the router
cannot classify, not the normal path.

The warehouse operations (nine as of `semantic-api.md`, including risk and
permit search) remain the only market-data tools. The model
does not receive SQL. `search_web_evidence` is a separate, bounded verification
capability and can run only after warehouse evidence identifies a concrete
entity, claim or coverage gap. It is not supplier discovery, enrichment or
exhaustive web search.

The post-protocol gate is a structured decision, not an unconstrained tool
turn. DeepSeek receives the question, non-sensitive counts and organization
names from a closed projection, then emits `search|skip` plus the five request
fields the capability accepts. The platform validates and executes that request.
An explicit positive request cannot be silently skipped; an explicit refusal
keeps the web budget untouched.

## Domain protocols

| Domain | Retrieval recipe | Completion evidence |
|---|---|---|
| Supplier | At most three complementary discovery searches when the question names distinct geographies or segments, dedupe by source identity, preserve exclusions only when published text supports them, reserve budget for individual detail reads | candidate identity, match explanation, detail and published contact boundary |
| Opportunity | Exact filters plus governed hybrid text retrieval, preserve aperture/actionability semantics, batch details only for selected stable IDs | relevant opportunities with platform dates and explicit non-deadline warnings |
| History | Resolve contractual identity before history; aggregate only inside an observed currency and amount-scope pair | RFC-grounded history or buyer/market aggregation with separated grains |
| Mixed | Build a typed objective/dependency plan and compose the three protocols over one audit | every conclusion reconciles to observations produced in the same run |

## Resource and report policy

- The call count is a high safety fuse, not the research strategy.
- Each warehouse observation records elapsed cost and useful yield.
- Three consecutive calls without new evidence, a new detail or a distinct
  bounded zero-result probe stop exploration as stagnated.
- Repairable report excess is normalized before semantic validation. One
  bounded synthesis repair receives the concrete failure. If synthesis still
  fails, the platform emits an honest partial or unsupported report and keeps
  the complete audit; useful rows are never discarded for presentation shape.
- Evidence, coverage, provenance, timestamps, cost and citation URLs are
  platform-owned. Model-authored facts and recommendations may only refer to
  evidence IDs that exist in the audit.

## Customer surface

`/w/:slug/research` is the canonical product surface. Its standalone
`POST /workspaces/:slug/research/runs` entry point calls the commercial-research
runner directly and streams the runner's typed events as NDJSON. It owns no Chat
thread, Chat message, Investigation entity or source-thread reference. The
durable execution ledger is the existing AgentRun and the deliverable is the
existing ResearchReport; provider transport, market-data services, audit and
resource policy remain shared platform capabilities.

The Workbench accepts a decision objective plus optional company, product,
inputs/BOM, target market and decision constraints. It renders actual progress
events, the answer, facts, inferences, candidates, actions, evidence, coverage,
warnings and a collapsed audit. It has no fixture fallback. The former
`/w/:slug/intelligence/investigator` URL is a compatibility redirect to this
surface, never a second product implementation.

`/w/:slug/intelligence` remains reachable and fixture-driven. It is not a
second supported product; it is retained until live parity, accessibility and
reachability checks are recorded and a human approves deletion.

## Evaluation gates

1. **Retrieval:** 30 Supplier, 20 Opportunity and 15 History candidate cases.
   Materialization records a live corpus basis but remains unsigned until a
   human supplies expected stable IDs and `reviewedBy`.
2. **Trajectory:** live Supplier, Opportunity, History and Mixed questions,
   plus web-needed, web-unneeded, insufficient-coverage and monetary
   currency/scope cases.
3. **Stability:** five runs per frozen configuration, reported by domain with
   verdict agreement and top-candidate Jaccard. Retrieval, strategy and
   synthesis variance are separate failures.
4. **Ownership:** every failure is one or more of `retrieval_miss`,
   `strategy_miss`, `provider_fail`, `contract_reject`, `synthesis_error` or
   `render_fail`.

Hermetic tests demonstrate contracts and control flow. Live controls now prove
one necessary and one unnecessary Web Evidence trajectory, including platform-
owned clickable citations; they do not substitute for a retrieval gold set or
customer-visible browser QA.

## Reachability-based deletion ledger

| Surface | Current decision | Deletion trigger |
|---|---|---|
| `/w/:slug/intelligence` and its fixtures | Preserve temporarily | `/research` proves live parity for all three domains, chat streaming, errors, cursors, details, accessibility and narrow viewports; human approves removal |
| Existing `ParallelAdapter` in `radar/` | Preserve; reused through the neutral provider port | Move only when a second real consumer requires it or all Radar call sites are independently retired; never duplicate the adapter |
| Web-evidence compatibility re-exports | Preserve as migration shims | repository-wide import reachability is zero after callers migrate |
| Radar paid discovery, FindAll, enrichment, billing, credits and monitors | Preserve and keep unreachable from this research slice | separate product decision with explicit cost, authority and customer trigger |
| Operator SQL tools in `gtm-fabrica` | Preserve | never part of the model surface; required for warehouse diagnosis and controlled evals |
| Old SQL-over-HTTP Query API | Deleted from code | infrastructure service and stale environment variables are removed during an explicitly approved deploy |
| Unsigned retrieval materializations | Preserve as eval artifacts, never gold | human review signs or rejects every case |

The ledger was rechecked after the live completion slice on 2026-08-13. No
additional legacy surface is safe to delete: `/research` has contract/build
parity and live report artifacts. A local Workbench-contract smoke authenticated
through the same workspace boundary and exercised live capabilities, coverage,
Supplier, Opportunity and History routes against staging: all five returned the
shared `market-data/domain/1` contract with governed coverage; Supplier and
History also returned their required semantic warnings. Visual accessibility
and narrow-viewport parity remain unproven because no controllable browser was
available in the verification environment. `/intelligence` therefore remains
transitional.

No deletion is justified by filename, age or architectural preference. A
customer-facing or billing-reachable path requires a runtime/reachability proof
and explicit human approval.

## Explicitly deferred

No Dynamic Workflow persistence, multi-agent supervisor, sandbox/code mode,
enrichment, FindAll, new Source Packs, dense retrieval, entity-resolution
graph, automatic outreach or weakening of semantic invariants is part of this
consolidation. Each needs its own measured trigger.

## Durable governance

Draft Topics:

- `commercial-intelligence-domain-protocols`
- `targeted-web-evidence-policy`
- `commercial-research-workbench`
- `commercial-intelligence-evaluation-program`

Execution board: **Commercial Intelligence v1 — consolidation and evidence**.
The board leaves human gold review, legacy deletion, merge and deployment as
explicit human decisions.

Live N=5 evidence and limitations:
[`commercial-intelligence-v1-live-eval.md`](./commercial-intelligence-v1-live-eval.md).
