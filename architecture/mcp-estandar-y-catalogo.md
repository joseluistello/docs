# El MCP como fuente única de capacidades — estándar y catálogo

> **Actualización 2026-09-11 (PR #698):** la familia de Empresas pasó a **persona-primero**. `contact_discover`, `contact_select`, `contacts_acquired`, `contact_quote` y `contact_unlock` se **retiraron**; su lugar lo ocupan `people_search`, `people_quote`, `people_acquired`, `people_reveal`, `people_file` y `people_status`. Las filas de `contact_*` de este doc describen el estado **previo** a esa retirada. El detalle vigente vive en `luna-chat/05-catalogo-core-y-chat.md` y `proveedores-una-puerta.md`.

**Decisión.** El MCP es la fuente de verdad de toda capacidad de Brein. Luna consume las mismas herramientas en proceso. Lo que no se usa se borra. El MCP se estandariza y se simplifica. **Broker/integraciones quedan fuera de esta versión.**

**Base auditada (solo lectura):** `apps/mcp/src/**`, `apps/api/src/{app.module.ts, market-data/market-data-mcp.adapter.ts, cognitive/, luna/}`, `docs/mcp/`, `skills/`, `.driftless/`, `apps/cli/src`, `scripts/harness/mcp-e2e.mjs`, `libs/analytics`.

## 0. Seis hallazgos que corrigen el encargo

| Supuesto | Lo que dice el código |
|---|---|
| "41 + 13 = 54" | **53**: 40 registros nombrados + 13 de mercado. El 41.º `this.tool(` es el `.map()` que genera las de mercado. |
| "El CLI espeja el MCP" | **Falso.** `grep "tools/call\|jsonrpc" apps/cli/src` → cero; el CLI habla HTTP contra la API. Los 3 nombres literales en código no-spec están en **prosa** (la plantilla de skill dentro de `install-skill.ts` y dos comentarios). **Borrar del MCP no puede romper el CLI**; solo rompe `surface-parity.spec.ts`. |
| "`cognitive/tool-registry.ts` es el tipo canónico sin usar" | `DriftlessTool` **está vivo** en `luna-tools.ts`, `luna-stage.ts`, `luna-tools.service.ts`, `radar/planning/market-intelligence-tools.ts`, `agent-runs/tool-execution-ledger.ts` y 7 módulos de `cognitive/`. Lo único muerto es **`toMcpDescriptor()`** (solo en specs). No se retira: **se adopta**. |
| "¿Hay telemetría de llamadas?" | Se emite y **se tira en silencio**. `mcp.controller.ts:299/306` manda `agent_tool_used {tool, ok, duration_ms}`; `events.ts:350` permite solo `['tool','ok']` y `validateEventPayload` **rechaza el evento entero** ante una propiedad desconocida. **Ni un solo `agent_tool_used` ha llegado a PostHog.** Tampoco hay `apps/api/src/telemetry/`, columna `tool_name` en migraciones, consulta en `.driftless/posthog-queries.sql` ni columna de herramienta en `audit_log`. Único rastro vivo: el atributo OTEL `driftless.tool.name`. |
| "Luna añadió ejemplos trabajados" | Dos veces, y solo una sirve: 6 herramientas pueblan `examples[]`, pero `toRuntimeToolDef` emite solo `{name, description, parameters}`. **El modelo nunca ve `examples`** — solo el ejemplo escrito dentro de la `description`, que `market_count` y `market_search` no tienen. |
| Cobertura de pruebas | `mcp-e2e.mjs` ejercita **9 de 53** (7 de Cerebro + `collection` y `broker` por nombre legado). **Ninguna de mercado, ninguna de contactos.** |

**No existe evidencia de volumen**: se decide con evidencia de *referencia*. Arreglar la telemetría es una línea, va en Fase A y no recupera historia. **Los docs:** `overview.mdx` lista bien las 18 retiradas, pero documenta como vivas `context_comment` y `note_add` y nombra **tres inexistentes** (`driftless_agent_stats`, `driftless_project`, `driftless_notion_*`); al revés, `company_save`, `contact_select` y `contact_prepare` no aparecen en ningún doc de usuario ni skill.

## 1. Inventario con evidencia de uso

CLI = fila en `CAPABILITY_MATRIX` (paridad de capacidad, no llamada). Skill = `skills/driftless/`. Brein = las 4 skills públicas `brein-*`. Har. = `mcp-e2e.mjs`.

### Cerebro — 20

| Nombre | Cat. | Qué hace | CLI | Skill | Docs | Har. | Veredicto |
|---|---|---|---|---|---|---|---|
| `context_retrieve` | pública | Lo que el equipo ya sabe para esta tarea | ✓ | 18× | ✓ | ✓ | **KEEP** — la entrada real |
| `context_get` | pública | Abre una nota por slug | ✓ | ✓ | ✓ | ✓ | **KEEP** |
| `context_search` | pública | Busca por palabra | ✓ | ✓ | ✓ | ✓ | **MERGE→retrieve** — retrieve ya compone search+match+list |
| `context_list` | pública | Lista por área | ✓ | ✓ | ✓ | ✓ | **MERGE→retrieve** |
| `context_get_for_files` | pública | Empata por ruta | ✓ | ✓ | ✓ | ✓ | **MERGE→retrieve** — `files[]` ya es su argumento |
| `context_create` · `_update` · `_delete` | públicas (3) | Escribe / corrige / borra una nota | ✓ | – | ✓ | 2/3 | **KEEP** |
| `context_share` | pública | Publica una nota a la web | ✓ | – | ✓ | – | **DELETE** — publicar no es trabajo de agente |
| `note_add` | retirada | Captura una nota suelta | ✓ | – | guías | – | **DELETE** — Notas no es producto visible |
| `context_comment` | retirada | Comenta un topic | – | – | ✓ vivo | – | **DELETE** + borrar su página de docs |
| `context_graph` · `_relations` | retiradas (2) | Grafo y aristas | – | – | ret. | – | **DELETE** — infraestructura |
| `context_propose` · `_approve` · `_merge` · `_create_proposal` · `_proposals` | retiradas (5) | Gobernanza Nota→Knowledge | ✓ | – | ret. | – | **DELETE** — acto de owner/admin |
| `context_events` · `context_doctor` | retiradas (2) | Actividad y salud del vault | ✓ | – | ret. | – | **DELETE** |

### Mercado — 13 (las 13 referenciadas por las skills públicas)

| Nombre | Qué hace | Brein | Veredicto |
|---|---|---|---|
| `market_capabilities` | Qué se puede filtrar y con qué cobertura | 3× | **KEEP** |
| `market_search_suppliers` · `_opportunities` · `_awards` · `_permits` · `_risks` | Filas de Proveedores / Licitaciones / Adjudicaciones / Registros / marcas de riesgo | ✓ | **MERGE→`market_search` (kind)** — ninguna tiene obligatorio propio (regla de fusión, §3) |
| `market_get_supplier` · `_opportunity` | Abre una fila por `record_ref` opaco | ✓ | **MERGE→`market_get`** — mismo único obligatorio |
| `market_count_suppliers` | Cuántos proveedores coinciden | ✓ | **RENAME→`market_count`** + `states[]` |
| `market_compare_segments` | Malla segmentos × entidades | ✓ | **RENAME→`market_compare`** |
| `market_aggregate_awards` | Cuánto se adjudicó, agrupado | ✓ | **RENAME→`market_aggregate`** |
| `market_get_supplier_history` | Historial de contratos de un RFC | ✓ | **RENAME→`market_history`** |
| `market_screen_risks` | Cruza 1-50 RFC contra listas | ✓ | **RENAME→`market_screen`** |

### CRM, Empresas y contactos, Cuenta — 20

| Nombre | Cat. | Qué hace | CLI | Skill | Docs | Veredicto |
|---|---|---|---|---|---|---|
| `collection_query` | pública | Lee registros del pipeline; ya trae `status: ok\|continue\|incomplete` | ✓ | – | ✓ | **KEEP** — es el envelope de referencia |
| `collection_record` | pública | Alta / edición / etapa / historial | ✓ | ✓ | ✓ | **RENAME→`crm_record`**, solo escritura (sus lecturas ya están deprecadas) |
| `collection` | retirada | CRUD de esquema de colección | ✓ | ✓ | ✓ | **DELETE** — configurar el pipeline es humano; hay que editar la skill |
| `collection_purge` · `collection_record_delete` | retiradas (2) | Borrado duro | ✓ | – | ret. | **DELETE** |
| `entity` | retirada | Identidad entre pipelines | – | – | ret. | **DELETE** — se resuelve server-side al guardar |
| `areas` · `tags` | retiradas (2) | Taxonomía del vault | ✓ | – | ret. | **DELETE** |
| `company_search` | pública | Busca en el directorio externo de Empresas | ✓ | – | ✓ | **KEEP** |
| `company_save` | pública | Guarda una empresa como registro del CRM | ✓ | – | **–** | **KEEP** — sin él `company_search` no lleva a ningún lado |
| `contact_discover` | pública | Hasta 3 personas atribuibles | ✓ | – | ✓ | **KEEP** |
| `contact_select` | pública | Elige un candidato por rango del servidor | ✓ | – | **–** | **KEEP** — es el punto de control de gobernanza |
| `contacts_acquired` | pública | Directorio adquirido, solo metadatos | ✓ | – | ✓ | **KEEP** |
| `contact_prepare` | pública | Prepara UN borrador `not_sent` | ✓ | – | **–** | **DELETE del catálogo** — redactar es Campañas; cero referencias externas |
| `contact_quote` · `contact_unlock` | públicas (2) | Cotiza y desbloquea Contact Path | ✓ | Brein | ✓ | **KEEP** |
| `usage` · `workspaces` | públicas (2) | Plan y ledgers · workspaces de la credencial | ✓ | – | ✓ | **KEEP** |
| `members` | pública | Lista miembros | ✓ | – | ✓ | **DELETE** — no es trabajo comercial; excepción `human-authority` |
| `broker` | retirada + kill switch | Router genérico de integraciones | ✓ | ✓ | ✓ | **DELETE de esta versión** |
| `<provider>_records` · `_document_content` | sintetizadas | Herramientas por conexión | – | – | ✓ | **DELETE de esta versión** — dependen del broker |

**"Broker fuera", en concreto:** (a) el default de `DRIFTLESS_BROKER_ENABLED` se invierte a `false` y se fija así en todos los entornos; (b) `driftless_broker` sale del array de registro — el handler puede quedarse en el archivo, pero deja de resolverse en `tools/call`; (c) `connectorTools()` deja de invocarse desde `paginateFor` (una línea) y `tool-synthesis.ts` queda inerte; (d) se borran `references/broker.md` (9 menciones en 2 archivos, espejadas en `.driftless/`) y su fila de la tabla de ruteo; (e) `docs/mcp/integrations.mdx` se marca no disponible. Conectar proveedores sigue siendo flujo humano.

**Cuentas.** KEEP **20** · RENAME **6** · MERGE **8→2** · DELETE **25** → **catálogo objetivo: 24 públicas.**

## 2. El estándar de una herramienta

| # | Regla | Hoy |
|---|---|---|
| 1 | **`<familia>_<verbo>`, sin marca**: `market_search`, `crm_record`. | **Ya está**: `list()` publica `publicName = name.slice('driftless_')`; `driftless_*` y `brein_*` son alias ocultos. **No** adoptar `driftless_<familia>_<verbo>`: mete marca en un nombre que el modelo repite y que el gate de narración castiga. Nuevo: renombrar **internamente** para que clave y nombre público coincidan. |
| 2 | **Enums cerrados**: estado, `observed_kind`, `currency`, `amount_scope`, `group_by`, `kind`, `contact_kind`, `query_mode`, `mark_kind`. | **Parcial.** **`state` y `mark_kind` son `{type:'string'}` sin enum** — el hueco más caro: el banco 2 midió 6 fallos en 35 llamadas por `"México"` (el país) y por dos estados en un campo. Los 32 nombres viven en `luna-tools.ts:107` (`MEXICAN_STATES`), **copiados**, con guardia contra `normalizeState`. Nuevo: subirlos a `libs/market-data-contracts` con esa guardia. |
| 3 | **`additionalProperties:false` + `required` en la raíz.** | **Ya está** en las 13 de mercado y en `collection_query`/`collection_record`; falta verificar Cerebro. |
| 4 | **Ejemplos trabajados**: 2 en búsquedas, 1 en el resto. | **Nuevo, y hoy va al revés en las dos superficies.** El MCP borra toda descripción de campo (`withoutDescriptions()`) para caber en el presupuesto de `tools/list`; Luna puebla `examples[]` que el modelo nunca ve. Regla: el ejemplo va **en la descripción**; las descripciones de campo vuelven solo donde hay enum o formato no obvio. |
| 5 | **Abrir con la pregunta que responde y decir para qué NO usarla.** | **Ya está** en las 13 de mercado. Nuevo: extenderlo a Cerebro, CRM y contactos con la fórmula "Úsala cuando… NO la uses para… (usa X)". |
| 6 | **Solo vocabulario de producto** (`luna-chat/03-lexico.md`): Proveedores, Licitaciones, Adjudicaciones, Registros, marcas de riesgo, observación, cobertura, evidencia, créditos de inteligencia / de contacto. Prohibido: *candidato* (salvo coincidencia por nombre), *universo*, *mercado* como sustantivo de datos, *análisis* genérico, *dataset*, *warehouse*, *interno/externo*. | **Nuevo, con deuda medida en ambos lados.** El léxico ya listó **22 correcciones** archivo:línea, la peor en `luna-tools.ts:543` (`usage_read` anuncia "créditos de análisis", ledger inexistente). El MCP: "candidate" en `search_suppliers` y `get_supplier`. |
| 7 | **Envelope uniforme** `{ ref, results[] con ref por fila, shown, has_more, cursor?, coverage?, status, next_action }`. | **Tres implementaciones distintas.** `shown`/`has_more`/`next_action`/`coverage` ya están en mercado; `status: ok\|continue\|incomplete` **solo en `collection_query`**; el `ref` de llamada y por fila **solo en Luna** (`company:<record_ref>`, `topic:<slug>`, `run:<prefijo>-<n>`). Nuevo: un `envelope.ts` único, más el `ref_label` de Luna, que deja narrar sin exponer el id. |
| 8 | **Error uniforme `{error:{code,message,hint,allowed_values?}}` como dato.** | **Casi.** El MCP ya devuelve el fallo como *resultado* (`isError:true` + `structuredContent`) y `renderErrorText()` pinta `why / allowed_values / suggested_correction / recovery.action` — **pero solo en market-data**; el resto cae a `{error: message}` y `actionArgs` lanza. Luna normaliza todo lo fixable por argumento (banco 2: 25 de 79 llamadas morían como string y el modelo reintentaba el argumento ilegal). Nuevo: generalizarlo — un bug sigue lanzando, y un error **no lleva `ref`**. |
| 9 | **Metadatos de efecto/política/costo/idempotencia.** | **El tipo existe, no está conectado.** `DriftlessTool` ya declara `sideEffect`, `policyClass`, `costClass`, `idempotent`, `outputBudget`, `examples`, `external`, `citations`; el MCP publica solo los 4 `annotations` del spec. Nuevo: el registro **adopta `DriftlessTool`** y deriva con `toMcpDescriptor()`, que debe **incrustar `examples` en la descripción**. |
| 10 | **Presupuesto de salida por herramienta.** | **Dos mecanismos distintos.** MCP: bytes globales (50 KiB), recorta la hoja mayor, y en páginas de mercado **no recorta** (rompería el cursor sellado) sino que empuja el presupuesto a la fuente (`marketPageBudget()`). Luna: caracteres por herramienta (4500 / 1800 / 2000 / 1200), **saca filas enteras** y marca `has_more:true`. Nuevo: `outputBudget` en el catálogo, aplicado como `min(outputBudget, tope)` con el recorte por filas. |
| 11 | **Paridad de cobro: los mismos recibos que HTTP.** | **Ya está en las dos rutas** (`CommercialUsageExecutionService`). **Un defecto a corregir al fusionar:** el `market_get` de Luna cae a `OpportunityService.detail` cuando el ref no es proveedor pero **cobra siempre como `get_supplier`**. Al unificar, el `action` de cobro debe seguir a la rama ejecutada. |

## 3. El catálogo objetivo — 24 herramientas

**La regla de fusión, del banco 3 de Luna.** `market_analyze {op, filters}` fracasó porque `firstMissingRequiredArg` (`cognitive/registry-tools.ts:143`) **solo lee `required` del nivel raíz**: un obligatorio dentro de `filters` era una frase, nunca una compuerta, y 5 de 8 fallos de intención fueron el modelo sin llamar la herramienta. Regla: **fusiona solo herramientas sin obligatorios propios distintos.** Las 5 búsquedas no tienen ninguno (solo `kind`); los 2 `get` comparten `record_ref`. Las 4 de análisis sí los tienen y **se quedan separadas**.

| Familia | n | Herramientas | Deltas de esquema |
|---|---|---|---|
| **Mercado** | 8 | `market_capabilities`, `market_search`, `market_get`, `market_count`, `market_aggregate`, `market_history`, `market_compare`, `market_screen` | `market_search`: `kind` enum (5) + `filters` cerrado **por kind** que **rechaza** la clave ajena con `hint` + `allowed_values` — Luna hoy la descarta en silencio (`additionalProperties:true`); eso no se copia. `search`/`count`/`compare`: `state` a enum de 32. `count`: `states[]` (≤5, conteo por estado y total, secuencial porque cada uno se cobra y admite aparte; `total: null` si alguno no se pudo leer). `search_risks`: `mark_kind` a enum. Todas: `ref` por fila y de llamada, `ref_label`, `status`, 1-2 ejemplos, descripciones en campos con enum. `market_get` absorbe `include_awards` y **cobra según la rama**. |
| **Cerebro** | 5 | `context_retrieve`, `context_get`, `context_create`, `context_update`, `context_delete` | `retrieve` absorbe `query`, `area`, `files[]`, `stale`. Envelope con `ref: "topic:<slug>"`, `status`, `next_action`. Escrituras: `additionalProperties:false` verificado + un ejemplo. |
| **CRM** | 2 | `collection_query`, `crm_record` | `collection_query`: `ref` por fila. `crm_record`: quitar `list`/`get` del enum (ya deprecados), dejar `add/update/history/bulk/schedule_activity`, un ejemplo. |
| **Empresas y personas** | 8 | `company_search`, `company_save`, `people_search`, `people_quote`, `people_acquired`, `people_reveal`, `people_file`, `people_status` | `ref` por fila (aditivo; el `claim_token` de `company_save` y los rangos se quedan). Descripciones al léxico: **Empresas ≠ Proveedores**, explícito en cada una. `quote`/`reveal`: pasar a metadatos lo que hoy va en prosa. |
| **Cuenta** | 2 | `usage`, `workspaces` | `usage`: "créditos de análisis" → **créditos de inteligencia**. |

Por qué cada conteo: Mercado son las cinco preguntas comerciales reales (¿quién hay?, ¿cuántos?, ¿cuánto?, ¿quién es este?, ¿es riesgoso?) más comparar y el contrato de capacidades. Cerebro es leer y escribir: la gobernanza es acto humano. CRM es leer y mover: configurar el pipeline es humano. Empresas/contactos son los siete pasos del ciclo gobernado, cada uno con su chequeo de derechos — fusionarlos borraría el punto de control. Cuenta son los dos hechos que un agente necesita antes de prometer algo.

## 4. Cómo Luna consume el MCP en proceso

**La costura ya existe y nadie la usó.** `McpModule.register()` **exporta `ToolRegistry`**, y `AppModule` ya lo importa con el adaptador in-process (`app.module.ts:334`). No hace falta HTTP ni JSON-RPC.

1. **Handle compartido.** Extraer `apps/api/src/mcp.dynamic.ts` con `export const MCP = McpModule.register({useExisting: MarketDataMcpAdapter, imports:[MarketDataModule]})` e importar **esa misma referencia** desde `AppModule` y `LunaModule` (Nest deduplica un `DynamicModule` por identidad de objeto). `LunaToolsService` inyecta `ToolRegistry`.
2. **Lista y llamada.** `registry.catalog(): DriftlessTool[]` (Luna conserva su `toRuntimeToolDef`) y `registry.call(name, args, ctx)` con un `ToolCallContext` armado desde el `Principal` de la sesión — el mismo que arma el controller, sin `authorization` porque no hay salto de red.
3. **Subconjunto por etapa — recomendación: `stages` en el catálogo, no allowlist en Luna.** Hoy `LUNA_TOOL_STAGES` es una tabla paralela por nombre que hay que tocar por cada herramienta nueva; el propio archivo lo admite. Añadir `stages?: SessionStage[]` a `DriftlessTool` y que `toolsForStage` filtre por el campo. `MAX_VISIBLE_TOOLS = 12` se queda **en Luna**: es regla de la conversación. De las 24, Luna verá 5 en `sin_criterio` y 11 después; **`market_capabilities` se marca sin etapas a propósito**, porque la cobertura ya le llega compilada en el `TurnInput`.

**Luna conserva:** `luna-manual.ts`, `luna-input.compiler.ts` y `luna-criterion.ts` (los dos compiladores), `luna-intent.ts` (las compuertas `parse/schema/refs/pregunta/lexico/cifra`), el cosechador de refs y `stripRefTokens`, `luna-stage.ts` y el cobro.

**Luna borra:** `luna-tools.ts` (551 líneas) salvo `MEXICAN_STATES`, que sube a contratos con su guardia; y de `luna-tools.service.ts` (862) las ~600 de despacho, mapeo acción→ruta, recorte por kind y proyección. `anchorRow`, `capOutput` y `toLunaToolError` **se mudan al MCP** como envelope, presupuesto y error estándar — no se duplican.

**`next_action` y presupuesto contra el validador.** Luna hoy **quita** `next_action` a propósito (`luna-tools.service.ts:7`); con el envelope estándar lo verán los gates de cifras y refs. `next_action` es **instrucción, no material citable**: el cosechador lo ignora por nombre y el validador lo trata como no-citable, igual que a `hint` — una línea junto a `REF_FIELDS`. El tope del MCP (50 KiB) es ~11× el de Luna (4 500 caracteres) y recorta distinto; el `outputBudget` por herramienta los reconcilia con `min(outputBudget, tope)` y el recorte por filas, conservando la excepción de las páginas de mercado, que se rechazan en vez de trocearse.

**`cognitive/tool-registry.ts` se adopta, no se retira.** Es el único tipo que ya declara efecto, política, costo, idempotencia, presupuesto y ejemplos, y ya trae un spec de contrato (`mcp-mapping.contract.spec.ts`) que lee el registro vivo del MCP y verifica la derivación. Mover `tool-registry.ts` + `tool-policy.ts` + `tool-citations.ts` a `libs/agent-tools` y que `apps/mcp` importe `DriftlessTool`: eso convierte "el MCP es la fuente de verdad" en algo que defiende el compilador.

## 5. Orden de migración y tamaño

| Fase | Qué | Arch. | ~Líneas | Pruebas | Gate |
|---|---|---|---|---|---|
| **A — Borrados** | Quitar 25; broker off por defecto; `connectorTools` fuera de `paginateFor`; podar `CAPABILITY_MATRIX`; **arreglar `agent_tool_used`**; reescribir `docs/mcp/` (× es) y las filas de broker/collection en `.driftless/`, `skills/driftless/` e `install-skill.ts` | ~16 | **−1 500 / +130** | `mcp-e2e.mjs`, `surface-parity.spec.ts`, `tool-registry.spec.ts`, `docs-i18n-drift.mjs`, spec nuevo de `agent_tool_used` | `tools/list` = 28; cero alias resolubles de las borradas; docs sin nombre inexistente; el evento llega a PostHog |
| **B — Mercado (13→8)** | `MEXICAN_STATES` a contratos; `market_search` con `kind` + `filters` que rechaza; `market_get` con cobro por rama; renombres; `envelope.ts`; `mark_kind` a enum; descripciones y ejemplos | ~10 | **−260 / +560** | `market-data-tool.spec.ts`, `market-data-exposure.spec.ts` (a los 5 kinds), `contract-matrix.spec.ts`, `market-data-budget.spec.ts`, banco de Luna, **e2e de mercado nuevo** | `tools/list` < 80 KiB; banco sin regresión en `unresolved_refs=0`, `must_count` ni aciertos de estado; recibos idénticos |
| **C — Cerebro (9→5)** | `context_retrieve` absorbe search/list/get_for_files; envelope + `ref: topic:`; léxico y ejemplos | ~6 | **−420 / +260** | `mcp-e2e.mjs` (3 bloques), `retrieve-contract`, `canonical.contract.spec.ts` | `retrieve` responde en el golden los 3 casos que hoy responden 3 herramientas |
| **D — CRM + Empresas/contactos** | `crm_record` sin lecturas, `ref` por fila en las 3 de directorio, léxico Empresas≠Proveedores, metadatos en quote/unlock | ~7 | **−180 / +250** | `collection-query-tool.spec.ts`, `oauth-scopes.spec.ts`, `cli-e2e.sh` | Cero cambio en recibos; `cli-e2e.sh` no se mueve (si se mueve, se borró un endpoint por error) |
| **E — `DriftlessTool` + Luna al registro** | Mover `cognitive/tool-{registry,policy,citations}` a `libs/agent-tools`; el MCP declara `DriftlessTool` y deriva con `toMcpDescriptor` incrustando `examples`; `stages` en el tipo; `mcp.dynamic.ts`; Luna inyecta `ToolRegistry`; borrar `luna-tools.ts` y el despacho; mudar `anchorRow`/`capOutput`/`toLunaToolError`; aplicar las 22 correcciones de léxico (incluido `COUNT_LABEL` en lockstep con `TOOL_LABELS`) | ~20 | **−1 100 / +680** | `mcp-mapping.contract.spec.ts` (deja de ser oscuro y pasa a ser el gate), los 9 specs de `luna/`, banco completo, `pr-hardening.guard.spec.ts` | Una sola definición por herramienta en el repo; banco igual o mejor; `luna-boundary.spec.ts` intacto |

**Total −3 460 / +1 880 líneas, ~59 archivos. 12-14 días de un ingeniero con Claude** (A 1,5 · B 3,5 · C 2 · D 1,5 · E 4, más un día de margen en E). A-D son independientes y se mezclan una por una; E necesita A-D dentro.

## 6. Riesgos

| Riesgo | Cuán real | Mitigación |
|---|---|---|
| **Clientes externos con nombres guardados** | **Alto y comprobado.** Las 4 skills públicas `brein-*` nombran las 13 de mercado **con prefijo `driftless_`**, que ya hoy es alias oculto. | **Alias de llamada** para los 13 de mercado y los 3 de Cerebro fusionados, traduciendo argumentos, **durante una release (60 días)**. No salen en `tools/list`; devuelven el resultado normal más un `next_action` que nombra el reemplazo. Vencido el plazo, `Unknown tool` con el nombre nuevo. **Las 25 borradas no llevan alias**: 18 ya estaban fuera del catálogo y las otras 7 no tienen referencia externa. |
| **Las skills `brein-*` quedan mintiendo** | **Seguro**, se rompen en B. | Se reescriben **en el mismo PR que B**: 4 archivos, ~15 líneas. |
| **La skill `driftless` promete `collection` y `broker`** | **Seguro.** | Fase A edita `.driftless/skill.md`, `references/commands.md` y **la plantilla dentro de `install-skill.ts`** (la fuente que escribe la copia instalada); `references/broker.md` se borra. Verificar con `scripts/sync-skill.sh`. |
| **El sitio de docs** | **Medio.** La lista de retiradas es correcta; hay 3 herramientas inexistentes documentadas y 2 retiradas presentadas como vivas. | Fase A reescribe `docs/mcp/` y el espejo `docs/es/`; gate `docs-i18n-drift.mjs`; publicar con `scripts/sync-docs.sh`. |
| **El CLI** | **Ninguno.** Habla HTTP contra la API. | Editar `CAPABILITY_MATRIX` con excepciones tipadas o rompe CI. |
| **Fusionar 5 búsquedas revierte una decisión escrita** | **Real.** `market-data-tool.ts`: "There is intentionally no public action-router schema". | Esa decisión asumía que un router afloja el contrato; no lo hace si `filters` es cerrado por kind y **rechaza** la clave ajena, y la regla de §3 respeta lo que el banco 3 demostró. Juez: el banco de 20 briefs. Si pierde, B se revierte y el catálogo queda en 29. |
| **Perder el gate de exposición** (`X-Driftless-Model-Exposure: abstracted`, allowlist de argumentos) | Alto si se descuida al fusionar. | Invariante: la cabecera se sigue fijando en el adaptador, nunca es argumento; el allowlist **por kind** sustituye al de por acción, con `market-data-exposure.spec.ts` extendida a los 5 kinds. |
| **Decidir sin datos de volumen** | **Cierto, y no se resuelve a tiempo.** | El arreglo da datos desde ese día, no retroactivos. Ninguna decisión depende de ellos: lo borrado ya era invisible en `tools/list` (18) o no tiene una sola referencia externa (7). Revisar a los 30 días **contados desde el arreglo** si alguna KEEP sin documentación (`company_save`, `contact_select`) tiene tráfico cero. |
