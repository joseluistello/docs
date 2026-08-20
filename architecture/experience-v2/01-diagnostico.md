# E1 — Diagnóstico: el trabajo real y por qué la experiencia actual no lo hace

**Proyecto:** Driftless Inteligencia Comercial — rediseño de experiencia desde primeros principios
**Base auditada:** rama `staging` (commit `46cb84b`), leída archivo por archivo — no la versión de los documentos de arquitectura, sino lo que el código hace hoy.
**Convención de este doc-set:** los párrafos marcados `[REQUISITO]` son contratos de experiencia congelables (verificables en evals, E7); los marcados `[SUGERENCIA]` son técnica recomendada que el equipo implementador puede sustituir si conserva el requisito.

---

## 1. El trabajo que el usuario contrata

El usuario de Driftless no contrata "búsquedas", "señales" ni "un chat". Contrata esto:

> **"Yo sé qué vendo. Dime a quién debería estar persiguiendo AHORA, por qué a ellos, por qué ahora, y cómo entro — con evidencia que yo pueda defender frente a mi socio o mi equipo."**

Es un trabajo de **decisión**, no de información. El entregable no es una lista: es una **recomendación de prospección argumentada** — pocas cuentas, ordenadas por "vale la pena actuar", cada una con su razón, su ángulo y su siguiente paso. La tesis interna del equipo (`commercial-intelligence-mvp-brief`) ya lo dice con precisión: *"No vendemos 'más leads'. Vendemos mejores razones para iniciar conversaciones."* El formato de salida ya está ratificado ahí (Cuenta / Por qué ahora / Necesidad probable / Confianza del evento / Confianza comercial / Compradores a resolver / Ruta de entrada / Siguiente acción). El problema no es la tesis: es que la experiencia construida no la ejecuta.

Tres propiedades del usuario que gobiernan todo lo demás:

1. **Piensa en su oferta, no en fuentes.** Su vocabulario es "vendo X", "mis clientes son Y", "el norte", "gobierno", "esta semana". No sabe — ni debe saber — qué es DENUE, una licitación en Compranet, una capability o un provider. Cualquier pregunta o mensaje formulado en el vocabulario del sistema es un defecto.
2. **Su costo de oportunidad es altísimo y su paciencia baja.** Es dueño de PyME o founder-seller: si en dos minutos no vio algo que se parezca a un cliente posible, se fue. La primera muestra útil es el onboarding, el aha y la retención — no hay una "fase de configuración" que él vaya a tolerar.
3. **Desconfía por defecto — y con razón.** Ha comprado listas malas. La evidencia visible y la honestidad sobre lo que NO se sabe (hecho vs hipótesis) no son features de compliance: son el mecanismo de confianza que diferencia al producto. Un "no encontré nada, y esto es lo que haría al respecto" bien dicho construye más confianza que diez resultados inflados.

**El objeto del producto es la oportunidad argumentada; la conversación es el volante; el trabajo en curso es el motor.** Todo lo que el usuario ve debe ser una de tres cosas: una oportunidad (o su ausencia honesta), una decisión que solo él puede tomar, o una explicación breve de qué se está haciendo por él en términos de su encargo. Nada más tiene derecho a pantalla.

---

## 2. Qué está fundamentalmente mal — causas conceptuales, no textos

Auditamos `staging` completo (API, workflows, UI, prompts, evals). Los síntomas reportados ("Terminado" duplicado, catálogo narrado, re-preguntar qué vende, composer estático, errores internos) no son bugs independientes: son proyecciones de siete causas raíz.

### RC1 — Nadie decidió quién atiende: el bibliotecario o el director

El asistente comercial vive dentro del chat del producto de contexto/conocimiento, con su identidad heredada. El skill activo (`apps/api/src/cognitive/skills/chat.skill.ts`) ordena su misión como **"1. Topics — the team's recorded truth… 2. Oportunidades… 3. Collections"**, y su regla suprema es la del bibliotecario: *"Ground every answer in what you read THIS run"*. Frente a "quiero leads", un bibliotecario honesto hace exactamente lo que se observó: consulta su catálogo (`discover_market_capabilities` devuelve el `CapabilityBundle` interno completo — ~12 KB con `coverage`, `freshness.cadence`, `limitations[]` — sin proyección a forma cliente, `chat-tools.ts:527`) y **reporta sus fondos**: licitaciones, DENUE, frecuencias de ingestión, tareas pendientes. No es que el modelo "alucine burocracia": obedece. El prompt además se lo pide textualmente: *"`discover_market_capabilities` tells you which market changes Driftless can support, their coverage and their limits"*.

Hay un segundo secuestro de identidad: cuando el perfil comercial está vacío, una directiva convierte el turno en soporte de configuración — *"Your ONLY job this turn: say plainly that the ICP/offer isn't registered, and invite the teammate to complete Commercial Setup (Ajustes → Setup comercial, ~2 minutes)"* (`chat.service.ts:3179`). El usuario pidió clientes; el sistema le contesta con su propio menú de ajustes.

**[REQUISITO EXP-1]** La superficie comercial tiene UNA identidad: dirige el encargo del usuario. Ningún turno puede tener como entregable la descripción del inventario, la configuración o las limitaciones del sistema; ese contenido solo puede aparecer subordinado a una decisión ofrecida ("no veo X; puedo hacer A/B/C").

### RC2 — La inteligencia fue legislada fuera del sistema

Éste es el hallazgo más importante de la auditoría. Por miedo legítimo al LLM (jerga, gasto, invención), el equipo movió TODA la comprensión y la estrategia a código determinístico — y dejó al modelo únicamente dos papeles: boca (en rutas de mercado corre con `synthesisOnly: true`, cero herramientas, redacta ≤350 palabras sobre un payload ya ejecutado — `chat.service.ts:2548`) o merodeador (en las demás rutas recibe el cinturón completo sin dirección). En medio, "entender" es esto:

- La intención se clasifica con una **escalera de regex** (`intent-preflight.ts`).
- El contrato se compila con **regex sobre el texto del turno**: `OFFER_PATTERN = vendo|vendemos|ofrezco|…` (`work-contract.compiler.ts:145`). *"Quiero leads para vender Driftless, inteligencia comercial"* no matchea `vendo` → `gap-offer` se declara material → el sistema pregunta qué vendes **aunque el usuario acaba de decirlo**. El re-preguntar observado no es un despiste del modelo: es la arquitectura. Un regex no puede absorber significado, y se le dio el monopolio del significado.
- La política de preguntas solo conoce **dos huecos posibles** (`gap-offer`, `gap-target`) y **un conflicto** (geografía). La "entrevista adaptativa" es estructuralmente incapaz de adaptarse.
- La selección de capability es **overlap de tokens** con `break` en la primera suspensión; un turno consulta exactamente una capability (`chat.service.ts:2126`).
- El plan nunca se revisa: `applyProposedRevision` existe con su allowlist… y **nada lo llama**.

La trayectoria canónica reportada se explica completa con esta causa. *"Quiero leads para vender Driftless, inteligencia comercial"* esquiva **tres escaleras de keywords independientes**: la ruta de mercado no lista `leads` como sustantivo ni `quiero` como verbo (`leads` sí está en la escalera de *intent*, no en la de *route* — una asimetría de una palabra), el clasificador de intent exige `nuevos leads` como bigrama, y ni `hasInlineCommercialBrief` ni `OFFER_PATTERN` reconocen el infinitivo `vender`. El turno degrada a `general` — **la única ruta donde el modelo recibe el cinturón completo de ~20 herramientas y ninguna directiva calculada por el servidor** — y ahí el skill le ordena, en tres secciones distintas, exactamente lo observado: (i) *"`discover_market_capabilities` tells you which market changes Driftless can support, their coverage and their limits"* → narra el catálogo; (ii) *"When the workspace doesn't have the answer… name the closest topics/areas that DO exist and what each covers"* → licencia explícita para el tour de inventario; (iii) *"First contact: ask the person to describe what they sell and to whom"* → re-pregunta. Y aunque el usuario conteste, los detectores tampoco reconocen su respuesta, así que el hueco se reabre al turno siguiente. El modelo no desobedeció: ejecutó fielmente un guion contradictorio.

Resultado: *"el sistema parece ejecutar un workflow, pero no dirigir inteligentemente el trabajo"* — la observación del equipo es literalmente correcta. **No hay director.** El `CommercialIntelligenceOrchestrator` del documento de arquitectura (§3.1) no existe en el código: hay regexes, un token-overlap y una llamada de síntesis.

**[REQUISITO EXP-2]** Comprender el encargo (oferta, comprador, geografía, timing, implícitos) es trabajo de un modelo con el contexto completo (mensaje + hilo + perfil + memoria), cuya salida se **valida** contra contratos tipados. El determinismo se reserva para donde es virtud: autoridad de gasto, integridad de evidencia, validación de checkpoints, el protocolo de eventos. Lema: **el modelo interpreta significado; el código otorga autoridad.** Nunca al revés.

### RC3 — El motor no recuerda la conversación

`objective` del contrato es `text.slice(0,300)` **del turno actual** (`agentic-contracts.ts`); el compilador no lee turnos anteriores, ni el perfil compilado, ni respuestas previas de clarificación cuando el turno nuevo llega por otra ruta. La sesión de trabajo (Work Session) existe y es durable — pero la comprensión se recomputa por-turno desde cero con regex. De ahí el bucle observado: contesta la entrevista → el siguiente turno no la conoce → "Cuéntame qué vendes". La entrevista determinística del Radar legado (retirada en C1) tenía el mismo defecto de nacimiento: *"la primera pregunta la hace el sistema, no tú"* — un formulario disfrazado de conversación, que descartaba lo ya dicho.

**[REQUISITO EXP-3]** Nada que el usuario ya dijo — en este hilo, en un checkpoint, en su perfil o en una sesión anterior accesible — puede volver a preguntársele. Confirmar con eco ("sigues vendiendo X a Y, ¿cierto?") está permitido dentro de otra pieza; re-preguntar en blanco, jamás. Este requisito es evaluable y debe fallar builds (E7-01).

### RC4 — Cero resultados es un callejón sin salida por diseño

Cuando la página de señales llega vacía, `coverageFor` produce un veredicto honesto… y ahí se acaba la estrategia: `proposalFor` **exige exactamente una señal** para poder ofrecer investigación pagada (`mastra-market-intelligence-workflow.ts:252` — *"Paid research is valuable only when it can produce a visible claim on one exact opportunity"*). Cero señales → cero filas, cero oferta, `result_useful: false`, y un modelo al que se le entrega un payload vacío para que "escriba prosa". La prosa natural sobre un payload vacío es… un diagnóstico de cobertura. El caso donde la investigación web es MÁS valiosa (no tengo nada tuyo aquí) es exactamente el caso donde está prohibida. A eso se suma que `budget.externalCostCapCredits` está **hardcodeado a 0** (`work-contract.compiler.ts:322`), de modo que la aritmética de presupuesto del supervisor siempre ve cero crédito autorizado.

**[REQUISITO EXP-4]** "No encontré nada" es un **punto de decisión estratégica con salidas**, nunca un final ni un reporte de infraestructura. Salidas mínimas: (a) reformular la señal o ampliar criterio con lo gratuito, (b) proponer investigación web acotada con costo y resultado esperado, (c) dejar un vigía y avisar cuando aparezca. La ausencia de cobertura propia se expresa en términos del encargo ("hoy no veo aperturas de clínicas en Guatemala"), no del sistema.

### RC5 — La UI proyecta el motor, no la experiencia

La superficie workbench renderiza el `runStatus` crudo en **cuatro lugares simultáneos** (header, status-row, runway desktop y trigger móvil — `OperateChatSurface.tsx:63,74` + `DecisionRunway.tsx:33,51`): de ahí el "Terminado" triplicado. Al enviar el siguiente turno, `reset()` limpia el stream pero no la proyección → durante toda la primera fase del turno nuevo conviven **spinner + "Terminado"** (estado duplicado *y además falso*). Un tool call sin id estable genera **dos filas** (fallbacks de índice divergentes en START y RESULT, `chat.service.ts:~2441/2466`), y herramientas distintas colapsan al mismo texto amistoso → filas byte-idénticas. Los artifacts se apilan inline por diseño (una segunda búsqueda monta una segunda sección "Oportunidades para actuar ahora"). Y los errores pasan por un **denylist** de ~10 tokens (`customerSafeChatError`): todo mensaje interno que no matchee el regex — "checkpoint is not pending", "403 Forbidden", errores de contrato — llega crudo al usuario.

La causa común: **ningún módulo computa "la verdad del usuario"**. El protocolo de eventos A1 es excelente como verdad del sistema; pero cada componente lo proyecta por su cuenta, y la suma de proyecciones honestas es una experiencia incoherente.

**[REQUISITO EXP-5]** Entre el log de eventos y la UI existe **un solo reductor de experiencia** (una proyección canónica): un estado del encargo, una línea de narración actual, un progreso agregado, una lista de decisiones pendientes, un artifact vivo. Todo componente lee de ahí; ninguno interpreta eventos por su cuenta. Errores hacia el usuario pasan por **allowlist** (catálogo de mensajes propios) — lo no catalogado se registra y se muestra como mensaje genérico de recuperación.

### RC6 — Rutas clasificadas sin dueño

El clasificador emite `create_monitor` y `contact_request` (`intent-preflight.ts:40-52`)… y `runTurnLocked` solo maneja las tres rutas de mercado (`chat.service.ts:1369`). "Avísame cuando aparezcan plantas nuevas en el norte" cae al turno genérico con cinturón completo — es decir, al bibliotecario con el catálogo en la mano. Los monitores están **construidos** (servicio, puerto, webhook, contratos, checkpoint `activate_monitor`, artifact `monitor`, labels en UI) y son **inalcanzables desde el chat**. Contactos: mismo patrón, con rechazo deliberado. De seis checkpoints tipados, tres jamás se producen; de nueve typed actions, se acuña una; de seis artifacts, se crean dos.

**[REQUISITO EXP-6]** Toda intención que el producto clasifica tiene un dueño que la ejecuta o una negativa útil diseñada (qué no puedo hacer + qué sí puedo ofrecer). Clasificar-y-abandonar está prohibido: si no hay dueño, la ruta no existe.

### El agravante que el diseño debe abrazar: la cobertura real de hoy

No es una causa raíz de la experiencia, pero condiciona todo el diseño: **hoy el catálogo EFECTIVO visible para el usuario es una sola capability con una sola fuente licenciada para exhibición (licitaciones — compras públicas del estado de Jalisco).** (Precisión tras revisar `gtm-fabrica` de primera mano: existen **6 capabilities definidas** — licitaciones, adjudicaciones CFE, permisos de energía, M&A COFECE, concesiones mineras, altas recientes al DENUE — pero la activación de licencia de exhibición es un acto humano/legal por fuente y solo compras-jalisco la tiene; ver `09-revision-warehouse.md`.)

> **[REQUISITO] Estas cifras son un SNAPSHOT de un SHA auditado, no una verdad del sistema.** "6 definidas / 1 activada" y "21 source packs" describen `gtm-fabrica` @ `d29123b` y Driftless @ `46cb84b` en el momento de la auditoría; cambian sin avisar a este doc-set y **cambiarán**. Ningún componente puede hardcodear un conteo, un id de capability ni una lista de fuentes tomado de aquí: el número efectivo se resuelve **en runtime** desde el catálogo licenciado, y la experiencia debe comportarse igual con 1 o con 21. Un eval que asuma "hay exactamente una capability" es un eval que se romperá el día que la operación active la segunda — los evals afirman *comportamiento bajo cobertura estrecha/nula*, nunca *cuántas capabilities hay*. Los otros 20 source packs del warehouse están cosechables pero invisibles para el producto hasta esa activación. La consecuencia de diseño es central: **la experiencia debe ser excepcional con cobertura estrecha** — usar el cajón propio cuando aplica, escalar a investigación web como puente natural cuando no, y ofrecer vigilancia para cuando la cobertura llegue. Un diseño que solo brilla con 21 fuentes vivas fracasaría hoy; uno que trate la cobertura estrecha como vergüenza a ocultar, también. La honestidad estratégica ("hoy veo bien X; para Y te propongo investigar en la web") ES el producto en esta fase.

### RC7 — Gobernaron los contratos del motor; nadie gobernó el contrato de la experiencia

Ésta es la meta-causa que explica la paradoja de este repo: documentos de arquitectura excepcionales (workbench doc, A1 con 28 eventos fail-closed, invariantes de producto en `product.md`) conviviendo con la experiencia observada. Los contratos congelados son todos **del motor hacia adentro** (eventos, schemas, idempotencia); los evals prueban invariantes de seguridad y estructura (warehouse-first, no-spend-sin-approval, no-contaminación entre workspaces) — todos necesarios, ninguno suficiente. **No existe ningún contrato congelado de lo que el usuario ve turno a turno**, y por eso nada falló cuando el sistema respondió con su inventario: ningún test lo consideraba un defecto. (El equipo empezó a corregirlo: `agentic-workbench.trajectory.spec.ts` pina algunos de estos comportamientos y sigue rojo.)

Este doc-set existe para cerrar esa brecha: E2 y E3 **son** el contrato de experiencia; E7 lo hace ejecutable.

---

## 3. Qué debe inferir el sistema (y jamás preguntar)

Regla general **[REQUISITO EXP-7]**: antes de formular cualquier pregunta, el sistema absorbe — mensaje actual, hilo completo, perfil comercial compilado, sesiones/artifacts previos del workspace — y clasifica cada dato del encargo como `dicho | recordado | inferido | faltante`. Solo `faltante`+material puede preguntarse; lo `inferido` se declara como supuesto reversible y se sigue trabajando.

| Dato | Cómo se obtiene sin preguntar |
|---|---|
| **Qué vende** | Del mensaje ("vendo…", "para vender X" — en cualquier formulación, no un patrón), del perfil comercial, de la sesión anterior. Si existe en dos lugares y contradice, eso sí es pregunta (conflicto material). |
| **A quién probablemente** | Inferible de la oferta en la mayoría de los casos (software p/ dependencias → compradores públicos). Se declara como supuesto y se calibra con la muestra, no con interrogatorio. |
| **Geografía** | Default: la que implique el mensaje > perfil > cobertura más fuerte del sistema, declarada ("empecé por Jalisco; dime si miro más lejos"). |
| **Ventana temporal** | Default del tipo de señal (licitaciones: vigentes; expansiones: ~90 días). Declarada, ajustable. |
| **Tamaño de salida** | Default: shortlist corta (3 destacadas de ~10–25 revisables). Nadie pide "¿cuántas quieres?" en frío. |
| **Estrategia de señal / fuente / capability** | SIEMPRE decisión del sistema. Preguntar "¿busco en licitaciones o en DENUE?" está prohibido — es trasladarle al usuario el trabajo que contrató. La estrategia se *muestra* ("voy a mirar compras públicas recientes porque vendes a gobierno"), no se delega. |
| **Suficiencia de cobertura propia** | Preflight interno silencioso; el usuario ve consecuencias, nunca el inventario. |

## 4. Qué sí debe preguntar

**[REQUISITO EXP-8]** Presupuesto de fricción: **máximo 2 preguntas antes de la primera muestra** (idealmente 0–1), una por turno, cada una con: por qué importa (una frase), 2–4 opciones tocables + texto libre, y un default marcado que permita "continúa con tu criterio". Después de la muestra, las preguntas se vuelven **calibración sobre ejemplos** ("de estas 8, ¿cuáles se parecen a tu cliente ideal?") — que responde más, cuesta menos y además valida el criterio real, no el declarado.

Solo hay cuatro familias de pregunta legítimas:

1. **Validez** — sin esto el trabajo puede salir *bien hecho e inútil*: p. ej. oferta genuinamente indescifrable, o un término ambiguo que bifurca el universo ("¿'gobierno' incluye municipios y organismos autónomos, o solo estatal?").
2. **Enrutamiento material** — la respuesta cambia radicalmente dónde mirar (público vs privado; ¿vendes el software o lo implementas?).
3. **Autoridad** — gasto, monitor recurrente, contacto de personas, escritura externa. Estas preguntas son SIEMPRE explícitas y nunca inferibles.
4. **Conflicto** — dos fuentes del propio usuario se contradicen (perfil dice A, mensaje dice B; evidencia se contradice y el criterio depende de ello).

**Litmus [REQUISITO EXP-9]:** si una pregunta puede sustituirse por *supuesto declarado + muestra barata*, se sustituye. La muestra es la mejor pregunta.

## 5. Qué nunca debe pedir ni mostrar

- Nada ya dicho o almacenado (EXP-3).
- Nada en vocabulario interno **[REQUISITO EXP-10]**: warehouse, capability, source pack, recipe, provider (Parallel/Exa/Apollo), licencias, cadencias de ingestión, schemas, contratos, IDs. La familia de la fuente sí existe para el usuario, pero como **evidencia** ("Compranet, 3 ago 2026", "registro público de establecimientos"), jamás como arquitectura. Vigencia: allowlist léxico en CI sobre TODOS los componentes de la superficie (hoy el lexicon test cubre solo el archivo legacy).
- Permiso para trabajo gratuito, reversible y dentro del encargo (se hace y se narra, no se solicita).
- Que el usuario "complete su configuración" para merecer una respuesta. El perfil se construye como subproducto del primer encargo, no como peaje previo.
- Tareas de operador: elegir fuente, reintentar pasos, interpretar errores, decidir entre duplicados técnicos.

## 6. Dónde ser proactivo y dónde detenerse

La escalera P0–P4 del documento de workbench es correcta como política de fondo; lo que faltó es su traducción operativa. La regla de superficie:

**Proactivo sin preguntar (anuncia, no solicita):** absorber contexto y arrancar la exploración gratuita en el primer turno; ejecutar la muestra; verificar evidencia; recalificar tras una corrección conservando lo válido; proponer (no ejecutar) la siguiente acción al cierre; avisar que una estrategia rinde poco y proponer alternativa; reintentar una vez fallas transitorias; guardar el trabajo siempre.

**Detenerse SIEMPRE (checkpoint explícito, bloqueante):** cualquier gasto externo (cotización exacta: alcance + costo + qué se obtiene); activar un monitor (contrato visible: qué vigila, cada cuánto, dónde avisa, cómo se apaga); buscar/mostrar personas (opt-in por oportunidad seleccionada); enviar o escribir fuera de Driftless; mutar Knowledge o el perfil (proponer ≠ aprobar); continuar cuando el criterio quedó ambiguo Y todo default es irreversible o caro.

**Nunca (ni con permiso genérico):** encadenar gasto a un "sí" viejo (cada cotización es nueva); convertir un rechazo en insistencia (un "no" a investigación pagada cierra la oferta en esa sesión salvo que cambie el contexto y aparezca UNA nueva razón concreta); actuar por señales implícitas ("suena frustrado, gastemos más") — la autoridad solo viene de checkpoints.

---

## 7. Resumen del diagnóstico en una frase

El equipo construyó un motor gobernado sin director y una superficie que enseña el motor: hay que **contratar al director** (un agente con el significado y la estrategia, validado por el código que ya existe), **darle un solo tablero hacia el usuario** (el reductor de experiencia y el artifact de oportunidades), y **congelar la experiencia con el mismo rigor con que ya congelaron los eventos** (E2–E3 como contrato, E7 como su suite).

Los documentos internos ya contienen casi toda la verdad de producto (tesis MVP, workbench §5–§8, DESIGN §0.9). Este rediseño no los contradice: los destila, corrige donde chocan con la evidencia (ver E5 §"Desacuerdos con el diseño vigente") y los convierte en contratos verificables.
