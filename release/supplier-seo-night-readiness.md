# Supplier SEO night readiness — staging/noindex only

This is the operator order after the `gtm-fabrica` single writer finishes. Its
only successful outcome is **ready for human review in staging while all 58
supplier pages remain noindex**. It never authorizes production, deployment,
index approval, a global indexing flag, or a second warehouse writer.

The machine gate is offline:

```bash
node scripts/release/supplier-seo-night-readiness.mjs --template > /tmp/supplier-night-evidence.json
node scripts/release/supplier-seo-night-readiness.mjs --check /tmp/supplier-night-evidence.json
```

Fill the ledger only from retained command output. Do not put a DSN, API key,
token, raw query, contact coordinate, source row or page body in it. The
validator rejects credential-shaped values and exits non-zero on every missing,
out-of-order or unsafe gate.

## Stop conditions

Stop immediately and leave the prior pages/indexing state untouched when any
of these is true:

- the writer is queued, in progress, cancelled, skipped, timed out or failed;
- another job holds `staging-market-data-writer`;
- less than 15 minutes have elapsed since the writer completed;
- RDS metrics have no datapoints or have not returned to their pre-writer
  baseline/stable-low state;
- the warehouse is not exactly `gtm_vault_staging` as
  `market_intelligence_consumer`, TLS, transaction read-only and unable to
  write any user relation;
- plan-only does not cover exactly 58 launch candidates in batches `[50, 8]`;
- any page fails, is indexable, leaks contact/source data or enters a sitemap;
- `SEO_INDEXING_ENABLED` is not exactly `false`/unset for this operation.

Do not cancel a long writer just because it is slow. A terminal GitHub result,
not elapsed time, is the handoff signal.

## 1. Prove the writer is terminal

The authoritative writer is job `structured-sync` in workflow
`Staging Structured Market Data` from `joseluistello/gtm-fabrica`. It must be a
`full` run on branch `staging`, conclusion `success`; migration-only is not
supplier-corpus evidence.

Owner/operator commands (read-only; run later, not during code review):

```bash
gh run view "$GTM_RUN_ID" --repo joseluistello/gtm-fabrica \
  --json databaseId,workflowName,headBranch,headSha,status,conclusion,createdAt,updatedAt,jobs

gh run download "$GTM_RUN_ID" --repo joseluistello/gtm-fabrica \
  --name "staging-structured-market-data-$GTM_HEAD_SHA" \
  --dir "$NIGHT_EVIDENCE_DIR/writer"
```

Inspect the downloaded evidence without printing a DSN. Require the
`structured-sync` job, all its steps, the source/serving E2Es, relation
statistics, supplier projection status, five-question smoke and blind probe.
Record the run id, SHA, job start/completion times and
`artifactsVerified=true` only after that inspection. Check current Actions runs and record
`otherWriterActive=false`; do not infer it from this run alone.

## 2. Cool down and inspect RDS metrics

Start the clock at the terminal `completedAt`. Wait at least 15 minutes with no
other writer. Capture a window that includes a pre-writer baseline and the full
cooldown. The validator requires these six `AWS/RDS` metrics for DB instance
`driftless-gtm-vault`, region `us-east-1`, period at most 300 seconds:

- `CPUUtilization`
- `DatabaseConnections`
- `FreeableMemory`
- `ReadIOPS`
- `WriteIOPS`
- `DiskQueueDepth`

Use `aws cloudwatch get-metric-data` or six `get-metric-statistics` calls with
`Dimensions=[{Name=DBInstanceIdentifier,Value=driftless-gtm-vault}]`. Retain the
raw read-only JSON outside the repo. Mark a metric `recovered=true` only when it
has datapoints and the post-writer tail is at/better than its pre-writer
baseline or is stably low. Do not invent a numeric threshold when there is no
baseline; keep the gate blocked.

## 3. Run the exact staging/read-only handshake and plan-only calibration

Use the fixed secret name; never paste its value:

```bash
export NODE_ENV=staging
export SEO_SUPPLIER_CALIBRATION_SECRET_ID=driftless-gtm/market-intelligence-consumer-database-url-staging
export SEO_INDEXING_ENABLED=false

pnpm --filter @driftless/api seo:supplier-explain -- --cohort=launch \
  > "$NIGHT_EVIDENCE_DIR/supplier-plan-only.json"
```

Do **not** pass `--analyze`. The command opens one connection, starts a
`REPEATABLE READ` transaction, immediately sets it `READ ONLY`, applies strict
timeouts and always rolls back. Its built-in preflight proves:

- database `gtm_vault_staging`;
- role `market_intelligence_consumer`;
- TLS active and transaction read-only;
- SELECT on `market_data_serving.supplier_search`;
- no INSERT/UPDATE/DELETE/TRUNCATE or write privilege on any user relation;
- current supplier projection, DENUE coverage and required indexes.

The artifact must say `mode=plan-only`, `cohort.name=launch`,
`cohort.candidates=58`, `cohort.batchSizes=[50,8]`, `planPassed=true`,
`calibrationPassed=false` and `gateDigest=null`. Copy only its hashes and
bounded summary into the night ledger.

## 4. Materialize the launch cohort in staging, still noindex

First run the same path as a dry-run and require the supplier launch report to
pass. Then, and only then, run the staging materialization. This is the first
and only intended write in this runbook; it writes the Driftless **staging app
database**, never the warehouse and never production.

```bash
export NODE_ENV=staging
export SEO_INDEXING_ENABLED=false

pnpm --filter @driftless/api seo:materialize -- --dry-run --type=supplier_geo \
  | tee "$NIGHT_EVIDENCE_DIR/materialize-dry-run.log"

pnpm --filter @driftless/api seo:materialize -- --type=supplier_geo \
  | tee "$NIGHT_EVIDENCE_DIR/materialize-staging-noindex.log"
```

Before the non-dry run, independently confirm that `SUPABASE_URL` came from
the staging environment. Do not copy the URL into the ledger. Require all of:

- 58 candidates and 58 materialized pages;
- zero failed, zero indexable, 58 noindex;
- zero contact leaks and `safetyPassed=true`;
- every candidate still has `indexingApproved=false`;
- stored supplier publication state is `noindex`.

Do not run `seo:supplier-approve-indexing`,
`seo:supplier-reconcile-publication`, `seo:indexation` or any command carrying
`--confirm-production`.

## 5. Privacy, semantics, UI and sitemap QA

Run focused deterministic suites from this checkout:

```bash
pnpm --filter @driftless/seo exec vitest run \
  src/public-dto.spec.ts \
  src/semantics.spec.ts \
  src/supplier-source-integrity.spec.ts \
  src/crawl-graph.spec.ts \
  src/sitemap.spec.ts

pnpm --dir apps/api exec vitest run --root ../web --config vitest.config.ts \
  test/pseo/seo-pages.spec.ts \
  test/sitemaps/index-route.spec.ts \
  test/sitemaps/segment-route.spec.ts
```

Then run automated route/privacy checks against all 58 stored staging paths and
review a representative sample of at least eight paths through the public
staging renderer at desktop and mobile widths. The sample must cover national,
state and municipality routes across distinct verticals. The review checks
headings, labels, observation vs company language, evidence/provenance,
empty/error states, internal navigation, overflow and absence of
phone/email/WhatsApp coordinates. A structured observation is not a verified
company/capability claim.

For the human-review hub only, the Vercel staging deployment may set
`SEO_SUPPLIER_PREVIEW_ENABLED=true`. The web app honors it only when
`VERCEL_ENV=preview`; it does not add held pages to build seeds or sitemaps and
production refuses the flag.

While indexing remains off, the sitemap gate is intentionally strict:

- zero supplier URLs discovered in sitemap index/segments;
- zero supplier URLs indexable;
- all 58 routes render a robots noindex posture.

Any supplier URL in a sitemap is a blocker, even if the page also says
`noindex`.

## 6. Rehearse rollback without applying it

The emergency path is the existing family-wide revocation. Validate its target
and reason in offline default mode; it must print that no database/network was
opened:

```bash
pnpm --filter @driftless/api seo:supplier-revoke-indexing -- \
  --all \
  --reason="night readiness rehearsal; no revocation applied"
```

Record `dryRunValidated=true`, `applyPerformed=false`,
`databaseOrNetworkOpened=false` and cache family `proveedores`. If a later
human-visible staging fault requires the real rollback, the owner/operator must
repeat the command with the exact staging target/gates and `--apply`; that is an
incident action, not part of readiness.

## 7. Close the ledger

Only after every preceding timestamp is ordered, set:

```json
{
  "status": "ready_for_staging_noindex_review",
  "indexingActivationAuthorized": false
}
```

Run the offline checker. A zero exit means the evidence chain is internally
complete for staging/noindex review. It is **not** approval to index, deploy,
merge, push or write production.
