# Phase 7 — Evals, Rollout and Operations

## Goal

Prove the complete vertical slice is useful, bounded, private, recoverable and affordable before it
becomes generally available.

## Test matrix

### Hermetic

- plan parsing and state transitions;
- candidate id/dedupe/ranking;
- idempotent step replay;
- event sequence/replay;
- cursor pagination;
- artifact spec validation;
- chart aggregation correctness;
- export escaping/encoding;
- Collection promotion preview/idempotency;
- provider contract/error normalization;
- architecture boundaries;
- tenant isolation and auth.

### Failure injection

- process killed during every step;
- provider timeout/rate limit/malformed payload;
- model produces invalid structured output;
- database reconnect;
- duplicate event notification;
- stale browser reconnect;
- stop during provider call;
- partial source coverage;
- artifact renderer unavailable;
- promotion response lost after commit.

### Live staging

Run the frozen objectives from Phase 1 against the configured DeepSeek/provider stack. Capture:

- time to plan and first candidate;
- time to terminal state;
- candidates before/after dedupe;
- verified/uncertain/contradicted;
- independent sources per verified candidate;
- cost by model and provider capability;
- resume count;
- user stop/abandonment;
- exports and promotions;
- rendered artifact type and fallback rate.

Live tests SKIP without credentials and say exactly why.

## Product acceptance scenarios

1. Start with defaults, watch rows arrive, refresh, inspect evidence, export.
2. Answer all clarifications and observe the plan reflect them.
3. Stop midway and use the partial dataset.
4. Kill/redeploy midway and observe automatic resume with no duplicates.
5. Open table, metrics and chart views over the same dataset.
6. Select verified rows and promote them to a Collection; retry safely.
7. Provider unavailable: prior/warehouse data remains and terminal state is honest.
8. Zero candidates: describe coverage and offer bounded scope changes, never market absence.
9. Spanish and English UI contain no tool/provider/internal-budget vocabulary.
10. Ordinary Chat regression suite and visual baselines remain green.

## Rollout

1. Feature off by default.
2. Internal Golden workspace only.
3. Dogfood with hard concurrency and spend ceilings.
4. Expand to selected workspaces after live quality gate.
5. General availability only after retention, support and pricing decisions are explicit.

Do not add credits or billing behavior inside this phase. Measure real cost first and present a
separate product decision.

## Operational dashboards

Use the existing Latitude/PostHog/database ledgers. Required views:

- starts, completions, partials, failures, cancellations;
- p50/p95 time to first candidate and completion;
- stale/recovered jobs;
- cost per useful/verified candidate;
- evidence coverage and artifact fallback rate;
- export and Collection-promotion conversion;
- provider error/latency by internal adapter.

No second observability vendor.

## Final delivery report

Include:

- base and final SHAs;
- commits by phase;
- migrations and rollback commands;
- exact test totals and skipped checks;
- live staging report;
- known limitations;
- security/privacy review;
- bundle and database-connection impact;
- evidence that Chat remained independent.

## Rollback rehearsal

Prove before launch:

- navigation/feature can be disabled;
- queue can stop claiming new work;
- running jobs settle as partial/cancelled without data loss;
- API remains read-only for existing investigations;
- artifact rendering falls back to canonical table;
- provider adapter can be disabled independently;
- Collection promotion can be disabled without breaking existing records.

