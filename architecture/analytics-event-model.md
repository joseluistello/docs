# Product analytics — the event model

The registry lives in code: `libs/analytics/src/events.ts`. This document says
what it is for, how it is used, and what was wrong with what it replaced.

Two planes, kept apart on purpose:

| Plane | Tool | Question it answers |
| --- | --- | --- |
| Product analytics | PostHog | Does a workspace reach value, and does value become revenue? |
| Agent observability | Latitude (OTEL, `libs/telemetry`) | What happened inside this one run? |

Neither replaces the other, and neither is a log. Operator detail — exception
text, failure reasons, prompts, tool arguments — belongs to the log and to the
trace, never to PostHog.

---

## Identity

**A person is their Clerk user id.** The same id in the marketing site, in the
app, and on every server event caused by their request. **A workspace is a
PostHog group** (`workspace`), carried on every event as `$groups`.

An agent — an API key, an MCP bearer, a background run — has no human behind it
and is attributed to `workspace:<uuid>` with `actor_kind: 'agent'`.

### What this replaced, and why it mattered

Every server event used to be attributed to `workspace:<uuid>`, and a
`posthog.alias()` then merged that id into each Clerk user who touched the
workspace. In a multi-seat workspace that **merged every teammate into one
PostHog person**: per-user activation, per-user retention and seat expansion were
unanswerable, and because an alias cannot be undone the merges already recorded
are permanent. Workspace-level questions are now asked of the group, which is
what a group is for — people are never fused to answer them.

Historical data carries the old identities. Insights that span the cutover should
be built on the group, which is stable across it.

---

## Where an event is emitted

**Server-side by default.** Anything a request reaches the API for — a topic
written, a record moved, a chat answer, an invitation — is captured once, in the
API, where the actor is known and no ad-blocker can drop it. A client-side copy
of a server write is double counting, and the two copies drift.

**Client-side only for what the server cannot see:**

- navigation (`$pageview`, `$pageleave`),
- intent that precedes a request or replaces one (`cta_clicked`,
  `signup_started`, `checkout_started`, `billing_portal_opened`),
- content reading on the marketing site.

Route-level writes go through `WriteTelemetryInterceptor`, configured per
controller with a handler-name → event map (`topics.telemetry.ts`,
`collections.telemetry.ts`). Two rules it enforces:

- **POST endpoints that are reads are excluded.** A query body is not a mutation.
  Counting `records/query` and `topics/retrieve` as writes is what made a
  retrieve-heavy agent look like a prolific writer.
- **An unmapped mutating handler still emits** — `workspace_write` with
  `{ domain, action }`. Nothing goes dark, and nothing pretends to be a funnel
  step it isn't. When one of those starts mattering, promote it to a named event.

The two record events that need to know what *changed* (`record_created`,
`record_stage_changed`) are emitted from `RecordsService`, which has the
collection's archetype and the record's prior status; the route does not.

---

## Naming rules

Enforced by `libs/analytics/src/events.spec.ts`, not by convention:

- `object_verb_past`, snake_case — `record_stage_changed`, never `updateRecord`.
- The surface is a **property**, never part of the name. No `cli_*` / `mcp_*`:
  one funnel has to be answerable across web, app, api, cli and mcp.
- No `$` prefix — that namespace belongs to PostHog.
- A read is not an event.
- Every event answers a question someone would act on.

Universal properties, set by the emitting client rather than the call site:
`surface`, `origin`, `actor_kind`, `workspace_id`.

---

## The two funnels the model is shaped around

### 1. PLG

```
$pageview → cta_clicked → signup_started → signed_up → workspace_created
  → onboarding_started → onboarding_completed → connection_established
  → chat_answer_received (is_first_turn) → record_created
  → member_invited → invitation_accepted
  → checkout_started → subscription_started
```

`onboarding_completed` is the step to watch: a workspace with a criterion is a
workspace that can be served. `is_first_turn` on `chat_answer_received` is the
activation edge — the first answer a workspace ever gets.

`checkout_started` (client, intent) and `subscription_started` (Stripe webhook,
money) are deliberately separate: the drop between them is the checkout
abandonment rate, and it needs both halves.

### 2. Pipeline

```
record_created → record_stage_changed (from_stage → to_stage) → record_outcome_recorded
```

`record_stage_changed` carries `from_stage`, `to_stage`, `moved_by`
(`human` | `agent` | `api`) and `age_days`. That is enough for stage conversion,
stage velocity and stall detection in PostHog directly, and enough to answer the
question this product exists to answer: **is the agent moving the pipeline, or
only the humans?**

---

## Migration

`libs/analytics/src/legacy.ts` maps every old name to its replacement, or to
`null` when it was retired. Retired means the event described a product Driftless
no longer is (repo linking, skill patterns, pattern validation), or it was
traffic dressed as a decision (per-command CLI reads).

Headlines:

| Before | After |
| --- | --- |
| `topic_write` (one event, 16 handlers in `action`) | `topic_created`, `topic_updated`, `knowledge_change_proposed`, `knowledge_merged`, `workspace_write` |
| `collection_write`, `radar_write` | `collection_created`, `record_created`, `record_stage_changed`, `record_outcome_recorded`, `search_opened`, `search_run_started`, `workspace_write` |
| `chat_turn_completed` / `_failed` / `_stopped` | `chat_answer_received`, `chat_answer_failed` (`reason`) |
| `$mcp_initialize`, `$mcp_tool_call` | `agent_session_started`, `agent_tool_used` |
| 42 `cli_*` events | `agent_session_started`, `agent_installed`, `command_failed` |
| `api_error` | `request_failed` (no `internal_message`) |
| `cta_click`, `blog_post_viewed`, `scroll_depth` ×4 | `cta_clicked`, `content_viewed`, `content_read` ×1 |

Insights built on an old name keep their history but stop receiving data. Point
them at the replacement; for a retired name, the question it was answering is not
one this product asks.

---

## Privacy

- **No PII on events.** Email and name are person properties, set once at
  `identify`. `signed_up` used to carry the email on the event itself — a contact
  address copied onto every row for no analytical gain.
- **No exception text.** `request_failed` carries the code, the endpoint, the
  method and the actor. The log has the message, joinable on `request_id`.
- **No customer content.** No topic body, no record field value, no chat text, no
  invitee address. Stage names and archetypes are configuration, not content.

---

## Adding an event

1. Add it to `EVENT_REGISTRY` with its stage, surfaces, description and
   properties. If you cannot write the description as a question someone would
   act on, the event does not exist.
2. Emit it — server-side unless only the client can see it.
3. `pnpm --filter @driftless/analytics test` — the naming rules and the size cap
   are checks, not suggestions.

The registry is capped at 45 events. The cap is the point: the taxonomy this one
replaced reached ~60 across five surfaces, and nobody could say what any single
one answered.
