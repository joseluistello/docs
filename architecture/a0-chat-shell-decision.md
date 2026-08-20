# A0 — Chat shell decision: trajectory evals + assistant-ui spike

**Project:** `70160c56-cf2f-4d94-81a0-ee9000eee76b` (Commercial Intelligence — Agentic Workbench)
**Card:** A0. Congelar trayectorias y decidir shell de Chat
**Status:** in review (never `done` — the reviewer decides)
**Verified against:** staging HEAD `26087499` (`fix(api): bound database connection pools`)
**Scope:** evaluation + a reversible, non-production spike. No production behavior changed.

---

## 0. Correction notice

An earlier pass of this card was built inside a worktree rooted at `fc038f17` — several commits behind real staging (`git merge-base HEAD 26087499` = `fc038f17`, i.e. the worktree was a direct ancestor, not staging itself). That pass claimed `ResearchArtifactPanel.tsx` did not exist and that no paid-approval/suspend-resume mechanism existed anywhere in Chat. Both claims were **false** — they were true of the stale commit, not of staging. The reviewer caught this, the worktree was rebased onto `26087499`, and every file map, eval, and claim below was re-derived from scratch by reading the current code on this exact commit. Two things from the first pass were also flagged and are fixed here: an adapter test that asserted on its own input instead of the adapter's output (a tautology), and a spike file that was five disconnected unit tests instead of one integrated trajectory.

---

## 1. What this covers

1. A hermetic, red-by-design trajectory eval suite pinning 10 concrete gaps between the playbook's generic Workbench model and the real, substantially-built `chat.service.ts` — verified against the actual code, not assumed absent.
2. A reversible spike: an `ExternalStoreRuntime`-shaped adapter with a fixed tool-activity tautology, exercised through ONE integrated trajectory (persisted history → deltas → tool activity → cancel → an artifact patch across a real suspend→resume cycle).
3. Real, executable type-compatibility evidence against the actual `@assistant-ui/core` package — run in an isolated scratch install, zero dependency left in this repo.
4. A keep/adapt/replace recommendation with a compatibility matrix, a migration-cost estimate, and a rollback plan.

**Owner invariant (2026-08-04):** compras-jalisco / licitaciones / any single geography or provider is ONE vertical fixture among many a future warehouse will serve. Test 9 below is not hypothetical — the real system's own capability-catalog fixture (`CAPABILITY_BUNDLE_FIXTURE`) ships exactly ONE capability today (`public_procurement_new_tender`), and the real query the service builds addresses exactly one `capability_id` per turn. The gap this invariant names is the CURRENT shape of the code, not a future risk.

---

## 2. What actually exists on staging HEAD 26087499 (read in full before writing anything)

The system is considerably more built than the playbook's "Chat v0, read-only" framing suggests. It already implements a full vertical — under a different, capability-specific vocabulary than the playbook's proposed generic one (`WorkContract`/`ExecutionPlan`/`HumanCheckpoint`) — for market opportunities:

| File | Lines | Real role today |
|---|---|---|
| `apps/api/src/chat/chat.service.ts` | 1666 | A deterministic pre-model route classifier (`classifyChatRoute`) dispatches market-shaped turns to a real, suspendable Mastra "Opportunity Flow" (`MastraMarketIntelligenceWorkflowFactory`). A suspended flow carries a quote (credits + worst-case USD) and a rationale; the teammate approves or declines via a `researchDecision` envelope resubmitted to the SAME `/messages` endpoint on the SAME thread, charged through `CreditsService.debitAndRun` with an idempotency key. A separate `CommercialContextService.compile()` computes `missing_material_context` (which profile fields are missing AND whether each is material) and turns it into a system-prompt directive telling the model to ask exactly one question. Mastra is now the ONLY runtime — the in-house ThinLoop loop was deleted (PR #262). |
| `apps/api/src/chat/chat-stream.hub.ts` | 74 | Unchanged from the prior architectural read: a plain `rxjs.Subject`, no replay buffer, four event types (`message.delta`/`tool.activity`/`tool.result`/`run.finished`). |
| `apps/api/src/chat/intent-preflight.ts` | 148 | The real, exported, pure `classifyChatRoute`/`classifyIntent` functions — a deterministic regex ladder, zero-cost, no model call. Five routes exist (`market_opportunity`, `pipeline`, `topic_context`, `paid_research_continuation`, `contact_request`) plus `general`. There is no monitor route. |
| `apps/dashboard/src/redesign/ChatThreadView.tsx` | 1356 | Everything from the prior read, plus: a `ContextPill`/`ContextDrawer` that fetches `getCommercialContext(runId)` **once per assistant turn, via a separate GET**, and renders `ResearchArtifactPanel` from that one snapshot when the result carries an `opportunity`. |
| `apps/dashboard/src/redesign/ResearchArtifactPanel.tsx` | 138 | **Exists, real, working.** Renders coverage state (`completed`/`partial`/`unavailable`/`unauthorized`/`unsupported`/`empty`), per-signal rows with evidence/unknowns/contradictions, and — when the flow is suspended — a quote + approve/decline UI wired to `onDecision`, which the parent forwards as `researchDecision` on the thread's next `postMessage`. |
| `apps/api/src/radar/radar-monitor.service.ts`, `ports/discovery-provider.port.ts` | — | A real, provider-neutral monitor primitive (`createMonitor(input: MonitorInput)`, implemented by `parallel.adapter.ts`) already exists. It is wired to its own `radar.controller.ts`/webhook, entirely separate from Chat — `chat.service.ts` never references it. |
| `apps/api/src/radar/ports/entity-enrichment-provider.port.ts`, `adapters/apollo.adapter.ts` | — | A real, provider-neutral enrichment port already exists, implemented by an Apollo adapter. Not on chat's tool belt (`chat-tools.ts`'s `chatToolExecutorFactory` never mounts it). |
| `apps/api/src/chat/opportunity-trajectory.trajectory.spec.ts` | — | Pre-existing, unrelated to this card: a real, GREEN acceptance suite for an already-shipped card ("Commercial Intelligence Chat — reemplazo visible"). Its `makeHarness`/`scriptedRuntime` pattern is reused below for consistency with the team's own hermetic convention, and its header explains a `*.trajectory.spec.ts` naming collision this card's `vitest.trajectory.config.ts` had to be scoped around (§3). |

None of this is claimed to be missing below. The evals pin the SPECIFIC, verified gap between this real, substantial implementation and the playbook's generalized (multi-capability, structurally-checkpointed) model.

---

## 3. Trajectory evals (hermetic, red by design, 10/10 confirmed)

**File:** `apps/api/src/chat/agentic-workbench.trajectory.spec.ts`
**Config:** `apps/api/vitest.trajectory.config.ts`, scoped to this ONE filename (not a `*.trajectory.spec.ts` glob) — the repo already has `opportunity-trajectory.trajectory.spec.ts` on that naming convention as a real, unrelated, GREEN regression suite; a glob would have silently swept it into this red-by-design config and dropped it out of CI's normal gate. `apps/api/vitest.config.ts`'s exclude is scoped the same way (already fixed by the reviewer during the rebase).

Every assertion targets something concretely verified in the code above — a field absent from a real DTO, a route the real classifier never returns, a ledger status the real `AgentRunsService` never writes, a query field that is a `string` not a `string[]` — never a substring match on assistant prose. Each is written as the DESIRED end-state (so a fix makes it turn green automatically, never requiring a rewritten assertion) and confirmed red against the real harness.

| # | Behavior | Desired assertion | Why it's red today (verified) |
|---|---|---|---|
| 1 | Layered interview | `result.checkpoint.kind === 'clarification'` before any answer | `missing_material_context` is real and code-computed, but only becomes a system-prompt directive (`buildProfileGapDirective`) — advisory prose the model can ignore. A full `agent_run` always executes. |
| 2 | Visible plan | `result.plan.steps.length > 0` | The Opportunity Flow's real internal stages run entirely server-side; only a terminal `success`/`suspended` snapshot reaches the client. |
| 3 | Progressive artifact | An `artifact.*`-shaped event arrives on the SAME SSE channel as tokens/tool activity | The artifact is fetched via a separate `GET .../chat/runs/:id/commercial-context`, once, after the turn — confirmed by reading `ContextPill` in `ChatThreadView.tsx`. |
| 4 | Low-yield review | `message.typedActions` includes `'revise_criterion'` | The real suspension envelope (`IncrementalResearchProposal`) carries only a rationale + a quote for MORE of the same research — no alternative-capability field exists on the contract. |
| 5a | Paid approval, same run | The ledger records `'suspended'` | Paid approval works end to end (suspend → quote → approve/decline → charge → resume, verified), but `agent_runs` has no `suspended` status — the turn that produced the suspension still finishes `'completed'`. |
| 5b | …generically, not per-capability | The route result carries a `capabilityId` | `classifyChatRoute` routes ANY `researchDecision` to `'paid_research_continuation'`, and `chat.service.ts` unconditionally resumes the ONE wired `marketWorkflow` — no capability→workflow dispatch table exists. |
| 6 | Monitor + checkpoint | A monitor-intent message routes to a dedicated route | `classifyChatRoute`'s 5 routes have no monitor branch — "avísame cada lunes…licitaciones" matches `market_opportunity` purely because of the word "licitaciones," even though `RadarMonitorService`/`createMonitor` already exist and are simply unreached. |
| 7a | Reconnect | A late SSE subscriber sees work published before it joined | `ChatStreamHub` is a plain `Subject`, confirmed unchanged — no replay buffer. |
| 7b | (folded into 5b/8) | — | Resume-as-a-generic-primitive and checkpoint-resolution are the same underlying gap, tested from two angles. |
| 8 | Enrichment stays separately gated | `ChatService.prototype.resolveCheckpoint` is a function | The provider-neutral enrichment port already exists (`entity-enrichment-provider.port.ts` + `apollo.adapter.ts`) but is not on chat's belt (confirmed) — and there is no generic checkpoint-resolution API that could ever grant it mid-run, gated the same way paid research already is. |
| 9 | **Owner invariant** | Two distinct `capability_id`s can be addressed in one turn | With a synthetic second capability added to a real `CapabilityBundle` fixture, the real query construction still only ever produces ONE `capability_id` — `discoverCapabilities()` is already N-capability, but `chooseCapability`'s single-winner selection is not. |

Reproduce: `pnpm turbo run build --filter="./libs/*"` once (workspace libs need their `dist/` built for Vite/vitest resolution — pre-existing, unrelated to this card), then `pnpm --filter @driftless/api exec vitest run --config vitest.trajectory.config.ts`. Confirmed: **10/10 red**, each for the reason in the table above — none crash on setup, none fail on an unrelated typo.

**Do not "fix" these by loosening an assertion.** A green result means the behavior shipped in `chat.service.ts`/`chat-stream.hub.ts`/`chat-tools.ts`/`intent-preflight.ts` — that is A1+ work, not A0.

---

## 4. Spike: an `ExternalStoreRuntime`-shaped adapter, one integrated trajectory, real type-compat evidence

### 4.1 The tautology fix

The first pass's "surfaces tool activity" test asserted facts about `liveEvents` (the function's OWN input) while `buildExternalStoreAdapter` silently dropped `tool.activity`/`tool.result` — the assertion would have passed regardless of whether the adapter did anything with them. `apps/dashboard/src/redesign/spike/chatExternalStoreAdapter.ts` now folds the REAL `ChatStreamEvent` union (imported from `../../api`, not reinvented) into `extras.toolSteps` — a typed, deduplicated-by-id list — and the spec asserts on `adapter.extras.toolSteps` (the adapter's OUTPUT), never on the raw input log.

### 4.2 One integrated trajectory, not five disconnected tests

`apps/dashboard/src/redesign/spike/chatExternalStoreAdapter.spike.spec.ts` is now ONE `it()` that walks a single simulated thread through every phase the acceptance criterion names, each phase building on the previous one's state:

1. **Persisted history** — two prior rows seed the thread (the real source of truth; never re-derived).
2. **`onNew` forwards to the real `send()`** — no drafted state lives in the adapter.
3. **Incremental deltas** — the assistant row grows token by token; the persisted rows are never duplicated.
4. **Tool activity fires and resolves** — asserted on `extras.toolSteps` (the tautology fix).
5. **Cancel** — `onCancel()` forwards to the real stop callback.
6. **Artifact patch across a real suspend→resume cycle** — using the REAL `OpportunityWorkflowRunResult` type (imported from `../chatThreads`, not an invented `artifact.*` event vocabulary): a `suspended` flow with one row and a quote, then a `success` flow with the SAME `run_id` and a second row added — the original row survives, the artifact's identity does not change (patched, not replaced).

Reproduce: `pnpm --filter @driftless/dashboard exec vitest run chatExternalStoreAdapter` — 1 test file, 1 test, green (it tests OUR mapping code, which is supposed to work).

### 4.3 Real type-compatibility evidence, zero workspace footprint

The reviewer asked for either real evidence against the actual assistant-ui runtime/API, or a documented reason it isn't possible — without leaving a dependency or lockfile churn in this repo (the first pass's `pnpm add` caused a 2,272-line lockfile diff across unrelated packages before being reverted).

**What was done:** an isolated npm project, entirely outside the pnpm workspace (`$CLAUDE_JOB_DIR/tmp/assistant-ui-typecheck` — not inside this repository, no `pnpm-lock.yaml`/`package.json` touched):

```jsonc
// package.json (scratch dir only)
{ "dependencies": { "@assistant-ui/core": "0.2.23" }, "devDependencies": { "@types/react": "19.2.14", "typescript": "5.9.3" } }
```

A `probe.ts` there assigns a literal value shaped field-for-field like `buildExternalStoreAdapter()`'s real return type (`messages`, `isRunning`, `extras.toolSteps`, `extras.opportunity`, `onNew`, `onCancel`, `convertMessage`) to the REAL, shipped `ExternalStoreAdapter<T>` generic type imported from `@assistant-ui/core`:

```
npm install --no-audit --no-fund
npm install --no-audit --no-fund -D @types/react@19.2.14   # a transitive peer the package's own .d.ts needs
./node_modules/.bin/tsc --noEmit -p tsconfig.json
→ EXIT CODE: 0
```

A clean compile against the actual shipped `.d.ts` is real, executable evidence of structural compatibility — not an inference from documentation. `git status --short pnpm-lock.yaml apps/dashboard/package.json apps/api/package.json` in this repo shows nothing: zero footprint. Version chosen (`0.2.23`, and `@assistant-ui/react@0.14.28` if the wrapping React package is installed later) was confirmed 8+ days old, clearing the workspace's 7-day `minimumReleaseAge` supply-chain gate — the gate was respected, not bypassed, when the first pass hit it.

**What was NOT done:** rendering the adapter through `useExternalStoreRuntime` + `<Thread />` in an actual browser/jsdom pass. That needs the real npm package installed in the workspace (a `pnpm add`, correctly scoped this time to a version ≥7 days old) — a small, low-risk, well-understood follow-up for whoever picks up the next card, not claimed as done here.

A secondary, real signal from reading the shipped source during this probe (not new exploration — carried over from the prior pass, now correctly framed): `useExternalStoreRuntime`/`useAssistantTransportRuntime` in `@assistant-ui/react@0.14.28` live under an internal `legacy-runtime/` path, re-exported from the still-independently-versioned `@assistant-ui/core@0.2.23`. Both are live, public, and exported from the package's root entry — "supported, re-exported" is not "deprecated" — but it is worth carrying as a roadmap-risk note.

---

## 5. Compatibility matrix

| Concern | Finding |
|---|---|
| Vite/React 19 | `@assistant-ui/react@0.14.28`'s peer resolution against `react@19.2.6` succeeded during a (reverted) trial install; TYPE compatibility is now proven for `@assistant-ui/core@0.2.23` via the isolated probe (§4.3). Not exercised in an actual Vite dev/build pass. |
| Auth (Clerk) | Orthogonal — the adapter only calls Driftless's own `send`/`cancel`; the Clerk-token-bearing `api.ts` wrapper is untouched either way. |
| Threads | Proven: `messages` derives directly from the real persisted rows; the integrated trajectory (§4.2) shows no duplication across incremental updates. |
| Citations | Not modeled in the spike (text-only `content`). Real integration needs a citation-bearing part type or an `extras`-based renderer — a genuine migration-cost item. |
| Tool UI | Proven the events survive the bridge as typed output (§4.1's fix). Per-tool renderer components (assistant-ui's `ToolCallMessagePart` pattern) still need authoring to reach parity with `ChatThreadView`'s `ToolStepChip`. |
| Queue | `isSendDisabled`/`isRunning` map onto the existing `sendingRef` guard. Mid-run steering-message queuing (playbook §10) is a backend capability, independent of UI runtime choice — not proven or disproven here. |
| Cancel | Proven, idempotent (integrated trajectory phase 5). |
| Artifact sidecar | No first-class "artifact" concept in assistant-ui — bridged via `extras`, using the REAL `OpportunityWorkflowRunResult` shape (not an invented protocol). Proven: a suspend→resume cycle patches one artifact identity across two snapshots without collapsing or duplicating rows (§4.2 phase 6). |

---

## 6. Decision: **ADAPT, staged — keep `ChatThreadView` as the production shell now; build the `ExternalStoreRuntime` bridge alongside, cut over only at parity**

Unchanged from the first pass's conclusion, now on firmer, corrected evidence:

- **Keep** `ChatThreadView.tsx` (1356 lines of working behavior: streaming, tool chips, grouped citations, feedback, regenerate, model picker, context-pressure nudge, the `ContextPill`/`ResearchArtifactPanel` suspend-approve flow) as the production surface through A1+. There is currently nothing new to render that the current shell can't already show — the trajectory evals (§3) pin gaps in what the BACKEND emits, not in what the shell can display.
- **Adopt as the target bridge** `ExternalStoreRuntime` (never `AssistantTransport` — it would hand wire-protocol ownership to a third party, directly against playbook §13's "no debe convertirse en un segundo dueño del workflow"). The spike (§4) now proves the mapping is clean, holds no state of its own, correctly patches a real multi-row artifact by identity, and type-checks against the actual shipped package.
- This operationalizes the playbook's own §14 line — *"`ChatThreadView` custom: SPIKE; conservar como fallback temporal hasta paridad del adapter"* — rather than relitigating it.

**Rollback:** the spike is two files under `apps/dashboard/src/redesign/spike/`, imported by nothing — `rm -rf apps/dashboard/src/redesign/spike` fully reverts it. The type-compat probe lives entirely outside this repository (`$CLAUDE_JOB_DIR/tmp`) and leaves nothing to revert. The two `vitest.config.ts`/`vitest.trajectory.config.ts` edits are one-line reverts each. No production file's behavior changed; no dependency was left installed.

**No second owner of state:** the adapter re-derives `messages`/`extras` from its inputs on every call (proven structurally, §4.2); Mastra + `ChatService` + `ChatStreamHub` remain the only writers of run/thread/message state.

**Enrichment / provider-neutral port:** confirmed to already exist (`entity-enrichment-provider.port.ts`, implemented by `apollo.adapter.ts`) — out of scope for A0, unaffected by this shell decision either way, since `ExternalStoreRuntime` has no opinion on backend tool architecture.

---

## 7. What stays red by design

All 10 trajectory evals (§3) are expected to stay red until the corresponding backend behavior ships, each naming the exact file and missing primitive (`checkpoint`, `plan`, an `artifact.*` stream event, a `suspended` ledger status, a `capabilityId` on the route result, a monitor route, a replay buffer, `resolveCheckpoint`, N-capability query construction). Whoever picks up A1 should start here: the gap between "what `chat.service.ts` does today" and "what the playbook's generic model requires" is now executable and verified against real staging, not prose.
