# Phase 2 — Durable Investigation Core

## Goal

Wrap the validated discovery engine in a resumable, idempotent resource that runs outside an HTTP
request and survives deploys without duplicating candidates.

## Domain contract

Create one explicit `Investigation` kind for this slice: `company_expansion`.

States:

`draft -> scoping -> planned -> queued -> running -> completed | partial | failed | cancelled`

The platform owns a closed plan:

1. scope;
2. discover (one to three bounded rounds);
3. resolve identity and dedupe;
4. verify;
5. enrich from semantic warehouse operations;
6. prioritize;
7. synthesize.

The model may supply content inside typed steps. It may not add steps, choose budgets, decide to
loop indefinitely, mint evidence ids or set terminal status.

## Persistence

Add exactly three tables in one forward-only migration:

### `investigations`

Parent lifecycle, workspace, creator, optional source thread, objective, status, typed plan JSON,
closed clarification answers, counters, heartbeat, cancellation request, failure reason and
timestamps.

### `investigation_events`

Append-only curated replay with monotonic sequence per investigation. Store a closed `kind`, a
`label_key`, and numeric/enum detail only. Never store model reasoning, queries, tool/provider names
or raw result payloads.

### `investigation_candidates`

Persist the existing `WebMarketCandidate` projection: deterministic candidate id, organization,
signal, geography, published date, evidence ids, independent-source count, status, score, ranking
reasons, warnings and optional resolved entity id.

Unique key: `(investigation_id, candidate_id)`.

Do not create `investigation_steps`; step state lives in the versioned, runtime-validated plan JSON.
Do not reuse the orphaned `WorkSession*` or `gtm_research_runs` schema.

## Execution

- Add a dedicated pg-boss queue following `StewardQueueService`.
- Reallocate the obsolete `workSessionWorkflow` connection-budget slot; do not increase the total
  connection budget without evidence.
- Use compare-and-set for state transitions.
- Persist a step outcome before marking the step `done`.
- On retry, skip `done`/`skipped` steps and UPSERT candidates from any re-run step.
- Add a reaper for stale queued/running rows following existing cron/state-machine conventions.
- Use `retryLimit: 2` only while every step remains idempotent. Pin that invariant in tests/comments.
- Reuse `AgentRunsService` for each model attempt and `ModelUsageService` with surface
  `investigation`. Do not write either ledger directly.

## Cancellation and partial results

- `cancel_requested_at` is checked between steps and aborts an in-process provider call when
  possible.
- Cancelled and partial runs keep every candidate already persisted.
- A web failure ends web discovery; it must not delete warehouse enrichment or prior rows.
- `partial` is an explicit terminal state with incomplete steps and warnings, not a disguised error.

## Tests

- Legal and illegal state transitions.
- Two concurrent starts enqueue once.
- Re-entry from every step.
- Process death after candidate UPSERT but before step completion.
- Replayed step produces no duplicate rows.
- Tenant isolation.
- Stop preserves rows.
- Reaper handles stale heartbeats and leaves fresh jobs alone.
- Entity and migration registration guardrails.
- Architecture guard: `apps/api/src/chat/**` and `apps/api/src/investigations/**` cannot import each
  other.

## Acceptance

Kill the worker while discovery is running, restart it, and observe one terminal investigation with
no duplicate or lost persisted candidates. The ordinary Chat test suite must pass without modifying
Chat behavior.

## Rollback

Disable queue startup, remove `InvestigationsModule` registration, and revert the phase commit.
Tables remain inert until a separate forward-only removal migration is deliberately approved.

