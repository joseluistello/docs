# Agentes 100x — diagnóstico y propuesta

Nota interna de arquitectura (sesión 2026-07-09). Diagnóstico verificado contra el código en
`apps/api/src/agent-runs/**`, `apps/api/src/cognitive/**`, `apps/api/src/broker/**`,
`apps/api/src/webhooks/**` y el vault (topics `cognitive-layer`, `driftless-vision-governed-memory`,
`projects-agent-loop`). Propone el salto de "tres agentes que reaccionan a git" a
"el sistema inmune del contexto, en todas las superficies".

---

## 1. Diagnóstico — por qué se sienten débiles

La señal empírica primero: **86% de approval rate sobre 95 propuestas** (`driftless_agent_stats`).
Los agentes NO proponen basura. El problema no es calidad — es **alcance, profundidad y medio loop**.

### 1.1 Solo miran git (y solo la mitad del pipeline de drift)

- El drift nace de TRES fuentes (push webhook, `--diff --mark` local, verredicto del Auditor) pero
  **solo el push webhook despacha al Auditor** (`webhooks.service.ts:545-548`). El drift marcado
  desde local (`topic-drift.service.ts:24-46`) muere en el badge: nadie lo atiende.
- Las anclas externas (`url/api/doc/connection` en `topic.entity.ts:73-79`) son **inertes**:
  `anchor-match.ts` solo lee `patterns`/`where_files`. Un topic anclado a un doc de Notion o a una
  conexión **nunca driftéa**, aunque el producto promete "drift-aware".
- `ConnectorDocument` ya guarda `content_digest` por documento indexado y los webhooks de Nango ya
  llegan como `BrokerEvent` — pero **nada compara ese digest contra Knowledge**. El drift de
  integraciones está a una join de distancia y no existe.
- `records.drifted` existe en Collections y **nada lo setea automáticamente**.

### 1.2 Los agentes autónomos son ciegos cross-surface; solo Chat ve todo

Chat v0 tiene 16 tools de lectura: topics + projects + collections + docs conectados + broker mirror
(`chat-tools.ts`). El Auditor/Architect tienen **4 tools de código** (`search_code`, `find_symbol`,
`read_file`, `list_dir`); el Librarian **6 tools de grafo**. Consecuencias directas:

- El Auditor no puede verificar un claim que cita un spec de Notion ("el precio está en el doc X").
- El Architect no ve las Collections (una collection sin `criterion_rel_slugs` es un gap de
  cobertura que hoy nadie detecta).
- El Librarian no puede correlacionar un topic con la actividad operacional que lo usa.

La ironía: los tools cross-surface **ya existen canónicamente** (`surface-tools.ts`) y la policy
engine ya distingue read/act. Componerlos para los agentes autónomos es cableado, no obra nueva.

### 1.3 Poca profundidad por diseño de v1

- `maxSteps: 16`, resultados de tool capados a 4.5k chars, `read_file` máx. 200 líneas.
- Clone `--depth 1 --no-tags` (`sandbox-executor.ts:224`): **el agente no tiene historia git**.
  No puede hacer `git log`/`blame` — o sea, no puede recuperar el PORQUÉ histórico, que es
  exactamente la materia prima de un topic durable.
- Sin grafo de dependencias/referencias (el LSP ya está en el sandbox pero solo se usa para
  `find_symbol`, no para "quién llama a esto" / blast radius real).

### 1.4 La "plataforma" es aspiracional

`AgentManifest`, `Registry`, `agentsForTrigger`, `TriggerKind 'integration_event'`
(`cognitive/contracts.ts:195-235`) son **tipos que nada implementa**. Los runners son bespoke
(`AgentRunnerService` hardcodea auditor/architect; `LibrarianRunnerService` aparte). Añadir un
agente hoy = escribir un servicio nuevo + cablear triggers a mano. El handoff drift→Auditor
re-parsea un string humano (`parseChangedFiles`, `agent-schedule.service.ts:27-35`).

### 1.5 Deudas de fiabilidad que matan la confianza silenciosamente

1. Crons de `@nestjs/schedule` corren en **cada réplica** (sin leader election) → doble sweep.
2. El **Librarian corre en el web tier** fuera de la cola (`agent-schedule.service.ts:177`),
   contradiciendo la invariante "no agent compute on the API web tier".
3. `enqueue` **descarta jobs en silencio** si pg-boss no arrancó (`agent-queue.service.ts:88-94`).
4. **Gate legacy**: el dispatch (push/PR/manual) exige `opencode_key_enc`
   (`resolveAgentDispatch:62`) pero el runner acepta cualquier credencial del gateway — un
   workspace gateway-only tiene agentes que **nunca se disparan**.
5. Jobs expiran a 600s con retry mientras el reaper permite 30 min → posible ejecución duplicada;
   el reaper mata el run pero **no el sandbox** (el gasto sigue).
6. El budget (`settings.agents.budget`) **no tiene superficie de escritura** — ni PATCH ni UI.

---

## 2. La vara del 100x (alineada a la visión)

La visión (`driftless-vision-governed-memory`): el trabajo se vuelve contexto vivo — **anclado,
gobernado, drift-aware** — y Driftless es la mitad de memoria de cualquier loop agéntico
(read-before / write-after). La v2 declarada es "inteligencia dentro de la plataforma".

El 100x entonces NO es "agentes más listos" en abstracto; es cerrar el loop completo del sistema
inmune en todas las superficies, con autonomía que se gana con evidencia:

```
  SENSAR (git, docs conectados, records, webhooks, harness)
    → DIAGNOSTICAR (audit profundo, con historia y cross-surface)
      → PROPONER (Review Queue, verificado adversarialmente)
        → MERGEAR (humano; higiene mecánica auto-aplicada reversible)
          → VERIFICAR (evals + approval rate por clase de acción)
```

Métricas que definen "100x" (todas ya instrumentables con `agent_run` + `agent_stats`):

| Métrica | Hoy | Meta |
|---|---|---|
| MTTR de drift (stale → Knowledge reparado) | días/∞ (solo push) | horas, cualquier fuente |
| Superficies con drift-awareness | 1 (git) | 4 (git, docs, records, conexiones) |
| Approval rate por clase de acción | 86% global | ≥90% con verificación; habilita autonomía |
| Costo por topic mantenido | sin medir | ↓ vía tiering de runtime + cache |
| Gaps de cobertura detectados | solo código | código + collections + docs conectados |

---

## 3. Roster propuesto

**No quitar roles** — el reparto SEED/MAINTAIN/GROW/CURATE (+ Chat) es correcto y la separación de
poderes (proposer ≠ approver) es la invariante que lo mantiene honesto. Lo débil es el alcance de
cada rol y la plomería compartida. Cambios:

### 3.1 Auditor → profundidad + cross-surface + todos los drifts

1. **Historia git**: tool `git_history` (log/blame acotado) + fetch `--depth 50` on-demand.
   El "porqué" histórico es la evidencia más barata que hoy se tira.
2. **Lecturas cross-surface**: componer `SEARCH_TOOLS + DOC_TOOLS` (read-only, ya canónicos) en su
   executor. Un claim que cita material conectado se verifica contra el índice, no se adivina.
3. **Triggers nuevos**: consumidor de una **drift queue tipada** (payload estructurado, no
   `parseChangedFiles`): drift local, drift manual del Inbox, y el drift de docs (§3.4) llegan al
   mismo Auditor. El botón "Review with Auditor" deja de ser el único camino para el drift no-push.
4. **Presupuesto dinámico**: `maxSteps`/deadline escalan con nº de topics × tamaño del diff, en vez
   de 16 fijo (con el cap duro del budget del workspace intacto).

### 3.2 Architect → cobertura más allá del código + modo entrevista

1. **Coverage multi-superficie**: además del coverage map de código, detectar (a) collections
   activas sin criterion, (b) docs indexados con alto uso en Chat sin topic que los gobierne,
   (c) áreas con drift recurrente sin invariantes registradas.
2. **Modo entrevista**: cuando el código no puede revelar el porqué (el caso más común de topic
   valioso), emitir una **pregunta dirigida** al humano (comment en el topic/PR) en vez de callar
   o inventar. Barato, y convierte al Architect en generador de contexto que solo el humano tiene.

### 3.3 Librarian → curador nightly con carril seguro (autonomía ganada)

1. **A la cola y fuera del web tier** (hoy viola su propia invariante).
2. **Nightly, no semanal** — la curación es el cuello de botella de activación declarado
   ("la fricción no es generar contexto sino madurarlo").
3. **Safe lane ejecutable**: acciones mecánicas y reversibles (crear `relates_to`, normalizar tags,
   archivar zombies con undo — el patrón Undo ya existe para autovouch) se **auto-aplican** cuando
   el approval rate de esa clase de acción supera un umbral sostenido. Promote/merge/split siguen
   siendo humanos. Esto generaliza `librarian_autovouch` a un sistema de niveles:
   `L0 sugerir → L1 proponer → L2 auto-aplicar reversible`, por clase de acción, medido con
   `agent_stats` desagregado. La autonomía se gana con evidencia, nunca se configura a ciegas.

### 3.4 NUEVO — Steward: el auditor de integraciones

La pieza que falta para "comparar contra la integración". Graph+broker-read, **sin Daytona**
(como el Librarian), barato:

- **Sensor**: webhook de sync de Nango / re-index → diff de `content_digest` por
  `ConnectorDocument`; `BrokerEvent`s de salud de conexión.
- **Diagnóstico**: cuando cambia un doc que Knowledge cita (o que un topic ancla vía `doc`/
  `connection` — **activar esas anclas hoy inertes como fuente de drift**), corre un audit
  doc↔topic con el mismo branch fact-vs-invariant del Auditor.
- **Acciones**: propone update/flag al topic; marca `records.drifted` cuando la fuente de un
  análisis cambió; flag de "conexión rota que Knowledge asume viva".
- **Límites**: solo lecturas del broker (documents/records/events). Nunca `invoke` de escritura,
  nunca setup, nunca scripting — las líneas existentes no se mueven.

### 3.5 Scout → segunda pasada + historia

Post-onboarding (día ~7), re-scout de gaps con lo aprendido del uso real; clone con historia para
que los primeros topics traigan el porqué de los commits, no solo la foto.

### 3.6 Chat → el write path gobernado (B4)

Chat ya navega todo pero es read-only. Darle **una** escritura: "convierte esto en nota/propuesta"
desde la conversación (nace `proposed`, misma Review Queue). Es la vía natural de "sugerencias top"
con humano en el loop, y convierte cada conversación en captura de contexto — exactamente la tesis
del producto.

### 3.7 Builder — sigue ON HOLD, con una excepción quirúrgica

Escribir código sigue off-thesis. La única variante que vale la pena en fase 3: **Remediator de
anclas** — PR mecánico que re-apunta globs cuando los paths se renombran (el modo "anchor moved"
que el Auditor ya detecta). Cero lógica de negocio, 100% reversible.

---

## 4. Plataforma — el motor que hace barato crecer el roster

1. **Materializar `AgentManifest`/`Registry`** (hoy tipos muertos): un agente = manifiesto
   (triggers, context providers, tool set, skill, actions, gate). El dispatch
   (`agentsForTrigger`) reemplaza el cableado bespoke y habilita `integration_event` y
   `drift_event` como triggers de primera clase con payloads tipados.
2. **Un tool-plane componible por rol** sobre la RegistryToolExecutor + policy engine que Chat ya
   probó: `SANDBOX_TOOLS ∪ TOPIC_TOOLS ∪ E2 read tools` según manifiesto. Los writes siguen siendo
   Actions post-loop gobernadas — nada de esto toca la gobernanza.
3. **Runtime tiering (con Daytona o sin él, por pregunta)**: grafo → sin sandbox (ya);
   lecturas puntuales de archivos → GitHub API contents (sin sandbox, ideal para audits de 1 topic
   con 2 archivos); exploración real → Daytona. Warm pool / snapshot por repo+commit para bajar
   latencia y costo del caso Daytona; unshallow on-demand.
4. **Verificación adversarial barata**: antes de aterrizar una propuesta, un pase corto con modelo
   barato que intenta refutarla contra el mismo sandbox/grafo. Sube el approval rate (la moneda
   con la que se compra autonomía) y corta el peor modo de fallo: la propuesta plausible-pero-mal.
5. **Fiabilidad (pre-requisito de todo lo demás)**: singleton keys / leader election para crons;
   Librarian via cola; alerta cuando pg-boss no arranca (hoy drop silencioso); **fix del gate
   legacy→gateway** (bug real: workspaces gateway-only nunca despachan); reaper que mata el
   sandbox; budget con PATCH + UI.
6. **Evals como gate de despliegue de skills**: `evals/loop` + golden-repo ya existen; añadir casos
   por rol (incl. Steward doc-drift) y correrlos en CI antes de tocar un skill.

---

## 5. Secuencia

**Fase 1 — palancas baratas (el 80% del dolor):** fix gate legacy→gateway · drift local/manual
despacha al Auditor vía drift-event tipado · `git_history` + depth 50 · cross-surface reads para
Auditor/Architect · Librarian nightly en cola · fiabilidad (leader election, alerta de cola).

**Fase 2 — la superficie nueva:** Steward (drift de docs conectados vía `content_digest` +
webhooks Nango → topic staleness; `records.drifted` automático) · verificación adversarial ·
autonomy tiers v1 (relate/tag/archive con undo) · budget UI · coverage multi-superficie del
Architect.

**Fase 3 — plataforma:** Registry/manifiestos + `integration_event` dispatch · Chat write-path
B4 · Remediator de anclas · modo entrevista del Architect · Scout segunda pasada.

---

## 6. Qué NO hacer (deliberado)

- **No** mensajería agente↔agente: la coordinación por el grafo es la decisión correcta y es
  auditable — se mantiene.
- **No** embeddings: el motor determinista/explicable es diferenciador de venta.
- **No** Builder que escribe lógica de negocio.
- **No** scripting de integraciones por agentes ni `invoke` de escritura desde loops — las líneas
  del broker no se mueven; el Steward es read-only sobre lo ya sincronizado/indexado.
- **No** apurar Mastra: `ThinLoopRuntime` aguanta todo lo anterior; el seam ya existe si un rol
  futuro necesita workflows.
