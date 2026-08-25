# Legacy Radar Flow — Keep/Delete/Adapt Inventory

Project: **Commercial Intelligence Chat — reemplazo visible** (C0/C1).
Playbook: `market-intelligence-chat-surface`. Replaces the legacy Radar
conversational product with a single Mastra Opportunity Flow; the old product
must become unreachable, while reusable infrastructure (ledger, credits,
quote/approval, provider attempts, cancel/reconcile, adapters, ports) survives
behind the new workflow.

**C1 status: RETIRO COMPLETO.** The legacy Radar product is removed from Chat
(RadarConversationService, radar-copy, `start_lead_search`, the `option` seam,
the sidecar entity, the interview HTTP endpoints, the dashboard rich-message
rendering) and a structural candado
(`apps/api/src/radar/conversation/legacy-radar-candado.spec.ts`) fails the build
if Chat ever re-imports or re-registers it. The trajectory eval
(`opportunity-trajectory.trajectory.spec.ts`) is now GREEN (7/7). KEEP-INFRA
(ledger, credits, quote/approval, attempts, cancel/reconcile, adapters, ports)
still compiles with its tests.

Classification of every legacy-Radar reference across the API and dashboard:

- **DELETE** — belongs to the legacy product only (interview, cotización,
  precio, radar-copy, estados/chips, `start_lead_search`, `option` seam).
  Removing it cannot break the new flow.
- **KEEP-INFRA** — reusable infrastructure the new workflow needs: ledger,
  credits, quote/approval engine, provider attempts, cancel/reconcile,
  adapters, ports. Never delete.
- **ADAPT** — shared surface that must change shape (chat turn pipeline,
  skills, DTOs, dashboard chat shell) so the legacy product stops being
  reachable while the new flow rides the same rails.
- **OUT-OF-SCOPE** — exists in the codebase but is NOT part of this project
  (enrichment, contacts). Leave untouched; do not classify as new-flow infra.

This inventory was produced by reading every referenced file; line numbers are
as of branch `staging` at the time of writing.

---

## API (`apps/api/src`)

| File | Lines | Class | What it is |
| --- | --- | --- | --- |
| `radar/conversation/radar-conversation.service.ts` | whole file | DELETE | The deterministic interview → cotización → precio → búsqueda state machine (`nuevo/entrevista/cotizando/corriendo/listo`). Pure product. |
| `radar/conversation/radar-copy.ts` | whole file | DELETE | Every user-visible Spanish string of the interview/price product (`precioAprobar`, `busquedaLista`, `radarPausado`…). Consumed only by the conversation service. |
| `radar/conversation/radar-lexicon.spec.ts` | whole file | DELETE | Lexicon gate for the product copy. |
| `radar/conversation/radar-conversation.service.spec.ts` | whole file | DELETE | Tests for the conversation state machine. |
| `cognitive/surface-tools.ts` | 252–284 | DELETE | `RADAR_TOOLS` spec incl. `start_lead_search`. |
| `chat/dto/post-message.dto.ts` | 7–9, 15–17 | DELETE | The `option` chip-click seam routed to the deterministic machine. |
| `chat/chat-tools.ts` | 160–167, 175–177, 588–650 | DELETE | `leadSearch` dep, `leadSearchBrief` capture, radar registry, `FREE_SOURCE_TOOLS` gate wiring. |
| `chat/chat.service.ts` | 64, 165–170, 595–636, 645–659, 946–953, 1300–1320 | DELETE | Radar dispatch seam: `ownsTurn`/`startFromBrief`/`esBusquedaDirecta`, `radarTurnResult`, `leadSearch: !!this.radar`, post-run `start_lead_search` dispatch. |
| `cognitive/skills/chat.skill.ts` | 19–59 | ADAPT | Re-scope from "Topics/Leads/Collections menu + start_lead_search" to the single opportunity flow (profile → warehouse → coverage → approved Parallel). |
| `chat/chat-tools.ts` | 611–642 (gate) | ADAPT | Keep the "signals-before-paid" intent but re-home the preflight on the warehouse (`query_market_signals`), never on `query_records` (CRM). |
| `chat/chat-tools.spec.ts` | 629–731 | ADAPT | Belt/gate tests for `start_lead_search` must be rewritten against the new surface. |
| `chat/chat.service.spec.ts` | 1537–1602 | ADAPT | Radar dispatch tests must be rewritten/removed with the seam. |
| `radar/radar.module.ts` | 55–62, 101–102, 113, 173 | ADAPT | Remove conversation wiring + forwardRef cycle; keep engine providers/exports. |
| `chat/chat.module.ts` | 13–17, 32 | ADAPT | Drop `forwardRef(() => RadarModule)` once the seam is gone. |
| `libs/db/src/entities/radar-thread.entity.ts` | whole file | DELETE | Sidecar `radar_threads` table holding the conversation state. (Historical migrations are NEVER deleted — see the migration row below.) |
| `libs/db/src/migrations/1715200000123-AddRadarConversation.ts` | whole file | KEEP | Historical migration that created `radar_threads`. **Historical migrations are never deleted or edited** — if a future card retires the table, it ships a NEW forward-only migration whose `up()` retires it and whose `down()` restores it (only if actually necessary; C1 does not invent it). |
| `radar/dto/radar.dto.ts` | 24–43 | DELETE | `DraftContractDto`, `ReviseContractDto`, `ApproveContractDto` (interview HTTP face). |
| `radar/radar.controller.ts` | 43–65 | DELETE | `contracts/draft`, `contracts/revise`, `contracts/approve` — the interview's HTTP face. |
| `radar/radar.controller.ts` | 70–77, 79–94 | OUT-OF-SCOPE/UNCHANGED | `searches`, `criteria/:slug` (GET/PATCH) — legacy criterion/contract compilation. The new Opportunity Flow re-homes contract/criterion in the workflow; do not wire. |
| `radar/radar.controller.ts` | 96–122, 242–267 | KEEP-INFRA | `runs/:runId` (GET) and `runs/:runId/trace` — run LEDGER reads. |
| `radar/radar.controller.ts` | 126–145 | KEEP-INFRA | `runs/:runId/price` — the quote/approval engine. |
| `radar/radar.controller.ts` | 148–218 | KEEP-INFRA | `credits`, `credits/history`, `credits/packs`, `credits/checkout`, `credits/grant` — credits/ledger. |
| `radar/radar.controller.ts` | 220–224, 228–232 | KEEP-INFRA | `runs/:runId/start` (approval-gated execution) and `runs/:runId/reconcile` — cancel/reconcile. |
| `radar/radar.controller.ts` | Contact activation routes | REPLACED | The legacy `collections/:id/enrich/contacts` route was removed. Contact activation now uses explicit `contact-paths/quote` then `contact-paths/unlock` with a confirmed spend cap and idempotency key. |
| `radar/radar.controller.ts` | 292–306 | OUT-OF-SCOPE/UNCHANGED | `runs/:runId/monitor` (+ pause/resume) — legacy radar monitor; not in the enumerated KEEP-INFRA categories. |
| `radar/radar.controller.ts` | 316–323 | OUT-OF-SCOPE/UNCHANGED | `runs/:runId/stream` (SSE) — legacy run-table projection; the new artifact carries its own stream. |
| `radar/radar-run.service.ts`, `radar/credits.service.ts`, `radar/radar-pricing.ts` | whole files | KEEP-INFRA | Ledger, credits, quote/approval, cancel/reconcile. |
| `radar/radar-criterion.service.ts` | whole file | OUT-OF-SCOPE/UNCHANGED | Legacy criterion/contract compilation; the workflow re-homes it. Not in the enumerated KEEP-INFRA categories. |
| `radar/radar-monitor.service.ts`, `radar/radar-stream.hub.ts`, `radar/radar-webhook.controller.ts` | whole files | OUT-OF-SCOPE/UNCHANGED | Legacy monitor/run-narration/stream infra of the radar product; not in the enumerated KEEP-INFRA categories. |
| `radar/radar-onboarding.service.ts` | whole file | ADAPT | Profile/brief ingestion. The interview's question flow is product; the profile facts it gathered feed the new compile-profile step. |
| `radar/radar-enrichment.service.ts`, `radar/enrichment` endpoints, `radar/contact-path.ts`, `radar-enrichment.service.spec.ts` | whole files | OUT-OF-SCOPE | Enrichment and contact resolution are **outside this project's scope** (playbook: "Contacto y enrichment ocurren únicamente después de seleccionar una oportunidad, mediante otro capability opt-in"). NOT new-flow infra; leave untouched, do not wire. |
| `radar/ports/market-intelligence-gateway.port.ts`, `radar/adapters/postgres-market-intelligence.adapter.ts` | whole files | KEEP-INFRA | The warehouse-only frontier the new flow consumes. |
| `radar/planning/mastra-market-intelligence-workflow.ts` + `.spec.ts`, `market-intelligence-tools.ts`, `market-intelligence-tool-schemas.ts` | whole files | ADAPT | The single Opportunity Flow; extend with coverage/quote/suspend-resume/Parallel normalization. |
| `radar/gtm-provider-resolver.ts`, `radar/ports/*provider.port.ts`, `radar/adapters/*.adapter.ts` | whole files | KEEP-INFRA | Provider-neutral executor ports/adapters (Parallel, Exa, Apollo, verifier…). |
| `radar/contract-gaps.ts`, `radar/radar-qualification.ts`, `radar/radar-collection-schema.ts` | whole files | OUT-OF-SCOPE/UNCHANGED | Legacy criterion/qualification/collection-schema logic. The new Opportunity Flow composes only the gateway port and its contracts, not these — leave untouched, unwired. |

---

## Dashboard (`apps/dashboard/src`)

| File | Lines | Class | What it is |
| --- | --- | --- | --- |
| `redesign/ResearchArtifactPanel.tsx` | whole file | ADAPT | The `/radar/runs/*` lead-search panel becomes the SINGLE research artifact (card C6 "artifact único"). DELETE its radar-run-specific product surface (quote block, approve button, status chips, lead table); keep the component as the artifact host for the new Opportunity Flow. |
| `redesign/ChatThreadView.tsx` | 598–633, 671–677, 756–764, 1117–1164, 1169–1175, 1199–1274, 1275–1289 | DELETE | Radar rich-message rendering: `kind`/`opciones` chips, `PacksRow` (credits packs), `estado`/`cuenta` collapse, `latestRunId`, Radar live narration, ResearchArtifactPanel mount. |
| `redesign/ChatThreadView.tsx` | rest | ADAPT | Keep the chat shell, `InFlightTurn`, tool-step chips, citations, `ContextPill`/`ContextDrawer` (commercial context P3.3), `FeedbackBar`. |
| `redesign/chatThreads.ts` | 50–62, 71–74, 141–147 | DELETE | `ChatMessageDto.payload` rich-envelope comments + `postChatOption()` chip-click route. |
| `redesign/chatThreads.ts` | rest | ADAPT | Keep thread CRUD, citations, `getCommercialContext`. |
| `api.ts` | 231–286 | DELETE | `RadarStreamEvent` + `subscribeRadarRunStream()`. |
| `api.ts` | 174–223 | KEEP-INFRA | `subscribeChatStream` (generic turn stream). |
| `redesign/CollectionDetail.tsx` | 144–155, 409–416 | ADAPT | Drop the Radar-specific `pillTone` vocabulary for `confianza_*`/`contacto_estado` if it only served radar leads; keep the generic allowlist. |
| `redesign/dashboard.css` | 1497–1519, 1207–1218 | DELETE | `.chat-opts`/`.chat-opt`/`.chat-kind-*` rich-message styles + `.leads-panel` layout rules. |
| `redesign/collections.css` | 85–193 | DELETE | The `.leads-*` block (panel/table/stat/chip/popover). |
| `App.tsx` | 327–328 | ADAPT | Update the "Radar has no screen of its own" comment. |
| `redesign/workspaceNav.ts` | 23–24 | ADAPT | Update the same comment. |
| `commercial-setup/CommercialSetup.tsx` | whole file | KEEP-INFRA | The NEW structured onboarding/calibration flow (not the legacy interview). |
| `ChatThreadView.test.tsx` | 654–768 | DELETE | The "mensajes ricos del Radar" describe block. |
| `ChatThreadView.test.tsx` | 770–894 | KEEP-INFRA | The P3.3 commercial-context drawer block. |
| `CollectionDetail.pillTone.test.ts`, `ChatThreadView.lexicon.test.ts`, `commercial-setup.onboarding.test.tsx` | whole files | KEEP-INFRA | Shared tests (comments may be adjusted). |
| `RecordDrawer.tsx`, `Dashboard.tsx`, `Settings.tsx` | run_id/billing refs | KEEP-INFRA | Generic agent-run / billing infra that merely mentions run_id. |

---

## What must NOT be deleted (KEEP-INFRA hard list)

Per the card, KEEP-INFRA is limited to ledger, credits, quote/approval,
provider attempts, cancel/reconcile, adapters, and ports:

- `radar-run.service.ts` (run ledger, trace, start/reconcile) — KEEP
- `credits.service.ts` + `radar/credits.integration.spec.ts` (ledger) — KEEP
- `radar-pricing.ts` / `radar.dto.ts PriceRunDto` / `radar.controller.ts price`
  (quote/approval engine) — KEEP, re-homed behind the workflow
- provider attempts (`ProviderAttemptService`, `gtm-provider-resolver.ts`,
  adapters under `radar/adapters/*`, ports under `radar/ports/*`) — KEEP
- cancel/reconcile (`POST runs/:runId/reconcile`, idempotent refunds) — KEEP
- `market-intelligence-gateway.port.ts` + `postgres-market-intelligence.adapter.ts` — KEEP
- `planning/mastra-market-intelligence-workflow.ts` — KEEP/ADAPT

**NOT in the hard list:** `radar-monitor.service.ts`, `radar-criterion.service.ts`,
`radar-stream.hub.ts`, `radar-webhook.controller.ts`, `radar/contact-path.ts`,
enrichment endpoints. They are not ledger/credits/quote-approval/attempts/
cancel-reconcile/adapters/ports, so the hard list cannot include them. Monitor
and criterion have no concrete dependency in the new Opportunity Flow (the
workflow re-homes criterion/contract compilation and coverage assessment; the
legacy monitor is the radar product's table watcher) — they stay untouched,
unwired. (`radar-onboarding.service.ts` is ADAPT per the table — its profile
facts feed the new compile-profile step — but it is not KEEP-INFRA either.)

**OUT-OF-SCOPE (do not classify as new-flow infra, do not wire):**
`radar-enrichment.service.ts`, `contact-path.ts`, enrichment endpoints, and
anything contact/enrichment-shaped. The playbook keeps contact and enrichment
strictly after an opportunity is selected, as a separate opt-in capability with
its own cost/conditions. None of it belongs in this replacement.

## Risks

| # | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| 1 | Removing `start_lead_search`/`option` (C1) while the full Mastra flow is not yet wired leaves a market question with no path to a quote | High | The dependency order is C0 → C1 → C2 → C3 → C4. C1 removes the Radar seam and keeps the basic gateway that already exists; anything not yet implemented responds honestly as **unavailable** (no fallback, no reorder). C3/C4 then close the gap — they do not gate C1. |
| 2 | `radar_threads` sidecar still written by old clients; dropping the table while the seam is live breaks `ChatService` DI | High | Remove the seam (C1) and unwire `radar.module.ts` before retiring the table; if a future card retires the table it ships a NEW forward-only migration — `up()` retires it, `down()` restores it — and only if actually necessary (C1 does not invent it). The historical migration is never modified or deleted. |
| 3 | Re-homing the paid-route preflight only on `query_market_signals` could, if mis-wired, leave no structural guard at all | Medium | Keep the structural gate in the executor (signals-first), pointing at the warehouse only; trajectory eval asserts CRM never unlocks spend. |
| 4 | Dashboard rich-message deletion may leave stale `.chat-kind-*` rendering paths referenced from persisted messages | Low | Keep a tolerant renderer for old `payload.kind` values during transition; delete CSS/UX only. |
| 5 | Credits checkout UI (`PacksRow`) is also used by the new flow for top-ups | Medium | Split "buy credits" (KEEP) from the interview-bound "approve quote" (DELETE); verify both surfaces. |
| 6 | The `agent:radar` write attribution in `collections/records.service.ts` may be load-bearing for existing collection history | Low | Rename/reuse the actor string carefully; treat as infra, not product. |

## Rollback plan

Rollback for any retirement card is a **git revert of that card's diff** (the
deletes are reversible; no data migration is destructive in C0). The legacy
Radar product is NOT kept behind a feature flag — that contradicts the playbook
("No basta ocultarlo o dejarlo como fallback") and the existing
`isCommercialFeatureEnabled` flag does not gate Radar at all. If a later card
retires the `radar_threads` table, the retirement ships as a NEW **forward-only
migration**: its `up()` retires the table and its `down()` restores it. The
historical migration file stays untouched — never modified, never deleted. C1
does not create that migration unless retiring the table is actually necessary.
No staging data loss: `radar_threads` is a sidecar conversation table;
`chat_messages` and run/credit ledgers are never deleted.

## Reintegration requirement (C7)

The red baseline is intentionally excluded from the default `vitest run` while
it is red. **The moment it turns green (the retirement cards land), it MUST be
reintegrated into the default suite**: remove the `**/*.trajectory.spec.ts`
exclude from `apps/api/vitest.config.ts` and delete
`apps/api/vitest.trajectory.config.ts`, so the harness runs the trajectory
acceptance on every check. A green eval that stays excluded is a failed C7 and
a failed project (the playbook's "Hola → oportunidades" acceptance must run in
CI, not by hand).

## Evidence of the red baseline

`research/commercial-intelligence-chat/c0-trajectory-red-baseline.txt` is the
output of `pnpm --filter @driftless/api test:trajectory` against the current
behavior: **5 tests failed / 2 passed**, failing specifically for (1) the real
turn's belt still carrying `start_lead_search`, (2) the real «Hola» prompt still
enumerating Topics/Leads/Collections, (3) `query_records` still satisfying the
market preflight, (4) the `option` DTO seam, and (5) `RADAR_TOOLS` still
declaring `start_lead_search`. The two passing guards pin the target: the market
turn IS offered the warehouse path, and `query_records`/`list_collections`
remain available for legitimate pipeline questions. Production behavior is
unchanged by this card.
