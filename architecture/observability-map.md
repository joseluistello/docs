# Observability — the map

Three planes, one join key each, and no second vendor.

This document is the map: what the platform emits, where it lands, which
question it answers, how to get from one plane to another, and what is still
blind. The event taxonomy for the product plane is its own document —
[analytics-event-model.md](./analytics-event-model.md).

---

## The three planes

| Plane | Sink | Question | Grain | Join key |
| --- | --- | --- | --- | --- |
| **Product** | PostHog | Did the workspace reach value, and does value become revenue? | one event per act | `workspace` group, `run_id`, `request_id` |
| **Run** | Latitude (OTEL, `libs/telemetry`) | What happened inside this one run? | one span per turn / tool call / model call | `driftless.run_id` |
| **Failure** | Postgres `error_events` + SQL views | Which bugs exist, how big, new or returning? | one row per (bug, day, workspace) | `fingerprint`, `last_correlation_id` |

They answer different questions and are not interchangeable. A funnel cannot
tell you why a turn died; a trace cannot tell you that eleven workspaces hit the
same 500; a bug map cannot tell you whether revenue moved.

### Why no vendor for the failure plane

The repo's standing rule — stated in `investigation-operations.ts` and pinned by
its tests — is that a second observability vendor means a second definition of
"a failure", and the day the two disagree is the day nobody trusts either. So
the failure plane is a table this platform writes plus SQL an operator runs. No
client, no transport, no agent, no per-seat bill, and nothing to keep in sync.

---

## The failure plane

### A bug is a fingerprint, not an occurrence

This is the idea the whole plane rests on. A log line per failure is a *stream*:
readable, but impossible to count, rank or trend, and useless for "is this new?"
or "how many customers does it hit?". A fingerprint turns the same failure seen a
thousand times into **one thing with a count**.

```
fingerprint = sha256(METHOD + route pattern + code + status class)[:12]
```

Deliberately **not** in it:

- **the message** — it carries values (`Topic 'billing-flow' not found`), so it
  would split one bug into one bug per value. It is also where customer data
  lives, and this plane holds none.
- **the release** — a bug that survives a deploy must stay the *same* bug, or
  "did this deploy introduce it?" is unanswerable. Release is a column.
- **the workspace** — one bug hitting thirty workspaces is one bug with a blast
  radius of thirty, not thirty bugs. Workspace is a row dimension.

The route must be the **pattern**. Before this change the endpoint label was the
concrete path, so `GET /workspaces/acme/topics/x` and
`GET /workspaces/other/topics/y` were different endpoints — every workspace was
its own bug and every error breakdown was a list of one-row groups. See
`ops/failure-fingerprint.ts`.

### The ledger is rolled up

`error_events` holds one row per `(day, workspace, fingerprint)` and increments
`occurrences`. That is the design, not an optimisation:

- it grows with the number of **distinct bugs**, not with traffic, so an error
  storm cannot become a storage incident;
- ten bugs is ten rows a day no matter how hard the platform is being hit;
- `first_seen_at` is never updated, which is what makes *new* and *regression*
  answerable at all.

It is **metadata only**: a code, a route pattern, a status, an actor kind, a
release, counters. No message, no stack, no parameter. The verbatim text stays in
the log, one `last_correlation_id` away.

### The writer cannot make an incident worse

`ops/failure-ledger.ts` sits on the path of every failed request, which means it
runs hardest exactly when the system is least healthy — and the database it
writes to can itself be the failure. Three defences, all load-bearing:

1. **Never awaited.** A slow write cannot add latency to an error response.
2. **A circuit breaker.** After 5 consecutive write failures it stops for 60s.
   Without it, a database outage means every 500 attempts another write to the
   database that is down — one outage amplifying into a write storm.
3. **A rate cap.** 20 writes/second/process. The ledger is a map, not a tape, so
   it may shed — and what it sheds is counted and logged, never hidden.

Both consequences are visible in the `ledger_health` view: **its counts are a
floor, not a total.** A view that let them read as totals would be lying during
exactly the incidents that matter most.

### The views

In `ops/failure-operations.ts`. SQL text plus typed row shapes — the audience is
an operator at a psql prompt or a BI tool. `$1` is always the window start.

| View | Answers |
| --- | --- |
| `bug_map` | Which bugs exist right now, how big, and how many customers each touches |
| `new_bugs` | Which are new in this window, and which release introduced them |
| `regressions` | Which went quiet and came back — and how long the gap was |
| `failing_routes` | Which endpoints fail most, and whether humans or agents hit them |
| `release_health` | How many bugs each release carries, and how many it introduced |
| `failure_surfaces` | Every failure surface at once — HTTP, agent runs, investigations |
| `ledger_health` | Whether the ledger is keeping up, or its counts are a floor |

Unlike the investigation views, these are **platform-wide, not workspace-scoped**.
A bug belongs to the engineering team, and its most important property — blast
radius — is unanswerable from inside one workspace. The workspace appears as a
`count(DISTINCT …)`, never as a filter.

`failure_surfaces` exists because the HTTP plane is only part of the picture: **a
chat turn that dies is never a 500.** It returns a polite sentence and a `failed`
row in `agent_runs`. A map that showed only `error_events` would report a healthy
platform while every turn was failing.

---

## Getting from one plane to another

```
                    a bug in the map
                           │  last_correlation_id
                           ▼
   log line  ◀──── correlation_id ────▶  request_failed  (PostHog)
                           ▲                    │
                           │                    │ same id, X-Correlation-Id header
                    the customer's response


   chat_answer_received  ──── run_id ────▶  agent_runs row  ──── run_id ────▶  Latitude span
        (PostHog)                          (tokens, trace, error)          (turn → tool → turn)
```

- **`correlation_id`** is minted per request by `CorrelationInterceptor`, returned
  on `X-Correlation-Id`, printed on every log line, sent as `request_id` on
  `request_failed`, and stored as `last_correlation_id` on the bug row. A customer
  can paste it into a support message and it resolves to the exact failure.
- **`run_id`** is the `agent_runs` primary key. It is on the Latitude span
  (`driftless.run_id`), and now on `chat_answer_received` / `chat_answer_failed`
  too — without it a funnel drop was a number nobody could open.

---

## Known blind spots

Stated because a map that hides its edges is worse than no map.

- **The dashboard and the marketing site have no failure plane.** A client-side
  exception, a failed fetch, a chunk that will not load: none of it reaches any
  of the three planes. The API sees only requests that arrive. This is the
  largest remaining gap.
- **`correlation_id` is not on the Latitude span.** Trace ↔ log joins through
  `run_id` for agent runs; for a plain HTTP request there is no span at all.
- **Counts are a floor** whenever the rate cap bites — by design, and
  `ledger_health` is how that is noticed.
- **404 and 401 are not captured**, deliberately: they are probe and
  missing-resource noise that would drown the signal (`shouldCapture`). A real
  404 bug is invisible to the map.
- **No alerting.** The plane makes bugs *visible*; nothing pages anyone. A query
  on `new_bugs` is the natural first alert, and it does not exist yet.
- **Background jobs and webhooks** raise failures that never become an HTTP
  response — the cron reapers, the Stripe and broker webhook handlers. Their
  failures land in the log only.
- **No retention job.** The roll-up bounds growth by construction, and
  `RetentionJob` is deliberately not extended: a candado
  (`retention-scope.guard.spec.ts`) makes a fourth purge target fail loudly, and
  the honest answer is that this table does not need one.

---

## Adding to the map

1. If it is a **funnel** question → the product plane, and the event goes in the
   registry (`libs/analytics`).
2. If it is a **"what happened inside this run"** question → a span attribute in
   `libs/telemetry`.
3. If it is a **"what is broken"** question → a view in `failure-operations.ts`
   over a ledger that already exists. If no ledger carries it, that is a real gap
   worth a table — but the bar is that no existing table can answer it.

Never a fourth sink for a question one of the three already answers.
