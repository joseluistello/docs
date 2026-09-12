# Luna Chat — plan de ejecución

**Qué es:** el orden en que se construye lo que define `01-interfaz-luna.md`, fase por fase, con lo que se puede **demostrar** al final de cada una, los archivos reales que se tocan, y la puerta que hay que pasar para seguir.
**Base verificada:** `staging` @ `f5acdf06`. Dos hechos cambian el plan respecto a lo que dicen los docs viejos: (a) las tablas de Work Session existen y están registradas en TypeORM, pero **nada las lee**: no hay reductor, no hay `agentic-contracts.ts`, no hay 28 eventos escritos; Luna es greenfield sobre un esquema vacío. (b) `FeatureKey` solo admite `assistant | broker`.
**Supuesto de equipo:** una persona de ingeniería a tiempo completo más Claude como par. Con dos personas las fases F2–F4 corren en paralelo y el total baja de ~7 a ~5 semanas.

## Por dónde se empieza y por qué

Se empieza por **el hilo** (F1): hablar con Luna y verla buscar, sin dinero y sin escribir nada. Porque ahí viven las dos incógnitas que pueden tirar todo el diseño y que hoy nadie ha probado en este repo:

1. ¿El modelo primario barato aguanta un bucle con ~10 herramientas y salida `json_object` sin desbarrancarse a la ruta cara? Si no, el costo por conversación cambia y hay que saberlo la semana uno, no la seis.
2. ¿La sesión, los eventos y la pantalla dividida se sienten vivos? Es el esqueleto sobre el que van las tarjetas de decisión.

El dinero entra en tercer lugar (F3), después de que existe el tablero, por la regla de orden del diseño: se gasta solo sobre algo que la persona ya vio.

## Mapa

| Fase | Se demuestra | Tamaño |
|---|---|---|
| F0 · Cimientos | Decisiones cerradas, contratos escritos | 2–3 días |
| F1 · El hilo | "Busca fabricantes de empaque en Jalisco" → narración en vivo + tarjetas argumentadas a la derecha | 1 semana |
| F2 · La lista y el CRM | "Guárdamelos" → un toque → aparecen en la Colección real, al lado; Luna mueve una tarjeta y se ve | 1 semana |
| F3 · Contactos y modo automático | "Consígueme los correos de los 10 mejores" → cotización → decisión → cobro; luego lo mismo en auto con tope | 1 semana |
| F4 · Secuencias | "Ármame tres correos" → borrador + vista previa → tarjeta `revisar_secuencia` → autorizar cada paso en el chat → sale | 1 semana |
| F5 · Cerebro, integraciones, investigación | Notas y ediciones sugeridas, lectura de HubSpot/Notion, investigación larga con progreso en el chat | 3–4 días |
| F6 · Puerta de beta | 8 evals bloqueantes en CI, costo por sesión medido, léxico y errores limpios, rollout a Founder | 1 semana, en paralelo desde F2 |

---

## F0 · Cimientos (2–3 días)

**Decisiones que se cierran y quedan en `DECISIONS.md` de este folder:**
- **Nombre.** "Luna" = el modelo gestionado. El id `gpt-5.6-luna` se queda como está en el gateway (es un id de proveedor) pero ninguna etiqueta de producto vuelve a decir "Luna" para referirse al fallback.
- **Entitlement.** Reusar `assistant` en `apps/api/src/entitlements/plans.catalog.ts` en lugar de ampliar `FeatureKey`; el control fino de rollout va en un kill switch propio.
- **Eventos v1.** Como los 28 eventos de A1 nunca se escribieron, se congela la tabla de 10 eventos de `01-interfaz-luna.md §6` como vocabulario v1. Cabe en `type varchar(40)` de `work_session_events`.
- **Free.** Explorer: chat sin auto, sin contactos, sin secuencias, tope diario de turnos (sugerido: 15).

**Trabajo:**
- `apps/api/src/luna/luna.contracts.ts`: `TurnInput`, `TurnIntent`, `DecisionDraft`, `Ref`, `LunaEvent` (los 10), `SessionStage`, `SessionPolicy` (modo, tope, clases). Solo tipos y JSON Schemas.
- `apps/api/src/luna/luna-rollout.ts` copiando la doctrina de `investigations/investigation-rollout.ts`: `{ disabled, allowedWorkspaces, autoModeEnabled, maxTurnsPerDayFree }`. Encendido por defecto, lista solo para fijar durante beta.
- Registrar la superficie `luna-chat` en la sesión gestionada y añadir el runner de Luna a `FACTORY_CONSUMERS` en `agent-runs/mastra-boundary.spec.ts` (si no, CI falla por diseño).
- Instalar `react-resizable-panels` en el dashboard.

**Puerta:** contratos revisados por el founder.

---

## F1 · El hilo (1 semana)

**Objetivo demostrable:** abrir `/w/:slug/luna`, escribir "quiero 40 fabricantes de empaque en Jalisco que ya le hayan vendido a gobierno", y ver la narración en vivo, los pasos ("leí el criterio del equipo", "412 candidatos"), y tarjetas argumentadas apareciendo a la derecha. Nada se escribe, nada cuesta.

### API — módulo `apps/api/src/luna/`

- `luna.module.ts` con imports `AgentRunsModule`, `EntitlementsModule`, `BillingModule`, `TopicsModule`, `MarketDataModule`, `TypeOrmModule.forFeature([WorkSession, WorkSessionEvent, WorkSessionArtifact])`. Registrar en `app.module.ts` L286–332.
- `luna-session.service.ts`: crear/cerrar `work_sessions` (una por principal), `append(event)` con `seq` monotónico y `snapshot` cada N eventos, `readSince(seq)`.
- `luna-turn.service.ts`, el corazón:
  1. `assertFeature(ws,'assistant')` + `CommercialUsageService.preflight(ws, actorHash, false, false)` + rollout.
  2. Compilar `TurnInput` (perfil comercial, libro de hechos, tablero del snapshot, mapa de cobertura, etapa).
  3. `managedSessions.contextFor({ surface:'luna-chat', runId: sessionId+turn, capabilities:{ structuredOutputMode:'json_object' }, allowTechnicalFailover:true })`. **Sin** `json_schema` aquí.
  4. `mastra.for(access.modelContext).runStreaming(spec)` con `tools = buildAgentToolExecutor(LUNA_TOOLS_FOR_STAGE, backing, { caller:'internal_agent', emit })`, `maxSteps: 8`, `stubToolResultsOverChars: 4500`, `onStep` → eventos `tool.started/finished`, `narration.delta`.
  5. Validar el `TurnIntent` en modo `prompted` con una reparación; si falla, segunda pasada con `capabilities:{ structuredOutputMode:'json_schema' }` y `escalate:{ reason:'capability' }`.
  6. `modelUsage.recordSession(access.session, null)` siempre, en `finally`.
- `luna-tools.ts`: las herramientas de F1 como `DriftlessTool[]` (`sideEffect:'read'`, `policyClass:'open_read'`): `context_retrieve`, `context_get`, `market_search`, `market_count`, `market_get`, `market_aggregate`, `market_history`, `market_compare`, `market_screen`, `board_read`, `usage_read`. El *backing* llama a `RetrieveService`, `MarketDataService`, `CommercialUsageService` con proyección cliente-segura (sin `next_action` de operador, sin ids internos).
- `luna-stage.ts`: `stageFor(snapshot)` → `sin_criterio | buscando | con_seleccion | con_lista | decision_pendiente` y `toolsFor(stage)`.
- `luna-refs.ts`: validador de `[[kind:id]]` contra los objetos del turno (v1: `company`, `topic`, `evidence`) + instrucción de reparación.
- `luna.controller.ts` en `workspaces/:slug/luna`:
  - `POST /sessions` → `{session_id}`
  - `POST /sessions/:id/turns` (header `Idempotency-Key`) → 202 `{turn_id}`; el trabajo corre en el request y publica eventos
  - `GET /sessions/:id/events?since=` → SSE (`text/event-stream`), mismo patrón que `events/stream`
  - `GET /sessions/:id` → snapshot proyectado

### Dashboard — `apps/dashboard/src/luna/`

- Ruta: una línea en `App.tsx` L265–311: `<Route path="luna" element={<Screen render={(ws) => sus(<Luna workspace={ws} />)} />} />`.
- `Luna.tsx`: `PanelGroup` horizontal (`react-resizable-panels`), izquierda `LunaThread`, derecha `LunaBoard`.
- `lunaRuntime.ts`: adaptador *External Store* de assistant-ui (`useExternalStoreRuntime`) alimentado por `subscribeLunaEvents` (copiar `subscribeWorkspaceEvents` de `api.ts` L195–247 con `since=seq` y reconexión). El servidor es la única autoridad: el store no guarda nada que no venga de un evento.
- `LunaBoard.tsx` v1: la selección como tarjetas argumentadas (nombre, porqué, evidencia), sin CRM todavía.
- Composer con el selector de modo visible pero deshabilitado ("Preguntar").

### Tests
- Unit: `luna-stage.spec.ts`, `luna-refs.spec.ts`, compilación de `TurnInput` con fixtures.
- Candado `luna-boundary.spec.ts` (text-scan como `mastra-boundary.spec.ts`): ningún archivo de `luna/` importa `unlockContacts`, `promote`, `EmailCampaignsService.confirm/activate`, `approve`; ninguna herramienta de Luna tiene `sideEffect:'act'`.
- Integración: un turno con modelo scripted (fixture) produce la secuencia de eventos esperada.

**Puerta:** 20 briefs reales de prueba; ≥95 % de turnos terminan en el primario; el tiempo al primer texto < 2 s; el founder lo usa 10 minutos y no pierde el hilo.

---

## F2 · La lista y el CRM al lado (1 semana)

**Objetivo demostrable:** "guárdamelos en Prospección" → tarjeta "Guardar 40 · 3 ya estaban" → un toque → la Colección real aparece en el panel derecho con sus etapas. "Pasa Cartonera Jalisco a Calificado" → la tarjeta se mueve a la vista, con deshacer.

### API
- Herramientas: `selection_update`, `crm_collections`, `crm_query`, `crm_get`, `crm_update` (devuelve `undo_token` y `dropped_fields`), `crm_schedule_activity`, `crm_save_companies`, `crm_bulk_update`.
- `luna-decisions.service.ts`: las propuestas viven en el snapshot (`pending[]` con `proposal_id`, tipo, vista previa, vencimiento). `POST /sessions/:id/decisions/:pid/resolve { outcome }` ejecuta: `guardar_en_crm` → `POST market-data/promote` con las mismas filas del preview; `cambios_masivos` → `POST /records/bulk` sin `dry_run`. `POST /sessions/:id/undo/:token` revierte un nivel 0.
- Tablero como `STATE_DELTA`: cada cambio de selección o de CRM emite `board.patched` (JSON Patch sobre la proyección).
- Etapas `con_seleccion` y `con_lista` activan sus herramientas.

### Dashboard
- `CollectionDetail.tsx` acepta `collectionId`/`recordId` por **props con fallback a `useParams()`** (cambio pequeño, no rompe la ruta `collections/:collectionId/records?/:recordId?`). Se monta en `LunaBoard` cuando hay lista guardada; antes, la selección.
- Tarjetas (Tool UIs de assistant-ui): `GuardarEnCrmCard`, `CambiosMasivosCard`, chip `Deshacer`.
- SWR: al resolver una decisión, invalidar la clave `/workspaces/:slug/collections/:id/...` para que el board se refresque solo.

### Tests
- Integración: preview y promote producen la misma salida por fila; resolver dos veces es idempotente (`source_promotion_key`).
- Candado: `crm_update` nunca manda `entity_id` dentro de `fields`.

**Puerta:** guardar 40, mover 3, deshacer 1, todo visible sin recargar.

---

## F3 · Contactos con dinero y modo automático (1 semana)

**Objetivo demostrable:** "consígueme el correo de los 10 mejores" → "Revelar 10 contactos · 20 créditos · te quedan 140 · vence en 10 min" → aceptar → los registros muestran contacto revelado. Luego, activar "Automático hasta 50 créditos" y repetir con otros 5: Luna narra "revelé 5 · 10 créditos · llevas 30 de 50" sin preguntar.

### API
- Herramientas: `people_search`, `people_quote`, `people_acquired`.
- Cotización: `people_quote` llama al servicio de Radar y guarda en el snapshot `{ quote_id, quote_token, idempotency_key, credits, expires_at, selection }`. **Solo `quote_id`, precio, saldo y vencimiento** cruzan al modelo y al cliente.
- Resolver `revelar_contactos`: `unlockContacts(ws, collectionId, recordIds, { confirmed:true, maxCredits: credits, idempotencyKey, quoteToken, actorId })`. Vencida → `expired` y se recotiza. `RADAR_QUOTE_EXCEEDED` → tarjeta "cambió el precio, vuelvo a cotizar", nada cobrado.
- `SessionPolicy`: `PUT /sessions/:id/policy { mode:'ask'|'auto', budget_credits, max_contacts_per_turn, classes }`. Gating: `commercialTierForPlan(plan) === 'explorer'` → 403 para `auto`. El resolutor automático corre dentro del turno cuando la política lo permite y la lista ya está guardada; escribe en la auditoría `resolved_by:'policy'` + quién fijó la política y cuándo. El auto expira con la sesión.
- Contador: evento `decision.resolved` lleva `budget_used/budget_total`.

### Dashboard
- `RevelarContactosCard` con cuenta regresiva; `PolicySheet` (modo, tope, clases) en el composer; contador de presupuesto en la barra del hilo.
- Explorer ve el selector deshabilitado con "Disponible en Founder".

### Tests
- `one-debit-per-operation.spec.ts` se extiende: un desbloqueo desde Luna produce **una** fila de ledger por operación.
- Candado: `unlockContacts` solo se invoca desde `luna-decisions.service.ts`, nunca desde `luna-tools.ts`.
- Unit: la política rechaza más de `max_contacts_per_turn`, rechaza sin lista guardada, expira con la sesión.

**Puerta:** 10 desbloqueos en staging con proveedor mock; cero dobles cobros; el recibo dice quién autorizó.

---

## F4 · Secuencias (1 semana)

**Objetivo demostrable:** "ármame una secuencia de tres correos para los 10" → borrador (día 0, 3, 7) → vista previa por destinatario con avisos ("2 sin nombre de contacto") → tarjeta `revisar_secuencia` en el chat con los pasos, la audiencia, la vista previa por destinatario y las brechas de capacidad → la persona la acepta (confirma campaña + autoriza cada paso + activa) → sale con el proveedor mock.

### API
- Herramientas: `sequence_list`, `sequence_get`, `sequence_draft`, `sequence_update_draft`, `sequence_preview`, envolviendo `EMAIL_CAMPAIGN_TOOL_CONTRACT` (`email-campaign-tools.ts`). Audiencia = registros de la Colección.
- `email-campaigns.feature.ts`: pasar de single-tenant a lista de workspaces + plan (Founder y Commercial). Sin esto no hay beta.
- `sequence_preview` incluye `GET /email-capabilities` proyectado: lo que no existe (prueba, respuestas, aperturas) se dice tal cual.
- **Resolutor de `revisar_secuencia` en `luna-decisions.service.ts`** (server-side, sesión humana): al aceptar la tarjeta, en un solo acto — `EmailCampaignsService.confirm` sobre la campaña, una autorización inmutable por paso con huella de remitente + audiencia + contenido (una llamada por paso, o una sola con las casillas marcadas — decidir contra la UI de F4), y `activate`. Corre con `assertHumanSession`: el chat principal ya es una sesión humana de Clerk, así que se cumple igual que en el dashboard. Editar el borrador después de emitida la tarjeta invalida las autorizaciones y obliga a reemitirla — mismo mecanismo que ya invalida en `sequence_update_draft`.
- `sequence_activate` no es una tool del cinturón: es el paso final del resolutor, nunca algo que Luna invoque.

### Dashboard
- `RevisarSecuenciaCard` (pasos, audiencia, avisos, checkbox o botón por paso), montada en el chat — ya no hay handoff ni pantalla intermedia en `/email-campaigns`.

### Tests
- Candado: `luna-tools.ts` no importa `confirm`, `activate`, `send-authorizations` (solo `luna-decisions.service.ts` puede); `assertHumanSession` sigue en `email-campaigns.service.ts` L694 y L1042 (text-scan).
- Integración: editar un borrador ya autorizado invalida las autorizaciones y el chat lo reporta; aceptar `revisar_secuencia` dos veces es idempotente.

**Puerta:** una secuencia completa de punta a punta en staging con `EMAIL_CAMPAIGN_PROVIDER=mock`, autorizada enteramente desde el chat.

---

## F5 · Cerebro, integraciones, investigación (3–4 días)

- Herramientas: `context_note`, `context_suggest_edit` (tarjetas nivel 1 que al resolver llaman `POST /topics` con `propose:true` y `proposals`); `integrations_list`, `integrations_read` (broker read); `research_start`, `research_status`.
- Decisiones: `accion_externa` (resolver → `broker invoke` con `idempotency_key`; la tarjeta resuelta muestra `correlation_id`), `investigar` (resolver → `POST /research/runs?stream=ndjson`; los frames se re-emiten como `run.progress`), `fusionar_conocimiento` (solo aparece a owner/admin; resolver → `assertCanApprove` + approve).
- Intent `limite`: tarjeta "Esto no lo puedo hacer todavía" con proveedor + operación, sin intento alternativo.
- Broker sigue tras su kill switch; en beta solo lectura de HubSpot y Notion.

**Puerta:** los tres tipos de decisión resueltos en staging; una nota de Luna aparece "en revisión" en el Cerebro.

---

## F6 · Puerta de beta (1 semana, en paralelo desde F2)

- `evals/luna/registry.mjs` + `run.mjs` copiando `evals/intelligence/registry.mjs`: los 8 evals bloqueantes de `01 §9` en tres niveles (L1 reductor puro, L2 modelo scripted con fixtures, L3 modelo vivo en `nightly-evals.yml`). Registrado sin implementar = falla.
- Telemetría de costo: por sesión, `% turnos en primario`, `costo USD`, `escaladas por razón`. Tablero interno simple. Alerta si el primario baja de 90 %.
- Léxico y errores: gate de léxico prohibido sobre `narration.delta`; catálogo de errores mapeando `RATE_LIMITED`, `CURSOR_*`, `PROTECTED_RESOURCE`, `VERSION_CONFLICT`, `RADAR_QUOTE_EXCEEDED` y los `RefusalCode` a frases de producto.
- Rollout: `allowedWorkspaces` → 3 workspaces amigos → plan Founder completo. Explorer con su tope diario.
- Docs: `update-docs` para la sección de Luna en docs.driftless.icu.

**Puerta:** 8/8 evals en verde en CI; costo por sesión medido y dentro de lo que el plan Founder aguanta; el founder cierra beta.

---

## Después de beta (no se planifica aún)

- Precio para el enrichment de *empresa* de Radar (`enrichCompanies`): hoy no tiene operación de débito y por eso el código lo limita a una pasada por run; el enrichment de *contacto* ya está cobrado (operación `contacts`, 2 créditos por persona).
- Conector de correo en el broker (Gmail u Outlook) para operar la bandeja propia de la persona (leer respuestas, enviar un correo suelto desde su cuenta). No es un bloqueante para secuencias: el envío ya funciona hoy vía Nylas (send-only).
- Paridad MCP: exponer el mismo registro `DriftlessTool` hacia afuera (`external:true`) para que Claude/ChatGPT tengan lo que Luna tiene.
- CopilotKit solo si assistant-ui se queda corto en las tarjetas de decisión.

## Riesgos y qué se hace con ellos

| Riesgo | Señal | Respuesta |
|---|---|---|
| El primario no aguanta el bucle de herramientas | F1: > 10 % de turnos escalan o se reparan dos veces | Reducir herramientas visibles por etapa a 6; mover la síntesis final a `json_schema` solo en `cierre` |
| El chat se siente lento | Primer texto > 2 s | Streaming desde el primer token; búsquedas en paralelo dentro del turno |
| Doble cobro o cobro sin ver | Cualquier fila de ledger sin `decision_id` | Candado en F3; el auto solo con lista guardada |
| Secuencias bloqueadas por el flag single-tenant | F4 no puede correr en dos workspaces | Cambiar el flag a lista + plan en F4, no después |
| Deuda de A1 (docs sin código) | Tentación de "primero construir el reductor de 28 eventos" | Vocabulario v1 de 10 eventos congelado en F0; ampliar solo cuando un eval lo pida |

## El primer PR (esta semana)

F0 completo + el esqueleto de F1: módulo `luna/`, contratos, rollout, sesión con eventos SSE, un turno que solo llama `context_retrieve` y `market_search`, la ruta `/w/:slug/luna` con el hilo de assistant-ui y el panel dividido. Sin tarjetas, sin dinero. Con eso ya se puede escribir "busca fabricantes de empaque en Jalisco" y ver a Luna pensar en vivo.
