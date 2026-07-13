# Plan de ejecución: Mastra como runtime, Driftless como proveedor

Plan de ejecución (pre-código), v2 — incorpora las decisiones del owner (2026-07-11).
**No inventa arquitectura**: ejecuta el contrato aprobado `mastra-adoption-contract`
(reviewed, owner 2026-07-05) y lo extiende con la dirección nueva del owner: exponer
el tooling de Driftless (la superficie MCP/CLI) a los agentes internos, con identidad
y gobernanza. Corrige el desvío de "El Underlayer — ronda 2" (runtime de manifiestos
interno redundante con Mastra), que se retira **por reemplazo**, nunca en caliente.

## 0. Decisiones tomadas (no re-litigar)

1. **Mastra es el runtime; Driftless es el proveedor.** Mastra posee loop, tool-dispatch,
   structured output, approvals, suspend/resume, supervisores, guardrails. Driftless
   posee el producto: workspace auth, Model Gateway/BYOM, Knowledge/criterion,
   Broker/Integrations, Collections, ledger, gobernanza. Ningún semántico de producto
   vive en estado de Mastra.
2. **Camino "completo", no "conservador":** `Agent`/`createTool` de Mastra son la capa
   real. El cognitive layer propio (`AgentSpec`, `ToolExecutor`, `Skill`, registry,
   manifest-runtime) colapsa en primitivas de Mastra a medida que cada rol migra.
3. **Agentes internos se definen EN CÓDIGO** (`new Agent({...})` versionado en git,
   revisado por PR). La fábrica agente-como-dato (fila DB → Agent) queda en STANDBY
   junto con los Workers.
4. **Workers FUERA de esta ronda.** Señal para reabrir: trazabilidad currada + agentes
   internos estables sobre Mastra semanas en staging/prod. Recién entonces: fábrica,
   MCPServer externo y semi-autonomía.
5. **Architect se BORRA como agente server-side.** No se resucita; si vuelve, es como
   skill/plugin (decisión SOTA ya tomada, ahora ejecutada). Roster interno final de la
   ronda: **Librarian, Auditor, Steward, Chat**.
6. **`minimumReleaseAge` para `@mastra/core`: REVOCADO por el owner para este run.**
   `@mastra/core` se agrega directo en la branch de trabajo.
7. **El invariante de la plataforma — paridad de capacidad, asimetría de autoridad:**
   un agente puede hacer todo lo que un humano puede hacer vía MCP/CLI, pero sus
   escrituras aterrizan gobernadas (propose, no approve; `requireApproval` en las de
   efecto). Proposer ≠ approver, siempre — con o sin autonomía. La semi-autonomía
   futura relaja *qué clases de acción requieren aprobación previa* (juez: el dossier
   de evidencia del ledger), jamás *quién aprueba la verdad*.

## 1. La frontera (qué pieza de Driftless entra como qué primitiva de Mastra)

| Driftless | Primitiva Mastra | Nota |
|---|---|---|
| Loop de ejecución | `Agent` (`.generate()`/`.stream()`) | Lazy `importEsm('@mastra/core')` en un `@Injectable`; jamás static import ni `@mastra/nestjs`. |
| Model Gateway v2 (BYOM) | `model` (`LanguageModelV4`) | `DriftlessGatewayModel` YA escrito (dark). Mastra nunca ve credencial/ruta/costo. |
| Superficie MCP/CLI (topics, áreas, collections, projects, comments, broker) | `createTool()` in-process sobre los MISMOS métodos de servicio | **El registry MCP es la spec de paridad** — no se diseña superficie nueva. Cada call estampa `actor: agent:<rol>` + `run_id` en el ledger. Escrituras: gobernadas o `requireApproval`. |
| Broker (operaciones) | `createTool()` con `requireApproval` en operaciones de efecto | Credenciales server-side; auditado. |
| Knowledge/criterion | `RequestContext` + instructions/tools dinámicos | Input-only. Estado del run vive en `agent_run` + grafo, nunca en Memory de Mastra. |
| Approval humano | `requireApproval` por tool + suspend/resume | El suspend aterriza en la Review Queue; el resume es acto de gobernanza. |
| Steward (determinista) | **Workflow** (steps sin LLM) | La lógica pura (digest/cadencia) se re-usa intacta. |
| Chat (interactivo) | suspend/resume nativo + streaming | Reemplaza el `interactive` casero. |
| Trazabilidad (ledger ronda 1) | Hooks de observabilidad → nuestro sink | Un solo span root `agent.run`; tokens del gateway. **El ledger encuentra aquí su consumidor**: cada tool call de agente lo alimenta. |

**Bright line (del contrato):** grafo, `agent_run`, Projects, Collections, Broker, audit
y event ledger son las ÚNICAS fuentes de verdad. `AgentRunsService` es el único escritor
de estado de run. Agents single-shot SIN storage backend. Workflow/suspend con storage
(`@mastra/pg`) OUT hasta el gate 9 (suspend-reconstruction).

## 2. La ronda actual: trazabilidad → tooling → agentes internos

Cada fase deja el sistema idéntico o mejor, con gate binario y rollback. **Cada fase se
entrega a un ejecutor como prompt acotado e independiente — nunca el plan entero.**

### D0 — Borrar Architect (mecánico, independiente)
- Eliminar el rol `architect` de `agent-runner.service`, config (`architect` toggle),
  dashboard, MCP y donde aparezca. Sus specs se ajustan.
- **Gate:** build + tests verdes; ninguna referencia viva a `architect` como agente
  server-side. La skill importable NO se crea ahora (plugins, después).

### F0 — El spike (el que ronda 2 se saltó)
- `pnpm add @mastra/core` (restricción de release-age revocada).
- `ADD cognitive/mastra-runtime.ts`: `MastraRuntime extends AgentRuntime`; lazy import;
  `AgentSpec` → Mastra `Agent` sin storage; tokens del gateway; step → `RunTraceEvent`.
- `ADD cognitive/mastra-tool.adapter.ts`: `ToolDef` → `createTool`, delegate puro,
  schema derivada (sin zod paralela).
- Cablear `DriftlessGatewayModel` como `model` (su primer uso vivo — gate 7).
- **Gate (binario):** gates 1, 2, 4, 5, 7 del contrato como smokes — ESM-load bajo
  `nest build` real; ledger-equivalencia vs ThinLoop para el mismo input del Librarian;
  Daytona-substrate; un solo span; BYOM sin fuga de secretos. CERO tráfico real.
- **Rollback:** nada en producción construye `MastraRuntime`.

### F1 — Tooling interno con identidad y gobernanza
- Envolver la superficie de servicio que hoy exponen MCP/CLI como `createTool()`
  in-process: lectura completa (topics/search/collections/records/projects/áreas) +
  escritura gobernada (draft/proposal de topics, comments, record updates, notas).
- Identidad: cada call estampa `actor: agent:<rol>` + `run_id` → ledger (la trazabilidad
  de ronda 1 se vuelve consumida, no dormida).
- Autoridad: invariante §0.7 — writes gobernadas, `requireApproval` en efectos.
- **Gate:** un Agent Mastra de prueba lista topics, crea un draft gobernado y el ledger
  muestra la cadena completa (run → tool call → delivery → proposal) con actor correcto.

### F2 — Los internos sobre Mastra, uno a uno (flag-gated por rol)
Orden: **Librarian** (el más simple) → **Steward** (Workflow determinista) →
**Auditor** (sandbox Daytona, el más difícil) → **Chat** (suspend/resume, paridad p95
+ citations). Cada rol re-pasa los gates 2–5 contra su propio tráfico; `ThinLoopRuntime`
queda como rollback compilado hasta que su rol flipa. A medida que cada rol queda verde,
**se borra su pieza del framework interno de ronda 2** (por reemplazo).

### F3 — Muerte del framework interno (cierre)
- Borrar lo que quede de: `manifest-runtime.ts`, consolidación ThinLoop,
  `manifest-registry`, `tool-sets`, `deterministic-pipelines`, `runtime-candado.guard`,
  superficie Worker del dashboard/MCP (dormida, sin músculos — se retira honesta).
- La gobernanza del manifiesto (tabla `agent_manifests`, propose→approve) se CONSERVA
  dormida: es el insumo de la fábrica en standby.
- **Gate:** cero referencias al runtime propio; tests verdes; el diff es solo deletes +
  recableos.

## 3. STANDBY (señal explícita para reabrir, no antes)

| Pieza | Señal de reapertura |
|---|---|
| Workers (agentes de usuario) | Internos estables sobre Mastra + trazabilidad currada (semanas) |
| Fábrica agente-como-dato (fila DB → Agent) | Al abrir Workers |
| MCPServer externo (broker para ChatGPT/Claude/Cursor) | Al abrir Workers; auth OAuth+FGA por workspace |
| Semi-autonomía (ladder por clase de acción) | El dossier de evidencia tiene volumen real; la promoción la decide un humano con el dossier enfrente |
| Workflow/suspend con storage de Mastra | Gate 9 del contrato (suspend-reconstruction) |

## 4. Qué sobrevive de ronda 2 vs qué muere

**Sobrevive:** ledger/trazabilidad completo (ahora con consumidor), broker, `DriftlessGatewayModel`,
lógica pura del Steward, dashboard Activity/Evidence/timeline, gobernanza propose→approve
del manifiesto (dormida), y el mapa de diseño (qué tools/contexto/criterion necesita cada
agente — se transcribe a cada `new Agent`).

**Muere por reemplazo (~2,900 líneas, >50% tests):** `AgentManifestV2` como runtime,
consolidación ThinLoop, registry, tool-sets, context-providers-como-registro,
deterministic-pipelines, runtime-candado, superficie Worker (UI/MCP). Cada pieza se
borra SOLO cuando su reemplazo Mastra está verde.

**Se borra sin reemplazo:** Architect como agente server-side (D0).

## 5. Riesgos
1. **Mastra churn:** mitigado por el seam `AgentRuntime` + adapter compile-enforced.
2. **Scope creep del ejecutor** (el fallo real de ronda 2, dos veces): mitigado por
   proceso — una fase por prompt, gate binario, revisión del owner entre fases.
3. **Delegar semántico de producto a Mastra:** las bright lines del contrato + el
   gate 3 (zero-product-state) lo detectan.
