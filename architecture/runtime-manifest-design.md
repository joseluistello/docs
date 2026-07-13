# El underlayer: AgentManifest v2 + mapa de migración

Documento de diseño (pre-código). Convierte el north star `worker-manifest-northstar`
("declarar un Worker = componer un manifiesto de datos, jamás escribir un servicio")
en un contrato concreto y un plan de migración, diseñado contra el código real y
validado contra los cuatro agentes existentes como casos de prueba.

**Regla de diseño:** si Auditor, Librarian, Steward o Chat no caben en el schema
sin pérdida, el schema está mal — no el agente.

**El candado que este diseño sirve** (invariante en `worker-manifest-northstar`):
*ningún agente nuevo se implementa como servicio bespoke: o es expresable como
manifiesto/datos sobre el runtime común, o espera.*

---

## 1. Lo que ya existe y se conserva (no partimos de cero)

| Pieza | Estado | Rol en el diseño |
|---|---|---|
| `AgentRuntime` (clase abstracta, `cognitive/contracts.ts:130`) | **Existe** — `ThinLoopRuntime` es impl #1; el comentario ya nombra `MastraRuntime` como impl #2 | El seam de ejecución. No se toca; se cumple |
| `AgentManifest`/`Registry`/`IntegrationManifest`/`TriggerKind` (`contracts.ts:150-235`) | Tipos muertos (nada los implementa) | La v1 del contrato — se **evoluciona**, no se descarta (ver §3) |
| Contrato de adopción de Mastra (topic `mastra-adoption-contract`, reviewed) | Decidido | Mastra = mecánica del loop (suspend/resume, approvals); Driftless = auth, gateway, tools, gobernanza, ledger. Sin semántica de producto en estado de Mastra. Gates y rollback definidos ahí |
| Model Gateway v2 + `mastra-model.adapter.ts` | Existe | Todo modelo pasa por el gateway (BYOM); el manifiesto solo *selecciona* |
| Cola pg-boss + disciplina (topic `agent-queue-discipline`, reviewed) | Existe | Invariantes: un solo budget de tiempo con tres enforcers; singletonKey como leader election; nada de compute de agente en el web tier; drops ruidosos |
| Policy engine sobre tools canónicas + observador T3 | Existe | El único camino de resolución de tools (§5.3) |
| Trace único (`RunTraceEvent`, topic `run-trace-enrichment`, reviewed) | Existe | Un solo stream enriquecido; el merge depende de que el runtime pase EL MISMO objeto a onStep y al trace |
| El ledger de la ronda 1 (branch `claude/driftless-research-features-5srdnn`) | Sin mergear — capa de datos | `record_events`, `context_deliveries`, invokes con run/record, dossier. El runtime escribe en estas tablas (§5.6) |

Los silos a disolver: `AgentRunnerService` (hardcodea auditor/architect),
`LibrarianRunnerService`, `StewardService` (el cuarto bespoke), y el turno del
Chat — cuatro cableados, tres composiciones de tools, dos-tres loops.

---

## 2. Huecos de la v1 (por qué se evoluciona)

La v1 (`contracts.ts:195`) acertó en lo estructural: el agente ES un objeto, los
`Action` son una superficie cerrada ("un action que no toca el grafo no
pertenece"), `Skill` es artefacto de primera clase fuera del loop, `Gate` decide
si corre, y `IntegrationManifest` monta en el mismo bus. Se conserva todo eso.

Lo que la v1 no contempla y el north star exige:

1. **Es código, no datos** — `contextProviders`/`tools`/`actions` son objetos con
   funciones. Un Worker declarado desde el chat necesita que el manifiesto sea
   **serializable** y que las funciones se resuelvan por NOMBRE contra registros.
2. **Sin identidad de ledger** (`actor`, acts-as) — el Steward hoy resuelve
   identidad a mano (owner del workspace); debe ser campo.
3. **Sin cognición declarada** — el Steward es determinista (cero LLM). Un
   manifiesto no debe presuponer modelo.
4. **Sin budget, autonomía, envelope ni escalamiento** — los campos que hacen a
   la autonomía *legible, acotada y reversible* (Art. VIII).
5. **Sin criterion** — el juicio versionado que se entrega pre-run (y que la
   ronda 1 ya sabe registrar como delivery).
6. **Registry en memoria** — los Workers de usuario viven en DB con gobernanza,
   no en un array de código.
7. **Sin clase de cola** — la disciplina distingue clase-agente (sandbox,
   watchdog 15/25min) de clase-batch (determinista acotado, estilo Steward).

---

## 3. El contrato: AgentManifest v2

Serializable (jsonb). Las capacidades se referencian por nombre; tres registros
de código las resuelven: **ToolSets**, **Skills**, **ContextProviders** (los
objetos-con-funciones de la v1 se convierten en entradas nombradas de registro).

```ts
interface AgentManifestV2 {
  // ── identidad ──────────────────────────────────────────────────────────────
  name: string                      // 'auditor' | 'librarian' | 'steward' | 'chat' | '<worker-slug>'
  version: number                   // el manifiesto es objeto versionado y gobernado
  system: boolean                   // true = agente de plataforma (seed); false = Worker declarado
  identity: {
    actor: `agent:${string}`        // sello en ledger/audit/record_events
    acts_as: 'workspace_owner' | 'key_creator' | 'none'   // resolución de credencial/visibilidad
  }

  // ── cuándo corre ───────────────────────────────────────────────────────────
  triggers: Trigger[]               // evolución de TriggerKind v1:
  // { kind:'schedule', cadence_setting?: string }        // cron con cadencia configurable (Steward)
  // { kind:'pull_request' | 'push' }                     // fuente github (Auditor)
  // { kind:'integration_event', source?: string }        // sync de Nango, etc. (Steward adelanta)
  // { kind:'drift_event' }                               // cola de drift tipada (WS4.2)
  // { kind:'human_message' }                             // Chat — deja de ser especial
  // { kind:'manual' }

  // ── con qué piensa ─────────────────────────────────────────────────────────
  cognition: 'llm' | 'deterministic'    // Steward: deterministic (sin modelo, sin skill)
  model?: { funding: 'byom' | 'driftless'; selection?: string }   // vía gateway, jamás key directa
  skill?: string                    // nombre en el registro de Skills (v1 Skill intacta)
  context_providers: string[]       // nombres en el registro (qué fragmentos de grafo recibe)
  criterion: string[]               // slugs de topics — el juicio; se entrega versionado (delivery)

  // ── qué puede tocar ────────────────────────────────────────────────────────
  tools: string[]                   // ToolSets nombrados: 'code.investigate', 'graph.read',
                                    // 'graph.curate', 'surface.read', 'broker.read',
                                    // 'broker.invoke:gmail', 'web.search', 'web.browse'
                                    // — TODOS resueltos por el único policy engine + observador T3
  surface?: { collections?: string[]; repos?: boolean }   // sustrato operacional que trabaja
  envelope?: Record<string, string[]>   // stage → operaciones permitidas (Playbook).
                                        // OBLIGATORIO si tools incluye broker.invoke:* y system=false
  actions: string[]                 // superficie cerrada v1 por nombre: 'createProposal',
                                    // 'postPRComment', 'createDraftTopic', 'writeEvidence',
                                    // 'updateRecord', 'shareNote' — cómo aterriza output

  // ── cuánto y con qué libertad ──────────────────────────────────────────────
  budget: { wallclock_soft_min: number; wallclock_hard_min: number;
            tokens?: number; invokes?: number; steps?: number }
  autonomy: Record<string, 'observe' | 'propose' | 'auto_reversible'>
            // por CLASE DE ACCIÓN; default 'propose'; 'auto_reversible' exige undo
            // (autovouch del Librarian es el precedente). Promoción/demotion = WS5,
            // alimentada por el dossier (evidence) de la ronda 1
  escalation: { on: string[]; to: 'review_queue' | 'note' }   // la salida legítima de no-acción

  // ── dónde corre ────────────────────────────────────────────────────────────
  runtime: {
    isolation: 'none' | 'sandbox'       // Daytona solo si toca código
    queue_class: 'agent' | 'batch'      // agent = watchdog 15/25min; batch = clase
                                        // webhook-processing (Steward) — misma cola,
                                        // mismos singletons, budget distinto
    interactive?: boolean               // Chat: streaming + suspend/resume (Mastra)
  }
}
```

**Gobernanza del manifiesto:** vive en DB (tabla `agent_manifests`), con
`status draft → proposed → approved`, versión y events — la misma máquina que
los topics, porque un Worker es *autoridad en pie* (verdad ejecutable). Los 4 de
plataforma se siembran `system:true, approved`. Cambiar un manifiesto = un diff
que un owner aprueba. Todo run estampa `manifest_name@version` en `agent_runs`.

---

## 4. La prueba del contrato: los cuatro agentes sin pérdida

| Campo | **Auditor** | **Librarian** | **Steward** | **Chat** |
|---|---|---|---|---|
| triggers | push / pull_request / drift_event | schedule (nightly) + manual | schedule (cadencia) + integration_event (sync) | human_message |
| cognition | llm | llm | **deterministic** | llm |
| model | byom (gate actual) | byom | — | byom/driftless |
| skill | auditor.skill | librarian.skill | — | chat.skill + titler |
| tools | code.investigate + graph.read | graph.curate | broker.read + records.write | surface.read (las 16) |
| criterion | topics matcheados por anchors | — | — | según thread |
| envelope | — (no invoca broker) | — | — | — |
| actions | createProposal, postPRComment | writeEvidence, vouch, archive | updateRecord(drift), shareNote | reply, citations |
| autonomy | propose | vouch: **auto_reversible** (undo existente) | flag: auto_reversible (drifted es reversible) | n/a (humano presente) |
| budget | 15/25 min, maxSteps 16 | 15/25 min | batch corto, sin watchdog LLM | por turno |
| runtime | sandbox, queue agent | none, queue agent | none, **queue batch** | none, **interactive** |

Los cuatro caben. Los dos que fuerzan campos son Steward (`cognition`,
`queue_class`) y Chat (`interactive`) — exactamente los casos que un diseño
hecho solo contra el Auditor habría roto después.

Y el quinto caso, el que valida el futuro — **el Worker de campaña**:
`triggers: schedule diario · cognition llm · tools: broker.invoke:gmail +
broker.invoke:exa + web.browse · surface: collection outbound · criterion:
outbound-mx-criterion + gmail-connection-criterion · envelope: el mapa
stage→ops · autonomy: draft auto, send propose · escalation: review_queue`.
Cabe sin añadir un campo. El contrato generaliza.

---

## 5. Decisiones de diseño

1. **El manifiesto es datos; las capacidades son registros de código.** El chat/
   CLI/MCP componen jsonb; `ToolSets`/`Skills`/`ContextProviders` se resuelven
   por nombre. Añadir una *capability* nueva sí es código (revisado); añadir un
   *agente* jamás.
2. **Un solo loop bajo el seam existente.** `AgentRuntime` ya es la abstracción;
   la migración consolida `agentic-loop` + `ThinLoopRuntime` en una impl (y
   `MastraRuntime` entra por el mismo seam según su contrato de adopción). Se
   preserva el invariante del trace (mismo objeto a onStep y al store).
3. **Un solo camino de tools.** Los ToolSets nombrados componen las tools
   canónicas (surface-tools E2 + investigation + graph + broker) SIEMPRE a
   través del policy engine y el observador T3. Mueren las tres composiciones
   bespoke.
4. **Un dispatcher.** Tabla de triggers derivada de los manifiestos aprobados →
   `agentsForTrigger` (la firma v1, ahora sobre DB) → enqueue. La disciplina de
   cola no cambia: singletonKey por (agente, workspace), budget único, drops
   ruidosos. `agent-schedule.service` se vuelve el dispatcher genérico.
5. **Dos clases de cola, un runtime.** La distinción que el Steward estrenó
   (clase webhook-processing) se legitima DENTRO del runtime (`queue_class`),
   no como excusa para otro servicio bespoke.
6. **El ledger de la ronda 1 es la salida del runtime.** El loader de criterion
   escribe `context_deliveries` (source nuevos: `collection_criterion` /
   `connection_criterion`); el contexto del run inyecta `run_id` en cada invoke
   y cada `record_event` automáticamente — lo que en la ronda 1 se pasa a mano,
   el runtime lo estampa solo. El dossier (`evidence`) se vuelve el insumo del
   campo `autonomy` (WS5).
7. **`IntegrationManifest` v1 se conserva como está** (inbound→TriggerEvent,
   outbound→Actions) — es la otra mitad del bus y no estorba; se materializa
   cuando un caso real lo pida (no en esta migración).

---

## 6. Mapa de migración

Principio: **cada fase deja el sistema funcionando idéntico o mejor, con gate
medible y rollback.** Nunca big-bang; los silos mueren uno a uno, el más simple
primero. (Gates de release del contrato Mastra + pass^k del plan SOTA aplican.)

### Fase 0 — Contratos sin cambio de comportamiento
- Materializar `AgentManifestV2` + tabla `agent_manifests` + seed de los 4
  (`system:true`, describiendo la realidad ACTUAL de cada uno).
- Los runners existentes LEEN su config del manifiesto (triggers, budget,
  tools nombrados) pero conservan su ejecución bespoke.
- Registros nombrados de ToolSets/Skills/ContextProviders envolviendo lo que ya
  existe (cero lógica nueva).
- **Gate:** comportamiento byte-idéntico (evals de loop existentes verdes); los
  manifiestos sembrados describen fielmente cada agente (revisión humana).
- **Rollback:** trivial — los runners ignoran el manifiesto.

### Fase 1 — Un loop; primer inquilino: Librarian
- Consolidar la ejecución bajo el seam `AgentRuntime` (ThinLoop como impl
  canónica; decisión Mastra-vs-ThinLoop se toma AQUÍ con el spike del contrato
  de adopción — es intercambiable por diseño del seam).
- Migrar **Librarian** (el más simple: sin sandbox, tools de grafo, safe-lane
  con undo ya probada): su service se reduce a `run(manifest, trigger)`.
- **Gate:** mismo output en corpus golden; autovouch conserva undo; approval
  rate del Librarian no cae.
- **Rollback:** el service bespoke sigue en el árbol una release; flag por
  workspace.

### Fase 2 — Steward y Auditor
- **Steward**: prueba `cognition:'deterministic'` + `queue_class:'batch'` dentro
  del runtime (sin modelo, sin skill — el loop degenera a pipeline determinista).
  Su lógica pura (digest, cadencia, notas) ya son funciones con tests: se re-usa
  intacta; solo muere el cableado. *Aquí se paga la ironía de haberlo construido
  bespoke — y se paga barato precisamente porque su lógica quedó pura.*
- **Auditor** (el más difícil): sandbox Daytona + BYOM + land loop + comment.
  El punto de enchufe del refuter (plan SOTA WS3) queda como paso del runtime,
  no del runner.
- **Gate por agente:** pass^k en corpus sembrado ≥ baseline; approval rate
  sostenido; cero dobles-runs (singleton respetado).
- **Rollback:** igual que F1, por agente.

### Fase 3 — Chat entra al registro
- Trigger `human_message`, `interactive:true` (streaming + suspend/resume — si
  Mastra ganó en F1, sus approvals mecánicos entran aquí). El turno del chat se
  vuelve `run(manifest,…)` con stream.
- **Gate:** paridad de latencia p95 y de citations; los threads no pierden
  invariantes (topic `chat-turn-lifecycle-invariants`).

### Fase 4 — Muerte de los silos + candado mecánico
- Borrar los runners bespoke.
- **El candado se vuelve CI:** un guard de arquitectura (patrón
  `architecture.spec.ts`) que falla si aparece un `*RunnerService` nuevo fuera
  del runtime, o un dispatch que no pase por `agentsForTrigger`. El invariante
  de `worker-manifest-northstar` deja de depender de la memoria de nadie.

### Fase 5 — Worker v1 interno (dogfooding)
- El agente de campaña de outbound como primer manifiesto `system:false`
  (redactado a mano, aprobado por owner) — el primer inquilino de negocio.
- Corre semanas fabricando evidencia en el ledger. La declaración conversacional
  (el "compilador" del chat) se construye DESPUÉS de que esto demuestre que un
  manifiesto acotado no puede hacer daño fuera de su envelope.
- **Gate de apertura a usuarios:** invariante 3 del north star — dogfooding
  primero, apertura después.

### Dónde enchufa la branch de la ronda 1
La capa de datos (migraciones 102–108, servicios de lectura, corpus A/B, skill
trailer) se cherry-pickea en F0–F1 renumerando migraciones: es la salida que el
runtime necesita y no opina sobre ejecución. El único conflicto real es el
cableado del Steward, que en F2 se re-expresa como manifiesto (su lógica pura
sobrevive intacta).

---

## 7. Riesgos nombrados

1. **Mastra**: que su estado no respete "sin semántica de producto" — el
   contrato de adopción ya define blockers/rollback; la decisión se toma en F1
   con spike, no por fe.
2. **Chat streaming**: la paridad interactiva es el gate más frágil (F3 va al
   final a propósito).
3. **Sandbox lifecycle** dentro del loop consolidado (Auditor): el warm-pool y
   los 3 sitios de `daytona.create` (gotcha conocida) se unifican en F2.
4. **Scope creep del manifiesto**: la tentación de añadir campos "por si acaso".
   Regla: un campo entra solo si uno de los 5 casos de prueba lo exige.

## 8. Qué NO decide este documento
- Mastra vs ThinLoop como impl definitiva (se decide en F1 con el spike y los
  gates del contrato de adopción — el seam hace la decisión reversible).
- El schema del "compilador" conversacional (F5+; depende de aprender del
  primer Worker manual).
- Multi-workspace / marketplace de manifiestos (parked bets; señales propias).
