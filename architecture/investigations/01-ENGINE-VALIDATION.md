# Phase 1 — Validate the Existing Discovery Engine

## Goal

Prove the current Company Expansion discovery engine is worth making durable before building the
durability layer. This phase changes no product architecture and creates no database tables.

## Why first

`prepareWebMarketDiscoveryEvidence()` already performs typed brief creation, bounded retrieval,
schema-constrained extraction, deterministic dedupe, explainable ranking and top-candidate
verification. The unresolved risk is result quality on real Mexican commercial objectives, not the
shape of the workflow.

## Required cases

Freeze at least five objectives representative of the intended product:

1. manufacturers announcing new plants in northern Mexico in the last 90 days;
2. hospital groups announcing expansions in Mexico;
3. automotive suppliers expanding capacity in Nuevo Leon or Coahuila;
4. logistics companies opening cross-border facilities;
5. industrial companies announcing capex where a local supplier could sell equipment or services.

Each case must declare:

- geography;
- freshness window;
- target result count;
- evidence threshold;
- commercial-priority rule;
- exclusions.

## Deliverables

- A committed, credential-gated live runner under the existing eval conventions.
- Fixtures for deterministic parsing/dedupe/ranking tests.
- A machine-readable report per case containing:
  - documents retrieved;
  - candidates before and after dedupe;
  - verified, uncertain and contradicted counts;
  - independent source counts;
  - wall time, model calls, web calls and cost;
  - the final top candidates and their evidence ids.
- A short human scorecard for usefulness, correctness, duplication and recency.

## Constraints

- Use the existing `ResearchWebSurface`, provider port and evidence ledger.
- Do not add another provider in this phase.
- Do not increase budgets until the baseline demonstrates that budget, rather than query quality or
  source coverage, is the bottleneck.
- Do not turn this into an exhaustive crawler.
- A zero-result run describes the executed search and coverage; it never claims the market is empty.
- Live tests SKIP without credentials. They never PASS by omission.

## Acceptance

- At least three of five cases return five or more unique candidates with direct evidence.
- Every `verified` candidate satisfies the configured evidence threshold.
- Duplicate articles do not inflate unique-company counts.
- No model-authored URL or date becomes platform evidence without provider provenance.
- The report distinguishes sources/documents, raw candidates and unique companies.
- The run converges within the declared hard limits.

If this gate fails, stop. Report whether the blocker is provider coverage, extraction, dedupe,
verification or query planning. Do not hide a data-quality failure under durable infrastructure.

## Verification

- Focused contract/protocol tests.
- Credential-gated live runner against staging providers.
- `corepack pnpm typecheck`
- `corepack pnpm build`
- `bash scripts/harness/check.sh`

## Rollback

The runner and fixtures are additive. Revert the phase commit; no persistent state exists.

