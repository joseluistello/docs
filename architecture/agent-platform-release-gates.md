# Agent Platform — current state & remaining gates

Operator + reviewer note for the agent platform that shipped in PR #192 (`claude/model-gateway-v2`)
and the follow-up unification. What is live, what is still dark, the rollback story, and how to
validate. No changelog, no marketing — just clarity. Companion to `agent-platform-boundary.md`.

> Update (post-launch unification): PR #192's pre-merge readiness framing (a `gateway_enabled`
> flag with a parallel legacy path) is obsolete. The owner ruled ONE model system before launch —
> the flag and the legacy resolver were deleted from source (candado-pinned). This note reflects
> the shipped reality: the gateway is the only model path, Chat v0 is live, and the internal
> agents run on the same tool platform as Chat.

## What's live

### Model Gateway — THE model path (one system)
- Every run (Auditor/Architect/Librarian/Chat) resolves `{base, auth}` per provider, per attempt,
  through `buildGatewayResolver` over `ProviderCredentialService.resolveAuth` — server-side only,
  never returned by the API. There is **no `gateway_enabled` flag and no legacy resolver**
  (`pr-hardening.guard.spec.ts` pins their absence).
- **OpenCode is one provider class inside the gateway.** A workspace's legacy subscription key
  (`settings.agents.opencode_key_enc`) resolves for BOTH `opencode` and `opencode-go` through the
  credential shim, wire-identical to the pre-gateway path (`buildChatRequest` candado,
  `agentic-loop.spec.ts`).
- `provider_credentials` is the single credential store (entity registered in BOTH
  `libs/db/data-source.ts` and `apps/api/app.module.ts` — the parity candado
  `db-entity-registration.guard.spec.ts` keeps them in sync). Migration
  `BackfillOpencodeCredential1715200000100` copies each legacy key into a real row (additive,
  idempotent, reversible); the legacy field + shim are retained as the rollout safety net.
- **Dashboard:** one always-on "Model providers" section (Settings → Agents) — save/test/revoke a
  credential for any of the ten provider classes, and a provider-aware model picker (OpenCode via
  the models.dev catalog; every other adapter_ready provider via the live `GET /models` probe).

### Chat v0 — live, read-only
- `apps/api/src/chat` (module/controller/service + chat-tools), `ChatThread`/`ChatMessage`
  entities + migrations, the `chat` skill, and the dashboard wiring. A Chat assistant turn IS an
  `agent_run` (single ledger). v0 is READ-ONLY — governed writes are B4 and need a new owner ruling.

### One tool platform, used everywhere
- The `DriftlessTool` registry (policy gate + observability + citations) backs Chat AND — via
  `cognitive/agent-tools.ts` (`buildAgentToolExecutor`) — the Auditor/Architect (`SANDBOX_TOOLS`)
  and Librarian (`TOPIC_TOOLS`). The canonical sets are parity-locked to the live literals so the
  flip is a provable no-op; the agents present `caller:'internal_agent'` and their in-loop tools
  are all read (the policy engine is a transparent pass-through). Their governed writes stay
  post-loop Action blocks. `SANCTIONED_LIVE_IMPORTERS` pins exactly who consumes the platform.

## What is NOT live (still dark, candado-pinned)
- `DriftlessGatewayModel` (the `@ai-sdk/provider` V4 adapter) — constructed by nothing live
  (`mastra-boundary.spec.ts`).
- Native Anthropic/Google adapters — `adapter_ready:false` + `base_url:null`; the resolver refuses
  them (`provider-registry.contract.spec.ts`). Reach them today via a custom OpenAI-compatible
  endpoint. Priority live providers: OpenAI-compatible, OpenRouter, DeepSeek, Qwen, custom
  OpenAI-compatible, local, and OpenCode (Zen/Go).
- Mastra runtime — **no `@mastra/*` dependency, no import** (static or dynamic). Deferred.
- External-caller (MCP) write/act tool exposure — hard-denied even with the exposure flag on
  (`tool-policy.spec.ts`).
- Chat governed writes (B4) — Chat is structurally read-only.

## Rollback / no-op story
- Per workspace: **revoke the offending provider credential** (`DELETE
  /workspaces/:slug/provider-credentials/:provider_class`) and/or point `settings.agents.model`
  back at `opencode/…` refs. There is no flag to flip — the gateway is the only path.
- The legacy `opencode_key_enc` + model string stay valid and authoritative through the shim; the
  backfill migration is reversible (`down()` removes only the rows it created).
- The `provider_credentials` table + `agent_config_events.provider_class` column migration is
  additive and reversible.

## Remaining gates
- Mastra real runtime — deferred (its adoption card gates it; `@mastra/core` go/no-go).
- Native Anthropic/Google native-auth wire — a dedicated card, kept dark until then.
- Drop the legacy `opencode_key_enc` field + the resolveAuth shim — a follow-up, only once the
  backfill is proven complete in staging/prod.

## Validate (local)
```
pnpm install --frozen-lockfile
bash scripts/harness/check.sh   # build + per-package typecheck + react-doctor + guardrails + tests
# integration (needs a Postgres on PATH or TEST_DATABASE_URL):
pnpm --filter @driftless/api test:integration
```
