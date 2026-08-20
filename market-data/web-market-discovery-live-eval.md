# Live evaluation — bounded web market discovery

**Nothing in this document has been run.** The change ships with a hermetic test
suite only: every automated test fakes the executor at the port and scripts the
model, so no test in CI has ever reached a real provider. This runbook exists so
a human with credentials can close that gap deliberately.

Do not treat "the tests pass" as evidence that the live path works. They prove
the contract, the shared budget, the redaction, the dedup rules, the ranking
terms and the citation resolution. They prove nothing about the executor's
current wire format, its ranking quality on Mexican industrial press, its
latency, or whether the credential in your environment is still valid.

## What is already proven, and where

| Claim | Proven by | Live? |
|---|---|---|
| One implementation of the Search transport, one instance, one breaker | `research-providers/web-search-topology.spec.ts`, `research-providers.module.spec.ts` | no |
| Wire mapping → neutral documents; depth tiers; session id | `research-providers/adapters/parallel-search.adapter.spec.ts` | no — stubbed `fetch` |
| Brief validation, too-broad refusals, query planning, dedup, ranking, verification folding | `research-providers/web-market-discovery.contract.spec.ts` | no |
| Provider boundary, evidence ledger, untrusted fence, adversarial documents | `research-providers/web-market-discovery.service.spec.ts` | no — port faked |
| Routing, one runner, shared budget, warehouse survives a web failure, honest zero | `cognitive/market-research/market-research.web-discovery.spec.ts` | no |
| FindAll / enrichment / people search unreachable | both architecture specs | no |
| **The executor surfaces useful Mexican industrial signals today** | **this runbook** | **not yet run** |

## Prerequisites

- `PARALLEL_API_KEY` set in the environment you are evaluating against. It is
  read server-side inside the adapter and never leaves it.
- `COMMERCIAL_FEATURE_PARALLEL_DISABLED` unset.
- A workspace with the market-data warehouse reachable, so the mixed question has
  a warehouse half and so the lift metric has a baseline.

Never paste a key into a file, a PR, a comment or a log line.

## Rules for the run

1. **No automatic retries.** If a question fails, record the failure as the
   result. A retried question is a different observation and must be labelled as
   one.
2. **One pass per question.** Do not reword a brief because the first answer was
   disappointing; that is the thing being measured.
3. **Score before reading the next question.** Human precision drifts once you
   have seen what "good" looks like in this dataset.
4. **Record the negative control last** and score it with the same rubric. It is
   the only question whose correct answer is "nothing".

## The six questions

Run each as a chat turn against a workspace whose context describes the seller.

| # | Seller context | Question |
|---|---|---|
| 1 | Estructuras metálicas | *Vendo estructuras metálicas. Encuentra empresas que estén construyendo o ampliando plantas industriales en Nuevo León.* |
| 2 | Cancelería de aluminio | *Vendo cancelería. Busca desarrollos residenciales y hoteles de lujo anunciados recientemente en México.* |
| 3 | Tratamiento de agua | *Busca proyectos privados recientes de tratamiento de agua en el Bajío.* |
| 4 | HVAC | *Encuentra hospitales y centros comerciales nuevos en construcción donde se necesite HVAC.* |
| 5 | Empaque industrial | *Busca nuevas plantas manufactureras que vayan a necesitar empaque industrial.* |
| 6 | **Negative control** | *Encuentra empresas que hayan anunciado plantas de fabricación de submarinos turísticos en Tlaxcala.* |

Question 6 is a deliberately improbable signal in a specific place. The correct
outcome is an honest zero with its coverage stated. **Any candidate returned for
question 6 is a finding**, and a candidate with confident commercial relevance is
a serious one.

Also run **question 3 twice**, once with the web surface disabled
(`COMMERCIAL_FEATURE_PARALLEL_DISABLED=true`), to measure lift over
warehouse-only. That question is chosen because it has both a public-procurement
half and a private half.

## What to capture per question

Capture into `docs/market-data/evidence/web-market-discovery-live-<YYYYMMDD>/`,
one file per question. Everything below is available from the run events and the
persisted report — nothing needs a debugger.

- normalized brief (objective, signals, geographies, freshness_days, exclusions,
  target_results) as the platform parsed it — **not** what the model proposed;
- the planned queries, and any query the platform dropped, with its reason;
- the search depth the policy chose (`balanced` / `thorough`);
- session id, **sanitized**: record that it equals the run id, not the value;
- number of provider calls, and the audit entry for each (id, ok, elapsed, result
  count, source domains);
- latency per call and end to end;
- cost, if the response carries one;
- documents retrieved, and how many produced no usable excerpt;
- candidates **before** dedupe and **after**, with the merge reason for each merge;
- candidates verified, and for each the status and why it landed there;
- every citation, checked by hand: does the URL open, does the page say what the
  excerpt says, does `published_at` match the page;
- warnings on the report;
- the final answer text;
- the reflection, **stored separately from the answer** so it can never be read
  as a conclusion.

Redact nothing except credentials — and there should be none to redact. If a key,
a raw payload, an endpoint or a provider name appears anywhere in a captured
artifact, that is a bug in the redaction boundary and is worth more than the
evaluation.

## Metrics

Per question:

| Metric | How to measure | Target for a first live run |
|---|---|---|
| Useful candidates in the top 10 | human count: is this an organization a seller would contact? | ≥ 4 for Q1–Q5 |
| Human precision, top 10 | useful ÷ returned | ≥ 0.5 |
| Duplicates surviving | same organization appearing twice | 0 |
| Candidates without resolvable evidence | count | **0 — any is a defect, not a score** |
| Fabricated URLs | citation that does not resolve to the ledger | **0 — any is a defect** |
| Unresolvable evidence | citation whose id has no ledger record | **0 — any is a defect** |
| Provider calls | from the audit | ≤ 2 |
| Latency | end to end | record, no target yet |
| Cost | from usage, if present | record |
| Lift over warehouse-only | Q3 with and without the web surface | record; a negative lift is a finding |
| Human usefulness | 1–10, one number, written before reading the next question | ≥ 6 |

The four zero-target rows are **correctness gates, not quality scores**. A run
that scores 9/10 on usefulness and produces one unresolvable citation has failed,
because the citation is the thing that makes the rest checkable.

## The command

```bash
# From a workspace with the warehouse configured and the executor credential set.
# The chat turn is the product surface; there is no separate discovery endpoint,
# no CLI and no MCP tool for this capability in this change — by design.
curl -sS -X POST "$API/workspaces/$WS/chat/threads/$THREAD/messages" \
  -H "authorization: Bearer $KEY" \
  -H "content-type: application/json" \
  -d '{"content":"Vendo estructuras metálicas. Encuentra empresas que estén construyendo o ampliando plantas industriales en Nuevo León."}'
```

Then read the persisted Work Session for that turn: the `web_discovery` event
carries the platform-owned candidates, and the artifact carries the report with
its audit, coverage and citations.

## Reading the result honestly

Three failure modes are worth naming in advance, because each looks like success:

1. **A confident list with thin evidence.** Check `independentSources`. A page of
   candidates each backed by one syndicated note is one newsroom, not a market.
2. **Relevance that is really a guess.** `commercialRelevance` is an inference by
   construction. If the answer states it as a fact, the report's fact/inference
   separation failed and that is a bug worth filing.
3. **A zero read as an empty market.** The coverage gap must say the result
   describes the searches executed. If the answer says the market is empty,
   that is the single most damaging defect this capability can have.

## After the run

Record the outcome in the evidence directory with a short summary, and open the
Task-API comparison (Arm A / Arm B) described in
`docs/market-data/web-market-discovery.md` only if the numbers justify it. Do not
integrate a second provider surface on the basis of a single evaluation.
