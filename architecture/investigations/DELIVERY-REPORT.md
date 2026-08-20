# Investigations — delivery report

Phases 01–07 of `docs/architecture/investigations/`, one commit per phase, on
`claude/architecture-investigations-phases-bnaoaz`.

## SHAs

| | |
|---|---|
| Base (merge-base with `origin/staging`) | `70889bc7d0b92620984933b6e87b133ca3118d44` |
| Final | see `git log -1` on the branch — the Phase 7 commit |

`origin/staging` was merged into the branch after Phase 6 (clean, no conflicts),
so the base above is staging's head at that merge, not the branch point.

## Commits by phase

| Phase | Commit | Subject |
|---|---|---|
| 1 — discovery validation | `5b76251` | validate the discovery engine on five frozen cases |
| 2 — durable core | `1ed7236` | a durable, resumable investigation core |
| 3 — API and progress surface | `2898b75` | authenticated API and a progressive surface |
| 4 — data artifact views | `ac6f84b` | typed data artifact views over one persisted dataset |
| 5 — Collection promotion | `ecf5bc3` | human-selected, idempotent Collection promotion |
| 6 — source expansion | `767f781` | provider-neutral source expansion seams |
| 7 — evals, rollout, operations | this commit | evals, rollout switches and the rollback rehearsal |

No phase was merged into another, and nothing was merged into `staging`.

## Migrations and rollback

One migration: `libs/db/src/migrations/1715200000150-AddInvestigations.ts` —
creates `investigations`, `investigation_events`, `investigation_candidates`,
with unique `(investigation_id, candidate_id)` and `(investigation_id, seq)` and
CHECK constraints on the kind/status vocabularies.

```bash
# forward (runs on boot, or explicitly)
corepack pnpm --filter @driftless/db migration:run

# back out — drops the three tables and nothing else
corepack pnpm --filter @driftless/db migration:revert
```

The migration is additive: no existing table is altered, so reverting it cannot
affect another surface. Chat, Collections and the Radar do not reference these
tables.

**Connection budget:** the queue's pool slot was RE-ALLOCATED from the retired
`workSessionWorkflow`, not added. `DATABASE_CONNECTION_BUDGET_TOTAL` is still 8,
and `database-connection-budget.spec.ts` fails if that stops being true.

## Rollout switches

**On by default.** A deployment that sets nothing gets the whole surface, for
every workspace whose plan includes it. These are KILL SWITCHES — they take
something away in a hurry; they are not an enrolment gate.

| Variable | Default | What it does |
|---|---|---|
| `INVESTIGATIONS_DISABLED` | `false` | The kill switch. `true` ⇒ every route 404s and the nav entry disappears. |
| `INVESTIGATIONS_WORKSPACES` | *(empty)* | Comma-separated workspace ids. Empty ⇒ every workspace. Pins the feature while something is being investigated. |
| `INVESTIGATIONS_ACCEPTING_WORK` | `true` | Off drains the queue: in-flight runs finish, new ones stay `queued`. |
| `INVESTIGATIONS_WRITES_ENABLED` | `true` | Off ⇒ read-only. Reads and exports keep working. |
| `INVESTIGATIONS_PROMOTION_ENABLED` | `true` | Off ⇒ promotion 503s. Promoted records are untouched. |
| `INVESTIGATIONS_MAX_CONCURRENT` | `3` | Runs in flight per workspace. |
| `INVESTIGATIONS_DAILY_RUN_CEILING` | `50` | Runs started per workspace per UTC day. |

An enable-gate was rejected deliberately: it makes the shipped path the one
nobody runs, so the feature works in the deployment where it is on and rots in
every other, and the first real user is also the first integration test.

The two ceilings are **operational** — they refuse to start work. They are not
credits, not entitlements and not pricing: the plan gate
(`entitlements.assertFeature`) still runs unchanged in front of every mutation,
and Phase 7 explicitly defers the pricing decision until real cost is measured.

## Test totals

Focused suites, this branch, all green:

| Suite | Tests |
|---|---|
| `src/investigations` (12 files) | **254** |
| `src/research-providers` (12 files) | **271** |
| `apps/dashboard` investigation tests | 19 + 6 + 13 |

`scripts/harness/check.sh`: **PASS — 19 passed, 0 failed, 3 skipped.**
Build and per-package typecheck (14 packages) clean.

### Skipped and NOT RUN — exactly what was not verified

| Check | State | Why |
|---|---|---|
| `investigations.integration.spec.ts` | **NOT RUN** | Needs Postgres. No database is reachable in this container (no docker daemon, no local `initdb`). It is delivered and runs against a real database. |
| `evals:investigation-live` | **NOT RUN** | Reports the five missing variables by name and exits 0. Nothing was measured. |
| `evals:discovery-live` (Phase 1) | **NOT RUN** | Same: no provider or model credentials. |
| Local API smoke | SKIP | No API on `localhost:3000`. |
| MCP smoke | SKIP | No MCP on `localhost:3020`. |
| Performance gate | SKIP | No `PERF_DB_URL`/`TEST_DATABASE_URL`. |
| Intel eval ratchet | PASS, 7 pre-existing NOT IMPLEMENTED | Unchanged by this work — it is the market-research golden set. |

The live-staging runner's credentialed path — booting the Nest context and
driving a real run — has **never executed** in the authoring environment. It is
delivered unverified and the runner says so in its own output.

## Live staging report

**NOT RUN.** No staging database and no credentials were available.
`corepack pnpm run evals:investigation-live` prints:

```
RESULT: NOT RUN

Missing, and required:
  • DATABASE_URL|SUPABASE_URL — the staging database the durable core writes to
  • INVESTIGATION_EVAL_WORKSPACE — the Golden workspace id every row is scoped to
  • PARALLEL_API_KEY — the web executor credential, read server-side
  • DISCOVERY_EVAL_MODEL — the model route, as provider_class/model
  • DISCOVERY_EVAL_MODEL_KEY — that provider's credential

Nothing was measured. This is NOT a pass, and it must not be reported as one.
```

It captures Phase 7's eleven metrics when it does run. Every metric is nullable
and `null` means NOT MEASURED — a zero is only ever a measured zero.

## Known limitations

1. **No live evidence of usefulness.** Whether the open web actually yields
   useful Mexican commercial candidates for the five frozen objectives is
   unmeasured. The hermetic suites prove the rules; they cannot prove this.
2. **No integration-test run.** Tenant isolation, the compare-and-set affected
   count and the unique constraints are proven by the database, and the spec that
   exercises them has not been executed here.
3. **No firmographics provider, no second web executor.** Both are documented
   decisions with their contract questions marked NOT DETERMINED — see
   `docs/architecture/source-expansion-data-rights.md`.
4. **The credentialed half of the live runner is unverified.**
5. **Browser-level scenarios** (rows arriving progressively, a real deploy
   interrupting a real run) are named in `investigation-acceptance.spec.ts`
   rather than proven.
6. **Operational views are unexecuted SQL.** Every column they reference is
   checked against the entity definitions by `investigation-operations.spec.ts`,
   which is the strongest guarantee available without a database — it is not the
   same as having run them.

## Security and privacy review

- **Tenant isolation.** Every service read carries the workspace predicate; a
  cross-workspace id is 404, never 403. The rollout gate uses 404 for the same
  reason — a workspace outside the rollout cannot learn the feature exists.
- **Authorization.** Every mutation calls `assertHasIdentity` and
  `entitlements.assertFeature(ws, 'assistant')`; the architecture guard asserts
  the counts match the number of `@Post` handlers. No new public route.
  `WorkspaceGuard` remains the global `APP_GUARD` and is not bypassed.
- **Credentials.** Resolved server-side through the existing encrypted
  provider-credential path. Never logged, never returned, never in model context.
  The web adapter now redacts its key from upstream error bodies before they
  become error messages.
- **Personal data.** None is collected or stored. The candidate schema has no
  person, contact, email, phone or title column, and the discovery contract
  refuses contact vocabulary — including *linkedin* — as query material.
- **Prompt injection.** Third-party text stays inside the branded
  `UntrustedText` fields; the conformance suite asserts at runtime that it never
  reaches a title, a control field or a structural position.
- **Curated activity stream.** Numbers, booleans and a closed string vocabulary
  only. Adapter ids and internal costs are dropped by key — a vendor name would
  make provider choice product-visible and an internal cost would read as a price.
- **Supply chain.** `minimumReleaseAge` is untouched and no package exclusion was
  added. No new runtime dependency was introduced by any phase.
- **Retired shapes stay retired.** `WorkSession*`, `gtm_research_runs` and the
  deleted generic patch reducer are absent, enforced by the architecture guard.

## Bundle and database impact

- **Bundle.** Four new dashboard modules (`Investigations`, `InvestigationDetail`,
  `DataArtifactRenderer`, `InvestigationPromote`) plus a label dictionary and a
  stylesheet. No new npm dependency; the artifact renderer is local React rather
  than `@assistant-ui/react-generative-ui` (decision recorded in
  `docs/architecture/data-artifact-views.md`).
- **Database.** Three tables and one pool connection, re-allocated rather than
  added. Reads are indexed on `(workspace_id, created_at)` and
  `(status, heartbeat_at)`; candidate and event reads are bounded (500 rows / 200
  events) and the API pages them.

## Evidence that Chat remained independent

`investigations.architecture.spec.ts` fails the build on:

- any file under `investigations/` importing from `chat/`;
- any file under `chat/` importing from `investigations/`;
- `InvestigationsModule` importing `ChatModule` or anything under `chat/`;
- any investigation file reaching `ChatStreamHub` or opening an `@Sse` stream.

The two surfaces share the model seam and the two ledgers (`agent_runs`,
`model_usage`) — the same seams every other surface uses — and nothing else.

## Rollback rehearsal

Proven in `investigation-rollout.spec.ts`, each switch independently:

| Property | How it is proven |
|---|---|
| Navigation/feature can be disabled | `INVESTIGATIONS_DISABLED=true` ⇒ every route 404s; the rail hides the entry when the probe 404s |
| Queue stops claiming new work | `acceptingNewWork: false` ⇒ `enqueue` refuses and the worker leaves the row `queued` |
| Running jobs settle without data loss | The drain gates the CLAIM only; a `running` row finishes its pass and lands terminal |
| API read-only for existing investigations | `writesEnabled: false` ⇒ reads, artifact and export succeed; every mutation 503s |
| Artifact falls back to a canonical table | The builder always leads with `DataTableView`; the renderer degrades to it |
| Provider adapter disabled independently | `discovery.configured === false` ⇒ the step skips and the run lands `partial` |
| Promotion disabled without breaking records | `promotionEnabled: false` ⇒ promotion 503s; promoted rows are ordinary Collection records |

## What must happen before general availability

1. Run the integration spec against a real database.
2. Run `evals:investigation-live` on staging and attach the report.
3. Read the measured cost, then make the pricing/credits decision separately —
   Phase 7 deliberately does not make it.
4. Decide retention and support posture.
5. If anything looks wrong on the way, pin `INVESTIGATIONS_WORKSPACES` or pull
   `INVESTIGATIONS_DISABLED` — the feature is on for everyone until told otherwise.
