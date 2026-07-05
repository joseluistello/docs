# Integrations test harness — fake vs live (P4.0)

The integration/broker path is testable **without live Nango or provider
credentials**. This is what lets agents iterate on integrations safely in CI: no
secrets, no real provider state, deterministic runs.

## The fake adapter

`apps/api/src/integrations/testing/fake-nango.ts` — `FakeNango` is an in-memory
double of the `@nangohq/node` backend SDK surface that `NangoService` actually
calls (`createConnectSession`, `listIntegrations`, `listConnections`,
`deleteConnection`, `getScriptsConfig`, `triggerAction`, `listRecords`). It is
faithful to the **shapes** `NangoService` destructures and supports the failure
classes the broker maps (404-on-delete, status-coded trigger/records errors,
over-returning a page).

Wire it into a real `NangoService`:

```ts
const fake = new FakeNango({ scriptsConfig: [...], records: {...} })
const svc = installFakeNango(new NangoService(), fake)
```

`installFakeNango` sets the lazily-built private `client` and ensures
`NANGO_SECRET_KEY` is present so no real client is constructed.

## What the LOCAL suite covers (no secrets, runs in CI)

| Concern | Where |
|---|---|
| Connect session + workspace tagging | `nango.contract.spec.ts` |
| Connection resolution: tenant isolation + newest-wins | `nango.contract.spec.ts` |
| Disconnect: revoked / already_gone (404) / throws (5xx) | `nango.contract.spec.ts` |
| Operations from `getScriptsConfig` (`listActions`) | `nango.contract.spec.ts` |
| Record models from syncs (`listSyncs`) | `nango.contract.spec.ts` |
| `triggerAction` success + status-coded failure passthrough | `nango.contract.spec.ts` |
| Records paging / delta / `next_cursor` mapping | `nango.contract.spec.ts` |
| Webhook HMAC over the raw body (valid / forged / missing) | `nango.contract.spec.ts` |
| Broker error mapping (429 / transient 5xx / 4xx) | `broker.service.spec.ts`, `broker-behavior.eval.spec.ts` |
| Output caps: oversized action result + over-returned records | `broker-output.spec.ts`, `broker.service.spec.ts` |
| Tenant isolation across the broker surface | `broker.service.spec.ts` (P0.2), `tenant-isolation.integration.spec.ts` |
| Records discovery + bounded read contract | `broker.service.spec.ts` (P3.1) |

Run it all locally / in CI:

```bash
pnpm --filter @driftless/api test -- nango broker integrations
```

## What stays LIVE (separate, opt-in — P4.1)

The fake proves the **contract**; it cannot prove the real Nango/provider behaves
the same. Live staging tests (P4.1) are gated behind env (`EVAL_API_URL` +
credentials) and are **never** required for a local/CI run. They cover: a real
connect→authorize→confirm round-trip, a real `getScriptsConfig`/`triggerAction`
against a staging integration, and a real signed webhook delivery.

Driftless keeps its own bounds/caps **regardless of provider behavior** — the
fake encodes "provider misbehaves" (over-returns, errors, oversized output) so
the caps are tested even though live providers usually behave.

## Staging live gate (P4.1)

The repeatable evidence required before any broker flag reaches production. Run it
against **staging only** (never prod), with the broker's expected state stated
explicitly. It is read-only and SKIP-safe: with no creds it skips and exits 0.

```bash
# Broker-ON workspace (full read-only flow + webhook rejection):
EVAL_API_URL=https://api-staging.driftless.icu/api/v1 EVAL_WS=golden EVAL_CLI=1 \
  pnpm evals:retrieval-scale
SMOKE_API_URL=https://api-staging.driftless.icu \
  SMOKE_API_KEY=<staging-key> SMOKE_BROKER_EXPECTED=on \
  bash scripts/harness/smoke.sh staging

# Broker-OFF workspace (surface must be ABSENT):
SMOKE_API_URL=https://api-staging.driftless.icu \
  SMOKE_API_KEY=<staging-key> SMOKE_BROKER_EXPECTED=off \
  bash scripts/harness/smoke.sh staging
```

What the gate proves (`scripts/harness/smoke.sh`, section 6–7), keyed on
`SMOKE_BROKER_EXPECTED`:

| Expected | Checks |
|---|---|
| `on` | `/broker/connections` present; bounded `operations` search; `events` feed; per-provider `operations` / `models` / `inspect` (or SKIP with reason if no connection); MCP exposes `driftless_broker` |
| `off` | `/broker/connections` ABSENT (503/404); MCP HIDES `driftless_broker` |
| both | an unsigned webhook POST is **rejected** (never a 2xx) |

The **WRITE/invoke** path is deliberately SKIPPED with an explicit reason — the
gate never executes a live operation (it could mutate provider state). A
known-safe read-invoke is run manually with an idempotency key when needed.

Paste the `=== Smoke Test Summary ===` block (TOTAL/PASS/FAIL/SKIP) plus the
retrieval-scale `PASS (n/n)` line into the release card as the gate evidence.
`RESULT: FAIL` blocks the rollout; `RESULT: SKIP` means no live target was
provided (not evidence).
