# 07 — Tarjetas de resultado y el "super chat" de Ada

Propuesta, 2026-09-11 (corregida el mismo día). Estado: **borrador para decisión del fundador**. No hay código detrás.

Lo que pide el fundador: un chat que muestre datos como componentes (listas, conteos, pipeline, secuencias, contexto) y actúe sobre ellos, explotando al máximo el proveedor que usamos, sobre las cinco primitivas del producto: CRM, enriquecimiento, señales, secuencias de correo, contexto.

## 0. Diagnóstico en tres líneas

1. **El modelo no es el problema.** Verificado en `model_usage` de staging: cada turno de la sesión `92da0b12` corrió con `openai/gpt-5.6-luna`, tier primario, sin escalar. (Los defaults de `managed-models.ts` y `render.yaml` apuntan a DeepSeek, pero el entorno de Render los sobreescribe; no inferir el roster del código.) Lo que falla es el harness.
2. **El harness solo sabe narrar.** El contrato de salida es `{intent, narration}`. La única tarjeta de resultado en línea es la de selección, y solo para tres herramientas (`company_search`, `market_search_suppliers`, `market_get_supplier`). Un conteo, un pipeline por etapa, una secuencia o un análisis se aplastan en un párrafo con las tres advertencias que el payload de mercado pega en cada llamada.
3. **Los componentes ya existen y el chat no los usa.** `DataArtifactRenderer` (`apps/dashboard/src/redesign/`) pinta seis vistas (`DataTableView`, `MetricGridView`, `BarChartView`, `LineChartView`, `EvidenceListView`, `ComparisonView`) sobre `DataArtifactSpec`, un contrato versionado que el servidor valida antes de salir (`apps/api/src/investigations/data-artifact.contract.ts`, decisión en `docs/architecture/data-artifact-views.md`). Hoy solo lo usa Investigaciones. Las nueve tarjetas de decisión de Luna son para pedir permiso, no para mostrar datos; cuatro devuelven 501 y `onResolve` descarta lo que la persona edita.

## 1. Norte

Cada respuesta de Ada es **una tarjeta y una frase**. La tarjeta es un `DataArtifactSpec` que el servidor construye a partir del resultado real de la herramienta, valida con el gate que ya existe y el cliente pinta con el renderer que ya existe. La frase la produce el modelo y lee la tarjeta, no la repite. Toda tarjeta tiene acciones por fila y una en lote, y esas acciones son las herramientas y decisiones que ya existen.

Esto respeta la decisión ya tomada en `data-artifact-views.md`: dataset persistido → spec validado → renderer nuestro. Nunca HTML del modelo. Y es el estado del arte de 2026 (partes tipadas del hilo, vocabulario cerrado de componentes) sin adoptar `react-generative-ui`, que el spike de agosto descartó.

## 2. Las tarjetas (vocabulario v1)

Todas se expresan como `DataArtifactSpec` con un `datasetRef` nuevo `{ kind: 'luna_run', run_id }` (hoy solo existe `investigation`), y se pintan con `DataArtifactRenderer` dentro del hilo. Lo nuevo es el **mapeo herramienta → vista** y las **acciones**, no los componentes.

| Tarjeta | Vista existente | La produce | Acción por fila | Acción en lote |
|---|---|---|---|---|
| **Lista** | `DataTableView` (+ selección) | `market_search_suppliers`, `company_search`, `market_search_opportunities` | Ver ficha · Elegir | Guardar en CRM (decisión) |
| **Conteo** | `MetricGridView` (1 métrica + filtros) | `market_count_suppliers`, `market_compare_segments`, `market_aggregate_awards` | — | Muéstramelos (hereda filtros) |
| **Pipeline** | `BarChartView` por etapa + `MetricGridView` | `collection_query` (list / aggregate) | Abrir etapa | Abrir en Colección |
| **Cuenta** | `EvidenceListView` + métricas | `collection_query` get + contacto + señales | Mover etapa · Elegir persona · Agendar | Revelar contactos (decisión cotizada) |
| **Secuencia** | `DataTableView` (pasos) + estado | `sequence_get`, `sequence_check` | Ver paso | Revisar y activar (decisión) |
| **Contexto** | `EvidenceListView` | `context_retrieve`, `context_get` | Abrir tema | Dejar nota (decisión) |
| **Análisis** | `ComparisonView` + `MetricGridView` + hallazgos | cualquier pregunta abierta | — | la acción que el hallazgo sugiera |

Las seis primeras las construye el código, deterministas. **Análisis** es la única que compone el modelo: emite un `DataArtifactSpec` (no HTML) con `json_schema` estricto contra el contrato existente, y pasa por `validateDataArtifactSpec` como cualquier spec. Si no valida, cae a la tabla canónica, que es la degradación que el renderer ya define.

**Regla del manual que acompaña:** "Cuando el turno produce una tarjeta, la narración es una o dos frases que la leen. No repitas sus cifras, no listes sus filas, no agregues advertencias: la fuente va al pie de la tarjeta." Las tres advertencias fijas de mercado salen del payload que ve el modelo y entran como pie de tarjeta, en español, una vez.

## 3. Proveedor: qué exprimimos de OpenAI

Ya usamos: streaming SSE, tools + `tool_choice`, `json_schema` negociado, prompt caching (los turnos de staging muestran ~11k tokens en caché de ~12k), razonamiento apagado.

Lo que empezamos a usar:

- **`json_schema` con `strict: true`** para el contrato de turno y para la tarjeta Análisis. La plomería existe (`types.ts:37`, `openai-compatible.ts:41`); nadie la enciende.
- **`reasoning_effort: low` solo en intents de análisis y cierre**, apagado en búsquedas y conteos.
- **Llamadas de herramienta en paralelo** (`parallel_tool_calls`) para "conteo + contexto del equipo" en un solo paso.
- **Narración incremental**: hoy `narration.delta` se emite una vez tras validar. Con la tarjeta ya en pantalla, la frase puede llegar en streaming sin riesgo de cifras sin ancla.
- **Responses API** más adelante, cuando toque migrar el adaptador. No es requisito.
- **Agents API** solo para "Investigar". No para el chat.

Costo observado en staging: US$0.003 a US$0.014 por llamada al modelo, dos a cuatro llamadas por turno. Sigue siendo centavos.

## 4. Plan por fases (tres semanas, tres PRs)

### Fase 0 — Ver lo que pasa (1 día)
- Persistir los argumentos de cada llamada en `tool.finished` (hoy no se guardan; el 32 contra 13 fue indepurable).
- `board.runs` deja de estar vacío: cada llamada registra `{run_id, tool, args, ref_label}`. Habilita "muéstramelos hereda los filtros".
- Alinear los defaults del código con el roster real (OpenAI primario) para que local, staging y producción digan lo mismo, y que el bench corra contra ese roster.

**Lo que ve la persona:** al expandir "Ver el detalle", qué buscó Ada, en lenguaje de producto.

### Fase 1 — Las seis tarjetas (1 semana)
- Servidor: `cardFromToolResult(name, parsed, harvest): DataArtifactSpec | null` junto a `selectionFromToolResult` en `luna-board.ts`; `datasetRef.kind = 'luna_run'`; validación con el gate existente; nuevo evento `card.shown {spec, payload}` (migración: el CHECK de `luna_session_events.kind` lista exactamente 10 kinds).
- Cliente: parte `data-luna-result-card` que monta `DataArtifactRenderer` con una barra de acciones por tarjeta. Precedente: `BoardCard.tsx`.
- Manual: regla "tarjeta y una frase"; advertencias de mercado al pie de tarjeta.

**Lo que ve la persona:** "¿cuántos proveedores de bombas hidráulicas?" → tarjeta Conteo con 32 y sus filtros, una frase, botón "Muéstramelos". "Muéstramelos" → tarjeta Lista con esos 32, mismos filtros, "Guardar en CRM" en lote.

### Fase 2 — Tarjetas que actúan (1 semana)
- `onResolve` lleva payload: filas elegidas, texto editado, colección elegida. Hoy se descarta.
- Las cuatro decisiones que devuelven 501 se habilitan o salen del catálogo.
- Tarjeta Cuenta: mover etapa, elegir persona, agendar, desde la tarjeta, con recibo.
- Tarjeta Análisis: el modelo emite `DataArtifactSpec` con `json_schema` estricto. Caso de prueba: "dame un análisis de mi CRM" sobre la sesión `92da0b12` (40 registros, 3 etapas).

**Lo que ve la persona:** el chat opera el CRM; un análisis con métricas y hallazgos anclados, y un botón por hallazgo.

### Fase 3 — Señales y secuencias desde el chat (1 semana)
- Herramienta `account_signals {collection_id, record_id}` que junta oportunidad + evidencia + estado de contacto en una lectura.
- Secuencia desde una selección: `sequence_create_draft` alimentado por `people_acquired`, tarjeta Secuencia, decisión "Revisar y activar" con `check_id` firmado (hoy es un token `sc1.` sin firma).
- Streaming de narración.

**Lo que ve la persona:** "arma una secuencia para las 5 cuentas prioritarias" → tarjeta Secuencia con pasos y bloqueos, "Revisar y activar" en el dashboard.

## 5. Lo que NO hacemos

- No cambiamos de modelo: el que responde ya es `gpt-5.6-luna`.
- No rehacemos el harness sobre el Agents API de OpenAI. Se evalúa solo para "Investigar".
- No dejamos que el modelo componga HTML ni markdown libre. Solo `DataArtifactSpec` validado.
- No creamos componentes nuevos donde `DataArtifactRenderer` ya tiene la vista.
- No abrimos panel derecho. Decisión 21 se mantiene.
- No tocamos el gate de anclajes: las tarjetas lo alimentan, no lo esquivan.

## 6. Decisiones que necesita el fundador

1. **Reusar `DataArtifactRenderer` como motor de tarjetas del chat** (en vez de componentes nuevos por tarjeta). Sí/no.
2. **Tarjeta Análisis compuesta por el modelo** como `DataArtifactSpec` estricto. Sí/no. Sin ella, "dame un análisis" sigue siendo texto.
3. **Orden de fases** como está, o Fase 2 antes que Fase 1 si lo urgente es operar el CRM desde el chat.

## 7. Evidencia usada

- Modelo real: `model_usage` en staging, `run_id` = turn ids de la sesión `92da0b12` (`provider_class=openai`, `model_id=gpt-5.6-luna`, `tier=primary`).
- Componentes existentes: `apps/dashboard/src/redesign/DataArtifactRenderer.tsx:310-316`, `apps/api/src/investigations/data-artifact.contract.ts:86-138`, `data-artifact.builder.ts`, `docs/architecture/data-artifact-views.md`.
- Seam del hilo: `luna.contracts.ts:347-399,749`, `luna-turn.service.ts:700-768,1020`, `luna-board.ts:110,142`, `lunaRuntime.ts:171,280,430,747-780`, `ThreadParts.tsx:216-255`, migración `1715200000185-AddLunaSessions.ts:49-62`.
- Primitivas: `apps/mcp/src/tools/families/{crm,empresas,mercado,secuencias,cerebro}.ts`; `apps/api/src/luna-decisions/luna-decisions.service.ts` (cinco kinds resueltos, cuatro en `UNAVAILABLE_KINDS`).
- Estado del arte: assistant-ui Tool UI y generative UI, AI SDK v6 partes tipadas, MCP Apps (2026-01-26), OpenAI structured outputs estrictos.
