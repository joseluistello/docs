# F0.7 — EXPLAIN & payload budget gates

How a performance claim is **accepted**. A card that changes a hot path is not done because the
code changed — it is done when it produces the evidence below in its write-back. This keeps the
program honest: every optimization is measurable, not asserted.

## The four kinds of evidence

| Gate | Applies to | Evidence required | Pass condition |
|---|---|---|---|
| **Query plan** | any SQL hot-path change (F1.1, F1.2, F1.3, F5.1, F5.3, F6.1, F6.5) | `EXPLAIN (ANALYZE, BUFFERS)` of the new query on the large fixture | uses an index for the hot filter/sort; **no Seq Scan** on a large table; no sort spilling to disk |
| **Query count** | anti-N+1 work (F1.4, F4.2-adjacent, F5.1, F6.1, F9.2) | count of SQL statements per request, captured by the harness | constant w.r.t. result-set size (no growth with N rows) |
| **Payload size** | every read (F2.1, F2.2, F3.1, F3.2, F5.2, F5.5, F6.2, F7.4) | byte size of the JSON response on the fixture | ≤ the ceiling in `budgets.md` |
| **Timing** | every workflow in `budgets.md` | before/after p50/p95 on the fixture | meets the budget; never regresses a sibling workflow |

## How evidence is captured

- **Large fixture (F0.4)** — a deterministic, seedable dataset big enough that N+1 and Seq Scans
  actually hurt (thousands of topics/records, realistic anchor patterns). All gates measure
  against it.
- **Harness (F9.1)** — `scripts/harness/perf-check.sh` is the perf gate proper: it seeds the F0.4
  fixture into a Postgres (`PERF_DB_URL`/`TEST_DATABASE_URL`) and runs the query-count (F9.2),
  payload-size (F2.2) and timing-instrumentation (F0.3) specs against it, printing a single
  PASS/FAIL. It is wired into the umbrella `scripts/harness/check.sh` as an optional step (it
  SKIPs when no Postgres is configured), so `bash scripts/harness/check.sh` runs it where a DB is
  available. Optimization cards point their `validate` at `bash scripts/harness/perf-check.sh`
  (the focused gate) or `bash scripts/harness/check.sh` (the full suite). The `driftless`-internal
  profiling mode (F0.2/F0.3, `DRIFTLESS_PERF_TIMING`) captures the per-request latency + SQL count
  it reads.
- **EXPLAIN gate** — run the candidate query with `EXPLAIN (ANALYZE, BUFFERS)` against the
  fixture DB and paste the plan (or its verdict) into the card write-back.

## Acceptance path per card (the rule)

Every optimization card's write-back MUST contain at least one of: a query plan verdict, a
query-count number, a payload-size number, or a before/after timing — whichever its row above
requires. A card whose only artifact is "code changed" does not pass.

## Validate-command correction (applies program-wide)

The cards were authored against `npm` and the workspace name `@driftless/cli`. Reality:

- Package manager is **pnpm** (`packageManager: pnpm@10.33.4`).
- CLI package is **`@driftless-sh/cli`** (run `pnpm --filter @driftless-sh/cli test`).
- The harness perf gate is `bash scripts/harness/perf-check.sh` (or the full `bash
  scripts/harness/check.sh`, which runs it as an optional step). It needs a Postgres via
  `PERF_DB_URL`/`TEST_DATABASE_URL`; without one it SKIPs. Cards that change a SQL hot path also
  capture EXPLAIN evidence + the profiling mode (F0.2/F0.3).

When working a card, fix its `validate` to the pnpm form before relying on it.
