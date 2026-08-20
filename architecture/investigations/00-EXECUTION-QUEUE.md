# Investigation + Data Artifacts — Execution Queue

> Implementation queue for one strong coding agent working sequentially from `origin/staging`.
> Read this file first, then execute the numbered documents in order. Each phase gets its own commit.

## Product outcome

Turn Driftless from a chat that returns prose into a commercial-intelligence workbench that can:

1. run a bounded investigation outside a normal Chat turn;
2. survive refreshes, deploys and worker restarts;
3. progressively build a navigable, evidence-backed dataset;
4. present that dataset as tables, metrics and charts;
5. let a human promote selected verified rows into a Collection;
6. add new data providers behind capability-level ports without exposing vendor names to the model.

## Non-negotiable architecture

- Ordinary Chat remains `one turn, one belt, one answer`.
- Investigation is an explicit resource and route. Message wording never silently starts one.
- Chat and Investigations must not import one another. Add an architecture test that enforces this.
- The database is the source of truth for plans, events, candidates and artifact datasets.
- `agent_runs` remains the attempt ledger; `model_usage` remains the cost ledger.
- Progress is curated state, never model reasoning, tool names, raw queries or provider metadata.
- Candidate updates are idempotent UPSERTs, not a generic artifact-patch protocol.
- A chart or table is a view of persisted data, not the authoritative data itself.
- Collection writes are explicit, selected by a human, authorized and idempotent. No silent auto-promotion.
- Provider expansion occurs behind semantic capability ports. Never add `search_brightdata` or `search_crunchbase` to the model belt.
- No Redis, no second workflow engine, no second observability vendor, no Assistant Cloud dependency.

## What assistant-ui owns

assistant-ui owns the conversation rendering and frontend runtime. Driftless currently uses
`@assistant-ui/react@0.15.8` with `useExternalStoreRuntime`, so Driftless still owns messages,
persistence and backend behavior. The optional Assistant Cloud is not required.

For data artifacts, evaluate assistant-ui's Generative UI as a **renderer adapter** over a
Driftless-owned, versioned `DataArtifactSpec`. Do not persist assistant-ui's experimental wire
format as the domain contract.

The Claude Artifacts example generates arbitrary HTML/CSS/JavaScript inside a sandboxed iframe.
That is appropriate for creative prototypes, not for governed commercial evidence. It is outside
this program.

Official references:

- https://www.assistant-ui.com/docs/architecture
- https://www.assistant-ui.com/examples/generative-ui
- https://www.assistant-ui.com/docs/api-reference/generative-ui
- https://www.assistant-ui.com/examples/artifacts

## Current reusable seams

- Discovery engine: `apps/api/src/cognitive/market-research/web-market-discovery.protocol.ts`
- Candidate contract, dedupe and ranking: `apps/api/src/research-providers/web-market-discovery.contract.ts`
- Semantic market operations: `apps/api/src/market-data/tools/market-data.tools.ts`
- Durable queue precedents: `agent-queue.service.ts`, `steward-queue.service.ts`
- Cross-instance notification: `EventsService`
- Operational table: `apps/dashboard/src/components/ui/DataTable.tsx`
- Persisted table presentation: `apps/dashboard/src/redesign/usePresentationTable.ts`
- Assistant message artifact reservation: `DriftlessAssistantMessage.tsx`
- Observability: OTEL to Latitude; do not introduce another backend.

## Sequence

| Phase | Document | Deliverable | May proceed when |
|---|---|---|---|
| 1 | `01-ENGINE-VALIDATION.md` | Live quality/cost evidence for the existing discovery engine | The engine produces useful candidates on the frozen cases, or its concrete data limitation is documented |
| 2 | `02-DURABLE-INVESTIGATION-CORE.md` | Durable parent, steps, events, candidates, queue, resume/stop | Kill/restart resumes without duplicate rows |
| 3 | `03-API-AND-PROGRESS-SURFACE.md` | Authenticated API, replay and progressive Investigation UI | Refresh reconstructs the same plan/activity/table |
| 4 | `04-DATA-ARTIFACT-VIEWS.md` | Typed table/metric/chart views and assistant-ui compatibility decision | Every rendered value traces to a persisted dataset field |
| 5 | `05-COLLECTION-PROMOTION.md` | Human-selected, idempotent candidate promotion | Replaying the same promotion creates no duplicate records |
| 6 | `06-SOURCE-EXPANSION.md` | Provider-neutral Bright Data / structured enrichment seams | A provider can be swapped without changing the model-visible capability |
| 7 | `07-EVALS-ROLLOUT-AND-OPERATIONS.md` | Live evals, observability, load/rollback gates | Staging report is green and rollback is rehearsed |

## Worker protocol

For every phase:

1. Fetch `origin/staging` and record the exact base SHA in the delivery note.
2. Read `AGENTS.md`, `product.md`, this queue and the current phase completely.
3. Retrieve Driftless context for the exact files before editing.
4. Inspect before edit. Do not implement from this document against code that has materially moved.
5. Work only inside the phase scope. If a prerequisite is missing, stop and report it.
6. Write tests before or with each behavior.
7. Run the focused suite, `typecheck`, `build`, and `bash scripts/harness/check.sh`.
8. Run `driftless context get --diff`; persist one clean Note only if a durable rule changed.
9. Commit the phase independently. Do not merge, push, open a PR or begin the next phase unless asked.
10. Report facts, tests, limitations and rollback. Never call an unrun check green.

## Global stop conditions

Stop the queue and ask for a decision if any phase would require:

- coupling ordinary Chat to Investigation internals;
- weakening `minimumReleaseAge` or adding a package exclusion;
- resurrecting `WorkSession*`, `gtm_research_runs` or the deleted generic patch reducer;
- adding a new public route or bypassing `WorkspaceGuard`;
- storing credentials outside the encrypted provider-credential path;
- exposing raw LinkedIn personal data or implementing scraping without a documented legal/data-rights decision;
- making Collection promotion automatic;
- changing pricing, credits or entitlements.

## Definition of program done

A user can explicitly start a Company Expansion Investigation, accept or skip at most three
clarifications, watch a durable plan and evidence-backed table fill progressively, inspect sources,
switch between verified table/metric/chart views, export the dataset, select rows and promote them
to a Collection, then refresh or survive a deploy without losing state. Ordinary Chat remains
behaviorally and architecturally independent.

