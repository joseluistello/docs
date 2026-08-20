# A1 — Work Session contracts: frozen schemas + event protocol

**Project:** `70160c56-cf2f-4d94-81a0-ee9000eee76b` (Commercial Intelligence — Agentic Workbench)
**Card:** A1. Congelar contratos de Work Session y eventos
**Scope:** contracts + validation + fixtures only. No model, provider, controller, service or wiring change. Nothing at runtime imports these modules yet — they are the frozen surface every later card builds against.

---

## 1. What was frozen

Two sibling modules, one per side of the wire, each fail-closed:

| Module | Role |
|---|---|
| `apps/api/src/chat/agentic-contracts.ts` | The semantic authority. Versioned schemas for `WorkContract`, `MaterialGap`, `ContractConflict`, `HumanCheckpoint`, `ExecutionPlan` (+`PlanStep`/`PlanRevision`), `TypedActionCommand`, `ArtifactEnvelope` (+ append-only patches), `AgenticQuote`, `ActivityEntry`, the 28-type event union, the `WorkSessionSnapshot` reducer (`applyAgenticEvent`/`replayWorkSession`), typed-action admission, and the legacy bridge. |
| `apps/dashboard/src/redesign/agentic-events.ts` | The renderer's mirror. Decodes stream frames fail-closed (`parseWorkbenchStreamEvent`) into `agentic | legacy | ping | unsupported`, and folds them through a pure, idempotent view projection (`applyWorkbenchEvent`). The dashboard never renders a payload it did not validate. |

Fixtures: `apps/api/src/chat/agentic-contracts.fixtures.ts` — neutral ids only (`capability_one`, `source_alpha`, `provider_x`; no geography, provider or capability brand).

## 2. Contract rules (enforced, each with a test)

- `schemaVersion: '1.0'` explicit on every event and versioned top-level object.
- `workspaceId` + `principalId` mandatory everywhere; cross-tenant / cross-session events and commands are rejected by the reducer, not by convention.
- Causality: every event carries exactly one of `causationId` or `root: true`.
- `WorkSessionId`/`runId`/`planId`/`contractVersion`/`planVersion` are linked wherever an object claims them, and stale versions are rejected (checkpoint, artifact, quote, typed action, step events).
- `ExecutionPlan` carries an `idempotencyKey`; a revision must keep it and advance `version` by exactly 1, with `version === 1 + revisions.length` (causal history is structural).
- `TypedAction` is a full command — tenant, principal, causal ref, idempotency key, flat string params — validated against CURRENT session state before admission.
- `HumanCheckpoint` binds to run + plan + contract version; resolving with an unknown option or a disallowed custom answer fails.
- `ArtifactEnvelope` must agree with the event that carries it (session, workspace, run) and with snapshot state (current contract/plan versions).
- `STATE_SNAPSHOT` refuses a plan without a contract and may not re-home the session (workspace, session id, principal all pinned); `STATE_DELTA` is ALLOWLISTED to `/contract` and `/plan` — every other state family has its own typed event, and identity/idempotency memory (`appliedEvents`, `patchCanon`, `lastPatchSeq`) is unreachable by any delta. The patched snapshot re-validates wholesale.
- Timestamps require an explicit timezone (Z or ±HH:MM) — a zone-less `occurredAt` would make replay verdicts depend on the host machine's TZ.
- Run terminal states are symmetric: `RUN_FINISHED`, `RUN_ERROR` and `RUN_CANCELLED` all refuse to overwrite an already-terminal run.
- JSON pointers accept only canonical array indices (`-` or digits without a leading zero), so two textually different patches can never alias one effect; plan step `dependsOn` graphs reject self-dependencies and cycles.
- `QUOTE_APPROVED` expiry is judged against the event's `occurredAt` — `Date.now()` appears nowhere in the module.
- `TOOL_CALL_RESULT.ok` must be a boolean and `preview` a bounded string; both sides enforce it.
- Artifact patch vocabulary is closed (`add`/`replace`/`remove`, JSON-pointer paths); a redelivered identical patch is a no-op, the same `seq` with different content fails closed (API) / marks the artifact corrupt (UI); a `seq` gap fails with a replay instruction.
- A repeated `eventId` with identical content is a no-op; with different content it fails closed. Idempotency memory (`appliedEvents`, `patchCanon`) is part of the snapshot, so it survives snapshot+delta reconstruction.
- All parsers reject unknown properties.

## 3. AG-UI semantics without the dependency

The event vocabulary adopts AG-UI's lifecycle names (`RUN_*`, `STEP_*`, `TEXT_MESSAGE_*`, `TOOL_CALL_*`, `STATE_SNAPSHOT`/`STATE_DELTA`, plus Driftless-specific `ACTIVITY_*`, `ARTIFACT_*`, `CHECKPOINT_*`, `PLAN_REVISED`, `QUOTE_*`, `RUN_SUSPENDED/RESUMED/CANCELLED`). No `@ag-ui/*` package is imported anywhere; the parsers in this repo are the authority, and `AGENTIC_WORKBENCH_JSON_SCHEMA` freezes the closed vocabularies for other tools.

## 4. Expand/contract compatibility with the four legacy events

Today's SSE channel emits exactly four shapes (`chat-stream.hub.ts`): `message.delta`, `tool.activity`, `tool.result`, `run.finished` (+ `ping` transport heartbeat).

**Expand phase (now → shell cutover):**

- New writers emit versioned `AgenticEvent`s. `toLegacyChatEvent` projects the four legacy-equivalent types down (`TEXT_MESSAGE_CONTENT`→`message.delta`, `TOOL_CALL_START`→`tool.activity`, `TOOL_CALL_RESULT`→`tool.result`, `RUN_FINISHED`→`run.finished`) so an un-migrated reader keeps rendering; events with no legacy counterpart simply don't reach it (it never saw them before either).
- Migrated readers use one code path: `fromLegacyChatEvent` lifts a legacy frame into a versioned envelope (with a synthetic `legacyMessageId` for delta accumulation), and every lifted event re-parses through the strict parser. `ping` maps to `null` and is never persisted.
- The dashboard decoder accepts BOTH vocabularies simultaneously; a malformed frame of either kind decodes to `unsupported` and is counted, never partially rendered.

**Contract phase (a later card, after shell parity):** legacy writers are removed; the decoder's legacy branch stays until the last legacy producer is retired, then dies with its own test.

The mapping is bijective on the four legacy shapes' fields — `TOOL_CALL_RESULT` carries `name` precisely so `tool.result` round-trips without loss — and no information is lost in either direction during the overlap.

## 5. Owner scale invariants, proven by fixture

`buildGoldenSessionEvents()` replays a complete session in which:

- one plan step addresses **two capabilities** in the same query;
- **one source (`source_alpha`) feeds both capabilities**;
- one signal claim carries evidence from **two sources**, including a **contradiction** (both positions kept, visibly);
- **provider substitution** (`provider_x`→`provider_y`) changes ONLY execution-plane activity entries — the spec proves contract/plan/artifact/checkpoint/quote state is byte-identical under either provider, because no contract object has a provider field to change.

## 6. What this card did NOT do

No persistence (A4), no Mastra wiring (A2), no compiler/policy logic (A3), no UI rendering beyond the pure projection (A6), no event emission from `ChatService`. The A0 trajectory evals stay red — they pin runtime behavior, which later cards ship against these contracts.
