# Phase 3 — API and Progressive Investigation Surface

## Goal

Expose the durable resource through an authenticated API and a navigable UI where plan, activity,
candidate rows and evidence reconstruct exactly after refresh.

## API

Create a standard NestJS feature module with controller-only HTTP and service orchestration:

- `POST /workspaces/:slug/investigations`
- `POST /workspaces/:slug/investigations/:id/answers`
- `POST /workspaces/:slug/investigations/:id/start`
- `POST /workspaces/:slug/investigations/:id/stop`
- `GET /workspaces/:slug/investigations`
- `GET /workspaces/:slug/investigations/:id`
- `GET /workspaces/:slug/investigations/:id/events?since=`
- `GET /workspaces/:slug/investigations/:id/candidates?cursor=&limit=`
- `GET /workspaces/:slug/investigations/:id/export?format=csv|json`

All routes use the global `WorkspaceGuard`; mutations require a human identity and the existing
assistant entitlement. Cross-workspace ids return 404.

Creation formulates at most three questions from a closed catalog:

- geography;
- evidence threshold;
- priority rule.

Every question has a declared default. Silence is non-blocking: start uses the defaults and records
them as assumptions.

## Progress transport

Use persisted replay plus the existing workspace event stream as a notification bell:

1. worker writes `investigation_events` and candidates;
2. `EventsService` announces that the investigation changed;
3. client fetches events after its last sequence and revalidates the visible candidate page.

Do not create an Investigation-specific token SSE stream. Do not use `ChatStreamHub`; it is
in-memory and belongs to ordinary Chat.

## UI

Add an explicit Investigation route and navigation entry. Desktop uses:

- left: objective, clarifications, plan, curated activity, stop/resume controls;
- right: progressive `DataTable`, counts, filters and evidence drawer.

Mobile uses one scroll: objective -> plan -> activity -> table -> actions. The table may scroll
inside its container; the body must not overflow horizontally.

Reuse:

- `DataTable` for rows;
- `RecordDrawer` interaction conventions for evidence;
- Assistant UI styling/primitives only where they improve the conversation/control pane;
- the existing auth-aware fetch/SWR and workspace event reconnection paths.

Activity is rendered from a closed `label_key` dictionary in English and Spanish, for example:

- `discover.searching` -> `Buscando expansiones recientes`
- `discover.sources` -> `{n} fuentes encontradas`
- `resolve.deduped` -> `{n} empresas únicas después de eliminar duplicados`
- `verify.candidates` -> `Verificando {n} candidatos`
- `verify.qualified` -> `{n} empresas cumplen los criterios`

## Export

- JSON is the canonical row projection.
- CSV includes UTF-8 BOM for Excel, stable columns, escaped commas/quotes/newlines and one row per
  unique candidate.
- Export uses persisted candidates; it never asks the model to regenerate rows.

## Acceptance

- The table exists at `running` with zero rows and grows without page reload.
- Refresh during a run reconstructs plan, activity, selection and rows from the server.
- A deploy/reconnect does not duplicate activity or candidates.
- Stop produces `cancelled` and leaves rows/export available.
- Evidence drawer resolves only platform-minted evidence ids.
- No UI string exposes tools, providers, raw queries, table names or internal budgets.
- Rail and all non-Investigation routes remain visually unchanged.

## Rollback

Hide the navigation entry and route behind the existing entitlement/feature gate; the durable API
and stored runs remain readable.

