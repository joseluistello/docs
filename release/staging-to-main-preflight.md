# staging -> main preflight

Operator runbook for merging `staging` into `main`. Source: the GO/NO-GO audit of
`origin/main` <- `origin/staging` (33 new migrations, 449 commits). Run the
checklist below before merging; this doc does not replace it.

## Why the gate exists

`apps/api/src/main.ts` runs pending migrations at process startup whenever
`NODE_ENV` is `production` or `staging` (`AppDataSource.runMigrations`). A
migration failure calls `process.exit(1)` -- the API does not come up, it is
not "the feature is off." With `transaction: 'each'`, migrations commit one at
a time: if migration 139 fails, migrations 119-138 stay applied and
committed; the resulting state is partial but consistent, never corrupt.

`autoDeploy: true` on the prod Render service means merging to `main` triggers
the deploy immediately -- there is no manual gate between merge and deploy.
That is what makes the pre-merge checks below non-optional rather than
nice-to-have.

## Pre-merge checklist

| # | Check | Where | Blocks merge |
|---|---|---|---|
| 1 | 🔴 Run `scripts/release/preflight-prod.sql` against the prod application database -- block 1: 3 rows, all `0`; block 2: 1 row with `0`, OR a `42703 column does not exist` error (passes trivially -- see below) | Production Postgres (Supabase, `driftless-api-prod`) | Yes |
| 2 | 🟠 Confirm in Render, `driftless-api-prod` service settings, that `MARKET_DATA_API_URL` and `MARKET_DATA_API_TOKEN` do **not** exist | Render dashboard | Yes |
| 3 | 🟠 Read `GTM_VAULT_DATABASE_URL` on `driftless-api-prod` and classify it: points at the shared staging warehouse / points at its own prod database (verify migrations `0001-0078`, grants, and licensing in `gtm-fabrica`) / absent (market-data degrades cleanly with `market_data_unavailable`, does not block the release) | Render dashboard (+ `gtm-fabrica` repo if it's its own database) | Only for market-data |
| 4 | Have someone watching logs during the merge -- `autoDeploy` means the deploy starts the moment the merge lands | -- | No |

Checks 1 and 2 are release blockers. Check 3 only conditions whether
market-data works day one; its absence degrades cleanly and does not put the
release at risk.

**Check 1 in detail.** Migrations `1715200000139` and `1715200000151` add
unique indexes on `entities` and `records`, each guarded by a `RAISE
EXCEPTION` that aborts before building the index if it finds duplicate rows.
The columns involved (`linked_gtm_entity_id`, `fields->>'candidate_ref'`,
`fields->>'source_promotion_key'`) are written only by staging-only features
(Radar / GTM / chat-promotion), so on a prod database that never ran those
features all four counts should already be zero -- `preflight-prod.sql`
confirms it in seconds, read-only.

`preflight-prod.sql` is split into two blocks, meant to be pasted and run
separately. Block 1 checks the three constraints on `records`, which exists
in prod today, so it always runs cleanly -- expect 3 rows, all `0`. Block 2
checks `uq_entities_workspace_gtm_link`, which depends on
`entities.linked_gtm_entity_id` -- a column that migration `1715200000130`,
part of this same release, creates. On prod pre-release that column does not
exist yet, so block 2 fails with `ERROR 42703: column
"linked_gtm_entity_id" does not exist` -- that error is expected and means
the check passes trivially, since a column that does not exist cannot hold
duplicates. Blocks are separate statements precisely so that error can't take
down the three valid checks in block 1 the way a single combined query would.
Once staging (or prod, post-release) has run migration 130, block 2 runs
normally and must also return `0`.

**Check 2 in detail.** `config.ts` fails boot with a `TypeError` if
`MARKET_DATA_API_URL` or `MARKET_DATA_API_TOKEN` are present in the
environment -- the GTM Fabrica HTTP transport they belonged to was removed,
and this is a deliberate fail-closed guard against an operator believing
market-data still flows over HTTP. `main` never read those variables, so the
risk is only that someone set them by hand on the prod service.

## Rollback

**Scenario A -- the API starts but something breaks functionally (most likely).**

1. `git revert -m 1 <merge-commit-sha>` on `main`, push.
2. `autoDeploy` redeploys automatically; verify `/health` and `GET /version`.
3. Do **not** revert the migrations. All 33 are backward-compatible with
   `main`'s code -- verified migration by migration in the audit -- so leaving
   them applied is safe and is exactly what makes a code-only rollback
   possible.
4. Confirm with `SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 5;`.

**Scenario B -- the API does not start (a migration failed).**

1. Render keeps the previous instance serving traffic if the new deploy's
   health check never passes -- there is no downtime window as long as the
   deploy never goes healthy. Confirm in the Render panel that the prior
   version is still serving.
2. Read the log line `[Driftless] Migration failed:` -- it names the exact
   migration.
3. If it was 139 or 151, run the duplicate-detail query in
   `scripts/release/preflight-prod.sql`, reconcile the duplicates by hand,
   then redeploy. There is no automatic shortcut, by design.
4. If restoring service is urgent, revert the merge commit. Migrations already
   applied (119...N) stay compatible with the old code.

**Never run a migration's `down()` in production.** `down()` blocks exist for
development rollback, not production incident response -- e.g. migration
120's `down()` runs `DELETE FROM topic_events WHERE repo_id IS NULL`, which
destroys history the `up()` made possible.
