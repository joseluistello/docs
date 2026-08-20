# Broker / integrations — production rollout runbook

Make enabling the integration broker in production **boring and reversible**. This
is the operator's guide: what the broker is, the env matrix, the staged rollout,
the rollback, and the checklist for adding a provider to policy.

## What the broker IS — and IS NOT

The broker is a **governed tooling proxy**: an (often external) agent calls an
external system through a configured Connection + a named Operation; Driftless
executes the call and audits it. Credentials live in Nango and are injected
server-side — they **never** reach the model or Driftless.

It is **NOT**:
- **not a Driftless approval queue** — reads AND writes execute inline; the
  human-in-the-loop is the calling agent's own harness.
- **not an agent runtime** — Driftless does not run autonomous loops here.
- **not a script-authoring surface for normal agents** — authoring/deploying Nango
  functions is a **privileged, human-only lane**. Normal agents only CALL existing
  operations and READ records. (Enforced structurally: the broker exposes no
  author/deploy method — see `broker-behavior.eval.spec.ts`.)

## The three gates (independent, layered)

| Gate | Env / store | Default | What it controls |
|---|---|---|---|
| Master | `DRIFTLESS_BROKER_ENABLED=true` | OFF | The whole broker. OFF → MCP tool hidden, API endpoints 503. |
| External rollout | `DRIFTLESS_BROKER_ROLLOUT=off\|internal\|ga` | off | The EXTERNAL (OAuth/MCP) lane. off → external principals get nothing, even with a grant ("not rolled out"). Internal principals (human session / owned API key) are unaffected. |
| Grants | `broker_grants` table | none | Per-principal authorization once the lane is open (principal × provider × effect, `*` wildcards). Owner/admin-managed. |
| Operation policy | `operation-policy.ts` REGISTRY | empty | Which operations are exposed/invokable. In `enforce` mode (prod) only allowlisted ops run; unknown ops fail closed. |

Policy mode is derived from the environment: `enforce` when
`NODE_ENV=production`; `open` in staging/dev so unknown operations remain visible
but flagged. There is no override that can open the entire broker in production.

## Env matrix

| Env | Required when | Notes |
|---|---|---|
| `DRIFTLESS_BROKER_ENABLED` | always set explicitly | `true` to turn the broker on; absent/anything-else = OFF (default). |
| `NANGO_SECRET_KEY` | broker ON | Boot guard refuses to start if ON without it. |
| `NANGO_WEBHOOK_SIGNING_KEY` | broker ON | Distinct from the secret key. When ON there is **no** silent fallback to the secret key for webhook verification — a misconfig rejects. |
| `NANGO_HOST` | self-host only | Omit for Nango Cloud. |
| `DRIFTLESS_BROKER_ROLLOUT` | to open the external lane | `off` default; advance `internal` → `ga`. |

Staging API: `https://api-staging.driftless.icu`. Prod: `https://api.driftless.icu`.

## Rollout plan (no global ON until gates pass)

1. **Staging, internal workspace.** `DRIFTLESS_BROKER_ENABLED=true`,
   `DRIFTLESS_BROKER_ROLLOUT=off`. Run the P4.1 staging gate (see
   `integrations-test-harness.md`) with `SMOKE_BROKER_EXPECTED=on`. Confirm
   internal flows work and the external lane is dark.
2. **Prod, internal workspace.** Same flags. Re-run the smoke gate against prod
   READ-only surfaces. Broker on, external lane still `off`.
3. **One beta workspace / one provider.** Add the provider's read operations to
   the policy REGISTRY (see checklist). Set `DRIFTLESS_BROKER_ROLLOUT=internal`.
   Create a narrow grant (e.g. `oauth × notion × read`). Validate the first wedge
   (Notion records → Collections).
4. **Broaden the allowlist** provider-by-provider, advancing
   `DRIFTLESS_BROKER_ROLLOUT=ga` only after the wedge's success metric holds.

There is **no global "broker on for everyone"** step — exposure is always per
workspace/provider behind grants + policy.

## Rollback plan

Reversible at every layer, cheapest first:
- **Disable the external lane:** set `DRIFTLESS_BROKER_ROLLOUT=off` — every
  external call is refused immediately; internal/owned-key use is unaffected.
- **Revoke a grant:** `DELETE …/broker/grants/:id` (or the dashboard) — removes
  one principal's access.
- **Disable the whole broker:** unset `DRIFTLESS_BROKER_ENABLED` — endpoints 503,
  MCP tool disappears. Connections/credentials are untouched (re-enabling restores
  them).
- **Disconnect a connection:** `DELETE …/integrations/:id` revokes the credential
  at Nango first, then drops the local row. A **stuck revoke** (Nango 5xx) THROWS
  and KEEPS the local row (never silently drops a live credential) — retry; a 404
  is treated as already-gone (idempotent).
- **Inspect what happened:** the event feed (`…/broker/events`) is the inbound
  signal; every broker call is in the audit log (`broker.read/write[.failed]`,
  `broker.invoke.denied` with `reason: grant|rollout`, `broker.connection.health`,
  `broker.grant.created/revoked`) with a `correlation_id` per invoke.

## Operator checklist — add a provider/action to policy

1. Confirm the action exists in Nango for the integration (`operations --refresh`).
2. Add a reviewed entry to the `REGISTRY` in
   `apps/api/src/broker/operation-policy.ts`: `{ provider, operation, enabled,
   effect, risk, idempotent, scopes?, requiresCriterion?, requiresGrant?, rollout }`.
   This is a **code change, reviewed by a human** — never an agent action.
3. For a write, set `idempotent` honestly (it gates write-retry/idempotency-key
   behavior). Set `requiresCriterion` if the agent must read a Topic first.
4. Bump `POLICY_VERSION` if the policy semantics change (it is stamped into audits).
5. Add/confirm the criterion Topic for the connection.
6. Re-run the staging gate; paste the summary into the release card.

## Security notes

- Credentials **never reach the model or Driftless** — Nango owns the credential
  vault (AES-256-GCM at rest) and injects them server-side; Driftless stores only
  connection ids + non-secret config.
- Every broker call is **audited**; denied attempts (grant/rollout/policy) are
  audited too.
- Webhooks are **HMAC-verified over the raw body**; unsigned/forged payloads are
  rejected before touching the DB.
- Secret-shaped writes are blocked from Knowledge/notes/topics client- and
  server-side; nothing here logs a secret.

## Public docs

If a customer-visible surface changes (API/MCP/CLI), update `docs/` and rely on the
existing `main → docs` mirror flow. The CLI/MCP broker surface is documented under
the integrations docs; keep it factual and aligned with the policy REGISTRY.
