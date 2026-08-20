# Chat / DeepSeek — baseline, diagnosis and change ledger

Base SHA: `e971558961047b13daa43f7a0b7cac30d74b2876` (`origin/staging` HEAD at the
time of the audit; `git rev-list --left-right --count HEAD...origin/staging` = `0 0`).

This document records **what was actually present before any edit**, so a fix is
never applied to a defect that was already closed. Every claim below is anchored
to a file and a line, not to the historical CSV.

---

## 0. What the historical CSV actually proves

The audit CSV (100 messages / 30 threads / 50 assistant answers, 2026-08-09 →
2026-08-15) mixes three model identities and at least three prompt/belt
generations:

| model | assistant rows |
| --- | --- |
| `deepseek/deepseek-v4-flash` | 26 |
| `opencode-go/glm-5.2` | 21 |
| `driftless-managed` | 3 (all `failed`) |

`run_status`: 47 `completed`, 3 `failed`.

**The single most important observation:** `tool_names` is `[]` and
`tool_call_count`/`tool_result_count`/`tool_error_count` are `0` on **all 50**
assistant rows — while `citation_count` is non-zero on 27 of them (up to 44), with
`citation_source_kinds` of `gtm_artifact`, `web`, `topic`, `collection`,
`project`, `record`.

Citations are minted **mechanically from tool results only**
(`chat-tools.ts:781-787` → `extractCitations` / `webCitations` /
`webSearchCitations`; `chat.service.ts:911`). A row with 44 `gtm_artifact`
citations and 0 tool calls is **arithmetically impossible** if both columns were
read from the same run. Therefore `tools=[]` is a **defect of the ad-hoc export
query**, not evidence that tools failed to persist.

Corroborating: `feedback_vote` is `null` in every row, which is consistent with a
real, un-rated dataset rather than a bug.

---

## 1. Export diagnosis (§9) — root cause

The CSV column set (`thread_ref`, `message_no`, `seconds_into_thread`,
`citation_source_kinds`, `run_status`, `duration_ms`, `tokens_in`, `tokens_out`,
`tool_names`, `tool_call_count`, `tool_result_count`, `tool_error_count`) is
produced by **no committed artifact in this repository**.

The only committed chat export is `scripts/harness/export-chat-feedback.mjs`,
which selects a completely different projection (`thread_id`, `message_id`,
`answer`, `reason`, `question`, `model`, `cited_refs`) and filters to
`feedback->>'vote' = 'down'`. It emits none of the tool columns.

So the CSV came from an **uncommitted Supabase SQL snippet** ("Supabase Snippet
Untitled query"), which is unreviewable and unreproducible.

Persistence itself is sound at base SHA:

- `chat.service.ts:934` writes `trace: runTrace` on the completed path, and
  `:897` writes the partial trace on the failed/stopped path.
- `mastra-runtime.ts:257-276` emits `tool_call` and `tool_result` trace events
  with `detail.name`.
- `chat.service.ts:612` persists `run_id` on every executed assistant message.

`agent_runs.trace` is `select: false` (`agent-run.entity.ts:84`), which affects
**TypeORM reads only** — raw SQL is unaffected. That is a plausible trap for a
hand-written ORM-based export, but not for the SQL snippet.

**Conclusion:** the fix is to *replace the unreviewable query with a committed,
unit-tested projection* that can never collapse "trace absent" into "zero tools".

---

## 2. Defect-by-defect baseline

| # | Defect | Status at base SHA | Evidence |
| --- | --- | --- | --- |
| A | English deterministic copy | **LIVE** | `chat.service.ts:123-132` — `GATE_NO_KEY`, `GATE_NO_MODEL`, `TURN_FAILED`, `TURN_STOPPED`, `RESEARCH_UNAVAILABLE` are English string constants; budget refusal built inline in English at `:638`; research stop/fail copy English at `:1120-1121`. Persisted verbatim as the assistant message. |
| A | Model answering in wrong language | Mitigated, unproven | `chat.skill.ts:53` already instructs same-language answers and bans interleaved English planning phrases. Needs a live check, not a re-fix. |
| B | Internal tool names in the answer | **PARTIALLY LIVE** | The prompt names `search_web`, `search_web_evidence`, `search_topics`, `get_topic`, `topic_signals`, `count_anchor`, `list_projects`, `get_project`, `list_collections`, `get_collection`, `query_records`, `search_docs`, `get_doc`, `list_connections`, `broker_recent_events` — 20+ raw identifiers — with **no rule forbidding them in the answer**. The model is shown the vocabulary and never told it is internal. |
| C | Meta-answer without payload | **LIVE** | No rule anywhere requires naming the delivered items before coverage notes. `chat.skill.ts:58` says "answer first, then supporting context", which is about ordering prose, not about enumerating results. This is the highest-value gap. |
| D | Wrong first surface | **FIXED (a487f08b/e9715589)** | `chat.skill.ts:22-27` pins surface-first selection explicitly, incl. "Never use the workspace as a generic fallback for a public question". `:32` handles named social hosts. Protect with an eval; do not re-fix. |
| E | Short follow-ups losing referent | **FIXED (a487f08b)** | `chat.skill.ts:55` handles "sí"/"el segundo"/"continúa"; `chat.service.ts:1164-1167` clips history head **and tail** so a trailing offer survives. Protect with an eval; do not re-fix. |
| F | Budget narration | **LIVE (root cause in the payload)** | Every market observation carries `remaining_calls`, `remaining_elapsed_ms`, `useful_yield`, `consecutive_no_progress` (`market-data.tools.ts:625,730-737`). Chat's web tools return `remaining_web_searches` and the literal sentence "This turn's web-search budget of 2 calls is spent." (`chat-tools.ts:602-619`). The model is *taught* budget vocabulary on every call. |
| G | Total vs visible | **LIVE (contract genuinely ambiguous)** | Three different numbers with three different meanings and no single unambiguous statement: `page.returned` (rows in this page — `envelope.ts:193`), `coverage[].totalVisibleRows` (**corpus size**, e.g. 48 325 — `envelope.ts:103`), `diagnostics.rowsExamined` (= `limit+1` when `hasMore` — `award.service.ts:338`). On the truncation path `page.returned` still says 20 while `results` holds 3, and only then are `observed_result_count`/`returned_result_count` added (`market-data.tools.ts:659-662`). The transcript "corpus de ComprasMX (48 325 filas visibles) devolvió 21 filas" is this confusion exactly. |
| H | Observability | **LIVE, and regressed** | See §3. |

---

## 3. Observability baseline (§7)

Working at base SHA:

- `initTelemetry('driftless-api')` **is** called — `apps/api/src/main.ts:46`.
- Latitude is configured on both Render services — `render.yaml:56-58` and
  `:118-120` (`LATITUDE_API_KEY`, `LATITUDE_PROJECT_SLUG`, `sync:false`).
- Exactly one `agent.run` root span per executed turn —
  `chat.service.ts:954-984`, pinned by `chat-observability.spec.ts:157-161`.
- Opt-in and non-blocking: without the key the global tracer stays the OTEL
  no-op; export is batched fire-and-forget (`libs/telemetry/src/index.ts:40-59`).

Missing, against the §7 target list:

| # | Target | Present? |
| --- | --- | --- |
| 1 | root trace per turn | yes |
| 2 | `session.id` grouping the thread | **no** |
| 3 | environment / surface | **no** |
| 4 | real provider + model | model yes (`gen_ai.response.model`), **provider no** |
| 5 | status | partial (`driftless.run.ok`), no terminal enum |
| 6 | tokens / cache | yes |
| 7 | duration | **no span attribute** (only `agent_runs.duration_ms`) |
| 8 | prompt fingerprint / version | **no** |
| 9 | belt fingerprint / version | **no** |
| 10 | release / git SHA | **no** |
| 11 | structural child span per tool | **no — regressed** |

The regression is documented by the Driftless topic `agent-observability-latitude`
(reviewed/authoritative), which describes the span tree as
`agent.run → chat {model} → tool {name}`. Those two child spans were emitted by
`apps/api/src/agent-runs/agentic-loop.ts`, which **no longer exists** — it was
deleted when Mastra became the runtime. `MastraRuntime` opens no spans at all, so
the chat trace is now a single flat root.

The correct seam for the tool span is `cognitive/tool-observability.ts`: it
already wraps every chat tool call with duration + error classification and emits
the sanitized `ToolExecutionEvent`. Adding the child span there reuses the
existing event (no second bus, §7), nests automatically under `agent.run` via OTEL
active context, and keeps `chat/` at exactly one `withSpan` so the existing
candado stays green.

---

## 4. TTFT / duration baseline (§8)

- `agent_runs.duration_ms` — computed and stored (`agent-runs.service.ts:172`).
- `model_usage.ttft_ms` / `duration_ms` — columns exist and are documented as
  "NULL = not measured, which is NOT 0" (`model-usage.entity.ts:110-116`).
- `ModelUsageService.recordTurn` **accepts** `ttftMs` / `durationMs`
  (`model-usage.service.ts:36-39`, written at `:95-96`).
- `ModelUsageService.recordSession` **never passes them** (`:109-130`), because
  `TurnUsageEvent` (`managed-session.ts:39-45`) has no timing field and
  `GatewayModelContext.onTurnUsage` (`mastra-model.adapter.ts:70`) does not
  report one.

So both columns are NULL for every row — by omission, not by a wrong value.

A **real** measurement point exists: `DriftlessGatewayModel.doStream` receives an
`onContent(delta)` callback from the gateway (`mastra-model.adapter.ts:342-346`).
The first invocation of that callback is a genuine observation of the provider's
first content token, and the `gateway.route(...)` call is an exact per-attempt
duration boundary.

Semantics that must be documented rather than faked:

- **`doGenerate` (non-streaming) has no first-token observation** → `ttft_ms`
  stays NULL; `duration_ms` is still exact.
- **A tool-call turn may emit no text at all** (the provider returns only tool
  calls). There is no first *content* token, so `ttft_ms` stays NULL for that
  turn. TTFT is *time to first content delta*, never "time to the final answer"
  and never derived from total duration.

---

## 5. Live baseline (§4) — NOT EXECUTED

`https://api-staging.driftless.icu/health` responds `200` (after a ~51 s cold
start), so the deployment is reachable from this environment.

**No `DRIFTLESS_API_KEY` is present in the environment**, and §4 forbids
hardcoding or inventing credentials. The 20-case live DeepSeek baseline was
therefore **not executed**, and no live before/after table is claimed.

Consequences, stated plainly:

- Defects **D** and **E** are recorded above as fixed *from code reading only*.
  They are protected by new evals rather than re-fixed, per §11.
- Defect **A**'s model half (does DeepSeek still emit English in a Spanish
  thread?) is **unverified**. Per §5.7 the language *repair/validator* is
  therefore **deliberately not built** — the instruction is to add it only if the
  current DeepSeek still produces English after prompt+copy are fixed, and that
  cannot be established without a live run.
- The runner is delivered and bounded so the team can produce the evidence:
  `pnpm --filter @driftless/api harness:chat-live-evals` with
  `DRIFTLESS_API_URL` / `DRIFTLESS_API_KEY` from the environment. It reports
  `SKIP` (never `PASS`) when credentials are absent.

---

## 6. What changed, and why

| Area | File | Change |
| --- | --- | --- |
| A — language | `apps/api/src/chat/chat-copy.ts` (new) | Pure es/en detector + every backend-authored sentence in both languages, localized managed-refusal by typed `RefusalCode`. |
| A — language | `apps/api/src/chat/chat.service.ts` | The five English constants deleted; gates, stop, failure, budget refusal, managed refusal and the research copy now read from the copy plane, chosen from the teammate's latest message. |
| B/C/E/F — behaviour | `apps/api/src/cognitive/skills/chat.skill.ts` | Results-before-limits promoted to rule 2 (with the two real failed answers quoted as failures); a named `result_visibility` contract; "speak like a person" with the seven translations and an escape hatch for a genuine technical question; an explicit no-narration ban list; autonomy rules; a search STRATEGY replacing the "1–4 tool calls" quota. The finalize cue no longer opens with "You have spent your exploration budget". |
| F — budget leak | `apps/api/src/chat/chat-tools.ts` | `remaining_web_searches` (a counter on every result) → `more_web_search_available` (a boolean); the exhaustion message and its correction carry no budget noun for the model to echo. |
| G — total vs visible | `apps/api/src/market-data/tools/market-data.tools.ts` | One authoritative `result_visibility` block on every observation: `matches_returned` / `rows_visible` / `more_available` / `corpus_rows` (explicitly labelled so the corpus size cannot be reported as a find). On the truncated path `page.returned` is restated so no field contradicts another. |
| §7 — Latitude | `libs/telemetry/src/index.ts` | `gen_ai.conversation.id`, `gen_ai.provider.name`, a structural attribute set, one-way `fingerprint()`, `releaseVersion()`, `environmentName()`. |
| §7 — Latitude | `apps/api/src/cognitive/tool-observability.ts` | Optional `tool {name}` child span at the seam that already times every call — restores the tool level of the tree lost with `agentic-loop.ts`, reusing the existing `ToolExecutionEvent` (no second bus) and keeping `chat/` at exactly one `withSpan`. |
| §7 — Latitude | `apps/api/src/chat/chat.service.ts` | Root `agent.run` now carries session, surface, environment, release, run id, provider, prompt/belt fingerprints, terminal status and duration. Metadata only. |
| §8 — latency | `apps/api/src/agent-runs/mastra-model.adapter.ts` | Per-attempt duration measured around `gateway.route`; TTFT measured at the FIRST `onContent` delta and omitted when none was observed. |
| §8 — latency | `managed-session.ts`, `model-usage.service.ts` | `TurnUsageEvent` carries optional timing; `recordSession` spreads it conditionally, so an unmeasured value stays NULL end to end. |
| §9 — export | `apps/api/src/chat/chat-telemetry-export.ts` (new) + `scripts/export-chat-telemetry.ts` (new) | Committed, unit-tested projection with a four-state `trace_availability`; tool counts are NULL unless a trace was observed; ids pseudonymised; the integrity audit flags the contradiction the old snippet published. |
| §6 — graders | `apps/api/src/chat/chat-answer-graders.ts` (new) | Deterministic graders, shared by the hermetic specs and the live runner. |
| §4/§6 — live | `apps/api/scripts/chat-live-evals.ts` (new) | The 20 golden cases against the deployed API, credentials from the environment only, SKIP distinct from PASS, JSON + Markdown report. |

## 7. What was deliberately NOT built

- **No language validator/repair.** §5.7 permits one only if the CURRENT DeepSeek still emits English *after* prompt + copy are fixed. That cannot be established without the live baseline, and §10 forbids adding repair pre-emptively.
- **No regex post-processor over the answer.** §5.3 is explicit: fix the prompt and the descriptions, never blind-replace the final text.
- **No budget increase.** §5.5 says hold the current budgets until evidence says otherwise.
- **No automatic market→web fallback.** §10 requires evidence first.
- **No new router, manager, second agent, event store, eval table or observability vendor.**
- **No UI change.** The dashboard already localizes activity labels and hides internal tool names; nothing in the baseline showed a live UI defect.
