# The commercial chat cutover

What `/w/:slug/chat` became, why each piece moved, and what is still owed.

> **The routing half of this document is superseded** by
> [the chat manager](./chat-manager-semantic-routing.md). `classifyChatRoute`
> is deleted: a regex ladder held the authority over meaning and failed by a
> conjugation, so one typed manager decision replaced both it and the research
> layer's second semantic router on the Chat path. Everything below about
> EXECUTION — the Work Session, the activity trail, the report artifact, the
> customer-safe projection — is unchanged and still current.

## The request path, end to end

```
/w/:slug/chat  or  /w/:slug/chat/:threadId
  └─ ResearchPage → ResearchChat
       ├─ hydrate, before the composer opens
       │    GET  …/chat/threads/:id/messages        the persisted transcript
       │    GET  …/chat/threads/:id/work-session    the Work Session snapshot
       │    └─ subscribe SSE from snapshot.lastSeq  the tail, never a replay
       └─ POST …/chat/threads/:id/messages
            └─ ChatService.postMessage
                 ├─ withTurnLock                          one turn per thread → 409
                 ├─ decideChatTurn(...)                   ONE semantic decision
                 ├─ destination === 'market_research' ────┐
                 │                                        │
                 │  (director surface, when enabled, reads first and may decline)
                 │                                        ▼
                 │                             runMarketResearchTurn
                 │                               ├─ WorkSession RUN_STARTED
                 │                               ├─ MarketResearchRunner
                 │                               │    └─ semantic market-data tools
                 │                               │       search_suppliers /
                 │                               │       search_opportunities /
                 │                               │       search_awards / …
                 │                               ├─ onEvent → research-progress.ts
                 │                               │    TOOL_CALL_START/END/RESULT
                 │                               │    with customer-safe copy
                 │                               ├─ ARTIFACT_CREATED (ResearchReport)
                 │                               └─ RUN_FINISHED
                 └─ otherwise: the general belt, unchanged
```

The browser renders the Work Session projection and nothing else. It never sees
an operation name, a semantic code, a row count phrased as a fraction, or a
statement.

## Root cause of each observed incident

| # | Observed | Root cause | Fixed by |
|---|---|---|---|
| 1 | `/research` crashed on `reading 'filters'` | `filtersFor` read `capabilities.filters` without checking the shape | already fixed in staging (`useMarketData.ts:208`); the surface that called it is gone |
| 2 | `409 CONFLICT: A turn is already running` | the client posted a second turn and rendered the refusal as a generic failure with a retry | the composer refuses the duplicate before it is sent; a server 409 becomes an active-run state that joins the live run |
| 3 | 50–120 s with no useful activity | `sendTurn`'s contract was mis-stated — it resolves when the TURN COMPLETES, not when it is accepted — and nothing filled the wait | the stream is subscribed from hydration; each lookup renders as a step as it starts |
| 4 | technical wall: `7 filtros disponibles en este modo`, `source_slugs`, `observed_kind` | `ResearchPage` rendered `/capabilities` as a disclosure for the customer | removed; `/capabilities` is read by the agent through its typed tools |
| 5 | `13/13`, `listo`, internal names, UUIDs | `TOOL_CALL_START.summary` was the raw operation name; the trace header printed a bare fraction | `research-progress.ts` composes every visible string server-side; the header says "13 de 13 pasos" |
| 6 | tried `discover_market_capabilities`, fell back to Topics/Collections | the turn classified as `general`, which carries the full ~20-tool belt including the legacy market catalogue | the ladder now classifies the errand as `market_opportunity`, which dispatches to the runner and builds no belt |
| 7 | never called the new semantic operations | `mode: "research"` was the only door to `MarketResearchRunner`, and no client ever sent it | route-based dispatch in `chat.service.ts` |

Incidents 6 and 7 are one cause. The router existed and was already
deterministic; it was missing the shapes people use — an offer framing
("vendo", "fabricamos"), the demand side ("quién compra", "quiénes han
ganado"), and a supply-side noun list that omitted `fabricantes` and
`proveedores`. `contact_request` also sat above the market ladder, so the bare
word `contacto` in a supplier search sent the errand to the CRM.

## Routing, before and after

| Question | Before | After |
|---|---|---|
| "Vendo estructuras metálicas y quiero saber quién compra en Nuevo León" | `general` → full tool belt | `market_opportunity` → `MarketResearchRunner` |
| "Busca fabricantes de bombas en Jalisco con contacto publicado." | `contact_request` → CRM | `market_opportunity` → `MarketResearchRunner` |
| "¿Qué licitaciones accionables hay para tratamiento de agua?" | `market_opportunity` → legacy Opportunity Flow | `market_opportunity` → `MarketResearchRunner` |
| "¿Quiénes han ganado contratos de alumbrado público y por cuánto?" | `general` → full tool belt | `market_opportunity` → `MarketResearchRunner` |
| "qué hay en mi pipeline" | `pipeline` | `pipeline` (unchanged) |
| "qué sabemos de la arquitectura" | `topic_context` | `topic_context` (unchanged) |
| "¿a quién le hablo?" | `contact_request` | `contact_request` (unchanged) |
| "Avísame cada lunes si aparecen licitaciones" | `create_monitor` | `create_monitor` (unchanged) |

## Deletion ledger

Every deletion below was proven unreachable by reference before it was made.

### Deleted

| Path | Lines | Why it was safe |
|---|---|---|
| `redesign/ChatThreadView.tsx` (+2 specs) | ~1,356 | no route in `App.tsx`; every remaining mention in the tree is a comment |
| `redesign/chat/` (13 files) | ~1,536 | `OperateChatSurface` imported only by `ChatThreadView` |
| `redesign/experience/` (7 files) | ~1,200 | the projection layer for the Operate surface; after its deletion the only importers were its own specs |
| `redesign/ResearchArtifactPanel.tsx` (+spec) | ~182 | single consumer was `ChatThreadView` |
| `redesign/AgenticWorkbench.tsx` | ~90 | zero references anywhere in the tree |
| `redesign/spike/` (2 files) | ~301 | self-referencing spike |
| `research/ResearchPage` mode nav, search form, capability disclosure | ~180 | replaced by the conversation; see incidents 4 and 6 |
| `research.css` rules for the above | ~86 | swept after the markup that used them |

Total: 7,864 lines removed, 30 added, in the consolidation commit alone.

### Kept, because the experience rests on them

`redesign/chatThreads.ts` (thread creation, message POST, regenerate, checkpoint
resolution), `redesign/agentic-events.ts` (A1 parser and reducer), the SSE
subscription in `api.ts`, the Work Session snapshot route, `ResearchReport` and
its artifacts, stop and retry.

### Kept, with the deletion condition named

| Piece | Still reachable? | Deletion condition |
|---|---|---|
| the legacy Opportunity Flow in `chat.service.ts` | yes — only in a deployment where the market-research dependencies are absent. Its three tools are no longer on any belt (see Capability isolation) and its instruction is out of the general manual | when the market-research dependencies stop being `@Optional()`, i.e. when no supported deployment can lack them |
| `useSupplierSearch`, `useAwardSearch`, `useOpportunitySearch`, `useCapabilities`, `filtersFor`, `RecordsTable`, `supplierColumns`, `awardColumns`, `groupAwards` | no — nothing in the shipped tree reaches them | when `ResearchReport` publishes `suppliers[]` and `historicalRecords[]` (the `suppliers-in-report` and `history-rows-in-report` gaps in `phases.ts`), these render them; if those gaps are closed differently, delete these instead |

The second row is the honest reading of "quiero que todo el UI se utilice":
the nine-route client and its three domain hooks are built and correct, and
exactly one of the three domains — opportunities — currently has rows in the
report to render. The other two are one backend field away, and are named here
rather than deleted quietly or left to look used.

## Capability isolation

The classifier can be wrong. Safety does not rest on it being right.

A commercial capability used to be reachable from the general runtime through
two doors, both open by default:

- **the belt.** `chat-tools.ts` registered `discover_market_capabilities`,
  `query_market_signals` and `get_signal_evidence` behind `includeMarketTools`,
  computed as "not a market route" — so the tools built for commercial work were
  withheld from commercial turns and handed to every other one.
- **the manual.** `chat.skill.ts` opened its market section by instructing the
  model to call the first two in sequence.

Both are closed. `marketIntelligence`, `runMarketIntelligence` and
`includeMarketTools` are gone from `ChatToolDeps`; there is no dependency to
inject and no flag to get wrong. The manual carries a boundary instead, naming
Collections, Topics and Projects explicitly as things that must not be
substituted for market data.

`apps/api/src/chat/commercial-isolation.spec.ts` pins all eight invariants:

| # | Invariant |
|---|---|
| 1–4 | supplier / opportunity / history / mixed intents all route to `market_opportunity` |
| 5 | an ambiguous commercial question degrades to `general` — and `general` has no market tools, so the degradation is safe |
| 6 | a non-commercial question keeps Topics, Collections, Projects, Docs and connections |
| 7 | the general belt cannot invoke `discover_market_capabilities`; calling it is an unknown tool |
| 8 | the runner reaches no Radar, Collections, Topics or CRM — grepped, because a mock proves one scripted run and this must hold for all of them |

Plus two the eight imply: the SEMANTIC operations are not on the general belt
either (replacing one leak with a newer one is the same defect), and a
market-research turn builds no chat tool belt at all.

## The activity trail

The runner has always reported every stage through `step_started` /
`step_finished`. The turn pipeline dropped all of them and forwarded only tool
calls — which is why the wait began after the search was already prepared.

The channel is the A1 contract's own `ACTIVITY_DELTA` / `ActivityEntry`, already
frozen, already reduced into `snapshot.activity`, already served by the Work
Session endpoint. No second stream was built, and the trail survives a reload
because it is the same durable projection everything else here reads.

| Moment | Source | What a person reads |
|---|---|---|
| turn accepted | emitted before any work | "Recibí tu solicitud" |
| route selected | `step_started: route_research` | "Entendiendo tu solicitud" |
| plan ready | `step_started: load_capabilities` | "Preparando la búsqueda comercial" |
| tool started | `tool_call` | "Buscando compradores en adjudicaciones" |
| tool completed | `tool_result` | same row, updated: "8 adjudicaciones encontradas" |
| synthesis started | `step_started: finalize` | "Preparando la respuesta" |
| answer ready | terminal | "Respuesta lista" |
| turn failed | terminal | "No pude terminar la investigación" |
| turn cancelled | terminal | "Investigación detenida" |

`investigate` is deliberately not narrated: it is the tool loop and its children
already name themselves.

**Allowed in an entry:** a human sentence (`summary`), a domain (`name`), a
status, `ok`, and a safe count or sanitized reason (`preview`). **Never:** an
operation name, a semantic code, a UUID as a label, SQL, a prompt, reasoning, a
capability catalogue, warehouse rows, or a provider — `providerId` is always
null.

Ids are stable KEYS (`phase:route_research`, `tool:q_0`), never labels. The
prefix also keeps them non-numeric, so object key order stays insertion order
and the trail rehydrates in the order it happened.

## Known residual exposure

A commercial question that slips the ladder still classifies as `general`. That
degradation is now bounded rather than dangerous: the general belt holds no
market capability, so the worst case is an honest "I can't answer that from
here" instead of a tour of Topics and Collections.

The legacy Opportunity Flow still runs where the market-research dependencies
are absent. Its deletion condition is unchanged: those dependencies ceasing to
be `@Optional()`.

## What is NOT proven

No live end-to-end run against staging, and no screenshots. The container has no
API on `localhost:3000`, no Docker, no database URL, no model credential and no
Clerk session; Playwright is not resolvable from `apps/dashboard`, and `/chat`
sits behind an authenticated workspace route, so a browser would reach a sign-in
screen rather than any of the states above. Every claim here rests on hermetic
tests and on reading the code.

### The live E2E checklist, for whoever has staging

```bash
# 1. Point the harness at staging and confirm it answers.
export STAGING_BASE_URL=https://api-staging.driftless.icu
export STAGING_API_KEY=…            # do not paste this into a PR
bash scripts/harness/smoke.sh staging

# 2. Confirm the semantic layer is deployed — the gate the cutover depends on.
#    Absent, commercial turns fall to the legacy Opportunity Flow by design.
bash scripts/harness/research-staging.sh
```

Then, in `/w/<slug>/chat`, with the network tab open on the SSE stream:

| # | Do this | Expect |
|---|---|---|
| 1 | Ask `Vendo estructuras metálicas y quiero saber quién compra en Nuevo León` in a NEW thread | "Recibí tu solicitud" within a second, then the phases in order |
| 2 | Watch the stream frames | `ACTIVITY_DELTA` entries only; no `discover_market_capabilities`, no `query_market_signals` |
| 3 | Reload mid-run | the trail and the running state come back; the stream resubscribes from `lastSeq` |
| 4 | Send a second question while the first runs | no POST is made; "Hay una investigación en curso" plus a Stop |
| 5 | Press Stop | "Investigación detenida"; no error banner |
| 6 | Let one finish | the answer lands in the SAME thread, with the report, its table and a row that opens its record |
| 7 | Ask `qué hay en mi pipeline` | answers from Collections; unchanged |
| 8 | Ask `Necesito vender más` | an honest short answer — NOT a tour of Topics/Collections |

Repeat 1 for each domain: `Busca fabricantes de bombas en Jalisco con contacto
publicado.` · `¿Qué licitaciones accionables hay para tratamiento de agua?` ·
`¿Quiénes han ganado contratos de alumbrado público y por cuánto, separados por
moneda y ámbito?`
