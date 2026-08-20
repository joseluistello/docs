# Live smoke — targeted web evidence

**Nothing in this document has been run.** The change ships with a hermetic test
suite only: every automated test fakes the executor at the port, so no test in
CI has ever reached a real provider. This runbook exists so a human with
credentials can close that gap deliberately.

Do not treat "the tests pass" as evidence that the live path works. They prove
the contract, the budget, the redaction and the citation resolution. They prove
nothing about the executor's current wire format, its latency, or whether the
credential in your environment is still valid.

## What is already proven, and where

| Claim | Proven by | Live? |
|---|---|---|
| Wire mapping of the search endpoint → neutral documents | `src/radar/adapters/parallel.adapter.spec.ts` | no — stubbed `fetch` |
| Request validation, refusals, redaction, claim attribution, contradiction | `src/research-providers/web-evidence.service.spec.ts` | no — port faked |
| Budget of two, third refused and audited, one audit over both surfaces | `src/cognitive/market-research/market-research.web-evidence.spec.ts` | no |
| Exhaustive discovery / enrichment unreachable | both architecture specs + the recording proxy | no |
| The executor answers today, with a live credential | **this runbook** | **not yet run** |

## Prerequisites

- `PARALLEL_API_KEY` set in the environment you are smoking against. It is read
  server-side inside the adapter and never leaves it.
- `COMMERCIAL_FEATURE_PARALLEL_DISABLED` unset (any value of `true` reports the
  capability as unconfigured, which is a *supported* state, not a failure).
- A workspace with the market-data warehouse reachable, so the run has a
  warehouse half to compare against.

Never paste a key into a file, a PR, a comment or a log line.

## 1. The capability end to end (one search request — start here)

This is the step this change adds, and the only one that smokes the path the
harness actually uses: `WebEvidenceService` → port → adapter → live endpoint. It
prints the **normalized** result, because printing the wire response would smoke
a layer nothing in production reads.

```bash
cd apps/api
RADAR_LIVE_SMOKE=1 PARALLEL_API_KEY=… \
  pnpm exec ts-node -T scripts/web-evidence-live-smoke.ts \
    "<ORGANIZACION REAL>" "nuevo programa de residencias" "monto de inversion anunciado"
```

Replace `<ORGANIZACION REAL>` with a real organization you can verify by hand.
Cost is one search request at the cheapest tier with `max_results: 5`. Without
both environment variables the script refuses to run.

The script prints the checklist after the payload. In order:

1. `search_id` is `w_0` — the platform's id, not one the executor supplied.
2. Every `evidence_id` matches `^wev_[0-9a-f]{20}$`.
3. Every `observed_at` is the same timestamp, and it is *now*.
4. `source_domain` equals the host of its own `url`, with `www.` stripped.
5. `published_at` is either a date the page really states, or `null`. If a page
   with no visible date came back with a date here, stop and open a bug — that is
   the freshness lie this design exists to prevent.
6. Each `claim.status` is justified by its own excerpts. Read them.
7. Grep the whole payload for the executor's name, an API key fragment, an
   endpoint, a request id: there must be none.

A refusal is a valid outcome of this step, not a failed run: it proves the
redaction boundary holds on a live failure, which is the one thing a fixture
cannot fully stand in for. Check the printed code, message and suggestion name no
endpoint, no request id and no credential.

## 2. The adapter's own smoke (optional, ~$0.10 — exercises DISCOVERY, not this)

`src/radar/adapters/parallel.smoke.spec.ts` predates this change and drives the
exhaustive-discovery path, which is *not* what the harness uses. Run it only if
you are separately validating discovery:

```bash
cd apps/api
RADAR_LIVE_SMOKE=1 PARALLEL_API_KEY=… npx vitest run src/radar/adapters/parallel.smoke.spec.ts
```

Read it before running it — it states what it sends and what it costs.

## 3. A full research turn (most expensive — a model run plus up to two searches)

Ask a question whose freshness half the warehouse cannot answer, through the
normal chat research path, in a **staging** workspace:

> ¿Hay evidencia reciente de que \<ORGANIZACION REAL\> esté ejecutando una expansión ahora mismo, y qué ha ganado históricamente en compras públicas?

**What to check:**

- The `ResearchReport` carries both evidence kinds, and every one points at a
  `queryId` present in `queryAudit`.
- `coverage.relations` declares both the warehouse relation(s) and `web_evidence`.
- Web citations render as title · domain · URL · excerpt · published date ·
  observed date. No executor name anywhere in the answer or the citations.
- At most two `search_web_evidence` rows in the audit. If the model tried a
  third, there is a `web_budget_exhausted` row — that is correct behaviour.
- The artifact body carries a `reflection` object, and nothing from it appears in
  the answer, the facts or the citations.

## 4. The failure path (no credential)

Worth running once, because "the capability is absent" is a supported state
rather than an outage:

```bash
cd apps/api
PARALLEL_API_KEY= npx vitest run src/cognitive/market-research/market-research.web-evidence.spec.ts
```

Then, in a deployment with no key, run a research turn and confirm the answer
still comes back from the warehouse with the gap named — not an error.

## Recording the result

After running any step, record the outcome where the team will find it: which
step, on which environment, on what date, and what the payload showed. Until
that exists, the honest statement about this change is that **the live path is
unverified**.
