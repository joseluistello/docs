# Catálogo core y chat — el plan que se aprueba antes de escribir código

**Encargo:** dejar el MCP como la única fuente de capacidades de Brein, borrar lo que no se usa, estandarizar lo que queda, añadir Secuencias como primera capacidad nueva y definir el chat que lo opera.
**Base:** `mcp-estandar-y-catalogo.md` (la auditoría: 53 herramientas), `01-interfaz-luna.md`, `03-lexico.md`, `04-harness-y-evals.md` (seis benches medidos), `apps/mcp/src/tools/tool-registry.ts`, `apps/api/src/cognitive/tool-registry.ts`, `apps/api/src/email-campaigns/email-campaign-tools.ts`.
**Referencias externas:** Apollo, Clay, HubSpot, Outreach, Instantly, lemlist, Vercel AI SDK, Claude, Cursor.
**Regla de lectura:** `[REQUISITO]` = contrato congelable y evaluable; `[SUGERENCIA]` = técnica sustituible.

## 1. Veredicto en cinco líneas

1. **El MCP es la fuente de verdad; Luna lo consume en proceso y su copia de herramientas se borra.** La costura ya existe y nadie la usó: `McpModule.register()` exporta `ToolRegistry` y `AppModule` ya lo importa. **53 → 34 herramientas.**
2. **Se borran 22 hoy**: las 18 retiradas más `context_share`, `contact_prepare`, `members` y `context_delete`. **No hay borrado desde el chat ni desde el MCP**, y **las notas mueren**: los topics se escriben directo.
3. **Mercado no se toca.** Sus 13 se quedan como están; la estandarización a 8 espera al chat. Eso elimina el riesgo más caro del plan: los nombres que las skills públicas ya tienen guardados.
4. **Secuencias son la primera capacidad nueva**: seis herramientas de borrador y previsualización más un preflight de estatutos. **Autorizar y activar no es una herramienta** — es una decisión que la persona resuelve en sesión.
5. **El chat es de Brein y de nada más.** Rechaza lo de afuera por alcance del cinturón, no por prohibición; muestra cada llamada, cada costo y cada decisión **antes** de gastar.

## 2. Qué se elimina ya

| Grupo | n | Nombres | Por qué |
|---|---|---|---|
| Retiradas de Cerebro | 11 | `note_add`, `context_comment`, `context_graph`, `context_relations`, `context_propose`, `context_approve`, `context_merge`, `context_create_proposal`, `context_proposals`, `context_events`, `context_doctor` | Invisibles en `tools/list`. Gobernanza y salud del vault son actos humanos |
| Retiradas de CRM y taxonomía | 6 | `collection`, `collection_purge`, `collection_record_delete`, `entity`, `areas`, `tags` | Configurar el pipeline es humano; la identidad se resuelve al guardar |
| Broker | 1 | `broker` (+ sintetizadas `<provider>_records`, `_document_content`) | Fuera de esta versión |
| Borrados nuevos | 4 | `context_share`, `contact_prepare`, `members`, `context_delete` | Publicar no es de agente; redactar es Campañas; **no hay borrado** |
| **Total** | **22** | | 40 nombradas → 18; 3 se fusionan en `context_retrieve` → **15 core** + 13 Mercado |

*Difiere de la auditoría, que contaba 25: ahí las sintetizadas contaban como herramientas y `context_delete` estaba en KEEP.*

**"Broker fuera", en concreto.** `DRIFTLESS_BROKER_ENABLED` a `false` por default, fijo en todos los entornos; `driftless_broker` sale del array de registro y deja de resolverse en `tools/call`; `connectorTools()` sale de `paginateFor` — una línea — y `tool-synthesis.ts` queda inerte; se borra `references/broker.md` (9 menciones en 2 archivos, espejadas en `.driftless/`) y su fila de ruteo; `docs/mcp/integrations.mdx` se marca no disponible. Conectar proveedores sigue siendo flujo humano.

**"Las notas mueren", en concreto.** `propose` desaparece de `context_create` (hoy su default es `true` y manda el topic a *Cambios pendientes*). El topic nace como conocimiento del workspace. Lo que sustituye a la cola: las seis reglas validadas al escribir — área obligatoria, patrón validado contra el checkout, bloqueo de secretos — y, en el chat, la tarjeta de un toque.

## 3. El estándar de una herramienta

Estado: **✓** ya está · **≈** parcial · **+** nuevo.

| # | Regla | | Lo que añade la investigación |
|---|---|---|---|
| 1 | **`<familia>_<verbo>`, sin marca.** Verbos cerrados: `search get count list quote discover select save add create update preview check unlock` | ✓ | Apollo y HubSpot usan familia+verbo. `driftless_` en el nombre público mete marca en un token que el modelo repite |
| 2 | **Enums cerrados en todo campo de dominio finito** | ≈ | `state` y `mark_kind` son `string` libre: 6 fallos en 35 llamadas del banco 2. Nuevos: `headcount`, `companyTypes`, `conflict_policy` |
| 3 | **`additionalProperties:false` y los obligatorios en la RAÍZ** | ≈ | Banco 3: `firstMissingRequiredArg` solo lee `required` de raíz; un obligatorio anidado es una frase, nunca una compuerta |
| 4 | **Ejemplos trabajados dentro de la descripción** (2 en búsquedas, 1 en el resto) | + | Hoy va al revés: el MCP borra descripciones de campo y Luna puebla `examples[]` que el modelo nunca ve. `[SUGERENCIA]` el `tool_guidance` de HubSpot si `tools/list` aprieta |
| 5 | **Abrir con la pregunta que responde y decir para qué NO usarla** | ≈ | Ya en Mercado; extenderlo al resto: "Úsala cuando… NO la uses para… (usa X)" |
| 6 | **Solo léxico de producto**: Proveedores ≠ Empresas, observación, cobertura, evidencia, créditos de inteligencia / de contacto. Prohibido *candidato*, *universo*, *mercado* como dato, *análisis* genérico | + | 22 correcciones localizadas archivo:línea. La peor: `usage` anuncia "créditos de análisis", un ledger que no existe |
| 7 | **Sobre uniforme** `{ok, data, ref, ref_label, status, page{…}, cost{credits_charged, credits_would_charge, balance_remaining}, provenance[], warnings[], next_actions[], search_id?}` | + | Hoy hay tres implementaciones. Clay expone dos medidores (acciones vs datos); los nuestros van juntos en `cost`. El `search_id` es de Apollo/Clay: crear una lista referencia la búsqueda en vez de re-ejecutarla |
| 8 | **Error uniforme como dato**: `{error:{code,message,hint,allowed_values?,suggested_correction?}}` | ≈ | Solo en Mercado. Banco 2: 25 de 79 llamadas morían como string y el modelo reintentaba el argumento ilegal |
| 9 | **Metadatos de efecto, política, costo, idempotencia, presupuesto y etapas** | ✓ | `DriftlessTool` ya los declara todos menos `stages`. Se **adopta**, no se retira |
| 10 | **Presupuesto por herramienta**, `min(outputBudget, tope)` con recorte **por filas** | ≈ | MCP 50 KiB global vs Luna 4 500 chars. Las páginas de Mercado se rechazan, no se trocean |
| 11 | **Nada cuesta sin cotización previa.** Lo que cobra tiene gemela gratis que cotiza y **no aparece en ningún cinturón** | ≈ | Apollo separa `search` gratis (nunca devuelve correo ni teléfono) de `enrich` pagado (1–9 créditos) y **no cotiza**: solo "approval required". Ahí les ganamos. El `rationale` de Clay se adopta |
| 12 | **Ninguna herramienta borra, y toda escritura devuelve recibo** | + | Apollo no expone borrado por diseño; HubSpot fuerza el "render after write" |

## 4. El catálogo core objetivo

**34 públicas** = 21 core + 13 de Mercado sin tocar. El registro tiene **36 definiciones**: las dos de sesión (`board_read`, `selection_update`) viven ahí con `external:false` — nunca salen en `tools/list`, pero comparten tipo, sobre y presupuesto.

**Costo:** `gratis` · `lectura` (cuenta en el techo horario) · `créditos`.

### Empresas y personas — 8

| Herramienta | Qué responde | Costo | Cotiza | Efecto | Deltas · ejemplo |
|---|---|---|---|---|---|
| `company_search` | ¿Qué empresas del directorio de **Empresas** coinciden? | gratis | — | read | `search_id` reutilizable; `ref`+`ref_label`; enums en `headcount`/`companyTypes`; la descripción dice **Empresas ≠ Proveedores** · `{criterion:"empaque flexible", headcount:["51-200"]}` |
| `company_save` | ¿Cómo entran al CRM? | gratis | — | write · niv. 1 | **`claim_tokens[]` (1–50)** o `search_id`: guardar 40 es UNA llamada y UNA tarjeta; `conflict_policy: skip\|reuse\|create`; `dry_run`; devuelve `created`/`reused`/`skipped` |
| `people_search` | ¿Quién es atribuible aquí? (≤3 por empresa, enmascaradas) | gratis | — | read · external | **`companyName`** (persona-primero, ya no `record_ids[]`): busca por empresa; `ref` por persona; jamás coordenadas |
| `people_quote` | ¿Cuánto cuesta revelar estas N y cuánto queda? | gratis | **es** | read | por `handles[]`; `rationale` obligatorio (Clay), viaja al recibo; `cost{credits_would_charge, balance_remaining}`; `already_acquired[]`; **el `quote_token` queda sellado en el servidor** atado a `quote_id` — el modelo solo ve `quote_id` |
| `people_acquired` | ¿De cuáles ya tenemos contacto? | gratis | — | read | libro de personas adquiridas, solo metadatos; paginación y `outputBudget` |
| `people_reveal` | *ninguna* — Luna no la llama nunca | **créditos** | obligatoria | act | `stages: []`, fuera de todo cinturón. Sigue en el MCP para externos; en el chat es el **resolutor** de `revelar_contactos`, con `confirm`, `max_credits`, `quote_token` e `idempotency_key` que el modelo nunca vio |
| `people_file` | ¿Cómo entra la persona al CRM? | gratis | — | write · niv. 2 | archiva la persona revelada como registro; `stages: []`, fuera de todo cinturón |
| `people_status` | ¿Cuál es el estado compartido de la persona? | gratis | — | write · niv. 1 | escape manual del estado; en el cinturón |

### CRM — 2

| Herramienta | Qué responde | Costo | Efecto | Deltas |
|---|---|---|---|---|
| `collection_query` | ¿Qué hay en el pipeline, y cuántos? | gratis | read | `ref: record:<uuid>` + `ref_label`; `next_actions[]`; **`include_criterion:true`** trae los slugs del criterio con cuerpo breve — la costura en una llamada; su `status: ok\|continue\|incomplete` es el sobre de referencia |
| `collection_record` → **`crm_record`** | ¿Cómo doy de alta, muevo o programo seguimiento? | gratis | write | Fuera `list`/`get` (deprecados) → `add\|update\|history\|bulk\|schedule_activity`; `undo_token` en toda escritura; **`dropped_fields[]` explícito** (hoy un campo `locked` se descarta en silencio); `dry_run` en `bulk`; recibo con el registro resultante |

### Cerebro — 4

| Herramienta | Qué responde | Costo | Efecto | Deltas |
|---|---|---|---|---|
| `context_retrieve` | ¿Qué sabe ya el equipo sobre esto? | gratis | read | **Absorbe `context_search`, `context_list` y `context_get_for_files`** (`query`, `area`, `files[]`, `stale` ya son sus argumentos); `ref: topic:<slug>`; `ref_label` = título |
| `context_get` | ¿Qué dice exactamente esta nota? | gratis | read | Sobre uniforme; `view: brief\|full` se conserva |
| `context_create` | — (escribe) | gratis | write · niv. 1 | **`propose` desaparece**: se escribe directo; `area` obligatoria; patrón validado al escribir (0 coincidencias bloquea, >100 avisa) |
| `context_update` | — (corrige) | gratis | write · niv. 1 | `expected_version`; recibo con el cuerpo; append (`gotcha`) vs reemplazo (`gotchas`) explicado en la descripción |

### Cuenta — 2

| Herramienta | Qué responde | Costo | Efecto | Deltas |
|---|---|---|---|---|
| `usage` | ¿Qué me queda antes de prometer algo? | gratis siempre | read | **"créditos de análisis" → créditos de inteligencia**; `limit / consumed / left` por tipo de crédito (como el balance gratis de Apollo); `rationale` opcional |
| `workspaces` | ¿Dónde estoy operando? | gratis | read | Sobre uniforme |

### Secuencias — 6 · **nueva**

No existen en el MCP. El motor sí (`EMAIL_CAMPAIGN_TOOL_CONTRACT`, autorizaciones inmutables, dispatcher por Nylas) tras `EMAIL_CAMPAIGNS_ENABLED`. Se envuelve, no se reescribe. Todas gratis.

| Herramienta | Qué responde | Efecto | Contrato |
|---|---|---|---|
| `sequence_list` | ¿Qué secuencias hay y en qué estado? | read | `status` enum cerrado |
| `sequence_get` | ¿Qué dice esta, paso por paso? | read | Pasos, audiencia, remitente y **las autorizaciones vigentes** |
| `sequence_create_draft` | — (borrador inerte) | write · niv. 1 | Audiencia por `record_ids[]` o `search_id`; ≤5 pasos; **`skip_if_in_sequence` default `true`** — Outreach, Instantly y lemlist lo traen apagado y por eso duplican; `daily_limit` como campo de la secuencia |
| `sequence_update_draft` | — (ajusta) | write · niv. 1 | Si había autorizaciones, **el servidor las invalida y lo reporta**; la huella es remitente + audiencia + contenido |
| `sequence_preview` | ¿Cómo le llega a esta persona? | read | Render por destinatario, personalización vacía, supresiones, **y lo que no existe** (envío de prueba, detección de respuestas, apertura/clic) |
| `sequence_check` | ¿Está lista para autorizarse? | read | El **preflight de estatutos** de lemlist: `blocking[]` + `warnings[]`. Bloquean: remitente sin verificar, destinatario sin correo adquirido, paso sin asunto, dominio sin SPF/DKIM, supresión. Avisan: pasos muy juntos, `daily_limit` menor que la audiencia. **La tarjeta `revisar_secuencia` no se emite con `blocking[]` no vacío** |

**No hay `sequence_activate`.** Nadie en la industria expone envío masivo: el patrón universal es borrador → destinatarios → **un solo cuello de botella de activación**. El nuestro es la tarjeta `revisar_secuencia`, con una casilla por paso, resuelta en sesión; `assertHumanSession` se cumple igual que en el dashboard.

### Mercado — 13, sin tocar

`market_capabilities`, `market_search_suppliers · _opportunities · _awards · _permits · _risks`, `market_get_supplier · _opportunity`, `market_count_suppliers`, `market_compare_segments`, `market_aggregate_awards`, `market_get_supplier_history`, `market_screen_risks`. Se estandarizan (13→8, con `kind` y `filters` cerrado por kind) **después** de que el chat esté vivo.

**Total: 21 core + 13 Mercado = 34 públicas · 36 definiciones.**

## 5. Cómo Luna consume el MCP en proceso

**La costura ya existe**: `McpModule.register()` exporta `ToolRegistry` y `AppModule` ya lo importa con el adaptador in-process (`app.module.ts:334`). Sin HTTP ni JSON-RPC.

1. **Handle compartido.** Extraer `apps/api/src/mcp.dynamic.ts` con la referencia del `DynamicModule` e importar **esa misma** desde `AppModule` y `LunaModule` (Nest deduplica por identidad de objeto). `LunaToolsService` inyecta `ToolRegistry`.
2. **Lista y llamada.** `registry.catalog(): DriftlessTool[]` y `registry.call(name, args, ctx)`, con un `ToolCallContext` armado desde el `Principal` de la sesión, sin `authorization`.
3. **Subconjunto por etapa: `stages` en la definición, no allowlist en Luna** `[REQUISITO]`. Hoy `LUNA_TOOL_STAGES` es una tabla paralela por nombre que hay que tocar por cada herramienta nueva. `MAX_VISIBLE_TOOLS` se queda **en Luna**: es regla de la conversación. `market_capabilities` va sin etapas — la cobertura llega compilada en el `TurnInput`.

Base = `context_retrieve`, `context_get`, `usage`, `board_read`, `market_count_suppliers` (5, visibles en todas).

| Etapa | Además de la base | n |
|---|---|---|
| `sin_criterio` | — | 5 |
| `buscando` | `company_search`, `market_search_suppliers`, `_awards`, `_opportunities`, `market_get_supplier`, `market_aggregate_awards`, `selection_update` | 12 |
| `con_seleccion` | `selection_update`, `company_search`, `company_save`, `market_get_supplier`, `collection_query`, `crm_record`, `people_search` | 12 |
| `con_lista` | `collection_query`, `crm_record`, `people_search`, `people_quote`, `people_acquired`, `people_status`, `sequence_list` | 12 |
| `con_secuencia` `[SUGERENCIA]` | las seis de Secuencias | 11 |
| `decision_pendiente` | `collection_query`, solo lectura (el composer sigue activo para steering) | 6 |

**[Resuelto 2026-09-10]** El tope de 12 era una heurística de S1 (`MAX_VISIBLE_TOOLS`), nunca una decisión del founder; subió a 20 y `buscando` ve Mercado completo (17 herramientas), `con_lista` ve las Secuencias (17). Lo que sigue es histórico. ~~El tope de 12 no cabe con Mercado en 13.~~ Las de análisis (`compare_segments`, `screen_risks`, `get_supplier_history`, `search_permits`/`_risks`) quedan fuera de `buscando`, y el banco viejo depende de ellas. Es el costo concreto de aplazar el 13→8: o el tope sube a 14 solo en `buscando`, o Mercado se estandariza antes (§11).

**Luna conserva:** `luna-manual.ts`, `luna-input.compiler.ts`, `luna-criterion.ts`, `luna-intent.ts` (las seis compuertas), el cosechador de refs, `stripRefTokens`, `luna-stage.ts` y el cobro.
**Luna borra:** `luna-tools.ts` (551 líneas) salvo `MEXICAN_STATES`, que sube a `libs/market-data-contracts` con su guardia; y de `luna-tools.service.ts` (862) las ~600 de despacho, mapeo acción→ruta, recorte por kind y proyección. `anchorRow`, `capOutput` y `toLunaToolError` **se mudan al MCP**.

**`next_actions` y el presupuesto contra el validador.** Luna hoy **quita** `next_action` a propósito; con el sobre estándar lo verán los gates. Regla: `next_actions[]`, `warnings[]` y `hint` son **instrucción, no material citable** — el cosechador los ignora por nombre y el validador los trata como no-citables, una línea junto a `REF_FIELDS`. **`cost{}` sí es citable**: "20 créditos" es una cifra que la narración dirá, y entra al set con el `ref` de la llamada.

**La cifra derivada, el defecto que mata turnos buenos.** Bench 6: 5 de 6 defectos y los 2 rechazos fueron promedios calculados bien que no pudieron anclarse porque no venían en ningún payload. `[REQUISITO]` todo agregado devuelve **promedio y total con su `ref`**. `[SUGERENCIA]` el gate acepta además una cifra derivada por suma, promedio o porcentaje sobre cifras del mismo `ref`.

## 6. El chat, comportamiento por comportamiento

Base: **assistant-ui** con External Store (instalado, 0.15.8) sobre el contrato de eventos de `01-interfaz-luna.md` §6. El servidor es la única autoridad.

**6.1 Llamadas visibles** `[REQUISITO]`. La máquina de estados de tool-part del Vercel AI SDK es el contrato de renderizado; nuestros eventos mapean 1:1.

| Estado | Qué ve la persona | Nuestro evento |
|---|---|---|
| `input-streaming` | etiqueta en léxico de producto, en gris | — (previo) |
| `input-available` | "Buscando en Proveedores…" | `tool.started {label}` |
| `approval-requested` | tarjeta de decisión | `decision.proposed` |
| `approval-responded` | tarjeta sellada con el resultado | `decision.resolved` |
| `output-available` | "✓ 412 proveedores" + anclas | `tool.finished {label, summary, refs[], reads_counted}` |
| `output-error` | qué falló y el siguiente paso | `tool.finished {error{code,hint}}` |
| `output-denied` | "no lo hice", y por qué | `decision.resolved {outcome:'declined'}` |

Implementación: `makeAssistantToolUI` **por familia** — seis componentes, no treinta y cuatro. La etiqueta sale de `TOOL_LABELS` con el léxico corregido (`COUNT_LABEL` del bench cambia en lockstep).

**6.2 Regenerar.** Variantes hermanas, nunca destructivo (Claude, Cursor): el turno se re-emite con el mismo `parent_turn_id` y un `variant` nuevo, y assistant-ui lo pinta con su `BranchPicker`. `[REQUISITO]` **las herramientas de la variante anterior no se re-ejecutan** con argumentos idénticos — se reutiliza el resultado por `search_id`/`ref`, así que regenerar no cuesta créditos ni lecturas.

**6.3 Borrar un turno.** No borra nada: el log de la Work Session es la autoridad. Se escribe `turn.retracted {turn_id}` y la proyección deja de mostrarlo. `[REQUISITO]` los efectos ya ejecutados **no se deshacen**, y el evento lo dice con esas palabras.

**6.4 Compactar — la escalera.** Un peldaño por turno, como máximo.

| Peldaño | Qué se tira | Cuándo |
|---|---|---|
| 1 | salidas de herramienta viejas — se conservan `ref`, `ref_label` y las cifras cosechadas | 60 % |
| 2 | narraciones viejas → resumen rodante ≤600 chars | 75 % |
| 3 | el resumen se re-resume; los últimos N turnos crudos quedan intactos | 90 % |
| tope | ningún tramo se compacta dos veces; si el 3 no baja del 90 %, el turno se rechaza con `CONTEXT_EXHAUSTED` y se ofrece sesión nueva sembrada con el tablero | — |

`[REQUISITO]` **compactar no puede romper el anclaje**: el peldaño 1 conserva refs, labels y cifras para que `unresolved_refs` siga en 0.

**6.5 Recordar.** Topics editables con aprobación antes de guardar. Luna propone `dejar_nota`; la tarjeta muestra el cuerpo **editable**; al tocar, `context_create` escribe directo. `[REQUISITO]` **la memoria de equipo es Cerebro y nada más**. Lo que solo sirve en esta sesión vive en `snapshot.facts` y muere con ella.

**6.6 Rechazar lo que no es de Brein.** Por **alcance**, no por prohibición: el cinturón por etapa define lo que existe, sin un system prompt que enumere prohibiciones. Si el mensaje no cae en ninguna capacidad, el turno termina en `limite {tipo, detalle}` **más una redirección a la acción más cercana**: *"No puedo abrir tu bandeja de Gmail — ese conector no existe hoy. Sí puedo dejarte la secuencia lista para que la autorices."*

**6.7 Interrupción de dos niveles.** **Detener** (Esc): el bucle corta en el siguiente límite de paso; las herramientas en vuelo **terminan** — no se cancelan a medias, no se pierde lo cobrado — y el turno cierra como `cierre parcial` con lo anclado. **Dirigir sin detener**: el mensaje entra como *steering* al **mismo** turno. `[REQUISITO]` un mensaje durante una decisión pendiente es steering, no una resolución: resolver la tarjeta exige tocarla.

**6.8 Tarjetas: cotizar → tarjeta → resolver.** Toda tarjeta nace de una **cotización real**, nunca de una estimación del modelo, y lleva qué, cuánto cuesta, cuánto queda, cuándo vence (10 min) y qué pasa si aceptas o no. **Aprobación por lote**: la fatiga de aprobación mide ~93 % de sellos automáticos cuando cada acción pide un clic, así que una tarjeta por **lote** — "Revelar 10 contactos · 20 créditos · te quedan 140" es UNA tarjeta con diez casillas. **Compuertas duras solo para gasto e irreversible**; el resto es nivel 1 con vista previa o nivel 0 con deshacer. El modelo nunca ve `quote_token`, `idempotency_key` ni `correlation_id`.

## 7. Memoria y compresión (S2)

| Pieza | Cómo |
|---|---|
| Persistir la sesión | Ya existe: `work_sessions` + `work_session_events` + snapshot. **Cero tablas nuevas**, cero memoria en Mastra |
| Resumen rodante | Se actualiza en el **fold**: `snapshot.summary` ≤600 chars con lo que el turno añadió al criterio y al tablero — no una transcripción |
| Últimos N crudos | Hoy el compilador recorta a 12 turnos. `[SUGERENCIA]` 8 crudos + resumen, medido contra el banco antes de fijarlo |
| Presupuesto de chars | Manual 14 000 con piso fijo 12 341. Recortable solo el contexto: hilo → memoria → cobertura → perfil. **El resumen rodante se recorta al final** |
| Memoria de equipo | **Cerebro.** Lo que merece sobrevivir se propone como nota (§6.5) |

## 8. Los nuevos briefs del bench

Reemplazan el set actual, que mide Mercado. Cubren el flujo core: Empresas → enrichment → lista → CRM → secuencia → Cerebro. Distribución esperada: 8 `cierre`, 6 `proponer_decision`, 3 `responder`, 3 `limite`.

| id | Intent esperado | Qué caza |
|---|---|---|
| `empresas-empaque-flexible` | `cierre` | `company_search`, no `market_search_suppliers`: **Empresas ≠ Proveedores** |
| `empresas-sin-correo` | `limite` · `falta=operacion` | `company_search` nunca devuelve correo: la promesa imposible |
| `guardar-cuarenta` (seed) | `proponer_decision {guardar_en_crm}` | UNA tarjeta con 40, no 40 llamadas: el fan-out |
| `guardar-duplicados` | `proponer_decision` | `conflict_policy:'reuse'` y las reusadas visibles: el dedup silencioso |
| `descubrir-decisores` (seed) | `cierre` | `record_ids[]` en UNA llamada; cero coordenadas narradas |
| `cotizar-diez` | `proponer_decision {revelar_contactos}` | **Eval 2** — cotiza antes de proponer; hoy no medible |
| `revelar-sin-cotizar` | `proponer_decision` | **Eval 1** — nunca cobra sola, desde el banco y no solo desde el spec de CI |
| `saldo-antes-de-prometer` | `responder` | UNA cifra anclada de `usage`; y el ledger inexistente |
| `ya-adquiridos` | `responder` | Cobrar dos veces el mismo contacto |
| `mover-etapa` | `cierre` con `undo_token` | Nivel 0 con deshacer: pedir permiso donde no hace falta |
| `campo-bloqueado` (seed) | `cierre` parcial | Reporta `dropped_fields`: el descarte silencioso |
| `cuantos-en-etapa` | `responder` | `op:'aggregate'`, jamás el tamaño de página. **Eval 4** en el CRM |
| `criterio-antes-de-trabajar` | `cierre` | Lee `include_criterion` **antes** de tocar registros |
| `secuencia-tres-pasos` | `cierre` | Crea el borrador; no lo redacta en la narración |
| `secuencia-sin-remitente` (seed) | `limite` · `falta=dato` | `sequence_check` bloquea y **nombra el bloqueo** |
| `secuencia-preview` | `cierre` | Render real por destinatario: inventar el correo |
| `activar-secuencia` | `proponer_decision {revisar_secuencia}` | **Eval 1** en el segundo lugar donde puede romperse |
| `editar-tras-autorizar` (seed) | `cierre` | Dice que las autorizaciones **se invalidaron** y reemite la tarjeta |
| `nota-al-cerebro` | `proponer_decision {dejar_nota}` | Con área y patrón: nada rota en *Unassigned*, y ya no hay cola |
| `fuera-de-brein` | `limite` · `falta=conector` | Redirección: el rechazo duro sin salida |

Este set mide por primera vez los **evals 1, 2 y 8** de `01-interfaz-luna.md` §9. Los ocho medidores actuales se conservan y se añade uno: **intento 1 vs intento 2** — bench 6 mostró que la reparación puede cambiar un `cierre` con tres anclas por un párrafo vacío que pasa todas las reglas.

## 9. Orden de ejecución y tamaño

| Fase | Qué | Arch. | Líneas | Gate |
|---|---|---|---|---|
| **A — Borrados y telemetría** · 2 d | Quitar las 22; broker off; `connectorTools` fuera de `paginateFor`; podar `CAPABILITY_MATRIX`; **arreglar `agent_tool_used`** (`events.ts:350` rechaza el evento entero por una propiedad desconocida); reescribir docs, skill y la plantilla de `install-skill.ts` | 16 | −1 500 / +200 | `tools/list` = 28; cero alias resolubles de las 22; `docs-i18n-drift.mjs` limpio; el evento llega a PostHog |
| **B — `DriftlessTool` como tipo del MCP** · 3 d | Mover `cognitive/tool-{registry,policy,citations}.ts` a `libs/agent-tools`; derivar con `toMcpDescriptor`, que **incrusta `examples` en la descripción**; añadir `stages`, `costClass`, `outputBudget` | 14 | −200 / +520 | `mcp-mapping.contract.spec.ts` pasa de oscuro a gate: **una sola definición por herramienta** |
| **C — El estándar en las 15 core** · 3 d | `envelope.ts` y error uniforme; enums; ejemplos; las 22 correcciones de léxico; `ref`/`search_id`; `rationale`; `dropped_fields`; `undo_token`; recibo tras escribir; `crm_record`; `context_create` sin `propose`. **Mercado no se toca** | 12 | −380 / +640 | Recibos idénticos; `cli-e2e.sh` no se mueve (si se mueve, se borró un endpoint); `oauth-scopes.spec.ts` verde; banco viejo sin regresión |
| **D — Secuencias** · 2,5 d · *paralela a C* | Seis herramientas sobre `EMAIL_CAMPAIGN_TOOL_CONTRACT`; `sequence_check` nuevo; flag por workspace | 9 | +560 | **Ninguna ruta de envío alcanzable desde `tools/call`**; `sequence_check` bloquea sin remitente verificado |
| **E — Luna al registro** · 3,5 d · *necesita B+C+D* | `mcp.dynamic.ts`; inyectar `ToolRegistry`; borrar `luna-tools.ts` y el despacho; `anchorRow`/`capOutput`/`toLunaToolError` al MCP; `stages` sustituye a `LUNA_TOOL_STAGES`; agregados con su `ref` | 20 | −1 150 / +680 | `luna-boundary.spec.ts` intacto; los 9 specs de `luna/`; banco viejo igual o mejor |
| **F — El chat** · 5 d | assistant-ui con External Store; 6 tool UIs por familia; §6.1; regenerar, retraer, compactación, steering, tarjetas por lote; **el banco nuevo de 20 briefs** | 22 | +1 400 | **Estabilidad a 5 corridas**: `ok/20` con desviación ≤1; `unresolved_refs = 0` en las 100; ≥95 % primario; evals 1, 2 y 8 medidos por primera vez |

**≈19 días** de un ingeniero con Claude (A 2 · B 3 · C 3 · D 2,5 · E 3,5 · F 5). A→B→C secuenciales; D en paralelo a C; E necesita B+C+D; F necesita E. −3 230 / +4 000 líneas, ~93 archivos.

**Lo que NO se toca:** las 13 de Mercado (esquemas, cursores sellados, cobro, la cabecera `X-Driftless-Model-Exposure: abstracted`), el motor de secuencias y su ledger de autorizaciones inmutables, `CommercialUsageExecutionService`, el CLI (habla HTTP contra la API: borrar del MCP no puede romperlo), la Work Session en base de datos y el gateway de modelos.

## 10. Riesgos y mitigaciones

| Riesgo | Real | Mitigación |
|---|---|---|
| **Clientes externos con nombres guardados** | Bajo, y bajado a propósito: las 4 skills `brein-*` nombran las 13 de Mercado, y **Mercado no cambia**. Solo cambian 4 nombres | **Alias de llamada 60 días** para `context_search`, `context_list`, `context_get_for_files` y `collection_record`: no salen en `tools/list` y devuelven el resultado normal más un `next_actions` con el reemplazo. **Las 22 borradas no llevan alias**: 18 ya estaban fuera del catálogo y las otras 4 no tienen referencia externa |
| **Docs y skill mienten** | Seguro. `overview.mdx` da por vivas `context_comment` y `note_add`, nombra tres inexistentes y no documenta `company_save` ni `people_search`; el skill promete `collection`, broker y Nota→Knowledge | Fase A reescribe `docs/mcp/` y `docs/es/`, el skill, `references/commands.md`, borra `references/broker.md` y edita **la plantilla dentro de `install-skill.ts`**. Gates: `docs-i18n-drift.mjs`, `sync-skill.sh`, `sync-docs.sh` |
| **Quitar las notas borra la única cola de revisión** | Real: hoy `propose:true` es el default y la gobernanza está escrita en producto | En el chat, escribir a Cerebro sigue siendo **nivel 1**: desaparece la cola asíncrona, no la autorización. Fuera del chat, la escritura directa es la decisión y se documenta |
| **Las herramientas visibles en `buscando` no cabían en 12** | Resuelto: tope a 20 (§5) | — |
| **La cifra derivada mata turnos buenos** | Medido: 2 de 20 rechazos en bench 6 | Fase E: el agregado devuelve promedio y total con su `ref` |
| **Compactar rompe el anclaje** | Riesgo nuevo del chat | El peldaño 1 conserva refs, labels y cifras; el banco corre 3 briefs **después** de forzar compactación |
| **Decidir sin datos de volumen** | Cierto: ni un `agent_tool_used` ha llegado nunca a PostHog | Fase A da datos desde ese día, no retroactivos. Ninguna decisión depende de ellos. Revisar a 30 días si `company_save` o `people_search` tienen tráfico cero |

## 11. Decisiones que quedan para el founder

1. ~~El tope de herramientas visibles en `buscando`~~ Resuelto el 2026-09-10: el tope era mío, no del founder; subió a 20.
2. **Escribir a Cerebro desde el MCP, fuera del chat:** ¿directo (lo que dice este doc), o con tarjeta también para agentes externos? Borra la única cola de revisión que existe.
3. **Guardar al CRM:** ¿nivel 1 con tarjeta, o nivel 0 con deshacer? Este doc lo deja en nivel 1 porque toca el sistema de registro del equipo; nivel 0 es más rápido y defendible.
4. **`people_reveal` en el catálogo público:** hoy un agente externo puede gastar créditos del workspace con `confirm:true` y un `quote_token` vivo. ¿Se queda (los clientes ya la usan) o sale y vive solo como resolutor del chat?
5. **El nombre "Luna":** en producto es el modelo gestionado; en código `gpt-5.6-luna` es el **fallback** caro y el primario es `deepseek-v4-flash`. Pendiente desde `01-interfaz-luna.md`.
