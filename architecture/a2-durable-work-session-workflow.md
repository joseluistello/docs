# A2 — Durable Work Session workflow (Mastra + PostgreSQL)

**Project:** `70160c56-cf2f-4d94-81a0-ee9000eee76b` (Commercial Intelligence — Agentic Workbench)
**Card:** A2. Hacer durable el workflow de Mastra
**Scope:** the versioned `work-session-flow-v1` workflow + the recoverable-SSE surface. Dark: registered as a provider, wired to nothing user-visible; the opportunity copy is untouched.

## What ships

- `apps/api/src/chat/mastra-workflow.ts` — `MastraWorkSessionWorkflowFactory`, the same posture as the market-intelligence factory: lazy ESM loaders (`importEsm`, never a static `@mastra` import — the runtime-contract candado holds), a singleton workflow, PostgresStore keyed `driftless-work-session-workflows` over `SUPABASE_URL` with the shared `OPPORTUNITY_WORKFLOW_POOL_MAX` connection budget.
- Steps: `compile-contract` (A3 compiler + bootstrap ExecutionPlan v1) → `clarify` (suspend on a typed `HumanCheckpoint`; resume revalidates workspace, principal, session, thread, checkpoint id and contract version against the PERSISTED suspension) → `finalize` (`contract_ready | needs_clarification | stopped | went_back`).
- Cancel is structural: it resumes through the checkpoint's stop affordance, so it is durable, restart-safe, preserves the compiled contract as the partial, and a second cancel/resume hits the consumed-suspension rejection.
- Steering messages queue on the caller and ride the resume payload (bounded: 5 × 500 chars), drained in order.
- Bounded retries (`withBoundedRetries`) wrap ONLY transient infrastructure (loader/storage init); a `DomainException` never retries.
- Snapshots hold small, closed payloads (contract + plan + checkpoint — proven < 8 KB canonical in the spec); no datasets/HTML.
- SSE recoverability: `WorkSessionStore.listEventsAfter(workspace, session, afterSeq)` serves the persisted tail; replaying it through the idempotent reducer/projection cannot duplicate a delta. `ChatStreamHub` remains an in-memory projection, never an authority.

## Migration / grants / RLS

- **No new Driftless migration**: Mastra's `PostgresStore.init()` creates and owns its `mastra_*` tables on first use — the same mechanism the already-shipped opportunity workflow uses. Both stores write the SAME `mastra_*` tables in the same schema (a store `id` is not a table namespace); run-state isolation between the two workflows comes from the distinct workflow id (`work-session-flow-v1` vs `commercial-opportunity-flow-v1`) in every snapshot key, plus the turn-scoped runId derivation.
- **Grants/RLS**: the store connects with the API's service-role connection string (`SUPABASE_URL`), the same trust level as TypeORM's pool; `mastra_*` tables are not exposed through PostgREST and inherit the service-role-only posture of every other API-owned table. Tenant isolation is enforced ABOVE the storage: `resourceId = workspace_id` on every run, and resume revalidates the full tenant scope against the persisted suspension — a cross-tenant resume fails closed even with direct storage access.
- **Connection budget**: this store is a SEPARATE pool (one connection) from the opportunity workflow's — `DATABASE_CONNECTION_BUDGET` gains an explicit `workSessionWorkflow: 1` line (total 7 → 8, still well under the staging session-pool limit; its spec pins the new total).

## Rollback (P1)

The factory is additive and dark. Rollback = revert the commit: no schema change of ours to unwind (Mastra tables are inert without a caller), no consumer to migrate, no flag needed. If a partial deploy leaves suspended `work-session-flow-v1` runs, they expire unused — nothing reads them after revert.

## Evidence

`pnpm --filter @driftless/api exec vitest run src/chat/mastra-workflow.spec.ts` — 12 tests: straight-through compile, typed suspension with bounded snapshot, cross-turn resume with directed second round, restart survival over shared storage, cancel preserving partials, cross-tenant/principal/checkpoint/stale rejections, consumed-suspension rejection, fail-closed answers, ordered steering + bounded queue, recoverable-SSE tail replay with duplicate-free reapplication, bounded-retry semantics.
