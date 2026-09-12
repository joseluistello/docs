# 00 · Plan maestro — Luna Chat

> La asistente se llama Ada desde 2026-09-10; "Luna" en nombres de código (carpetas, módulos, tablas, rutas del API, este documento) es el nombre interno.

Documento vivo. Se actualiza ola por ola sin reescribirse: los estados cambian, la Bitácora crece, el resto se toca solo por decisión del founder. Ver §9.

## 1. Norte

Un chat top, totalmente especializado en Brein — no un asistente genérico con acceso a Brein. El humano sigue en el loop: Luna busca, arma y propone; la persona decide y el servidor ejecuta. El MCP es la fuente de la verdad que Claude, ChatGPT y Luna consumen por igual — un solo catálogo, no tres integraciones distintas.

## 2. Decisiones tomadas

Append-only: una decisión aquí no se borra, se supera con una nueva fechada.

| # | Fecha | Decisión |
|---|---|---|
| 1 | 2026-09-10 | Humano en el loop: Luna nunca ejecuta sola lo que cuesta, sale del workspace o toca la verdad del equipo. |
| 2 | 2026-09-10 | Todo Brein se opera desde el chat; el dashboard deja de ser el único lugar donde algo se hace. |
| 3 | 2026-09-10 | Enviar una secuencia se autoriza en el chat, un toque por paso — nunca en automático. |
| 4 | 2026-09-10 | Modo automático con presupuesto existe solo en planes de pago; Explorer (gratis) tiene muy poca capacidad, sin auto. |
| 5 | 2026-09-10 | El CRM vive al lado del chat; el panel derecho aloja lo que Luna esté trabajando en ese momento (selección, Colección, secuencia, cotización), no solo el CRM. |
| 6 | 2026-09-10 | Luna habla el vocabulario del sidebar del dashboard — Proveedores, Licitaciones, Adjudicaciones, Registros, Cerebro — no sinónimos inventados. |
| 7 | 2026-09-10 | El MCP es la fuente de la verdad. Luna lo consume en proceso (misma app, sin red); su copia de trabajo se borra al cerrar el turno, no se persiste aparte. |
| 8 | 2026-09-10 | Se elimina del catálogo lo ya no usado: las 18 retiradas del inventario + `context_share`, `contact_prepare`, `members`, `broker`, y toda herramienta de borrado/purga (`collection_purge`, `collection_record_delete`). |
| 9 | 2026-09-10 | No hay borrado desde el chat ni desde el MCP. "Deshacer" mueve un registro a la etapa Descartado; nunca hay un DELETE real detrás de una herramienta de agente. |
| 10 | 2026-09-10 | Las notas sueltas mueren como concepto de producto de agente; se consume Knowledge por topics directos (`context_retrieve`/`context_get`), no un buzón de notas aparte. |
| 11 | 2026-09-10 | Core primero: Empresas y contactos, CRM, Cerebro en lectura, saldo/uso, secuencias. Todo lo demás espera. |
| 12 | 2026-09-10 | Mercado no es core de esta ronda; se estandariza después, sobre el mismo formato de herramienta que el core. |
| 13 | 2026-09-10 | El broker (integraciones externas) queda fuera de esta versión completa. |
| 14 | 2026-09-10 | Luna corre sobre un único modelo (OpenAI); salida estructurada estricta desde el primer pase, no como escalada. |
| 15 | 2026-09-10 | Mastra corre el bucle de herramientas sin memoria propia; el servidor es el único dueño del estado. |
| 16 | 2026-09-10 | La memoria de una sesión es: diario de eventos (append-only) + foto (snapshot) + resumen rodante — nunca un vector store paralelo. |
| 17 | 2026-09-10 | La UI se arma con piezas prehechas: assistant-ui para el hilo, shadcn para los átomos, los componentes del CRM que ya existen para el tablero, `react-resizable-panels` para el panel dividido. |
| 18 | 2026-09-10 | Forma de trabajo de esta iniciativa: la base primero (motor headless antes que pantalla); un plan escrito y el sí del founder antes de escribir código; Fable orquesta, los subagentes escriben; una capa de instrumentación por medición real (nunca una métrica sin bench detrás); se mide el objeto completo antes que reducirlo a un número suelto. |
| 19 | 2026-09-10 | Luna ve TODAS las herramientas del MCP siempre (salvo las de nivel 2, que solo existen como tarjeta). La etapa orienta las instrucciones; nunca oculta herramientas. El filtro por etapa y el tope de herramientas visibles eran heurísticas de S1, no decisiones, y costaron "¿cómo va mi pipeline?" sin poder leer el CRM. |
| 20 | 2026-09-10 | "Chat" reemplaza a "Prioridades" en el sidebar y como destino por defecto tras iniciar sesión; la pantalla Inbox y todo lo relativo a Prioridades se elimina. La ruta es `/w/:slug/chat`. |
| 21 | 2026-09-10 | Referencia visual del Chat (supera a la 5 en lo del panel derecho): las conversaciones viven en el sidebar principal en una sección "Chats" con "Nuevo chat"; cabecera con título del chat, menú y "Nuevo chat"; el turno de Luna muestra su nombre, UNA línea gris con lo que hizo y el texto; los resultados van en línea como tarjeta dentro del hilo (lista con acciones por fila y una acción en lote), sin panel derecho; compositor centrado y ancho con adjuntar y enviar; acciones pequeñas bajo el turno (copiar, regenerar, comentar). |

## 3. Estado actual

Commit base: `f19865d4` — "el motor de turno de Luna, headless, con su bench" (`apps/api/src/luna/`).

| Existe | Dónde |
|---|---|
| Motor de turno headless | `luna-turn.service.ts` |
| Contratos (`TurnInput`, `TurnIntent`, `DecisionDraft`, `Ref`) | `luna.contracts.ts` |
| Compilador de la entrada del turno | `luna-input.compiler.ts`, `luna-criterion.ts` |
| Instrucciones del manual por etapa | `luna-manual.ts` |
| Validador de intent (parse/schema/refs/pregunta/léxico/cifra) | `luna-intent.ts` |
| Candados de frontera (escaneo de texto en CI) | `luna-boundary.spec.ts` |
| Bench de 20 briefs, 6 corridas | `luna/bench/` — bench 6: **13/20 medido, 15/20 real** (la reparación degradó un `cierre` correcto a `responder` vacío; ver `04-harness-y-evals.md` §3) |

| No existe todavía | Consecuencia |
|---|---|
| Memoria persistida (sesión, eventos, snapshot leído) | Cada corrida de bench es stateless; no hay hilo real |
| Endpoints (`luna.controller.ts`) | Nada expuesto fuera del proceso del bench |
| Pantalla (`apps/dashboard/src/luna/` no existe) | Cero superficie visible para el founder |
| Resolutores de decisión (`luna-decisions.service.ts`) | Ninguna tarjeta de nivel 1/2 se puede aceptar todavía |
| Escrituras de cualquier tipo | S1 es 100 % lectura; nada cobra, nada guarda, nada envía |

## 4. Carriles y olas de la primera noche

Tres carriles en paralelo: **MCP** (limpia y estandariza el catálogo que todos consumen), **Memoria** (persiste la sesión), **Pantalla** (construye contra un stream simulado mientras Memoria no esté lista). Se integran al final.

| Ola | Paquete | Modelo | Archivos | Puerta | Estado |
|---|---|---|---|---|---|
| MCP · 1 | Limpiar + partir: retirar 18+4, dividir el catálogo en Cerebro/Mercado/CRM | sonnet | `apps/mcp/src/tools/tool-registry.ts`, `mcp.controller.ts`, `.driftless/skill.md`, `references/broker.md` (borrar), `docs/mcp/*` | Catálogo compila; `tools/list` no lista ninguna retirada; alias temporal para las 13 de mercado nombradas por skills externas | verde |
| MCP · 2 | Estándar core (Empresas/contactos, CRM, Cerebro lectura, saldo) + secuencias + briefs | opus | `apps/mcp/src/tools/tool-synthesis.ts`, `contract-matrix.spec.ts`, `apps/api/src/luna/luna-tools.ts` (contrato compartido) | Toda tool nueva tiene `sideEffect`/`policyClass`/`costClass`/`idempotent`; `contract-matrix.spec.ts` verde | verde |
| MCP · 3 | Luna corre sobre el MCP (no sobre su propio backing) + rebench | sonnet | `luna-turn.service.ts`, `luna-tools.service.ts`, `luna/bench/run-bench.ts` | Bench 7 ≥ bench 6 en `ok/20`; 0 regresiones en refs/lexico | verde (con la costura MCP · 5) |
| MCP · 4 | Estabilidad: 5 corridas, revisión de frontera, PR | sonnet | `luna-boundary.spec.ts`, PR de la ola | 5/5 corridas ≥15/20 real; candados verdes; PR abierto | pendiente: bench en la máquina del founder |
| Memoria · sesión | Persistir `work_sessions` + `work_session_events` + snapshot | sonnet | `luna-session.service.ts` (nuevo), `luna.module.ts` | Un turno sobrevive un restart del proceso | verde (migración sin correr contra base real) |
| Memoria · resumen | Resumen rodante sobre el hilo recortado a 12 turnos | opus | `luna-input.compiler.ts` | Hilo de 30 turnos sigue cabiendo en el presupuesto de 14 000 chars | verde |
| Memoria · endpoints | `POST /sessions`, `POST /sessions/:id/turns`, `GET /sessions/:id` | sonnet | `luna.controller.ts` (nuevo) | Los tres endpoints responden con `Idempotency-Key` obligatoria | verde (sin base real) |
| Memoria · stream | `GET /sessions/:id/events?since=` SSE + reconexión | sonnet | `luna.controller.ts`, cliente `subscribeLunaEvents` | Reconexión con `since=seq` no repite ni pierde eventos | verde (sin base real) |
| Pantalla · ruta + historial | Ruta `/w/:slug/luna`, carga de historial al abrir | sonnet | `apps/dashboard/src/App.tsx`, `luna/Luna.tsx` (nuevo) | Abrir la ruta pinta el último snapshot sin recargar dos veces | verde |
| Pantalla · hilo assistant-ui | Adaptador *External Store* contra **stream simulado** primero | sonnet | `luna/lunaRuntime.ts` (nuevo) | Narración en vivo con eventos fabricados, sin backend real | verde |
| Pantalla · filas de herramienta | 7 estados de una fila de herramienta en curso | opus | `luna/ToolRow.tsx` (nuevo) | Los 7 estados son visualmente distintos y sin parpadeo al encadenarse | verde |
| Pantalla · tarjetas | Tool UIs de decisión (una por `DecisionDraft.kind`) | opus | `luna/cards/*.tsx` (nuevo) | Cada tarjeta previsualiza y no ejecuta nada hasta el toque | verde |
| Pantalla · acciones de turno | Regenerar / borrar / compactar / recordar | sonnet | `luna/Composer.tsx` (nuevo) | Las cuatro acciones no rompen el `seq` del log | verde |
| Pantalla · panel dividido | `react-resizable-panels`, chat izquierda / tablero derecha | sonnet | `luna/Luna.tsx` | Redimensionar no pierde el scroll de ninguno de los dos paneles | verde |
| Integración | Los tres carriles contra el mismo turno real, de punta a punta | opus | todo lo anterior | El founder abre `/luna`, pide algo real, ve narración + tarjeta + tablero sin mock | verde en puertas; falta correr contra base y modelo reales |

**Reglas de la noche:** el contrato de eventos (§6 de `01-interfaz-luna.md`) y el contrato de turno (`TurnInput`/`TurnIntent`) quedan **congelados** — un carril que necesite cambiarlos para en seco y avisa, no improvisa. Commit + push por ola, nunca al final. `caffeinate` corriendo y despertador cada 20 min para no perder una ola dormida. Presupuesto de bench de la noche: **~$3**, autorizado de antemano.

## 5. Después de la noche

1. Resolutores de decisión con dinero de por medio: guardar en CRM, revelar contactos, autorizar secuencia.
2. Modo automático con presupuesto (planes de pago).
3. Diseño visual de la pantalla con el founder — lo de esta noche es funcional, no final.
4. Evals L1/L2 en CI, con juez con modelo.
5. Mercado estandarizado sobre el mismo formato de herramienta que el core.
6. Beta con el Founder.

**Fuera de esta versión:** broker (integraciones externas), licitaciones resueltas dentro del chat, Gmail/Outlook de la propia bandeja del usuario.

## 6. Puertas globales

Ninguna ola se da por verde sin esto, además de su puerta propia:

| Puerta | Qué exige |
|---|---|
| Typecheck | `tsc` limpio en todo el monorepo tocado |
| Suite API | `apps/api` verde |
| Harness MCP | `scripts/harness/mcp-e2e.mjs` verde |
| Bench 5 corridas | ≥ 15/20 real en cada una |
| Candados de frontera | Nada borra, nada envía, nada cobra sin cotización — `luna-boundary.spec.ts` y equivalentes |
| Léxico | Cero vocabulario prohibido en narración (ver `03-lexico.md`) |

## 7. Mapa de documentos

| Doc | Qué es |
|---|---|
| `00-PLAN.md` | Este documento — el plan maestro vivo |
| `01-interfaz-luna.md` | El contrato: escalera de autorización, cinturón, turno, eventos |
| `02-plan-de-ejecucion.md` | El plan original por fases (histórico — F0–F6, ya parcialmente superado por las olas de §4) |
| `03-lexico.md` | El vocabulario del producto que Luna debe usar |
| `04-harness-y-evals.md` | Cómo está construido el turno, la matriz de evals, los seis benches |
| `05-catalogo-core-y-chat.md` | El catálogo core y del chat |
| `../mcp-estandar-y-catalogo.md` | El estándar de herramienta y el catálogo objetivo del MCP |

## 8. Bitácora

Append-only. Una entrada por hito relevante, nunca se edita una entrada pasada.

**2026-09-10** — Día de arranque. Se construyó y commiteó S1 (`f19865d4`): motor de turno headless completo (contratos, compilador, manual, validador, candados, bench), sin memoria, sin endpoints, sin pantalla. Seis benches corridos; bench 6 en 13/20 medido (15/20 real — la reparación del validador puede degradar un turno bueno a uno vacío, hallazgo pendiente de arreglar). Pivote de diseño: el MCP pasa a ser la fuente de la verdad que Claude, ChatGPT y Luna consumen por igual, en vez de que Luna tenga su propio backing paralelo. Investigación de referencia completada: Apollo, Clay, HubSpot, plataformas de outreach, patrones de UX de chat. Se cerraron las 18 decisiones de §2.

**2026-09-10 02:30 CST** — Arranca la noche con el sí del founder. Sin `.env.local` en esta sesión: el bench y todo lo que pega a staging quedan para su máquina; se avanza solo lo que no gasta. Ola 0: `caffeinate` corriendo, despertador de ola cada 20 min y uno de reinicio de límites a las 04:03. Se lanzan en paralelo: MCP · 1, Memoria · sesión, Memoria · resumen, Pantalla · ruta + hilo (stream simulado), Pantalla · filas + tarjetas, y la reescritura de los 20 briefs al flujo core. Decisiones del founder aún abiertas y respetadas: tope de 12 herramientas sin cambio, `con_secuencia` detrás de bandera apagada, borrador de secuencia en nivel 0 como constante marcada.

**2026-09-10 04:03 CST** — Los seis agentes de la 02:30 murieron por límite de uso de la sesión antes de tocar un archivo; el árbol quedó limpio. Reinicio del límite a las 04:00; se relanzan los seis paquetes idénticos.

**2026-09-10 04:17 CST** — Memoria · resumen verde: el hilo entra como resumen rodante (≤1 200 chars, escalera 3/10/30) más los últimos 4 turnos crudos cuando pasa de 12; con 30 turnos las instrucciones completas miden 13 446 de 14 000 chars. Determinista, sin modelo, con punto de extensión para que el modelo lo escriba después. Salvedad: si otra sección de las instrucciones se disparara, el recorte de luna-manual (congelado) tira primero el resumen; anotado en el código.

**2026-09-10 04:22 CST** — Briefs del bench reescritos al flujo core (20: empresas 4, guardar en CRM 3, contactos 3, secuencias 3, Cerebro 3, saldo 2, fuera de alcance 2); los de Mercado quedan en `briefs.mercado.json`. Spec de validación verde (18 pruebas). Sin ejecutar el bench. Cinco graders faltantes anotados para MCP · 3 / MCP · 4: conteo fuera de Mercado, "nunca llama a X" leyendo eventos, orden cotizar→proponer, herramienta esperada usada, y `decision.kind` esperado.

**2026-09-10 04:35 CST** — Memoria · sesión verde: tablas nuevas `luna_sessions` y `luna_session_events` (no se reutilizan `work_sessions`, que pertenecen al Workbench A4 y tienen otro snapshot; corrección a la fila de §4). Seq monotónico asignado por la base, idempotencia por `Idempotency-Key`, ocultar un turno es `hidden_at` y nunca DELETE, regenerar es un turno nuevo con `parent_turn_id`/`variant_index` en columnas propias, compactar solo persiste el resumen. `runTurn` no cambió: el sink de eventos existente es la costura. Migración escrita y probada con mocks; **no se corrió contra Postgres** (pendiente en la máquina del founder). Se lanzan Memoria · endpoints y · stream juntas.

**2026-09-10 05:05 CST** — Pantalla · filas y · tarjetas verdes: la fila de herramienta con sus 7 estados a altura fija y sin animación de entrada; las 9 tarjetas de decisión (una por kind) que previsualizan y no ejecutan nada hasta el toque, con cuenta regresiva, recibo sellado, recotización en su lugar y confirmación escrita cuando el gasto pasa de la mitad del saldo; más la tarjeta de límite y la franja de deshacer de 8 s. Todo cuelga de los contratos de `slots.ts` del carril del hilo. 23 pruebas nuevas verdes. Hueco anotado: el reductor del runtime aún no conserva hora ni política de la resolución, así que el recibo sale sin esa línea.

**2026-09-10 05:20 CST** — Pantalla · ruta y · hilo verdes: `/w/:slug/luna` con riel de sesiones (archivar, nunca eliminar), hilo assistant-ui sobre un External Store con reductor exhaustivo de los 10 eventos, panel derecho con modo activo, compositor con Preguntar/Automático (automático deshabilitado: "en planes de pago") y contador de presupuesto, píldora "Luna sigue trabajando". Stream simulado que reproduce la escena de referencia; reconectar con `since` no duplica. `react-resizable-panels` no estaba instalado (el plan lo daba por instalado): se agregó. Rojo pendiente: el guard de diseño marca 4 controles crudos en `Luna.tsx`; lo corrige la ola de acciones de turno, que ya toca ese archivo.

**2026-09-10 05:45 CST** — Memoria · endpoints verde y · stream amarillo. Rutas bajo `workspaces/:slug/luna/sessions` (el prefijo que la auth de workspace exige): crear, listar, leer, turno con `Idempotency-Key` obligatoria (misma clave → mismo resultado sin volver a correr), ocultar, regenerar (variante con `parent_turn_id`), archivar, y SSE con replay desde `since` o `Last-Event-ID`, heartbeat de 15 s. 354 archivos / 5 119 pruebas verdes. **Rojo a resolver en Integración:** el sink guarda los eventos en un solo lote al cerrar el turno, así que el stream no narra en vivo mientras Luna trabaja; la causa es que `appendEvents` estampa la clave de idempotencia solo en la primera fila del lote. Arreglo previsto: la idempotencia vive en el turno (una fila por clave) y los eventos se anexan uno a uno según llegan. También anotado: regenerar corre sobre el snapshot actual, no el previo al turno original; `listEventsSince` no pagina más de 500 filas.

**2026-09-10 06:10 CST** — MCP · 1 verde: 22 herramientas fuera del catálogo (18 retiradas + `context_share`, `contact_prepare`, `members`, `context_delete`; borrar un topic cae bajo la misma regla que borrar un registro), el registro partido en cinco familias (Cerebro, CRM, Empresas y contactos, Cuenta, Mercado sin tocar por dentro), `tool-registry.ts` de 2 928 a 832 líneas, desaparece el mecanismo de "ocultas pero resolubles": lo eliminado responde `Unknown tool`. `tools/list` expone 31 (18 core + 13 Mercado). MCP 174/174, CLI 215/215. Docs, skill del CLI, sumisión a ChatGPT, contrato de evals y harness e2e actualizados. Fuera: espejo `docs/es` (quedará STALE), y un mensaje de error en `members/member-lookup.service.ts` que aún sugiere `driftless_members`; lo toma MCP · 2.

**2026-09-10 06:35 CST** — Memoria · stream en vivo verde: tabla nueva `luna_session_turns` con la `Idempotency-Key` única por sesión registrada antes de correr el turno; cada evento se persiste y se publica al hub según llega (5 eventos → 5 publicaciones antes del cierre, probado). Repetir la clave reproduce el mismo resultado sin volver a correr; un turno interrumpido por excepción queda `failed` y se reintenta reusando la fila; un proceso muerto deja `running` y la misma clave responde 409. Nada se borra. Sin correr contra Postgres. Un spec de mapeo MCP en cognitive está rojo por el trabajo en curso de MCP · 2, no por esta ola.

**2026-09-10 07:05 CST** — Pantalla · acciones y · panel dividido verdes, guard de diseño en cero. Las seis acciones funcionan sobre el stream simulado: regenerar con selector de variantes ‹ i/n ›, eliminar con confirmación en línea y sin borrar nada, compactar pliega el hilo tras un bloque de resumen expandible, recordar reutiliza la tarjeta `dejar_nota`, detener con Esc, dirigir mientras corre con píldora "dirigido". El panel muestra la selección como tabla del CRM y "vino de este turno ▸" resalta el turno. El recibo ya muestra hora y política. 451 pruebas verdes. **Para Integración:** el reductor usa tres eventos solo de cliente (`turn.variant`, `turn.retracted`, `thread.compacted`) que no están en el contrato congelado de 10; el servidor modela lo mismo como turno variante, `hidden_at` y resumen, así que el cliente real debe traducir esas formas del servidor a los eventos del reductor, no ampliar el contrato. `SelectionItem` no trae nombre de empresa en el contrato: el panel muestra monograma; abrir esa decisión con el founder.

**2026-09-10 07:20 CST** — Pantalla · cliente real (paquete añadido, archivos nuevos): cliente tipado de las rutas de sesión con `Idempotency-Key` y un reintento con la misma clave ante fallo de red; fuente de eventos sobre EventSource con reconexión desde el último seq entregado, heartbeats ignorados; hook `useLunaSession`. 478 pruebas verdes. **Para Integración:** (1) EventSource nativo no puede mandar el Bearer de Clerk, así que hoy depende de la cookie; el repo ya resuelve SSE autenticado con fetch en `subscribeWorkspaceEvents` de `api.ts`: cambiar a ese patrón. (2) Faltan rutas en el API para resolver una decisión, detener un turno, dirigir, compactar y proponer nota; el cliente las marca `not_supported`. (3) El turno regenerado llega como turno normal: el cliente debe leer `parent_turn_id`/`variant_index` de la respuesta de sesión, no del evento.

**2026-09-10 07:50 CST** — MCP · 2 verde: catálogo core de 21 (Cerebro 4, CRM 2, Empresas y contactos 7, Cuenta 2, Secuencias 6) + Mercado 13 = 34, exactamente el de 05. Cada herramienta lleva sideEffect / policyClass / costClass / idempotent y sus ejemplos van dentro de la descripción (antes el modelo nunca los veía). `DriftlessTool` extendido aditivamente; el MCP mantiene un espejo local porque no puede importar del API. `context_search`/`context_list`/`context_get_for_files` y `collection_record` quedan como alias de llamada ocultos por 60 días para skills externas. Ninguna Secuencia activa ni envía; `sequence_check` es la comprobación previa. Backends que faltan y no se inventaron: audiencia por registros sin correos literales, límite diario y dedup en campañas, SPF/DKIM, `undo_token`, guardado en lote con política de conflicto, `search_id` reutilizable. MCP 181/181, API 5 129, CLI 215/215.

**2026-09-10 08:25 CST** — Memoria · decisiones y control de turno (paquete añadido) verde: resolver una tarjeta (`decisions/:id/resolve`, con 404/409/410/501), detener (aborta el turno vía la señal que `runTurn` ya aceptaba; la fila queda `failed: detenido`), dirigir, compactar y recordar. Resolutores reales solo sin dinero: guardar en CRM (crea o reutiliza la Colección y hace upsert por `record_ref`, "3 ya estaban" sale del conteo real), cambios masivos (cambio de etapa por id, deshacer es otro cambio a Descartado), dejar nota (escribe el topic directo). Los seis kinds con dinero o externos responden 501. El resolutor vive en su propio módulo `luna-decisions/` por exigencia del candado. 355 archivos / 5 158 pruebas verdes antes de que MCP · 3 empezara a reescribir el árbol. Pendiente de plomería: hoy ninguna herramienta llena `preview` ni `board.selection`, así que solo guardar en CRM resuelve de punta a punta cuando la selección exista; lo cierra la Integración.

**2026-09-10 08:55 CST** — Integración · pantalla verde: `/w/:slug/luna` habla con el API real por defecto (riel, nueva sesión con id del servidor, archivar, abrir sesión siembra el reductor con snapshot + resumen + últimos turnos y suscribe desde `last_seq`); el simulado queda con `?simulado=1`. SSE sobre fetch con el Bearer de Clerk, como el resto del repo; reconexión con backoff desde el último seq. Cada acción se traduce a su ruta y a un evento del reductor sin ampliar el contrato: ocultar → `turn.retracted`, compactar → `thread.compacted`, regenerar → turno nuevo cuyas narraciones se pliegan en `turn.variant` al terminar; resolver, detener, dirigir y recordar solo disparan el POST y el efecto llega por el stream. 409 al enviar encola el texto como dirección. 483 pruebas verdes, guard de diseño en cero. Falta en el API: renombrar sesión (queda solo en cliente).

**2026-09-10 09:30 CST** — MCP · 3 amarillo. Luna toma su catálogo del registro del MCP en proceso (un solo `ToolRegistry` para todo el proceso), `luna-tools.ts` y su servicio se borraron, los estados mexicanos viven en `libs/market-data-contracts`, etapas renombradas a las herramientas del MCP (Mercado: 6 visibles en `buscando`, 6 fuera; el tope de 12 intacto; `contact_unlock` nunca visible), routing de las instrucciones actualizado, presupuesto de instrucciones subido a 14 600 chars para no perder el resumen. Cuatro graders nuevos en el bench. 5 161 pruebas verdes. **Rojo estructural:** la ejecución no pasa por `registry.call()` porque los handlers del MCP exigen un bearer y el contexto de Luna solo trae workspace y principal ya autenticados; Cerebro, Mercado, saldo y workspaces ejecutan directo contra los servicios, pero las 9 herramientas de Empresas, CRM y Secuencias responden `not_wired`. Se abre el paquete "MCP · 5: costura de auth en proceso" para que Luna ejecute por el mismo camino que Claude y ChatGPT.

**2026-09-10 10:20 CST** — Selección viva y renombrar sesión verdes. Buscar empresas o proveedores llena la selección del tablero por cada llamada (evento `board.patched`, que ya estaba en el contrato y nadie usaba) y la persiste en el snapshot; `guardar_en_crm` llega con vista previa (nombre de Colección desde el criterio, conteo, refs) y el resolutor real la acepta: probado de punta a punta con el resolutor y colaboradores simulados. Corrección a la nota de las 07:05: `SelectionItem` sí trae `name`. Hueco real: `cambios_masivos` no se puede armar con el contrato congelado (`proposal_id` opaco sin registro de propuestas; sin ids reales del CRM hasta que `collection_query` ejecute). Renombrar sesión en API y riel; el título automático nace en el servidor al cerrar el primer turno. 5 190 pruebas verdes.

**2026-09-10 11:10 CST** — MCP · 5 verde: Luna ejecuta TODAS sus herramientas por `registry.call()` del MCP, el mismo camino que Claude y ChatGPT, con un token interno firmado de 60 s (audiencia `luna`, secreto en `LUNA_INTERNAL_TOKEN_SECRET`, falla en claro en producción si falta); un token que llegue por HTTP sin firma válida cae a la validación normal y falla, probado. Cero `not_wired`. Verificación final: db build, API 5 212 pruebas, MCP 181, CLI 215, dashboard 485, guard de diseño y el harness de léxico nuevo (`scripts/harness/luna-lexico.mjs`, que encontró y corrigió dos "universo" en las instrucciones) todos verdes. `mcp-e2e.mjs` no ejecutable sin servidor y base.

**Cierre de la noche, en términos de producto.** Un vendedor que abra `/w/:slug/luna` hoy ve el riel de sesiones, escribe, y Luna narra en vivo lo que hace: cada herramienta aparece como una fila con su estado, la búsqueda llena la selección en el panel derecho como tabla del CRM, y guardar en el CRM es una tarjeta con nombre de Colección, cuántas entran y cuántas ya estaban; al tocar, la Colección se crea de verdad y queda un recibo con hora y política. Puede regenerar con variantes, quitar un turno sin que nada se borre, compactar un hilo largo tras un resumen, recordar algo como topic del Cerebro con aprobación, detener con Esc y dirigir mientras corre. Al día siguiente la sesión reabre con su resumen. Lo que cobra o sale del workspace (revelar contactos, autorizar una secuencia, acciones externas) muestra la tarjeta pero responde "todavía no se puede resolver desde el chat". Claude y ChatGPT ven el mismo catálogo de 34 herramientas, con la familia Secuencias y su comprobación previa, y ninguna borra, cobra sin cotización ni envía.

**Lo que necesita el founder:** (1) correr las tres migraciones (`luna_sessions`, `luna_session_events`, `luna_session_turns`) y `LUNA_INTERNAL_TOKEN_SECRET` en staging; (2) el bench en local (`.env.local`, workspace golden, ~$3) y cinco corridas para MCP · 4; (3) abrir la ruta con `assistant` habilitado y pedir algo real; (4) cuatro decisiones: tope de 12 con Mercado, nivel del borrador de secuencia, etapa `con_secuencia` (requiere ampliar el contrato), y la vista previa de `cambios_masivos` (`proposal_id` opaco sin registro de propuestas). Backends que faltan para Secuencias: audiencia por registros, límite diario y dedup en campañas, SPF/DKIM. Comentarios obsoletos con `not_wired` en `luna-board.ts` por limpiar.

**2026-09-10 tarde, en la máquina del founder.** Migraciones aplicadas en staging (tres tablas). Pila hermética con Postgres nativo en el worktree `Driftless-luna`: HTTP e2e 24/24 y MCP e2e 101/101 (harness alineado al catálogo de 34). Benches 7→9 contra staging: 3/20 → 3/20 → 6/20, cada uno con una causa de plomería distinta y ya cerrada: sin principal en el bench, la política negaba la búsqueda gratuita, el bench no escuchaba en el puerto del loopback, el pooler de staging se saturaba (cierre explícito de DataSources; bug real de Nest con dos DataSources). El workspace golden quedó sembrado (Colección Oportunidades, 10 registros, 3 contactos adquiridos, remitente sin verificar, borrador de secuencia). Empresas → selección → guardar funciona: `company_search` llena la selección y el resolutor consume claim tokens vía `company_save`. Dos correcciones del founder: Hunter Discover es gratis (la puerta es de evaluación, no de costo) y el tope de 12 herramientas era mío (S1), no suyo: subió a 20 y las Secuencias entran en `con_lista`. Diagnóstico del bench 9 por clase: 4 entorno, 3 contrato de herramienta, 3 etapa, 1 validador, 5 instrucciones (incluida mi línea de routing "guardar → company_save", que debe ser tarjeta). Bench 10 en curso con esos arreglos. Decisiones que siguen abiertas: nivel del borrador de secuencia; `con_secuencia` como etapa (contrato); vista previa de `cambios_masivos`; el lote de `company_save` con política de conflicto que 05 describe y el API no tiene.

**2026-09-10 13:00 CST.** Bench 10: 7/20 (manual v2.4.0, 2.9 herramientas por turno). Desaparecieron los dos errores de contrato del bench 9 (`select`+`projection`, `entity_id` como campo) y el refusal espurio por la fecha "1 de octubre" (el validador acepta fechas que vienen de la herramienta; la causa real era que un datetime ISO nunca entraba en las cifras conocidas). Nuevos muros: Hunter sin configurar en el entorno local (503), `cursor_invalid` de paginación en cuatro briefs, y `proposal_id` sin fuente en `guardar_en_crm` una vez que guardar dejó de ser llamada directa. Los resolutores con dinero ya existen: revelar contactos (cotización vigente, saldo, confirmación escrita, reembolso) y revisar secuencia (comprobación previa vigente, un toque por paso, huella). Demo: API del worktree contra staging en :3777 con Empresas y secuencias en evaluación, dashboard en :5173; el founder es owner de `golden`. Pendiente de plomería: la vista previa de las tarjetas de contactos y secuencia (cotización y comprobación) desde el turno.

**2026-09-10 15:10 CST — la primera sesión real del founder.** Abrió `/w/golden/luna` y vio: layout encajonado en el centro, filas de herramienta con el JSON crudo como título, la narración terminando en `】【。`, el panel "Vacío" pese a 47 observaciones, y en "muéstralas" Luna se fue de pesca (tres búsquedas no pedidas). Nada de eso lo vio ningún agente ni yo: se verificó con pruebas, guard de diseño y un stream simulado; el founder fue el primer humano en verla con datos reales. Regla nueva (memoria): ninguna ola de Pantalla cierra sin captura contra el API real. Causas y arreglos: (1) el recorte por presupuesto vaciaba `results[]` y dejaba la procedencia duplicada, así que no había filas ni tablero → se quita la procedencia y las filas llevan nombre y estado; `summary` humano por herramienta; (2) la pantalla mostraba `summary` como título → título = etiqueta, JSON solo al expandir; citas rotas limpiadas o convertidas en chip; layout con el patrón de sangrado completo del rediseño; (3) el modelo escribe corchetes de ancho completo → normalización en el turno y ejemplo exacto del formato en las instrucciones (en curso); (4) seguimientos ("muéstralas") se contestan desde el tablero, nunca con búsquedas nuevas (en curso). Decisión: no se corren más benches hoy; la señal es el founder con el navegador. Bench 11 quedó commiteado sin correr (pooler saturado).

**2026-09-10 17:00 CST — el Chat del founder.** Tras "suspende ya toda tu mierda": todo detenido, y dos órdenes: (a) un agente diseña bien el chat y lo mete en el sidebar como "Chat" en lugar de Prioridades, borrando todo lo de Prioridades (Inbox, su endpoint exclusivo, redirects, i18n); (b) Luna ve las 34 herramientas siempre (decisión 19). Luego mandó una referencia visual (decisión 21) y el rediseño la siguió: Chats en el sidebar, cabecera delgada, una línea de actividad por turno, resultados como tarjeta en línea con acciones por fila y en lote, tarjetas de decisión con la misma piel, compositor ancho; sin panel derecho ni riel interno. Verificado con captura real a 1440 y 1024 antes de entregar. En paralelo, "¿cómo va mi pipeline?" destapó que no existía forma de listar Colecciones: `collection_query` sin id ahora las lista con conteos por etapa, el routing va lista → consulta, y un freno corta llamadas repetidas. Resultado en su pantalla: "Tu pipeline tiene 40 oportunidades: 36 nuevas, 3 por revisar y 1 prioritaria", con cita a la Colección. Su veredicto del rediseño: "nice, mejoró muchísimo". Pendientes chicos: chip "colección", sección Chats visible arriba, título sin capitalizar.

**2026-09-11 — Contact Path retirado (PR #698) + Ada persona-primero (#697).** La familia de Empresas pasó a persona-primero: `contact_discover`/`contact_select`/`contacts_acquired`/`contact_quote`/`contact_unlock` salen del catálogo MCP, las rutas `/radar/collections/:id/contact-paths/*` y el flujo en `RadarEnrichmentService` se borran, y su lugar lo ocupan `people_search`/`people_quote`/`people_acquired`/`people_reveal`/`people_file`/`people_status` sobre `/radar/people/*`. El resolver del chat llama `ContactsService.revealSelection`; `people_reveal` (spend, policyClass 2) queda oculto del cinturón y `people_quote` sella el `quote_token` en el snapshot (el modelo solo ve `quote_id`). Scopes OAuth: search/save→`commercial:discover`, quote/acquired→`commercial:read`, reveal/file/status→`commercial:activate` (default-deny; sin ellos Ada era rechazada). El catálogo público queda en 22 core (Cerebro 4, CRM 2, Empresas y personas 8, Cuenta 2, Secuencias 6) + 13 Mercado = 35. Docs públicas y de arquitectura repuntadas.

## 9. Cómo se actualiza este documento

Lo actualiza el orquestador (Fable) al cierre de cada ola, nunca a mitad de una. Lo que cambia: la columna Estado de §4 (pendiente → en curso → verde/rojo) y una entrada nueva en la Bitácora (§8) resumiendo qué se demostró. Lo que **nunca** cambia sin un sí explícito del founder: la lista de Decisiones tomadas (§2) — se supera con una fila nueva, jamás se edita una vieja — y el Norte (§1).
