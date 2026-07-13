# Plan de implementación — agentes SOTA (2026)

Nota interna de arquitectura (sesión 2026-07-09, parte 2). Convierte el diagnóstico de
`agents-100x.md` en un plan de ejecución, calibrado contra el estado del arte verificado por
research web (fuentes al final de cada punto). El objetivo: que los agentes de Driftless operen
al nivel de los mejores harnesses de 2026 sin romper las invariantes del producto (gobernanza,
determinismo explicable, proposer ≠ approver, no-scripting del broker).

---

## 0. Los diez principios SOTA que gobiernan este plan

1. **El loop canónico es gather → act → VERIFY → repeat.** La pierna de verificación es la que
   nuestro loop no tiene. Pipelines de refutación adversarial matan ~79–91% de hallazgos falsos
   antes de llegar al humano (Refute-or-Promote, arXiv:2604.19049; SAST-Genius −91% FPs).
2. **El presupuesto es de tokens-en-contexto, no de pasos.** "Context rot" es la restricción real;
   limpiar tool-results viejos dio +29% solo, +39% con memoria de archivo, −84% de tokens en tareas
   de 100 turnos (Anthropic context-management).
3. **Fan-out solo para lectura paralelizable; síntesis y decisión single-context.** Multi-agente de
   research superó al single-agent 90.2% — a ~15× el costo; Cognition: nunca paralelizar decisiones
   (anthropic.com/engineering/multi-agent-research-system; cognition.com/blog/dont-build-multi-agents).
   Workers devuelven resúmenes estructurados de 1–2k tokens.
4. **Delta updates, nunca rewrites totales.** El "context collapse" de ACE: un rewrite iterativo
   erosionó 18,282 tokens → 122 en un paso y dejó accuracy DEBAJO del baseline sin adaptación
   (arXiv:2510.04618, ICLR 2026). Vale para el vault y para cualquier skill que se auto-edite.
5. **La memoria gana confianza con contadores de uso.** ACE: unidades atómicas con contadores
   helpful/harmful alimentados por feedback de ejecución. Mem0: la escritura es un clasificador
   ADD/UPDATE/DELETE/NOOP contra la memoria existente. Zep: invalidación temporal, no borrado.
6. **Cache-first prompt architecture.** Reads de cache a 0.1× (Anthropic) / ~2% (DeepSeek). El
   Knowledge inyectado debe ser un bloque estable versionado que solo se re-renderiza cuando el
   topic cambia de versión — re-escribir memoria por run es un impuesto de cache además de un
   riesgo de gobernanza.
7. **Drift de claims en dos etapas.** Detector barato → verificador caro → gate humano (DocPrism
   LCEF, arXiv:2511.00215: filtrar categorías de inconsistencia relevantes antes de reportar; el
   juicio one-shot de un LLM sobre drift no lo shippea nadie).
8. **Autonomía graduada con promoción ganada y demotion automática.** Tres niveles (auto-apply
   reversible / notify-and-proceed / HITL); reversibilidad es el factor #1 de routing; promoción =
   evidencia empírica en esa clase de acción + autorización humana registrada; demotion automática
   al degradarse (arXiv:2606.22484; patrón Mintlify PR-gated→opt-in-push; Rovo admin-gated).
9. **pass^k, no pass@1, para decidir autonomía.** Un agente 90% pass@1 es ~57% consistente a k=8
   (τ-bench). Un skill no gradúa ni shippea sin pass^k sobre corpus sembrado.
10. **Supresión > generación.** Presupuesto de FP <10% (el "cry-wolf effect" es la razón #1 de
    abandono de bots de review); suprimir 35% de sugerencias subió la aceptación +15.8pp
    (arXiv:2511.18849). Invertir en *cuándo callar* tanto como en la calidad del draft.

Validación externa de las apuestas existentes: notas atómicas ≈ bullets de ACE; el gate
Note→Knowledge es exactamente la defensa que la literatura de seguridad converge a recomendar
contra memory poisoning (OWASP ASI06; MINJA >95% de éxito de inyección sin gate); el drift
temporal ≈ invalidación de Zep; retrieve por tiers ≈ just-in-time retrieval de Anthropic. **La
arquitectura de Driftless está bien apostada — lo que falta es ejecución del loop completo.**

---

## Workstreams

### WS1 — Fiabilidad (pre-requisito; sin esto nada de lo demás es creíble)

| # | Cambio | Dónde |
|---|---|---|
| 1.1 | **Fix gate legacy→gateway** (bug): dispatch exige `opencode_key_enc`; el runner acepta cualquier credencial. Cambiar a `hasAnyCredential` | `agent-schedule.service.ts:62`, `pr-processor.service.ts:155` |
| 1.2 | Singleton jobs (pg-boss `singletonKey`) + leader election para crons (hoy corren en cada réplica) | `agent-queue.service.ts`, `agent-schedule.service.ts` |
| 1.3 | Librarian a la cola y fuera del web tier (viola su propia invariante) | `agent-schedule.service.ts:177`, controller `:32` |
| 1.4 | Alerta/telemetría cuando pg-boss no arranca (hoy: drop silencioso a debug) | `agent-queue.service.ts:88-94` |
| 1.5 | Reaper que cancela el sandbox del run zombie (hoy marca failed y el gasto sigue); alinear expiry 600s vs reaper 30min | `agent-schedule.service.ts:80-91` |
| 1.6 | Budget con superficie de escritura: `PATCH /config` acepta `budget` + UI en Settings | `agent-config.service.ts:85-87`, `Settings.tsx` |
| 1.7 | Reemplazar `parseChangedFiles` (regex sobre string humano) por payload tipado de drift | `agent-schedule.service.ts:27-35` |

**Aceptación:** cero dobles-runs en multi-réplica; un workspace gateway-only despacha por push/PR;
un run zombie no sigue gastando.

### WS2 — Loop económico: tokens, cache, profundidad

| # | Cambio | Dónde |
|---|---|---|
| 2.1 | **Tool-result clearing**: al acumular N tokens, sustituir resultados viejos ya supersedidos por stubs (`(cleared — re-read if needed)`); presupuesto por tokens complementa `maxSteps` | `agentic-loop.ts` (messages), `checkRunCaps` ya da el cap duro |
| 2.2 | `maxSteps`/deadline dinámicos por tamaño del trabajo (nº topics × tamaño diff), cap duro = budgetPolicy | `agent-runner.service.ts:290` |
| 2.3 | **Tool `git_history`** (log/blame acotado, formato conciso) + `fetch --depth 50` on-demand — hoy el clone `--depth 1` tira el porqué histórico | `sandbox-executor.ts` (INVESTIGATION_TOOLS + Sh) |
| 2.4 | **Tool `find_references`** sobre el LSP ya montado en el sandbox (blast radius real, no grep) | `sandbox-executor.ts:251-280` |
| 2.5 | Respuestas de tool en formato conciso con paginación y errores accionables ("narrow your query") — el formato conciso de Anthropic midió −65% tokens sin pérdida | `sandbox-executor.ts`, `graph-tool-executor.ts` |
| 2.6 | Bloque de Knowledge **estable y versionado** en prompts (re-render solo cuando `topic.version` cambia) para maximizar prefix-cache en runs programados; ya se hace a medias (volatile al final) — formalizarlo | `agent-runner.service.ts` buildPrompts |

**Aceptación:** cache hit-rate ≥80% en runs warm (ya medido ~81% en el mejor caso — sostenerlo);
tokens/run del Auditor −30% con igual o mejor recall en el eval de loop.

### WS3 — Verificación adversarial (la pierna que falta)

| # | Cambio | Dónde |
|---|---|---|
| 3.1 | **Refuter pass**: post-parse y pre-landing, cada proposal pasa por un turno corto de refutación con "kill mandate", contexto asimétrico y modelo DISTINTO de la lista (los verificadores de la misma familia comparten sesgos). El refuter ve el claim + el código, no el razonamiento del generador. Sobrevive → aterriza con `verified:true`; muere → se registra en el trace (no llega al humano) | nuevo paso en `agent-runner.service.ts:339-347` (land loop); reusar `ThinLoopRuntime` con maxSteps 4-6 |
| 3.2 | **Filtrado de claims estilo DocPrism** para drift: clasificar cada claim del topic localmente (fact/invariant/decision/ephemeral) y filtrar qué categorías de inconsistencia son reportables antes de auditar — mata el FP de "abstracción ≠ inconsistencia" | skill del Auditor + `agent-output.ts` |
| 3.3 | `agent_stats` **desagregado por clase de acción** (update/flag/new_topic/relate/…) — el insumo de WS5 | `proposals.service` stats |
| 3.4 | Política de supresión: presupuesto FP <10%; el comment de PR solo cuando el hallazgo sobrevivió al refuter Y la clase de acción tiene approval histórico >X | `auditor-comment.ts` |

**Aceptación:** en el corpus sembrado, el refuter mata ≥70% de proposals falsas plantadas sin
matar >5% de verdaderas; approval rate humano sube de 86% → ≥92%.

### WS4 — Cross-surface + Steward (drift multi-superficie)

| # | Cambio | Dónde |
|---|---|---|
| 4.1 | Componer los E2 read tools (search_topics, docs, collections) en los executors del Auditor/Architect — ya son canónicos y la policy engine ya los gobierna; Chat probó el patrón | `agent-tools.ts` (nuevo set compuesto), runners |
| 4.2 | **Drift-event tipado + cola**: drift local (`--mark`), drift manual del Inbox y doc-drift despachan al Auditor — hoy solo el push webhook lo hace | `topic-drift.service.ts` → `agent-queue` |
| 4.3 | **Steward** (agente nuevo, graph+broker-read, sin Daytona): sensa diffs de `content_digest` en ConnectorDocuments + webhooks de sync de Nango; activa las anclas `doc`/`connection` (hoy inertes) como fuente de drift; corre audit doc↔topic (mismo branch fact-vs-invariant); setea `records.drifted`. Patrón RAG estándar: `last_modified` cuando es confiable, digest-compare como fallback, "staleness gap" como SLA. **Nadie shippea drift semántico contra fuentes SaaS — es terreno abierto y es exactamente la tesis del producto** | nuevo runner (patrón LibrarianRunner); `connector-index.service.ts`, `broker.service.ts:1183-1273` (webhooks), `anchor.dto.ts` |
| 4.4 | Coverage multi-superficie del Architect: collections activas sin criterion, docs indexados con uso alto en Chat sin topic gobernante | `coverage.service.ts` |

**Aceptación:** un cambio en una página Notion indexada que contradice Knowledge produce una
propuesta de update en <1h (staleness gap SLA); drift local llega al Auditor sin clicks.

### WS5 — Autonomía graduada (earn-autonomy)

| # | Cambio | Dónde |
|---|---|---|
| 5.1 | Ladder de 3 niveles POR CLASE DE ACCIÓN: L2 auto-apply (solo reversible con undo) / L1 notify-and-proceed / L0 HITL. Reversibilidad = factor #1 de routing | generaliza `librarian_autovouch` en `agent-config` |
| 5.2 | Promoción = pass^k ≥ umbral en evals de esa clase + approval rate humano sostenido + **autorización humana registrada** (el owner activa el nivel, como Rovo). **Demotion automática** cuando la métrica cae — sin humano | `agent-config.service.ts` + stats de 3.3 |
| 5.3 | Primer graduado: safe-lane del Librarian (relate, normalizar tags, archive de zombies) — todo con undo (el patrón Undo ya existe para autovouch) | `librarian-runner.service.ts:257-273` |
| 5.4 | Todo auto-apply escribe al audit trail existente + evento con actor `agent:<rol>` | `audit.service`, `TopicEvent` |

**Aceptación:** ninguna acción auto-aplicada irreversible; demotion dispara sola en el eval de
regresión; el humano ve el nivel vigente y el porqué (métrica) en Settings.

### WS6 — El vault que aprende (ACE aplicado a Driftless)

| # | Cambio | Dónde |
|---|---|---|
| 6.1 | **Contadores helpful/harmful por topic** desde feedback de ejecución: retrieval seguido de propuesta aceptada que lo cita, "Still good" clicks, drift confirmado vs falso. Complementa `matched_runs`/`topic_signals` (estructura) con outcome (uso) | `proposals.service.topicSignals` + eventos |
| 6.2 | **Write classifier** ADD/UPDATE/DELETE/NOOP en `context add/update` (patrón Mem0): detectar conflicto/solapamiento con lo existente y sugerir el update coherente en vez de aceptar el wall — es la regla E del skill, hecha estructural | `topics.service` write path / `vault-validator.ts` |
| 6.3 | **Sleep-time compute**: job nocturno de consolidación (doctor→curator) que PROPONE merges/dedupe/re-anclajes — siempre deltas, nunca rewrite total (context collapse), siempre a la Review Queue | extiende `context doctor` + Librarian nightly |
| 6.4 | Lessons (ya existen) cierran con contadores: una lesson que los runs siguen y correlaciona con approvals sube; una ignorada/害ful se propone archivar | `findLessons` + 6.1 |

### WS7 — Runtime y orquestación

| # | Cambio | Dónde |
|---|---|---|
| 7.1 | **Daytona snapshots por repo** (base nightly con el repo clonado + LSP warm) + warm pool: sub-90ms p99 vs clone por run; estandarizar el spec del sandbox (el warm-pool hit exige match exacto). Costo marginal ~$0.17/hr por worker 2vCPU — el fan-out es barato en compute, caro en tokens | `sandbox-executor.ts`, `sandbox-factory.ts` (y los otros 2 sitios de `daytona.create` — gotcha conocida) |
| 7.2 | **Fan-out selectivo**: para sweeps del Architect y auditorías multi-topic (>5), orquestador que lanza workers read-only por módulo/hipótesis con contrato explícito (objetivo, formato, límites) y retorno estructurado de 1–2k tokens; síntesis single-context. Reemplaza el hack de batches encadenados con `setImmediate` | `agent-runner.service.ts:392-400` → nuevo orquestador sobre la cola |
| 7.3 | **Materializar `AgentManifest`/`Registry`** (hoy tipos muertos) con `drift_event` e `integration_event` como triggers de primera clase — añadir el Steward debe ser un manifiesto, no un servicio bespoke | `cognitive/contracts.ts:195-235` |

### WS9 — Observabilidad viva + Agent Activity como sala de control

El observador interno ya existe — `observeToolExecutor` (Agent Tool Platform T3,
`cognitive/tool-observability.ts`): un `ToolExecutionEvent` sanitizado por llamada (duración,
error class, preview redactado). Estado real: Chat lo envuelve pero descarta los eventos
(`chat.service.ts:592`), y los agentes autónomos lo omiten. Es la señal que WS2 (presupuestos
por tool), WS5 (autonomía medida) y WS8 (trajectory evals) necesitan — cablearlo va primero.

| # | Cambio | Dónde |
|---|---|---|
| 9.1 | Cablear el observador T3 en los tres runners vía `buildAgentToolExecutor({emit})`; cada métrica se fusiona en el evento `tool_result` del trace (`ms`, `error_class`) — un solo stream enriquecido, sin migración | `agent-runner.service.ts`, `librarian-runner.service.ts` |
| 9.2 | Exponer `matched_topics` en el detalle del run (los chips de "qué auditó") | `agent-runs.service.ts:get` |
| 9.3 | **Agent Activity página pulida**: stat strip 30d (runs, % merged, % cached, avg run, spend), filtros por agente, feed agrupado por día, drawer con stat grid + chips de topics auditados + rollup por tool (llamadas/avg ms/errores) + timeline con args expandibles, reasoning clampeado y autoscroll en live | `Dashboard.tsx` (Agents/RunTrace), `dashboard.css` |
| 9.4 | Siguiente iteración: rutear también los eventos de Chat al mismo plano; panel "por tool" agregado en Usage (Settings); export de trazas fallidas → casos de eval (alimenta WS8) | `chat.service.ts`, `Settings.tsx`, `evals/` |

*9.1–9.3 quedaron implementados como spike verificado (tests + typecheck) en esta branch —
revisable/revertible como commit independiente.*

### WS8 — Evals como gate de release

| # | Cambio | Dónde |
|---|---|---|
| 8.1 | Corpus sembrado por skill sobre el golden repo (bugs/drifts plantados con verdad conocida) + **pass^k a nivel de hallazgo** (k≥4) como métrica de graduación | `evals/loop/` (ya existe la base) |
| 8.2 | Trajectory evals sobre `agent_run.trace` (ya se guarda): el grading solo-de-output esconde 20–40% de fallos; trazas fallidas → casos offline automáticamente | `evals/` + export de traces |
| 8.3 | Juez LLM de **familia distinta** al modelo del run, rúbrica por criterio separado; híbrido con checks deterministas (el output contract ya es parseable) | `evals/lib.mjs` |
| 8.4 | **Gate de CI**: un cambio a un skill no mergea sin pasar sus evals (los skills son artefactos de primera clase — tratarlos como código con tests) | CI + `cognitive/skills/**` |

---

## Secuencia (6 sprints)

| Sprint | Entregas |
|---|---|
| 1 | WS1 completo (fiabilidad) + 3.3 (stats por clase) + 8.1 base (corpus sembrado) |
| 2 | WS2 (clearing, git_history, find_references, cache-first, budgets dinámicos) |
| 3 | WS3 (refuter + DocPrism filtering + supresión) — medir contra el corpus |
| 4 | 4.1–4.2 (cross-surface + drift queue) + 7.1 (snapshots/warm pool) + 8.4 (gate CI) |
| 5 | 4.3–4.4 (**Steward**) + 5.1–5.3 (autonomía graduada v1) |
| 6 | WS6 (contadores, write classifier, sleep-time) + 7.2–7.3 (fan-out + registry) + 8.2–8.3 |

## KPIs del programa

- **MTTR de drift** (detección → Knowledge reparado), por superficie (git / docs / records).
- **pass^k (k=4)** por skill en el corpus sembrado — gate de release y de autonomía.
- **Approval rate por clase de acción** (hoy 86% global) — objetivo ≥92% con refuter.
- **FP rate de hallazgos** <10% (presupuesto cry-wolf).
- **Tokens/run y cache hit-rate** (objetivo: −30% tokens, ≥80% cache warm).
- **Staleness gap** de fuentes conectadas (SLA <1h con webhook, <24h batch).

## Trampas a evitar (todas documentadas en la literatura)

- **Context collapse**: jamás un rewrite total del vault o de un skill por un LLM — solo deltas.
- **Memory poisoning**: el gate humano Note→Knowledge es la defensa SOTA (OWASP ASI06) — la
  autonomía graduada nunca se aplica a la *verdad* (contenido), solo a higiene reversible.
- **Verificador correlacionado**: el refuter usa otro modelo/contexto — mismo modelo = mismos sesgos.
- **Multi-agente para decisiones**: fan-out solo lectura; síntesis y writes single-context.
- **Leaderboard-itis**: los números de memoria (LoCoMo etc.) están inflados por retrieval-k; medir
  con nuestros evals, no con benchmarks ajenos.
