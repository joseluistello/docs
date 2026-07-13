# Launch Runbook — Model Gateway v2 + Agent Tool Platform + Chat v0

> The operational script for the next launch (PR #192, branch `claude/model-gateway-v2`).
> Everything in this PR is **additive**: merging changes nothing for any existing
> workspace (OpenCode keys keep resolving identically through the gateway's
> credential shim), and every step below has an instant rollback. Decision state:
> all pending decision cards were RULED 2026-07-02 under
> owner-delegated authority (BYOM `79b02da2`, Mastra `2df63a08`, Tool exposure
> `b9962b44`, Chat writes B4 → post-launch); the three Knowledge Suggested edits are
> merged. Nothing in this launch is blocked on a decision.

## What ships (and what deliberately does NOT)

**Ships:**
- **Model Gateway v2 — THE model path (one system, ruled 2026-07-03).** Per-provider
  credentials (encrypted at rest, server-side only); every run (agents + chat)
  resolves its model through the gateway. OpenCode is one provider class inside it:
  existing workspaces' OpenCode keys are read through the credential shim (both Zen
  and Go bases) with ZERO user action — the wire requests are identical
  (candado-proven). There is no flag and no parallel legacy path.
- **Agent Tool Platform** — canonical registry + policy engine + observability +
  mechanical citations. Consumed live by Chat; parity-locked to the legacy tool
  literals everywhere else.
- **Chat v0** — grounded, cited, READ-ONLY workspace chat: threads/messages, the
  assistant turn as an `agent_run`, Topics+Projects+Collections grounding, citation
  chips, stop button, hardening limits, eval harness.

**Does NOT ship (ruled):**
- Chat writes (B4) — post-launch fast-follow, scope pre-approved.
- Mastra runtime — lands behind the AgentRuntime seam post-launch (age gate opens
  2026-07-03 ~20:30 UTC); launch runs on ThinLoopRuntime as ratified.
- External tool exposure via MCP — every canonical tool is `external:false`
  (candado-pinned); apps/mcp is byte-identical to before.
- Native anthropic/google adapters — `adapter_ready:false`; custom OpenAI-compatible
  endpoints are the sanctioned reach.
- Broker / Connector Retrieval — untouched; separate release track.

## Pre-merge checklist

1. **CI**: repo GitHub Actions are currently failing for ALL branches (billing/runner
   issue — account-level, not code). Fix billing first so the merge shows green
   checks; local evidence otherwise: integration 340/340 · api 941/941 ·
   dashboard 10/10 · tsc clean · guardrails PASS.
2. **DB migration review**: TWO new migrations vs staging —
   `AddProviderCredentials…096` (creates `provider_credentials`) and
   `AddChatThreadsAndMessages…097` (creates `chat_threads` + `chat_messages`
   + 2 indexes). All CREATE-only / `IF NOT EXISTS`, no destructive statement,
   no backfill, no touch on existing rows. They run in the normal migration step.
3. Confirm no staging config drift: `ENCRYPTION_KEY(S)` present; no new env vars are
   required by this PR.

## Flip order (staging → prod)

Each step is independently reversible; do them in order, verify, then advance.

**Step 0 — merge + deploy.** Zero behavior change expected. Smoke: existing agents
(Auditor/Architect/Librarian) run exactly as before; dashboard loads; `/models` and
`/config` respond.

**Step 1 — Chat availability (no flag; needs a model).** Chat endpoints exist for all
workspaces, but a turn only runs where model access is configured — otherwise it
answers in-thread with the setup pointer (no ledger noise). Smoke (the human half of
the release gates):
   1. In a pilot workspace: Settings → Agents → set the OpenCode key + model
      (the subscription quick-path; it resolves through the gateway like everything).
   2. Chat tab → ask something covered by a topic → expect a grounded answer with
      citation chips → chip opens the topic.
   3. Ask something NOT covered → expect "isn't recorded" + pointers, zero citations.
   4. Watch the run in Activity (agent `chat`) — trace shows the tool reads; usage
      rolls into Settings → Agents spend.
   5. Press Stop mid-turn → clean "Stopped." message; thread stays usable.

**Step 2 — new-provider pilot (ONE pilot workspace).**
   1. Add a provider credential (Settings → Agents → Model providers): one real
      provider (e.g. deepseek/openrouter) AND one custom OpenAI-compatible endpoint.
      `testConnection` must pass for both.
   2. Point the model list at the new provider ref; run one agent + one chat turn.
   3. Verify in Activity: runs completed, tokens/cost recorded, no secret anywhere in
      trace/error/UI (spot-check run detail).
   4. Rollback if anything is off: revoke the credential and point the model list
      back at the `opencode/…` refs — the subscription key keeps working untouched.

**Step 3 — per-workspace provider adoption.** Teams move providers by adding
credentials and editing their model list; nothing global exists to flip.

## Rollback matrix

| Symptom | Action | Blast radius |
|---|---|---|
| A new provider misbehaves on a workspace | revoke its credential / point the model list back at `opencode/…` refs | that workspace, instant; the OpenCode subscription key never moved |
| Chat misbehaves | it's per-turn and read-only — no flag needed; worst case revert the deploy | no writes exist; threads/messages are inert rows |
| Migration problem | `down()` drops the two chat tables (no product data before launch) | chat only |
| Anything systemic | revert the merge — everything is additive | full revert, zero data loss |

## Post-launch queue (in order)

1. **Mastra P1** (age gate opens 2026-07-03 ~20:30 UTC): `@mastra/core` via lazy
   importEsm, gates 1+7 vs real `nest build` output, data-driven per-role flag,
   call-site inventory candado (AgentRunnerService, LibrarianRunnerService,
   ChatService). No excludes.
2. **B4 — chat governed writes** (scope pre-approved, unblocks once launch is stable).
3. **model_usage write-time cost materialization** (prerequisite for hard budgets).
4. **External exposure implementation card** (from the ruled policy: read-only
   allowlist, per-principal limits, hard-deny external act).
5. Settings → Agents health hint for `credential_undecryptable`.

## Evidence snapshot (post staging-merge + one-system collapse)

Integration 340/340 (48 files, hermetic incl. gateway smoke + chat E2E + stop path) ·
api unit 941/941 (92 files) · dashboard 10/10 · tsc clean · guardrails PASS (3
pre-existing advisory warnings) · `pnpm harness:chat-evals` 6/6 · supply-chain age
gate intact with ZERO excludes (candado-pinned) · one-system candado: no
`gateway_enabled`, no legacy resolver, anywhere in source.
