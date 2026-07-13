# Agent Platform Boundary (BYOM Gateway · AgentRuntime · Mastra · Chat)

Internal architecture note. Two kinds of change live in PR #192: the **contract layer**
(chat/runtime/observability types + docs + tests) is strictly **inert** (compiled-away or
never imported); the **BYOM Model Gateway** is **THE model path — one system**
(ruled 2026-07-03): additive code + one additive, reversible migration
(`provider_credentials`) + the always-on provider section in Settings. Existing
OpenCode workspaces resolve identically through the credential shim (their
subscription key serves both OpenCode bases); there is no flag and no parallel
legacy resolver (candado-pinned). Reviewer/operator readiness lives in
`agent-platform-release-gates.md`. The durable "why" lives in the Driftless topics
`model-gateway-v2`, `mastra-adoption-contract`, and `chat-product-contract`.

## The bright lines (non-negotiable)

1. **Driftless owns the model boundary.** Credentials, routing/fallback, capability
   gating, cost/usage normalization, and budget/policy are Driftless's
   (`ProviderCredentialService`, `ModelGatewayService.route`, the `@driftless/model-gateway`
   registry/routing/cost, `BudgetService`). A runtime framework never owns any of these.

2. **Mastra, when it arrives, is only the loop underlayer.** It mounts behind the
   existing `AgentRuntime` seam (`apps/api/src/cognitive/contracts.ts`) as a swappable
   peer of `ThinLoopRuntime`, owning execution mechanics only (reason/act loop,
   tool-call dispatch, per-step events, and a deferred typed-Workflow). `ThinLoopRuntime`
   stays the default and the zero-dependency rollback target.

3. **No product semantic lives in Mastra state.** The topic graph (Knowledge), the
   `agent_run` ledger, Projects, Collections, Broker/Integrations, audit, and the event
   ledger are the ONLY sources of truth. `AgentRunsService` is the sole writer of run
   state. A single-shot Mastra Agent is built with **no storage backend at all**;
   `PostgresStore` is wired only into a deferred suspending Workflow and may hold only a
   re-derivable cursor.

4. **Secrets never cross to the model / result / stream / error.** The decrypted secret
   exists server-side only, inside the resolution path, for the shortest wire window.
   `DriftlessGatewayModel` receives a route + a server-side credential *resolver* — never
   a secret — and the secret never appears in any stream part, generate result, or error
   surfaced to the runtime/Mastra level. Enforced by the candado
   `apps/api/src/agent-runs/mastra-boundary.spec.ts`.

5. **Chat is not a generic LLM endpoint.** It is a product surface — grounded and cited
   over Driftless memory — that runs on the AgentRuntime seam + the Model Gateway, reuses
   the `agent_run` ledger, the `DriftlessEvent` bus, OTEL→Latitude, and Review-Queue
   governance. It is never a bare "send a prompt, get text" route.

## Current state

| Surface | State |
|---|---|
| BYOM Model Gateway → agent loop | **THE one model path (no flag).** Every run resolves base+auth per provider via `buildGatewayResolver`; OpenCode is one provider class (legacy subscription keys ride the credential shim, both Zen and Go — wire-identical, `buildChatRequest` test). Refuses non-`adapter_ready` providers. Rollback per workspace = revoke the credential / repoint the model list. Ships an additive `provider_credentials` migration + the always-on provider section in Settings. ALL runner call sites (auditor/architect, librarian, chat) resolve through it. |
| `DriftlessGatewayModel` (V4 adapter) | **Dark.** Implements the real `@ai-sdk/provider@4.0.0` `LanguageModelV4`; nothing live constructs it (candado-enforced). |
| Native Anthropic/Google adapters | **Dark** (`adapter_ready: false` in the registry) until a dedicated card. Priority live providers: OpenAI-compatible, custom OpenAI-compatible, OpenCode legacy. |
| Mastra runtime | **Deferred** — see the checklist below. No `@mastra/*` dependency on any mergeable branch. |
| Chat | **LIVE (v0, read-only)** — threads/messages module + the grounded turn on the agent_run ledger, Topics+Projects+Collections grounding, mixed citations, stop path, evals. Writes stay B4 (post-launch). |

## Mastra unblock checklist (run when the age gate clears)

Mastra real adoption is **deferred until the just-published v7 cluster clears the
7-day `minimumReleaseAge` supply-chain gate** — `@mastra/core`, `@mastra/schema-compat`,
`@ai-sdk/provider-utils`, `@ai-sdk/provider`. Do **not** expand
`minimumReleaseAgeExclude` on `claude/model-gateway-v2` / `staging` / `main` to bring it
in early. When the cluster has aged past 7 days:

- [ ] Install `@mastra/core@<version>` + the `zod` peer **with no new excludes** (the
      cluster now passes the gate on its own). Pin `@mastra/core` exactly.
- [ ] Load it via **lazy dynamic import** (`importEsm('@mastra/core/...')`) inside an
      `@Injectable` — never a static import, never `@mastra/nestjs` (Express-only ESM →
      `ERR_REQUIRE_ESM` under `module: commonjs`).
- [ ] Add a **minimal `MastraRuntime` behind the `AgentRuntime` seam** (peer of
      `ThinLoopRuntime`); `ThinLoopRuntime` stays default + rollback target.
- [ ] **Real smoke** against `nest build` output (not vitest): a Mastra `Agent` consumes
      a `DriftlessGatewayModel` (real `LanguageModelV4`), runs one tool via a Driftless
      `ToolExecutor`, emits a compatible trace.
- [ ] Assert **no storage / no product state** in Mastra (Agent built with no storage
      handle; `mastra_runtime` schema empty after a run) and **no secret** crosses the
      boundary.
- [ ] **Clear rollback**: a config flip back to `ThinLoopRuntime`; nothing product-bearing
      delegated to Mastra.

Already de-risked on a throwaway spike (so the eventual build needs no new excludes):
`@mastra/core@1.47.0` dynamic-imports cleanly, exposes `Agent` + `createTool`, and accepts
a `LanguageModelV4` model via its `provider-v7` path — so `DriftlessGatewayModel` is
wire-compatible.

## Runtime seam contract (stable, dark)

`apps/api/src/cognitive/runtime-contract.ts` is the single stable entry point a consumer
(Chat, BYOM, tools) or a future runtime (Mastra) builds to — so neither depends on a
concrete runtime impl. It re-exports the live seam (`AgentRuntime`, `AgentSpec`,
`AgentRunResult`, `RunTraceEvent`, `ToolExecutor`) and adds the formal contracts:

- **Capabilities** — `RuntimeCapabilities` + `THIN_LOOP_CAPABILITIES` (the default;
  `DEFAULT_RUNTIME_ID = 'thin-loop'`, the rollback target) and `MASTRA_CAPABILITIES_FUTURE`
  (a plain descriptor — no `@mastra` import).
- **Model boundary** — a runtime's only model dependency is the `ModelResolver` abstraction
  (`RuntimeModelBoundary`); it never imports the gateway/credential services nor holds a raw key.
- **Tool / trace handoff** — `ToolCallEvent` / `ToolResultEvent` and `RuntimeTraceEvent`; the
  runtime emits via `onStep`, the platform owns `agent_run.trace` (the runtime never writes the ledger).
- **Citation handoff** — `CitationRef` / `GroundingHandoff`, structurally compatible with
  `chat.contracts` `Citation`, so a future Chat runtime surfaces grounding without reaching into
  Chat persistence.
- **Error / abort** — `RuntimeError` / `RuntimeErrorClass` (scrubbed message) and
  `RuntimeRunOptions` (`AbortSignal` + deadline), declared for future wiring.
- **Secret boundary** — no output/trace/error contract declares a key-bearing field; enforced by
  `runtime-contract.spec.ts` (source scan) + the adapter candado (`mastra-boundary.spec.ts`).

Inert: nothing imports this module at runtime; the live impls and consumers still import
`./contracts` directly and are unchanged.

## Runtime observability contract (stable, dark)

`apps/api/src/cognitive/observability-contract.ts` fixes how ANY runtime (ThinLoop /
OpenCode legacy / Mastra future) reports model usage, cost, routing, tool events,
citations and errors — uniformly, without coupling to a provider or leaking secrets.

- **Driftless owns the semantics** — usage/cost/routing/policy/audit are Driftless's; a
  runtime only **emits normalized events**. `ModelUsage` (normalized tokens + cache
  reporting), `ModelCostEstimate` (USD; `amount: null` when **unpriced** — never a fake
  `$0`, matching `computeCostUsd`), `ModelRoutingDecision` (requested → selected, per-ref
  rejections, rotation outcome, budget decision).
- **Provider raw payloads are never surfaced directly.** The raw usage blob is opaque and
  normalized; only `ProviderRawUsageRef` (keys seen, never values) records the boundary.
- **Event union** — `RuntimeObservabilityEvent`:
  `model_start | model_end | tool_start | tool_end | citation | error | cancel`.
  `ToolExecutionEvent` references the tool's input *schema* and carries only sanitized
  summaries (keys + sizes), never raw args/outputs.
- **Secrets never cross output / stream / trace / error / chat boundaries.** No usage,
  cost, routing, event, tool, or handoff type declares a key-bearing field; enforced by
  `observability-contract.spec.ts` (source scan) + the existing candados.
- **Chat handoff** — `ChatObservabilityHandoff` (runId → `agent_runs.id`, an opaque
  `traceRef`, citations, grounded source refs) lets Chat render a grounded, cited answer
  without importing a concrete runtime.

Inert: nothing imports this module at runtime; behavior is unchanged.

## Tool platform — canonical registry & the MCP mapping (live for Chat + agents)

`apps/api/src/cognitive/tool-registry.ts` defines a tool ONCE (`DriftlessTool`: JSON-Schema
in/out, `sideEffect read|write|act`, substrate, policy/cost class, idempotency, output
budget, usage examples, `external` flag) and DERIVES each surface's shape: the runtime
`ToolDef` (byte-identical to the live literals — parity-locked in `registry-tools`), the
Mastra `createTool` config (no `@mastra` import), and the **MCP descriptor**.

Live consumers: Chat (`chat/chat-tools.ts`) and — via `cognitive/agent-tools.ts` — the internal
agents (Auditor/Architect on `SANDBOX_TOOLS`, Librarian on `TOPIC_TOOLS`). `SANCTIONED_LIVE_IMPORTERS`
in `pr-hardening.guard.spec.ts` pins exactly this set. The MCP descriptor + Mastra derivations remain
dark until their own cards.

Canonical ↔ apps/mcp field mapping (pinned by `mcp-mapping.contract.spec.ts`, which reads
the live registry SOURCE — no cross-package import, zero behavior change in apps/mcp):

| Canonical | apps/mcp entry | Rule |
|---|---|---|
| `name` / `title` | `name` / `title` | verbatim |
| `description` | `description` | same normalization (`\s+\n`→`\n`, ` {2,}`→` `, trim) |
| `inputSchema` | `inputSchema` | 1:1 **plus only** the uniform optional `workspace` arg (verbatim copy) |
| `outputSchema` | `outputSchema` | pass-through (2025-06-18 structured output) |
| `sideEffect`/`idempotent`/`substrate` | `annotations` | `readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint` |
| `external` + policy engine | OAuth scope / default-deny | exposure stays decision-gated (external card) |

Spec-version posture: the repo speaks MCP **2025-06-18**; the spec is at **2025-11-25**
with a **2026-07-28** revision (stateless core, Tasks, enterprise auth). The registry
insulates Driftless from that churn: adopting a new revision = adding a derivation, never
rewriting tools. Governance (`tool-policy.ts`) and observability (`tool-observability.ts`)
sit on the same canonical definitions, so every surface inherits them uniformly.

## E2 cross-surface retrieval (A2 design — specs dark, E2 implements)

Chat v0 shipped Topics-first with **no retrieval router**: "routing" is the model's own
tool choice over the read registry, under the skill's budget clauses and per-tool output
caps. A2's finding is that this stays true at E2 scale — the design widens the **tool
surface**, not the machinery. `cognitive/surface-tools.ts` carries the canonical specs
(dark, candado-guarded like every platform contract):

| Surface | Tools | Cites as | Budget (chars/result) |
|---|---|---|---|
| Projects | `list_projects`, `get_project` | `project` (id) | 4 000 / 8 000 |
| Collections | `list_collections`, `get_collection`, `query_records` | `collection` (id) / `record` (record id) | 4 000 / 6 000 / 6 000 |
| Connected docs (S7) | `search_docs`, `get_doc` | `doc` (connector `citation_id`) | 4 000 / 8 000 |
| Broker events mirror | `broker_recent_events` | **nothing** | 2 400 |

**Ranking / fusion / stop conditions.** No planner and no interleaving engine: the tool
descriptions carry the routing knowledge ("survey → load", "get_collection before
query_records"), the skill keeps the 1–4-call budget for narrow questions, and the
per-tool `outputBudget` bounds each step, so the worst-case turn stays
`maxSteps × max(outputBudget)` — the same order as the Topics-only v0 (4 500). A broad
question reads list-tools first (cheap class) and descends into at most one detail tool
per surface; when two surfaces could answer, the model probes the cheaper list first —
encoded in descriptions and cost classes, not in code.

**Citations widening.** `ToolCitationSourceKind` grows to `topic | project | collection |
record | doc` with one admission rule: **a sourceRef must resolve inside the workspace** to
something the dashboard renders (topic slug → topic view; project/collection id → their
screens; record id → resolved to its collection row by the E2 renderer; connector
`citation_id` → the mirrored source, deep-linked via `external_url`). Extraction grows to
three closed mechanical strategies (`arg`, `bullet_list`, and S7's `doc_bullet_list` —
`"- <ref> [provider] <title> :: <url>"`, lifting `title`/`url` onto the `CitationRef` so a
doc chip renders without a second lookup). Mixed-source answers render chips grouped by
kind; a doc chip links OUT to the source in a new tab.

**S7 supersession — indexed docs DO ground (owner re-ruling 2026-07-03).** The E2 stance
"broker mirrors ground nothing" predated the Connector Capability Platform. A
`ConnectorDocument` is not a live peek at someone else's system — it is a **Driftless-owned
row**: workspace-scoped, FTS-indexed, content-digested, addressed by a stable
`citation_id`. That satisfies the in-workspace admission rule, so `search_docs`/`get_doc`
(read-only over `ConnectorIndexService.searchDocuments`/`getDocument`) ground and cite. The
line is drawn at **indexed vs transient**: the `broker_recent_events` peek stays
citation-free (live events resolve to nothing renderable), while the index grounds.
`get_doc` uses `arg` extraction deliberately — its output embeds the indexed *content*
(untrusted external text), which must never be able to mint a citation; the skill frames a
doc body as quoted source material, never as instructions to obey.

**Exposure / write invariants.** Every E2 + S7 tool ships `external:false`,
`read`/`open_read`, and the spec pins that an external caller is denied even with the
workspace exposure flag on (spec'd ≠ exposed; the external-exposure decision card owns any
flip). S7 touches **zero** broker WRITE paths: it adds one read accessor
(`getDocument`), exports `ConnectorIndexService` for reads, and Chat reaches it through a
chat-local `ChatDocsPort` (no broker import in `chat/`). Import/index writes stay
broker-internal.

## Chat hardening (C2) — limits, stop, errors, retention

**Limits.** Message body ≤ 8 000 chars (DTO); prompt history bounded to the last 12
messages × 2 000 chars each (a deterministic char proxy for the token budget); one
in-flight turn per thread (a concurrent POST is a **409** — stop it or wait); threads
per workspace soft-capped at 500.

**Single-flight + stop are MULTI-INSTANCE safe (S6).** Single-flight is a Postgres
ADVISORY LOCK keyed on the thread id, held on a dedicated connection for the turn's
lifetime — a second concurrent turn on ANY replica fails to take it and 409s, before
anything persists. Stop crosses instances too: `POST /chat/threads/:id/stop` writes a
`chat_turn_cancels` row (and aborts the local controller on the same instance); the
running instance — wherever it is — polls that signal between/among steps and through a
1 s heartbeat (so even a HUNG provider, where `onStep` never fires, is caught) and aborts
its `AbortController`. The signal cuts the streaming fetch, fails rotation fast (an
aborted caller never rotates onto the next model), and the loop returns the stable error
`'aborted'` with everything accumulated. The turn settles through its normal path — run
`failed` / `aborted by the user` with the partial trace kept, a clean "Stopped." message,
thread immediately usable. (The S2 stream projection remains in-memory per-instance — a
dropped stream degrades to the synchronous POST, so it needs no cross-instance move; a
multi-replica streaming upgrade would ride the same LISTEN/NOTIFY bus as workspace events.)

**Per-thread model (S6).** A thread may carry a `model_override` (parseModels-validated)
that takes priority over the workspace default for its turns; the model pill is a real
picker over the workspace's configured list, and spend still rolls up per the model
actually used. Clearing the override falls back to the workspace list.

**Errors.** Config gates answer in-thread (run_id NULL, no ledger row); stop is a
first-class terminal state; everything else is the generic clean failure line — the
run row carries the detail, the message never carries a stack.

**Parallel tools + context nudge (S4).** A turn's tool calls now dispatch
CONCURRENTLY (`Promise.all`) — every exposed tool is a READ (the policy engine denies
write/act structurally), so parallel dispatch is side-effect-safe. Determinism is
preserved: `tool_call` events fire in call order, then results stitch back in CALL order
(array position), so the model sees tool messages in the exact order it requested them
regardless of which finished first. Separately, each turn returns a `contextPressure`
signal (`ok` | `high` | `full`) computed from the rendered-history char budget (12 × 2 000)
and whether older turns already fall outside the 12-message window. At `high`/`full` the UI
invites the teammate to start a NEW chat (a dismissible nudge, prominent at `full`, never
blocking). This is deliberately a NUDGE, not memory: there is **no summarization, no thread
memory, no compaction** — the history window mechanics are unchanged, and a guard grep-pins
the absence (owner directive). Revisit memory only with a solid, owner-approved design.

**Streaming (S2).** `GET /chat/threads/:id/stream` (SSE) projects an in-flight turn to
the browser LIVE: assistant tokens (`message.delta`), tool activity (`tool.activity`, a
compacted status line), and a terminal `run.finished` carrying the persisted message id.
The POST turn feeds these through `ChatStreamHub` — an **in-process, per-thread** channel,
the same single-instance posture as the in-flight registry above (a multi-replica deploy
moves it to the Postgres LISTEN/NOTIFY bus). It is a **projection, never a second source
of truth**: the terminal event points AT the persisted row (id), so the browser reconciles
by revalidating, and a dropped/absent stream degrades to the synchronous POST render (the
pre-S2 behavior). The channel is ref-counted (dropped when its last subscriber leaves, so
the per-thread map can't grow unbounded) and tenant-isolated (the thread is pinned to the
workspace before any event flows — a leaked thread id can't tap another tenant's stream).
This retired the dashboard's old agent-run trace polling.

**Lifecycle + feedback (S5).** Threads carry a real lifecycle: `PATCH /chat/threads/:id`
renames (marking `title_is_custom` so the auto-titler yields) or archives/unarchives;
`DELETE /chat/threads/:id` hard-deletes (cascading messages) and is the stricter act —
the thread opener or a workspace owner/admin only. The Rail and History main list show
ACTIVE threads; archived ones move to a collapsible History section, recoverable. After
the FIRST assistant answer a one-shot, tool-less **auto-titler** (the `chat-titler` skill
on the same runtime + gateway) replaces the raw 80-char truncation with a human title —
fire-and-forget so it never delays the answer, and it never clobbers a user-renamed
thread. Feedback closes the loop: `POST …/messages/:id/feedback` records 👍/👎 (+ optional
reason) as jsonb on the assistant message; `scripts/harness/export-chat-feedback.mjs`
turns 👎-with-reason turns into chat-eval CANDIDATES (question + bad answer + critique +
grounding), so the goldens grow from real usage — the flywheel.

**Retention.** Chat rows follow the workspace retention story: threads/messages cascade
with the workspace; `ChatMessage.run_id` is ON DELETE SET NULL so chat history outlives
purged runs. No chat-specific retention job exists (deliberate — revisit only if chat
volume ever warrants one).

## Hard stops

Anything that requires real persistence, a live agent loop, live model routing, a fresh
Mastra dependency, a DB migration, a new Nest module, a staging deploy, or touching
integration-broker / Connector Retrieval is **out of scope here** — stop and record the
decision/blocker. The decision cards (BYOM, Mastra, Chat) carry the proposed defaults and
remain human-gated; none is ratified.
