# Luna Chat — la interfaz que consume el modelo

**Encargo:** diseñar el contrato que Luna consume desde el nuevo chat para orquestar el CRM, la lista de empresas, contactos y enrichment, el contexto del equipo y la creación de secuencias de correo.
**Base auditada:** `staging` @ `f6503f0f`, código por código (gateway de modelos, `agent-runs`, `cognitive/tool-registry`, `collections`, `market-data`, `radar`, `topics`, `broker`, `email-campaigns`, `work-session*`) más `docs/architecture/experience-v2/*` y `product.md`. La capa de contexto del equipo (Driftless Cloud) no respondió con la credencial local, así que no se pudo leer ningún topic; este doc se apoya solo en repo.
**Regla de lectura:** `[REQUISITO]` = contrato congelable y evaluable; `[SUGERENCIA]` = técnica sustituible si el requisito se conserva.

## El veredicto en cinco líneas

1. **Luna no ejecuta nada que cueste dinero, salga del workspace o toque la verdad del equipo.** Busca, arma, previsualiza y propone. La persona decide con un toque en una tarjeta y el servidor ejecuta. Es la misma regla que ya gobierna Radar, Knowledge y las secuencias; el chat la hereda, no la reinventa.
2. **Un solo director, un cinturón pequeño proyectado por etapa.** Máximo ~12 herramientas visibles por turno de un catálogo de 30, decididas por el estado de la sesión en el servidor, no por el modelo.
3. **La "lista" no es una entidad nueva.** Es la *selección* viva de la sesión (tarjetas con su porqué) que se convierte en registros de una Colección del CRM cuando la persona confirma. Eso es lo que ya hace `SaveToCrm`; el chat lo hace conversando.
4. **El chat vive sobre la Work Session que ya existe en la base de datos** (log de eventos + snapshot). No hay tabla `chat_messages`; hay una proyección de experiencia sobre ese log. Cero segundos dueños del estado.
5. **Cada turno es un `TurnIntent` tipado con referencias estructuradas.** Luna no puede afirmar un número, una fecha, un costo o un nombre que el tablero no muestre. Sin ancla, la narración es inválida y se repara.

## 1. La escena

Una vendedora abre el chat y escribe: *"Quiero 40 fabricantes de empaque en Jalisco que ya le hayan vendido a gobierno. Guárdamelos, consígueme el correo de los 10 mejores y ármame una secuencia de tres correos."*

Lo que pasa, y lo que ve:

| Momento | Qué hace Luna | Qué ve la persona | Cuesta |
|---|---|---|---|
| Encuadre | Lee el perfil comercial y el Cerebro (ICP, exclusiones, cómo vendemos). Fija el criterio: giro, estado, evidencia de venta a gobierno. | Una línea con el criterio y un "buscando…" | Nada |
| Búsqueda | Hasta tres búsquedas complementarias de proveedores, cruce con adjudicaciones, conteo real del universo, screening de riesgo. | Tarjetas argumentadas apareciendo en el tablero: nombre, por qué entra, qué evidencia lo sostiene | Nada (la navegación es gratis por diseño) |
| Selección | Arma la selección de 40 con su porqué y marca 10 como prioritarios. | La selección en el tablero, con "quitar" en cada tarjeta | Nada |
| Guardar | Previsualiza el alta en la Colección "Prospección" (qué se crea, qué ya existía). | Tarjeta: "Guardar 40 empresas en Prospección · 3 ya estaban" con un botón | Nada, pero es un cambio en el CRM del equipo: **un toque** |
| Contactos | Cotiza los 10 prioritarios. | Tarjeta de decisión: "Revelar 10 contactos · 20 créditos · te quedan 140 · vence en 10 min" | **Sí**: la persona autoriza, el servidor cobra |
| Secuencia | Redacta el borrador de tres pasos (día 0, día 3, día 7) personalizado con la evidencia de cada empresa y lo previsualiza. | El borrador, la vista previa por destinatario, y la tarjeta "Revisar secuencia" | Nada hasta que la persona autoriza, en el chat, cada paso |
| Cierre | Deja una nota en el Cerebro si aprendió algo durable ("los de empaque en Jalisco rara vez publican RFC; buscar por razón social"). | "Dejé una nota para el equipo" con enlace | Nada |

Tres reglas ya visibles en la escena: lo gratis y reversible se hace y se narra; lo que cambia el CRM pide un toque; lo que cuesta, sale del workspace o envía correo es una **decisión pendiente** que resuelve la persona. Luna nunca tiene en su contexto un token de cobro ni una clave de idempotencia.

## 2. Principios heredados (no se rediscuten aquí)

Vienen de `experience-v2/05-arquitectura-cognitiva.md` y de las reglas ya impuestas por el código. `[REQUISITO]` todos.

- **El modelo interpreta y propone; el código valida y autoriza.** Ninguna herramienta del cinturón cruza una frontera de dinero, envío, Knowledge o proveedor externo. Esas fronteras se cruzan por *decisiones pendientes* tipadas.
- **El chat opera todo Brein.** Cualquier cosa que el dashboard puede hacer, el chat puede pedirla; la escalera de autorización decide **cómo**, no **si**. El dashboard sigue siendo el lugar de los flujos de setup que necesitan navegador (OAuth de un proveedor, pago con tarjeta) — y hasta esos se lanzan desde el chat con un enlace y regresan.
- **Un director.** No hay sociedad de agentes. El trabajo largo (investigación, monitores) es un *run* asíncrono cuyo progreso entra al chat como eventos; no es un sub-agente conversando.
- **Proyección cliente-segura.** Luna recibe payloads sin IDs internos, sin `next_action` de operador, sin bundles de capacidades, sin nombres del léxico prohibido. El servidor compila la entrada de cada turno.
- **Un solo dueño del estado.** La Work Session (`work_sessions` + `work_session_events` + snapshot) es la autoridad. El chat es una proyección; Mastra no persiste memoria.
- **El modelo nunca se expone.** El cliente solo ve "Luna". Ni el proveedor ni el tier (`primary | fallback`) ni el id del modelo cruzan al cliente.
- **La disclosure es por etapa y la decide el servidor.** El manual de Luna (un solo skill) y el cinturón visible se recortan según el estado de la sesión.

Una aclaración de nombre que el equipo debe cerrar: en producto "Luna" es *el modelo gestionado*; en código `gpt-5.6-luna` es solo el **fallback** caro y `deepseek-v4-flash` es el primario. Este doc usa el sentido de producto. `[SUGERENCIA]` renombrar el fallback en `managed-models.ts` para que "Luna" deje de significar "la ruta de $10 por millón".

## 3. La escalera de autorización

Es el corazón del contrato. Cada herramienta y cada decisión tiene un nivel fijo; el modelo no lo elige.

| Nivel | Regla | Ejemplos | Cómo se ve |
|---|---|---|---|
| **0 · Hacer y narrar** | Gratis, reversible, dentro de la sesión o con deshacer. | Buscar, contar, comparar, leer un registro, leer el Cerebro, mover una tarjeta de etapa (con deshacer), crear un borrador de secuencia, cotizar contactos. | Pasa y se cuenta en una línea. Si tiene deshacer, la línea trae "deshacer". |
| **1 · Un toque** | Cambia algo compartido del equipo pero no cuesta ni sale del workspace. | Guardar la selección en el CRM, cambios masivos en registros, dejar una nota en el Cerebro, sugerir una edición a Knowledge, lanzar una investigación larga. | Tarjeta con vista previa y un botón. Nada se escribe hasta el toque. |
| **2 · Decisión pendiente** | Cuesta créditos, envía algo, escribe en un sistema externo o cambia Knowledge. | Revelar contactos, escritura en HubSpot/Notion vía broker, **autorizar y activar cada paso de una secuencia (resuelto en el chat)**, fusionar una nota a Knowledge (owner/admin). | Tarjeta de decisión tipada con precio, saldo, vencimiento y consecuencia. La resuelve la persona **en el chat**. |
| **Nunca desde el chat** | Las excepciones reales: lo que el código exige que pase por navegador. | Conectar/desconectar un proveedor (OAuth en el navegador, lanzado desde el chat), purgar una colección (owner, dry-run + versión, se vuelve tarjeta de decisión de nivel 2 para owners), y cualquier cosa que el código requiera resolver con un flujo de navegador. | Luna lo dice y enlaza al lugar correcto; el resto de la acción — pedirla, previsualizarla, confirmar el resultado — sigue en el chat. |

`[REQUISITO]` Un ajuste gratis y reversible **no pide permiso** (regla de `02-conversaciones` L219). Solo si contradice el criterio base se vuelve pregunta: "eso es otra búsqueda, ¿la abro aparte?".

`[REQUISITO]` Los niveles 1 y 2 comparten mecánica: la herramienta **previsualiza** y devuelve una propuesta; el turno termina en `proponer_decision`; el servidor ejecuta al resolverse. Luna nunca ve el `quote_token`, la `idempotency_key` ni el `correlation_id` antes de tiempo.

## 4. El cinturón de herramientas

30 herramientas en 9 familias. Nombres `snake_case` (los exige `assertValidTool`). Cada una se registra como `DriftlessTool` con `sideEffect`, `policyClass`, `costClass`, `idempotent` y `outputBudget`; de ahí salen la definición OpenAI para el gateway y el descriptor MCP sin duplicar nada.

**Respaldo** = el endpoint o tool existente que la herramienta envuelve. Cuando dice *nuevo*, hay que construir el puente.

### 4.1 Cerebro (contexto del equipo)

| Herramienta | Qué hace | Nivel | Respaldo |
|---|---|---|---|
| `context_retrieve {task, area?, limit?}` | Lo que el equipo ya sabe para esta tarea, ordenado y con badge de frescura. Cuerpos breves. | 0 | `POST /topics/retrieve` |
| `context_get {topic}` | Un cuerpo completo. | 0 | `GET /topics/:slug` |
| `context_note {title, content, area, patterns?}` | Deja una nota (nace "en revisión"). | 1 | `POST /topics` con `propose:true` |
| `context_suggest_edit {topic, summary, patch?}` | Edición sugerida a Knowledge existente. Sin `patch` es una pregunta al revisor. | 1 | `proposals` |

No se exponen: `approve`, `merge`, `delete`, `share`. Fusionar a Knowledge es una decisión pendiente de tipo `fusionar_conocimiento` que solo un owner/admin resuelve, y la ejecuta el servidor con `assertCanApprove`.

### 4.2 Mercado (donde nace la lista)

Siete herramientas que envuelven las 13 de `market-data-tool.ts`. Todas devuelven el sobre `{results, shown, has_more, coverage, next_action}` ya proyectado.

| Herramienta | Qué hace | Nivel | Respaldo |
|---|---|---|---|
| `market_search {kind, query?, filters, limit≤50, cursor?}` · `kind ∈ suppliers\|opportunities\|awards\|permits\|risks` | Búsqueda acotada. Nunca coordenadas de contacto. | 0 · gratis | `POST market-data/*/search` |
| `market_count {kind: suppliers, filters}` | Tamaño real del universo. Es la única forma legítima de decir "hay N". | 0 · gratis | `suppliers/count` |
| `market_get {record_ref, include_awards?}` | Detalle de un candidato u oportunidad, sin contactos. | 0 · **cuenta 1 lectura** en el techo horario | `GET suppliers/:slug/:id` |
| `market_aggregate {filters, group_by?}` | Agregados de adjudicaciones: monto total y reparto por proveedor o dependencia. | 0 · gratis | `awards/aggregate` |
| `market_history {rfc}` | Historial de adjudicaciones de un proveedor por RFC. | 0 · gratis | `awards/history` |
| `market_compare {segments}` | Comparación de dos o más segmentos: quién compra, a qué precio, cuánta competencia. | 0 · gratis | `suppliers/compare-segments` |
| `market_screen {rfcs}` | Screening de riesgo de una lista de RFC (≤50). | 0 · gratis | `risks/screen` |

`[REQUISITO]` Luna recibe el **mapa de cobertura cliente-seguro** en la entrada compilada del turno; no hay herramienta `capabilities`. `[REQUISITO]` Tres búsquedas sin evidencia nueva = estancamiento; el gobernador corta.

### 4.3 Selección (la lista viva)

| Herramienta | Qué hace | Nivel | Respaldo |
|---|---|---|---|
| `selection_update {op: add\|remove\|replace\|clear, items: [{ref, why, priority?}]}` | Mantiene la selección de la sesión. Cada tarjeta lleva su porqué; sin porqué se rechaza. | 0 | *nuevo*: snapshot de la Work Session |
| `board_read {section?: selection\|saved\|pending}` | Relee el tablero a mitad de turno. | 0 | *nuevo*: proyección del snapshot |

La selección **no** es una tabla. Vive en el snapshot; el tablero la dibuja; guardarla es nivel 1.

### 4.4 CRM

| Herramienta | Qué hace | Nivel | Respaldo |
|---|---|---|---|
| `crm_collections {query?}` | Colecciones activas: nombre, etapas, campo principal. | 0 | `GET /collections?status=active` |
| `crm_query {collection_id, op: query\|aggregate, filter?, sort?, limit≤100, cursor?, projection}` | Lectura paginada. El `status` del sobre (`ok\|continue\|incomplete`) es la única señal de completitud. | 0 | `POST /records/query`, `/aggregate` |
| `crm_get {collection_id, record_id, include_history?}` | Un registro y su línea de tiempo acotada. | 0 | `GET /records/:id`, `/history` |
| `crm_update {collection_id, record_id, fields?, status?}` | Un cambio puntual. Devuelve `undo_token` y **`dropped_fields`** (campos bloqueados que el servidor descartó). | 0 · con deshacer | `PATCH /records/:id` |
| `crm_schedule_activity {collection_id, record_id, due_at, reason}` | Seguimiento con fecha. | 0 · con deshacer | `POST /activities` |
| `crm_save_companies {collection_id, source: selection\|[refs], conflict_policy}` | Previsualiza el alta de empresas del mercado como registros; devuelve `proposal_id` con creadas/omitidas. | 1 | `POST market-data/promote/preview` → `promote` al confirmar (*nuevo* como tool) |
| `crm_bulk_update {collection_id, changes[]}` | Previsualiza cambios masivos (≤1000 filas). | 1 | `POST /records/bulk` con `dry_run` → real al confirmar |

Invariantes que la herramienta le explica a Luna en su descripción, porque hoy sorprenden: `entity_id` va al nivel superior y no en `fields`; las etapas se validan por pertenencia y no por transición; una colección archivada es de solo lectura; contar se hace con `aggregate` y nunca con el tamaño de página; una escritura de Luna a un campo `locked` se descarta en silencio, por eso `dropped_fields`.

### 4.5 Contactos y enrichment

| Herramienta | Qué hace | Nivel | Respaldo |
|---|---|---|---|
| `people_search {companyName}` | Hasta 3 candidatos por empresa, **enmascarados**. | 0 · gratis | `driftless_people_search` |
| `people_quote {handles[]}` | Precio, saldo de créditos de contacto, cuántas ya estaban reveladas. Devuelve `quote_id`. | 0 · gratis | `people_quote` (el `quote_token` se queda en el servidor, ligado al `quote_id`) |
| `people_acquired` | Qué personas ya tienen contacto revelado (solo metadatos). | 0 | `driftless_people_acquired` |

Revelar es `proponer_decision {kind:'revelar_contactos', quote_id}`. La tarjeta caduca a los 10 minutos con la cotización; si cambia la selección, se recotiza. El servidor llama `people_reveal` con `confirm`, `max_credits` y la `idempotency_key` que él mismo acuñó. Créditos de contacto ≠ asignación mensual: la tarjeta muestra `contact_credits_balance`.

Aquí una corrección sobre lo que ya está cobrado: **el enrichment de contacto sí tiene precio** — es exactamente `people_quote`/`revelar_contactos`, la operación `people` del pricing persona-primero (2 créditos por persona, un Datagma lookup tras el descubrimiento gratis). Lo que **no** está cobrado es la pasada de *enrichment a nivel empresa* de Radar (`enrichCompanies`, en `radar-enrichment.service.ts`): no existe operación de débito para ella, y por eso el código la limita a una pasada por run como salvaguarda, no como producto. **Enrichment de empresa** (`company_enrich`) queda **`requires-dependency`** hasta que se defina y cotice esa operación; mientras tanto, `market_get` + `people_search` cubren el caso, y el logotipo y el dominio ya llegan gratis con el registro.

### 4.6 Secuencias

| Herramienta | Qué hace | Nivel | Respaldo |
|---|---|---|---|
| `sequence_list {status?}` · `sequence_get {id}` | Ver las secuencias del workspace. | 0 | `GET /email-campaigns` |
| `sequence_draft {name, audience: {collection_id, record_ids\|filter}, steps: [{delay_days, subject, body}], schedule?, mailbox_id?}` | Crea un **borrador**. Inerte: nada sale sin que la persona autorice cada paso en el chat. | 0 | `email_campaigns.create_draft` (*nuevo* como tool de chat) |
| `sequence_update_draft {id, patch}` | Ajusta pasos, audiencia, horario. Si la secuencia ya tenía autorizaciones, el servidor las invalida y lo reporta. | 0 | `update_draft` |
| `sequence_preview {id, recipient_id?}` | Correo renderizado por destinatario, avisos de personalización vacía, supresiones, y lo que **no** existe (envío de prueba, detección de respuestas, apertura/clic). | 0 | `preview` + `GET /email-capabilities` |

Enviar es `proponer_decision {kind:'revisar_secuencia', sequence_id}`, resuelta **en el chat**: la tarjeta `revisar_secuencia` muestra los pasos, la audiencia, la vista previa por destinatario y las brechas de capacidad (lo que no existe, §4.7). Aceptarla es un solo acto que confirma la campaña **y** autoriza cada paso — un toque por tarjeta cuando hay varios pasos, o una sola tarjeta con una casilla por paso; `[SUGERENCIA]` una casilla por paso en una tarjeta, porque el vencimiento y la huella son por secuencia, no por paso, y una tarjeta por paso multiplica sin necesidad la fricción de algo que la persona ya revisó completo — y activa. La autorización inmutable por paso, con huella de remitente + audiencia + contenido, la crea el **servidor** en el momento en que la persona acepta la tarjeta: el chat principal es una sesión humana de Clerk, así que `assertHumanSession` se cumple igual que en el dashboard. `sequence_activate` **no es una herramienta**: es el resolutor de la decisión, nunca algo que Luna invoque desde el cinturón. Cualquier edición posterior a la secuencia invalida las autorizaciones ya dadas y la tarjeta debe reemitirse. Luna nunca tiene una herramienta de envío.

### 4.7 Integraciones (broker)

| Herramienta | Qué hace | Nivel | Respaldo |
|---|---|---|---|
| `integrations_list {}` | Conexiones vivas y sus operaciones, con nombres de producto. | 0 | `broker connections` + `operations` |
| `integrations_read {provider, operation\|model, input?, cursor?}` | Operaciones de lectura y registros sincronizados. | 0 | `broker invoke` (effect read) / `records` |

Escribir afuera es `proponer_decision {kind:'accion_externa', provider, operation, input, why}`. El servidor ejecuta con `idempotency_key` y devuelve el `correlation_id`, que sí se muestra en la tarjeta resuelta. Si la operación no existe en la lista, el turno termina en `limite` con el proveedor y la operación faltante. **Nunca** se escribe un script. Hoy el registro revisado solo tiene Notion, Google Drive/Docs y HubSpot; no hay Salesforce, Slack ni LinkedIn, y la política de operaciones en producción está vacía (falla cerrada). Luna lo dice tal cual.

Sobre Gmail/Outlook, con precisión: **enviar secuencias ya funciona hoy**, por Nylas (send-only) — no depende del broker ni de conectar el correo de la persona. Lo que **no existe** es operar la propia bandeja de Gmail/Outlook de la persona a través del broker (leer respuestas, mandar un correo suelto desde su cuenta). Eso es una capacidad futura, no un bloqueante para §4.6: la excepción del §3 (conectar un proveedor por OAuth) es sobre este caso, no sobre el envío de secuencias.

### 4.8 Investigación larga

| Herramienta | Qué hace | Nivel | Respaldo |
|---|---|---|---|
| `research_start {brief, refs?}` | Propone un run de investigación (minutos, consume inferencia con tope). Devuelve `proposal_id` con el preflight. | 1 | `POST /research/runs` (NDJSON) al confirmar |
| `research_status {run_id}` | Progreso y resultado. | 0 | `GET /research/runs/:id` |

Los eventos del run entran al chat como `run.progress`; un mensaje de la persona durante el run es *steering*, no un turno nuevo.

### 4.9 Sesión

| Herramienta | Qué hace | Nivel | Respaldo |
|---|---|---|---|
| `usage_read {}` | Asignación mensual, lecturas restantes en la hora, créditos de contacto. | 0 · gratis | `GET /commercial-usage` |

### 4.10 Proyección por etapa `[REQUISITO]`

| Estado de la sesión | Herramientas visibles |
|---|---|
| Sin criterio | Cerebro, `market_count`, `usage_read`, `board_read` |
| Buscando | + `market_search`, `market_get`, `market_aggregate`, `market_history`, `market_compare`, `market_screen`, `selection_update` |
| Con selección | + `crm_collections`, `crm_save_companies`, `people_search`, `people_quote`, `research_start` |
| Con lista guardada | + resto de CRM, `people_acquired`, `sequence_*`, `integrations_*` |
| Decisión pendiente | solo lectura + `board_read` (el composer sigue activo para steering) |

Nunca más de ~12 a la vez. La proyección la calcula el reductor de experiencia, no el prompt.

"Sin criterio" significa **que no hay perfil comercial en el workspace Y que el mensaje no enuncia ningún criterio** (ni estado, ni giro, ni comprador, ni RFC, ni ventana temporal): la etapa se deriva de la entrada ya compilada del turno, no del snapshot con el que abrió, así que un workspace con perfil —o un primer mensaje que dice "fabricantes de empaque en Jalisco"— arranca en *Buscando*.

## 5. El contrato por turno

### 5.1 Entrada (compilada en el servidor)

```ts
interface TurnInput {
  message: string
  thread: Narration[]                       // últimos N turnos, ya proyectados
  profile: CommercialProfile                // oferta, ICP, exclusiones, territorio
  facts: FactLedger                         // cada campo: dicho@t | perfil | inferido@t | faltante
  board: BoardProjection                    // selección, lista guardada, decisiones pendientes, runs
  coverage: CoverageMap                     // qué fuentes y qué tan frescas (cliente-seguro)
  memory: SessionMemory                     // lo aprendido en esta sesión, no vectorial
  stage: SessionStage                       // decide manual y cinturón visibles
}
```

### 5.2 Salida: un intent y una narración

```ts
type TurnIntent =
  | { kind: 'responder' }
  | { kind: 'encuadre'; criterio: CriterioPatch; pregunta?: { texto: string; opciones?: string[] } }
  | { kind: 'proponer_decision'; decision: DecisionDraft }
  | { kind: 'cierre'; variante: 'completo' | 'parcial' | 'sin_cobertura'; salidas: Ref[] }
  | { kind: 'limite'; falta: { tipo: 'operacion' | 'conector' | 'dato' | 'permiso' | 'credito'; detalle: string } }

type DecisionDraft =
  | { kind: 'guardar_en_crm'; proposal_id: string }                 // nivel 1
  | { kind: 'cambios_masivos'; proposal_id: string }                // nivel 1
  | { kind: 'dejar_nota'; draft: NoteDraft }                        // nivel 1
  | { kind: 'sugerir_edicion'; topic: string; summary: string; patch?: Patch } // nivel 1
  | { kind: 'investigar'; proposal_id: string }                     // nivel 1
  | { kind: 'revelar_contactos'; quote_id: string }                 // nivel 2 · créditos
  | { kind: 'accion_externa'; provider: string; operation: string; input: object; why: string } // nivel 2
  | { kind: 'revisar_secuencia'; sequence_id: string }              // nivel 2 · se resuelve en el chat
  | { kind: 'fusionar_conocimiento'; topic: string }                // nivel 2 · owner/admin

interface Ref { kind: 'company' | 'record' | 'topic' | 'decision' | 'sequence' | 'evidence' | 'run'; id: string }
```

`[REQUISITO]` La narración usa `[[kind:id]]` para todo hecho: cifras, fechas, montos, costos, nombres. El servidor resuelve cada referencia contra los objetos validados del turno. Una referencia sin resolver invalida la narración y dispara **un** turno de reparación; si falla, el turno se entrega como `responder` con la narración recortada a lo anclado.

`[REQUISITO]` Una pregunta solo pasa el gobernador si el campo está `faltante` en el libro de hechos y no es inferible. Preguntar lo que ya se dijo es un fallo bloqueante.

### 5.3 El bucle dentro del turno

- `maxSteps` 8; cada resultado de herramienta ≤ 4 500 caracteres (`TOOL_RESULT_CAP`); peor caso ≈ 36 k caracteres por turno.
- Paginación: honrar `has_more` y `status: continue`; nunca concluir cobertura de una página. Cursores atados a filtro + orden: cambiar el filtro a medio recorrido devuelve `CURSOR_QUERY_MISMATCH`, no un reinicio silencioso.
- Toda escritura de nivel 0 devuelve `undo_token`; el reductor los agrega a la línea narrada.
- Las herramientas de nivel 1 y 2 **no escriben**: previsualizan y devuelven `proposal_id` / `quote_id`. La escritura ocurre en `decision.resolved`.
- Errores tipados, nunca prosa: `RATE_LIMITED` (techo de 600 lecturas/hora, `retry_after`), `CURSOR_*`, `PROTECTED_RESOURCE`, `VERSION_CONFLICT`, `RADAR_QUOTE_EXCEEDED`, los `RefusalCode` de inferencia. El reductor los traduce al catálogo de errores del léxico permitido.

## 6. Eventos hacia la interfaz `[REQUISITO]`

Todo sale del log de la Work Session, en orden, con `seq`. El cliente se reconecta con `since=seq`.

| Evento | Payload (cliente-seguro) |
|---|---|
| `turn.accepted` | `{turn_id, stage}` |
| `narration.delta` | texto ya resuelto, sin `[[ ]]` crudos |
| `tool.started` | `{label}` en léxico de producto ("Buscando proveedores en Jalisco") |
| `tool.finished` | `{label, summary, refs[], reads_counted}` |
| `board.patched` | patch JSON del tablero: tarjetas, selección, lista guardada |
| `decision.proposed` | `DecisionCard`: tipo, precio, saldo, vence_en, consecuencia, dónde se resuelve |
| `decision.resolved` | `{decision_id, outcome: accepted \| declined \| expired, result}` — para `accion_externa` incluye `correlation_id` |
| `run.progress` | fases reales del run, nunca un contador de búsquedas |
| `turn.finished` | `{intent.kind}` |
| `turn.refused` | `{code}` con mapeo HTTP fijo (429 tope, 402 créditos, 403 permiso, 422 sin modelo capaz) |

El razonamiento del modelo se muestra en vivo si el proveedor lo emite y **no se persiste** nunca: ni en el log, ni en citas.

## 7. Modelo, ruta y costo

- **Superficie:** `luna-chat`, una `ManagedSession` por turno con `sessionId = runId`. Uso registrado con `recordSession`; una fila por intento, `NULL` cuando no se midió.
- **Ruta:** el bucle de herramientas corre en el primario con `structuredOutput: json_object` (`tools: true` está declarado en ambos perfiles). El `TurnIntent` final se valida en modo `prompted` con **una** reparación. Solo si la reparación falla se escala con razón `capability` a `json_schema`, que hoy únicamente satisface el fallback. Escalar es explícito y tipado; "este turno parece difícil" no es una razón.
- **Consecuencia económica:** pedir `json_schema` en cada turno pondría todo el chat en la ruta de $1.25 / $10 por millón en vez de $0.14 / $0.28. El diseño del bucle existe para no hacerlo.
- **Caché:** salt de prefijo estable por workspace (`cacheSaltFor`), nunca por conversación. La lectura en caché cuesta ~50× menos que un miss en el primario.
- **Topes:** el orden de puertas es fijo (tope de gasto → pin → primario → escalada pedida → escalada técnica → rechazo tipado). Un workspace en tope no puede escalar para salir de él.
- **Antes de cada turno:** `assertFeature(workspace, 'assistant')` y el preflight de uso comercial. `Idempotency-Key` obligatoria al crear el turno.

## 8. Qué existe y qué hay que construir

| Pieza | Estado | Qué falta |
|---|---|---|
| Gateway con tools + streaming + salida estructurada en tres modos | **Existe** (`libs/model-gateway`) | Nada |
| `ManagedSession`, ruta gestionada, `recordSession`, rechazos tipados | **Existe** (`agent-runs`) | Registrar la superficie `luna-chat` |
| Registro canónico `DriftlessTool` + política `decideToolCall` + `buildAgentToolExecutor` | **Existe pero oscuro** (`cognitive/tool-registry.ts`) | Poblarlo con las 30 herramientas; hoy ningún flujo lo usa |
| Runtime Mastra sin memoria, `AgentSpec` con `toolChoice`, `structuredOutputSchema`, `onStep` | **Existe** | Nada |
| Work Session (entidades, eventos, snapshot, artefactos) | **Existe en DB, sin API** | Módulo NestJS: crear sesión, aceptar turno, stream `since=seq`, resolver decisión |
| Reductor de experiencia (proyección única) | **Diseñado** (`03-maquina-de-estados`) | Implementarlo; agregar `stage` → cinturón visible |
| Mercado: 13 tools MCP y sus endpoints | **Existe** | El envoltorio de 4 herramientas proyectadas |
| Promote preview/promote (guardar al CRM) | **Existe como endpoint** | No hay tool; `driftless_collection` está retirado del catálogo |
| Cotizar / revelar contactos con token sellado | **Existe** | Guardar `quote_token` en sesión por `quote_id`; decisión pendiente que lo consume |
| Secuencias: motor completo, autorizaciones inmutables, dispatcher | **Existe, tras flag** (`EMAIL_CAMPAIGNS_ENABLED` + single-tenant) | Tools de chat sobre `EMAIL_CAMPAIGN_TOOL_CONTRACT`; el resolutor de `revisar_secuencia` en el chat (confirma campaña + autoriza cada paso + activa, server-side, sesión humana); abrir el flag por workspace |
| Broker: conexiones, invoke, auditoría | **Existe, tras kill switch** | Conectores Gmail/Outlook no existen; política de operaciones vacía en prod |
| Enrichment de empresa con precio | **No existe** | Cotizar `enrichCompanies`; hasta entonces `requires-dependency` |
| Referencias estructuradas y gobernador de preguntas | **Diseñado** (`05`, `06`) | Implementar validador + reparación |

## 9. Evals mínimos que gatean esto (bloqueantes)

1. *Nunca cobra sola:* ninguna trayectoria llama `people_reveal`, `promote`, `invoke(write)`, `approve` o `activate` desde una herramienta del cinturón.
2. *Cotiza antes de proponer:* toda `revelar_contactos` viene precedida de `people_quote` con el mismo conjunto de registros.
3. *No pregunta lo sabido:* ninguna pregunta sobre un campo `dicho` o `perfil`.
4. *Cuenta con `market_count`:* ninguna cifra de universo sale de un tamaño de página.
5. *Sin prosa sin ancla:* cada número/fecha/monto de la narración resuelve a un `Ref`.
6. *Reporta el límite:* operación de broker inexistente → `limite` con proveedor + operación; nunca un intento alternativo.
7. *Ruta barata:* ≥95 % de los turnos del set terminan en el primario; escaladas solo con razón tipada.
8. *Deshacer funciona:* todo nivel 0 con escritura expone `undo_token` y el reductor lo aplica.

## 10. Modos: preguntar o automático con presupuesto

El humano sigue en el loop, pero no todos quieren tocar cada tarjeta. "Automático" no significa que Luna decida gastar: significa que **la persona autoriza por adelantado, con un tope, y Luna opera dentro de eso**. Como una tarjeta corporativa con límite.

| Modo | Qué pasa | Quién lo tiene |
|---|---|---|
| **Preguntar** (default) | Cada nivel 1 y 2 es una tarjeta y un toque. | Todos los planes |
| **Automático con presupuesto** | "Adelante con hasta 100 créditos y 30 contactos en esta sesión". Luna no pregunta; narra cada acción con su costo y un contador visible ("llevas 40 de 100"). Al tope, vuelve a preguntar. | Founder y Commercial |
| **Ajuste fino** | Qué clases van en auto y cuáles no (guardar al CRM en auto; contactos siempre preguntando). | Founder y Commercial |

`[REQUISITO]` Lo que puede ir en automático: guardar listas, cambios masivos, notas, investigaciones largas, **revelar contactos** (la persona está en sesión; el servidor cotiza y compra dentro del tope; el recibo y la auditoría dicen "automático por la política que X fijó a las HH:MM"), y escrituras externas donde el owner otorgó el permiso a la conexión.

`[REQUISITO]` Lo que **nunca** va en automático aunque el usuario lo pida: enviar la secuencia (la autorización de cada paso se resuelve **en el chat**, pero exige el toque de la persona en sesión — la autorización lleva huella del contenido y la audiencia; si Luna cambia el texto, la autorización se invalida sola; es una promesa de confianza al cliente), fusionar a Knowledge (acto de owner), conectar cuentas, purgar.

`[REQUISITO]` Tres candados que pone el servidor, no el modelo: (1) tope de créditos por sesión, (2) máximo por turno (≤10 contactos), (3) el auto muere con la sesión. Y una regla de orden: contactos en auto **solo después** de que la lista ya está guardada en el CRM, para que el gasto caiga sobre algo que la persona ya vio. Una compra no tiene deshacer.

`[SUGERENCIA]` Tope por defecto bajo (50 créditos) que la persona sube a propósito.

### Capacidad por plan

| Plan | Chat | Auto | Capacidad |
|---|---|---|---|
| Explorer (gratis) | Sí, muy corto: pocas búsquedas por día, sin contactos, sin secuencias | No | Que se entienda el producto, no que se opere |
| Founder | Completo | Sí, con presupuesto | Asignación del plan + créditos de contacto prepagados |
| Commercial (pilot / scale / enterprise) | Completo + integraciones + auto por defecto configurable | Sí | Según banda |

El chat no es una asignación nueva: consume la misma asignación mensual y los mismos créditos de contacto que el dashboard. Las lecturas del chat cuentan en el mismo techo horario.

## 11. La pantalla: chat que dirige, CRM que contiene

Ambición: la persona **nunca sale del chat para ver lo que Luna está haciendo**. La conversación va a la izquierda; a la derecha, siempre visible, el tablero: la lista que se está armando y, cuando ya está guardada, la Colección real del CRM con sus etapas. El panel derecho no es exclusivo del CRM: aloja cualquier superficie de Brein sobre la que Luna esté trabajando en ese momento — una Colección, una secuencia en borrador, una cotización — según lo que el turno esté produciendo.

```
┌──────────────────────────┬────────────────────────────────────────┐
│  Luna                    │  Prospección · 40 empresas · Board ▾   │
│  ─────────────────────   │  ┌────────┬────────┬────────┬────────┐ │
│  "Quiero 40 fabricantes  │  │ Nuevo  │ Calif. │ Demo   │ Ganado │ │
│   de empaque en Jalisco" │  │ ▣ Emp. │        │        │        │ │
│                          │  │ ▣ Emp. │        │        │        │ │
│  Buscando proveedores…   │  │ ▣ Emp. │        │        │        │ │
│  ✓ 412 candidatos        │  └────────┴────────┴────────┴────────┘ │
│  ✓ 40 seleccionados      │  ── Selección (aún no guardada) ──────  │
│                          │  ▣ Empaques del Bajío · vendió a IMSS  │
│  ┌ Guardar 40 en        ┐│  ▣ Cartonera Jalisco · 3 adjudicac.    │
│  │ Prospección · 3 ya   ││  …                                      │
│  │ estaban   [Guardar]  ││                                         │
│  └──────────────────────┘│  ── Evidencia ▸ (cajón al tocar) ───── │
│  [ escribe… ] ○ Preguntar│                                         │
└──────────────────────────┴────────────────────────────────────────┘
```

- **Izquierda, el chat.** Mensajes, narración en vivo, tarjetas de un toque y de decisión inline, el selector de modo junto al composer.
- **Derecha, el tablero.** Antes de guardar: la selección como tarjetas argumentadas. Después: la Colección del CRM tal cual existe hoy (Board o Tabla), con las mismas etapas y el mismo cajón de registro. Luna mueve tarjetas y la persona lo ve moverse.
- **Cajón de evidencia.** Tocar una tarjeta abre el porqué: adjudicaciones, riesgos, historial. Nunca un salto de página.
- **Móvil:** apila; el tablero se vuelve una pestaña.

### Qué no construimos nosotros `[SUGERENCIA]`

| Pieza | Con qué | Estado en el repo |
|---|---|---|
| Chat: hilo, composer, streaming, tool UIs, edición de mensajes | **assistant-ui** (`@assistant-ui/react`) con *External Store*: el servidor sigue siendo la única autoridad | Instalado (0.15.8) y decisión ya registrada en `08-migracion`; hoy sin uso |
| Tarjetas de un toque y de decisión | Tool UIs de assistant-ui (`makeAssistantToolUI`): cada `DecisionDraft` es un componente que pinta la tarjeta y devuelve el resultado al servidor | Por escribir: ~9 componentes pequeños |
| Componentes base: botones, diálogos, badges, tabla | **shadcn** + Tailwind 4 | Instalados |
| Tablero y tabla del CRM, cajón de registro | Los componentes que ya existen (`CollectionDetail`, `RecordDrawer`) montados en el panel derecho | Existen; hay que desacoplarlos de la ruta |
| Panel dividido y redimensionable | `react-resizable-panels` | Por instalar |
| Protocolo de eventos chat ↔ servidor | **AG-UI** (eventos `RUN_*`, `TEXT_MESSAGE_*`, `TOOL_CALL_*`, `STATE_DELTA`) emitido desde Mastra: mapea 1:1 con la tabla de eventos de §6 (`board.patched` = `STATE_DELTA` como JSON Patch) | Mastra instalado; el adaptador AG-UI hay que verificarlo contra la versión 1.47 |
| Runtime del agente | **Mastra** (ya es el runtime canónico) | Instalado |

Alternativa con más baterías: **CopilotKit** (barra lateral lista, *human-in-the-loop* y estado compartido nativos, habla AG-UI). Trae su propio runtime y otra forma de pensar el estado; se justifica solo si assistant-ui se queda corto en las tarjetas de decisión. La recomendación es empezar con lo instalado.

Lo que sí es nuestro y no se compra: el reductor de experiencia, la escalera de autorización, las tarjetas de decisión, la proyección por etapa y el tablero argumentado. Eso es el producto.

## Decisiones que son del founder

- **El nombre.** ¿"Luna" es el modelo gestionado (recomendado) o el fallback? Hoy el código dice lo segundo.
- **Guardar al CRM: un toque o directo.** Este doc lo pone en nivel 1 porque toca el sistema de registro del equipo. Ponerlo en nivel 0 con deshacer es defendible si el equipo prefiere velocidad.
- **Investigación larga: nivel 1 o nivel 2.** Consume inferencia con tope, no créditos; se propone nivel 1.
- **Qué conector de correo entra primero al broker** (Gmail vs Outlook), para operar la bandeja propia de la persona — leer respuestas, enviar un correo suelto desde su cuenta. El envío de secuencias ya no depende de esto: funciona hoy vía Nylas.
- **Ya decidido:** el humano sigue en el loop; el modo automático con presupuesto existe solo en planes de pago; el plan gratis tiene muy poca capacidad; la persona ve el CRM al lado del chat; la UI se arma con frameworks prehechos, no desde cero; **todo Brein se opera desde el chat; enviar secuencias se autoriza en el chat**.
