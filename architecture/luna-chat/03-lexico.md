# Luna Chat — el léxico del producto

**Encargo:** que Luna hable exactamente la lengua del dashboard — el sidebar, los títulos de las pantallas de Inteligencia, el CRM y Cerebro — y deje de inventar sinónimos (`candidato`, `universo`, `mercado`, `análisis`) donde el producto ya tiene una palabra.
**Base auditada:** `apps/dashboard/src/i18n/messages.ts` (bloque `es-MX`, línea 1563 en adelante), `apps/dashboard/src/redesign/workspaceNav.ts` + `Rail.tsx` (el sidebar real, no el título de página), `apps/dashboard/src/intelligence/vocabulary.ts`, `apps/api/src/luna/luna-tools.ts`, `luna-turn.service.ts`, `luna-manual.ts`, `bench/run-bench.ts`.
**No se editó código.** Este doc es solo lectura del vocabulario existente; los cambios de código quedan listados en la última sección para que alguien más los aplique.

## El glosario

| Término del producto | Qué es (en palabras del producto) | De qué fuente sale | Cómo lo nombra Luna (singular/plural) | Qué NO es |
|---|---|---|---|---|
| **Cerebro** | El criterio comercial confirmado que el equipo conoce — oferta, ICP, exclusiones, señales, geografía, compradores, mensajes, playbooks. Se navega como documento o como grafo (`cerebro.viewDocument`/`cerebro.viewGraph`). | `nav.cerebro`, `cerebro.*` | "Cerebro" (siempre singular, nombre propio, sin artículo indefinido: "leí el Cerebro", no "un cerebro") | No es un topic suelto ni un chat de notas; una **Nota** (`home.addToCerebro`) es un hint privado que puede o no llegar a Cerebro. No es la sección "Conocimiento" del sidebar tampoco — Conocimiento es el grupo del rail; Cerebro es lo que hay dentro. |
| **CRM** — Colección | El contenedor operativo configurado: un `pipeline` con sus campos y etapas propias (`collections.collection`: "Pipeline"). El sidebar lo llama **Prospectos** (`nav.collections`); la pantalla que lo administra dice "Ajustar CRM" (`pipeline.adjust`). | `nav.collections`, `collections.*`, `pipeline.*` | "un pipeline" / "pipelines"; el grupo entero es "el CRM" o "Prospectos" (como en el sidebar) | No es una tabla genérica ni una "base de datos" — cada pipeline tiene su propia forma (campos + etapas). No es lo mismo que "Colección" a secas cuando se habla con la persona: el producto dice **pipeline**. |
| **CRM** — registro | Una fila dentro de un pipeline (`collections.record`: "record", `record.record`: "Record"). Tiene etapa, campos, actividad, criterio y evidencia propios. | `record.*` | "un registro" / "registros" (nunca "record" en inglés) | No es lo mismo que un "registro publicado" del lado de Mercado (`intel.record.publishedRecord`) — mismo sustantivo, dos objetos distintos; hay que decir de cuál se habla. Tampoco es "Registros" (mayúscula, plural, la pantalla de permisos del sidebar) — ese es un nombre propio de pantalla. |
| **CRM** — etapa | La columna por la que avanza un registro en el tablero del pipeline (`pipeline.stages`, `record.stage`: "Stage"/"Etapa"). | `pipeline.stage*`, `record.stage`, `stage.*` (Nuevo, Contactado, Calificado, Propuesta, Negociación, Ganado, Perdido…) | "etapa" / "etapas" | No es "status" ni "fase" — el producto dice etapa en todas partes (`record.historyStageChange`: "cambio de etapa"). |
| **Empresas** | El directorio de contacto **externo** (enrichment): organizaciones navegables por mercado, tamaño e industria, sin revelar correos hasta una adquisición explícita (`dir.companies.*`). Es también el nombre del ítem del sidebar bajo "Descubrir" (`nav.companies`). | `nav.companies`, `dir.companies.*` | "Empresas" (nombre de pantalla, mayúscula) / "una empresa" en prosa | **No es Proveedores.** Empresas es exclusivamente el directorio externo de enrichment (hoy fuera del cinturón de Luna); Proveedores son los directorios propios de Brein. Tampoco es lo mismo que `intel.observedKind.company` ("Empresa" como tipo de fila observada dentro de Proveedores/Registros) — ese es un valor de un campo cerrado (`observed_kind`), no la pantalla Empresas. |
| **Personas** | El directorio de contactos/decisores dentro de una empresa del directorio externo, navegable sin revelar datos (`dir.people.*`). Ítem del sidebar bajo "Descubrir". | `nav.people`, `dir.people.*` | "Personas" (pantalla) / "una persona", "un decisor" en prosa | No es un tipo de contacto de Proveedores (`intel.contactKind.*`: teléfono, celular, correo, WhatsApp, sitio web) — eso es disponibilidad de un canal, no un directorio de individuos. Hoy fuera del cinturón de Luna. |
| **Proveedores** | Los directorios **propios** de Brein — DENUE, MexicoIndustry — observados y publicados, bajo su propia identidad. Amplios pero no exhaustivos; requieren búsqueda o filtro. Ítem del sidebar bajo "Mercado". | `nav.suppliers`, `intel.suppliers.*` | "Proveedores" (pantalla) / "un proveedor", "proveedores" en prosa | **No es Empresas** (ver regla de separación abajo). Tampoco es "proveedor" en el sentido de `intel.record.supplier` dentro de una Adjudicación (la parte que ganó un contrato) — ahí "proveedor" es un rol dentro de una adjudicación, un dato más específico que la pantalla Proveedores. |
| **Licitaciones** | Procedimientos públicos de contratación publicados, sin fecha límite garantizada, con estado tal como lo imprimió el publicador. Ítem del sidebar bajo "Mercado" (etiqueta real: "Licitaciones", clave `nav.tenders`). | `nav.tenders`, `intel.opportunities.*` (la pantalla interna se llama `opportunities`) | "Licitaciones" (pantalla) / "una licitación", "oportunidades" solo cuando se cita el título interno de pantalla (`intel.opportunities.title`: "Licitaciones publicadas") | No es lo mismo que "Adjudicaciones" — una licitación es el procedimiento abierto; una adjudicación es el contrato ya otorgado bajo ese procedimiento. Un estado "abierto" no implica que siga siendo accionable (`intel.warning.openNotActionable`). |
| **Adjudicaciones** | Contratos ya adjudicados y publicados: quién ganó, cuánto, cuándo. Ítem del sidebar bajo "Mercado" (etiqueta real: "Adjudicaciones", clave `nav.awards`; el título dentro de la pantalla dice "Contratos adjudicados", `intel.procurement.title`). | `nav.awards` (sidebar), `intel.procurement.*` (pantalla) | "Adjudicaciones" (para hablar del sidebar) / "contratos adjudicados" (para hablar del contenido de la pantalla) — ambas correctas, mismo objeto | No prueba pago, entrega ni cumplimiento (`intel.warning.awardNotPayment`); un procedimiento puede tener varias adjudicaciones (`intel.warning.manyAwards`). No es "Licitaciones". |
| **Registros** (permisos/autorizaciones) | Permisos, concesiones y autorizaciones publicadas — un derecho otorgado al momento de otorgarse, nunca una verificación de que algo opere hoy. Ítem del sidebar bajo "Mercado" (etiqueta real: "Registros y permisos"). | `nav.registries`, `intel.registries.*` | "Registros" o "Registros y permisos" (pantalla) / "un permiso", "una autorización" en prosa | Ojo con la colisión de palabra: esto **no** es un "registro" del CRM ni un "registro publicado" genérico de Mercado — es el nombre propio de esta pantalla específica. |
| **Riesgos** (marcas de riesgo) | No es una pantalla propia del sidebar hoy: vive como una faceta dentro de Proveedores/Registros y del detalle de un registro (`intel.record.risk`: "Marcas de riesgo", `intel.evidenceCategory.risk`: "Registros administrativos de riesgo"). Una marca es un listado publicado por una autoridad, nunca una condena judicial (`intel.warning.riskNotConviction`). | `intel.record.risk`, `intel.warning.riskNotConviction`, `market_screen` (Luna) | "marcas de riesgo" / "una marca de riesgo" — nunca "riesgos" a secas como si fuera pantalla propia | No es una "lista negra" ni una "sanción confirmada"; es una marca administrativa publicada que puede convivir con una exoneración posterior. |
| **Investigador** | Investigación de una pregunta de mercado más allá de lo que las pantallas de Mercado responden directamente, con evidencia guardada como resultado durable (`investigator.*`). Ítem del sidebar bajo "Inteligencia". | `nav.investigator`, `investigator.*` | "Investigador" (pantalla) / "una investigación" en prosa | Hoy fuera del cinturón de Luna (S1 no tiene `research_start`/`research_status`); no confundir con una búsqueda cualquiera en Proveedores/Licitaciones — Investigador es para preguntas que ninguna pantalla responde con un filtro. |
| **Secuencias** | El paso "Secuencia" dentro de Campañas de correo (`email.step.sequence`): el borrador de N correos con audiencia y vista previa por destinatario. No es un ítem propio del sidebar — vive dentro de **Campañas** (`nav.email`). | `nav.email`, `email.step.sequence` | "una secuencia" / "secuencias" — siempre en el contexto de Campañas | No es "Campañas" en sí (Campañas es la pantalla completa: contactos, secuencia, remitente, revisión). Hoy fuera del cinturón de Luna. |
| **observación** | Cada fila de Proveedores/Registros es una observación publicada por una fuente en un momento dado — nunca una empresa consolidada. Dos filas con el mismo nombre son dos observaciones distintas (`intel.warning.observationNotCompany`, `intel.columnHint.observedName`). | `intel.warning.observationNotCompany`, `intel.columnHint.observedName` | "una observación publicada" / "observaciones" | No es "una empresa" ni "un candidato" — es el objeto que realmente devuelve la búsqueda. |
| **cobertura** | Cuántas fuentes activas o cuántos elementos publicados respalda una pantalla (`intel.coverage.activeSources`, `intel.companies.coverage`, `intel.coverage.span`: "de {{from}} a {{to}}"). | `intel.coverage.*`, `intel.*.coverage` | "cobertura" | No es "el universo" ni "todo el mercado" — cero resultados dentro de una cobertura no describe el mercado completo (`intel.warning.zeroWithCoverage`). |
| **créditos / uso** | Dos ledgers separados: **Créditos de inteligencia** (`settings.credits`, se consumen solo cuando una solicitud humana explícita revela coordenadas de contacto publicadas) y **saldo de créditos de contacto** (`settings.contactCredits`, un saldo prepagado aparte; desbloquear una empresa usa 2). Además, un techo de **consultas** mensuales (`intel.usage.requestsRemaining`). | `settings.credits*`, `settings.contactCredits*`, `intel.usage.*` | "créditos de inteligencia", "créditos de contacto", "consultas disponibles este mes" | **No existen "créditos de análisis"** como ledger — ese nombre no está en el producto; el ledger real que cubre agregados y detalle es **créditos de inteligencia**. |
| **selección** | La lista de trabajo viva de la sesión de Luna: tarjetas con su porqué, que se convierte en registros de un pipeline cuando la persona confirma (`intel.selection.*` para el equivalente del Explorer; en Luna, `board_read` la relee). | `intel.selection.*`, `01-interfaz-luna.md` §1/§4.3 (`selection_update`, `board_read`) | "la selección" / "seleccionados" | No es "el pipeline" todavía — sigue siendo selección en memoria hasta que se guarda; guardarla es el acto que la convierte en registros. |
| **evidencia** | Lo que respalda un resultado: la categoría de evidencia (`intel.evidenceCategory.*`), el registro publicado en sí, o el resumen que aparece en la ficha (`intel.record.evidence`, `record.evidence` en el CRM). Aparecer en un registro publicado dice lo que esa publicación afirma — nunca un estado vigente ni una verificación (`intel.record.evidenceNote`). | `intel.record.evidence*`, `record.evidence*` | "evidencia" (no cuenta plural natural; "la evidencia publicada") | No es "prueba" ni "verificación" — el producto es deliberadamente más débil: evidencia es lo que un publicador dijo, no un hecho confirmado. |

## La regla de separación Proveedores vs Empresas

El comentario que ancla esta regla vive junto a `intel.suppliers.title` en `apps/dashboard/src/i18n/messages.ts:1864-1866`:

> Proveedores — los directorios propios (DENUE, MexicoIndustry) bajo su propia identidad. "Empresas" queda exclusivamente para el directorio externo de enrichment.

Dicho como lo dice el producto: **Proveedores** son los directorios que Brein observa y publica bajo su propio nombre — amplios pero no exhaustivos, con evidencia pública verificable (RFC cuando está disponible, adjudicaciones vinculadas). **Empresas** es, exclusivamente, el directorio externo de enrichment: presencia en la web, dominio, sin revelar contacto hasta una adquisición explícita.

**La consecuencia operativa para Luna:**

- Todo lo que devuelve `market_search` con `kind:"suppliers"` (o cualquier otro `kind` del cinturón: `opportunities`, `awards`, `permits`, `risks`) son **proveedores** — u oportunidades, adjudicaciones, permisos, marcas de riesgo, según el `kind` — nunca "empresas". Son observaciones publicadas en los directorios propios de Brein, con la evidencia pública que cada `kind` trae (RFC, adjudicaciones vinculadas, permisos otorgados).
- El directorio externo de enrichment (`dir.companies.*`, respaldado por el buscador de empresas tipo Hunter) **no está en el cinturón de Luna todavía** — S1 no tiene una herramienta de tipo `company_search`. Luna no puede ofrecer resultados de Empresas porque no puede consultarlos.
- Un mismo registro del CRM puede terminar vinculado a ambos mundos una vez que alguien lo conecta por RFC o por dominio — eso es lo que hace la **Entidad** (`record.entity`: "identidad entre pipelines del CRM"). Hasta que ese vínculo exista, un proveedor observado en DENUE y una empresa del directorio externo son dos objetos distintos, aunque compartan nombre.

Tres frases que Luna **sí** debe decir:

1. "Encontré 18 proveedores en los directorios propios que coinciden con 'empaque industrial' en Jalisco — son observaciones publicadas, algunas con RFC."
2. "Esto es un proveedor, no una empresa consolidada: es una fila observada en DENUE en un momento dado."
3. "Todavía no puedo buscar en el directorio de Empresas — esa herramienta no está en mi cinturón hoy; sí puedo revisar Proveedores, Licitaciones, Adjudicaciones o Registros."

Tres frases que Luna **no** debe decir:

1. ~~"Encontré 18 empresas que coinciden con 'empaque industrial'."~~ (son proveedores, no empresas — vienen del directorio propio, no del enrichment externo).
2. ~~"Voy a buscar en el mercado general a ver qué candidatos aparecen."~~ (ni "mercado" como sustantivo genérico, ni "candidato" como sinónimo de resultado).
3. ~~"Esta empresa tiene 12 adjudicaciones consolidadas."~~ (una observación de Proveedores no es una empresa consolidada, y "consolidada" reintroduce justo la afirmación que `intel.warning.observationNotCompany` prohíbe).

## Mapa herramienta → palabra

Cada fila: la herramienta de Luna, el sustantivo de producto para lo que devuelve, y la etiqueta que debería verse mientras corre (reemplazando las actuales en `luna-turn.service.ts` `TOOL_LABELS` y `bench/run-bench.ts` `COUNT_LABEL`, que hoy dicen "Contando el universo real" y "Revisando un candidato").

| Herramienta | Sustantivo de producto para el resultado | Etiqueta actual (código) | Etiqueta propuesta (consistente con el sidebar) |
|---|---|---|---|
| `context_retrieve` | Notas y Knowledge del **Cerebro** | "Leyendo lo que el equipo ya sabe" | "Leyendo el Cerebro" |
| `context_get` | Una nota o topic de **Cerebro** | "Leyendo una nota del equipo" | "Abriendo una nota del Cerebro" |
| `market_search` | Filas de **Proveedores**, **Licitaciones**, **Adjudicaciones**, **Registros** o marcas de **Riesgo** (según `kind`) | "Buscando proveedores" (fijo, sin importar `kind`) | "Buscando en Proveedores" / "Buscando en Licitaciones" / "Buscando en Adjudicaciones" / "Buscando en Registros" / "Buscando marcas de riesgo" — una etiqueta por `kind`, igual que el Explorer nombra cada dominio |
| `market_count` | El total publicado de **Proveedores** que coincide con un filtro | "Contando el universo real" | "Contando cuántos proveedores coinciden" |
| `market_get` | El detalle de un **proveedor** o una **licitación** | "Revisando un candidato" | "Abriendo el detalle" (o "Abriendo el proveedor" / "Abriendo la licitación" si se conoce el tipo) |
| `market_aggregate` | Montos adjudicados agregados sobre **Adjudicaciones** | "Sumando montos adjudicados" | sin cambio — ya usa el sustantivo correcto |
| `market_history` | El historial de contratos de un proveedor en **Adjudicaciones** | "Revisando el historial del proveedor" | sin cambio |
| `market_compare` | Conteos de **Proveedores** cruzados por segmento y territorio | "Comparando segmentos y territorios" | sin cambio |
| `market_screen` | Marcas de **Riesgo** cruzadas contra una lista de RFC | "Revisando listas de riesgo" | "Revisando marcas de riesgo" (evita "listas", que no es como el producto llama a `intel.record.risk`) |
| `board_read` | La **selección** viva de la sesión | "Releyendo el tablero" | sin cambio (tablero/selección son el vocabulario propio de Luna, ya consistente con `01-interfaz-luna.md`) |
| `usage_read` | **Créditos de inteligencia**, **créditos de contacto** y consultas del periodo | "Revisando tu uso" | sin cambio en la etiqueta corta, pero ver el hallazgo de `luna-tools.ts:543` abajo (la descripción interna sí usa un nombre de ledger que no existe) |

## Palabras que Luna no usa

Más allá del léxico prohibido de `docs/architecture/experience-v2/02-conversaciones.md` (apéndice de frases prohibidas), estas son las que este léxico añade porque el producto ya tiene su propia palabra:

| Palabra a evitar | Por qué | Reemplazo |
|---|---|---|
| **candidato** | El producto reserva esta palabra para un significado preciso y distinto: un nombre parecido sin confirmar (`intel.match.trigram`: "Nombre similar (candidato)"; `intel.warning.trigramNotIdentity`: "Un nombre similar es un candidato, no una identidad confirmada"). Usarla como sinónimo genérico de "resultado de búsqueda" (como hacen hoy `market_search`, `market_get` y la etiqueta "Revisando un candidato") pisa ese significado y hace ambiguo cuándo algo es de verdad una coincidencia de nombre sin confirmar. | El sustantivo del `kind`: "un proveedor", "una licitación", "una adjudicación", "un permiso", "una marca de riesgo" — o genéricamente "un resultado"/"una fila". Reservar "candidato" solo para el caso de coincidencia por nombre (`match: trigram`). |
| **universo** | No aparece en ningún string de producto. `market_count` ya tiene su propio verbo: "¿Cuántos coinciden?" (`intel.count.ask`), "{{count}} observaciones publicadas coinciden con esta búsqueda" (`intel.count.result`). | "cuántos [proveedores/…] coinciden", "el total publicado que coincide", nunca "el universo". |
| **mercado** (como sustantivo genérico para los datos, ej. "datos de mercado", "en el mercado hay…") | "Mercado" SÍ es una palabra del producto, pero como **nombre del grupo del sidebar** (`nav.market`) que agrupa Licitaciones/Proveedores/Adjudicaciones/Registros — no como sinónimo de "toda la base de datos". Decir "voy a ver qué hay en el mercado" no dice en cuál de las cuatro pantallas se buscó. | Nombrar la pantalla específica: "en Proveedores", "en Licitaciones", "en Adjudicaciones", "en Registros" — o "en el grupo Mercado" solo cuando de verdad se habla de las cuatro a la vez. |
| **análisis** (genérico) | El producto reserva "Análisis" para un modo de pantalla muy concreto: el selector Lista/Análisis de Adjudicaciones (`intel.mode.analysis`: "Análisis", `intel.agg.run`: "Ejecutar el análisis (1 consulta)"). Llamar "análisis" a cualquier cosa que `market_aggregate`, `market_compare` o `market_history` hacen difumina esa etiqueta concreta — y `usage_read` (`luna-tools.ts:543`) ya heredó el error llamando "créditos de análisis" a un ledger que el producto llama **créditos de inteligencia**. | Nombrar la acción: "sumar montos adjudicados", "comparar segmentos", "revisar el historial del proveedor", "revisar marcas de riesgo". Reservar "análisis" solo para cuando de verdad se invoca el modo Análisis de Adjudicaciones. |
| **dataset** | El propio locale en español lo evita: donde el inglés dice "the dataset's stable order" (`intel.matchExplanation.filters` en `en`), el español dice "el orden estable del **conjunto de datos**" (misma clave, bloque `es-MX`, línea 1853). | "conjunto de datos" solo si hace falta ser genérico; mejor, nombrar la pantalla ("Proveedores", "Registros"…). |
| **warehouse** | Ya está en el léxico prohibido (`FORBIDDEN_LEXICON` en `luna-intent.ts:47`) y en las claves internas vetadas de las specs (`FORBIDDEN_KEY_SUBSTRINGS`). Confirmado aquí porque no tiene ningún equivalente en `messages.ts` — no es una palabra que la persona vaya a reconocer. | "los directorios propios de Brein", "lo publicado", según el contexto. |
| **fuente interna / fuente externa** | El producto nunca describe la diferencia así. La distinción real y ya nombrada es "directorios **propios**" (`intel.suppliers.description`: "Los directorios propios de Brein — como DENUE y MexicoIndustry") contra el directorio de **Empresas** (externo, pero nunca llamado "externo" de cara a la persona). | "los directorios propios de Brein" vs. "el directorio de Empresas" — nunca "interno"/"externo". |
| **registro** sin calificar | No es que el producto la evite — la usa mucho — pero está sobrecargada tres veces: un registro del CRM (`record.record`), un registro publicado de Mercado (`intel.record.publishedRecord`) y el nombre propio de la pantalla "Registros" (permisos). Decir solo "registro" sin más deja ambiguo cuál de los tres. | Calificar siempre: "un registro del CRM", "un registro publicado", "la pantalla Registros" / "un permiso". |

## Cambios pendientes

Lista mecánica, archivo:línea, de cada lugar en `apps/api/src/luna/` (y los docs 01/02 de esta carpeta) que usa una palabra fuera del léxico del producto. Solo lectura — nada de esto se editó.

### `apps/api/src/luna/luna-tools.ts` (6 apariciones)

- `luna-tools.ts:3` — comentario de cabecera: "Cerebro (context_retrieve/context_get), **Mercado** read-only (...) y Sesión" — "Mercado" aquí se usa correctamente como nombre del grupo, no requiere cambio; se lista solo para que quien aplique el resto no lo confunda con las líneas de abajo.
- `luna-tools.ts:389` (`market_search.description`) — "Busca **candidatos** acotados en el **mercado**: proveedores, oportunidades de gobierno, adjudicaciones, permisos o marcas de riesgo. (...) solo si el **candidato** tiene un canal de contacto publicado". Dos usos de "candidato" como sinónimo genérico de fila, y "mercado" como sustantivo de datos.
- `luna-tools.ts:413`/`415` (`market_count.title`/`description`) — título "Mercado: contar" (correcto, nombre de grupo); descripción: "El tamaño real del **universo** de proveedores (...) esa es una muestra acotada, no el **universo**." Dos usos de "universo".
- `luna-tools.ts:438`/`440` (`market_get.title`/`description`) — "Detalle de UN **candidato** de mercado (proveedor u oportunidad) (...) solo si el **candidato** tiene un canal de contacto publicado". Dos usos de "candidato"; "de mercado" también generaliza donde debería nombrar el `kind`.
- `luna-tools.ts:456`/`458` (`market_aggregate.title`/`description`) — "NO la uses (...) ni para el tamaño de un **universo** de proveedores (market_count)". Un uso de "universo".
- `luna-tools.ts:543` (`usage_read.description`) — "lecturas usadas y restantes en el techo horario, **créditos de análisis**, saldo de créditos de contacto (un ledger distinto)". "Créditos de análisis" no es un ledger del producto: el ledger real es **créditos de inteligencia** (`settings.credits` en `messages.ts:2556`). Este es el hallazgo más concreto de la auditoría — un nombre de ledger inexistente en una descripción que el modelo lee literalmente.

### `apps/api/src/luna/luna-turn.service.ts` (2 apariciones)

- `luna-turn.service.ts:236` — `market_count: 'Contando el universo real'`. "Universo" otra vez, en la etiqueta que la persona ve mientras la herramienta corre.
- `luna-turn.service.ts:237` — `market_get: 'Revisando un candidato'`. "Candidato" en la etiqueta visible.

### `apps/api/src/luna/luna-manual.ts` (3 apariciones)

- `luna-manual.ts:212` — "cuenta el **universo** con `market_count`".
- `luna-manual.ts:217` — "el tamaño del **universo** sale de `market_count`, jamás del tamaño de una página".
- `luna-manual.ts:623` — "Tienes herramientas para consultar datos de **mercado** y el contexto del equipo" — "datos de mercado" como sustantivo genérico; no nombra Proveedores/Licitaciones/Adjudicaciones/Registros.

(`luna-manual.ts:234` — "Si vigilar el **mercado** tiene sentido..." — este uso es más discutible: podría leerse como "vigilar el grupo Mercado completo" en sentido correcto, o como el sustantivo genérico. Se deja anotado para que quien revise decida si necesita nombrar la pantalla.)

### `apps/api/src/luna/bench/run-bench.ts` (1 aparición)

- `bench/run-bench.ts:103` — `const COUNT_LABEL = 'Contando el universo real'`. Mismo texto que `luna-turn.service.ts:236`; el bench mide contra esta etiqueta, así que hay que cambiar ambos lugares juntos o el bench se queda comparando contra la copia vieja.

### `apps/api/src/luna/bench/briefs.json`

- 0 apariciones. Los briefs y sus expectativas no usan ninguna de las palabras auditadas.

### `docs/architecture/luna-chat/01-interfaz-luna.md` (7 apariciones)

- `01-interfaz-luna.md:24` — tabla de la escena: "conteo real del **universo**".
- `01-interfaz-luna.md:79` — encabezado "### 4.2 **Mercado** (donde nace la lista)" — uso correcto (nombre de grupo), sin cambio.
- `01-interfaz-luna.md:86` — descripción de `market_count`: "Tamaño real del **universo**. Es la única forma legítima de decir 'hay N'."
- `01-interfaz-luna.md:87` — descripción de `market_get`: "Detalle de un **candidato** u oportunidad, sin contactos."
- `01-interfaz-luna.md:113` — "Previsualiza el alta de empresas del **mercado** como registros" — "mercado" genérico otra vez.
- `01-interfaz-luna.md:122` — "Hasta 3 **candidatos** por empresa, enmascarados" — sobre contactos de una persona, un uso todavía más alejado del producto, que llama a eso "personas"/"decisores", no "candidatos".
- `01-interfaz-luna.md:272` — "**Mercado**: 13 tools MCP..." — nombre de grupo, sin cambio.
- `01-interfaz-luna.md:285` — "Cuenta con `market_count`: ninguna cifra de **universo** sale de un tamaño de página."
- `01-interfaz-luna.md:331` — mockup de terminal: "✓ 412 **candidatos**".

### `docs/architecture/luna-chat/02-plan-de-ejecucion.md` (1 aparición)

- `02-plan-de-ejecucion.md:50` — "los pasos ('leí el criterio del equipo', '412 **candidatos**')".

### Total de cambios pendientes por archivo

| Archivo | Apariciones a corregir |
|---|---|
| `apps/api/src/luna/luna-tools.ts` | 8 (candidato ×4, universo ×3, "créditos de análisis" ×1) |
| `apps/api/src/luna/luna-turn.service.ts` | 2 (universo ×1, candidato ×1) |
| `apps/api/src/luna/luna-manual.ts` | 3 (universo ×2, mercado-genérico ×1) — + 1 caso dudoso sin contar |
| `apps/api/src/luna/bench/run-bench.ts` | 1 (universo ×1) |
| `apps/api/src/luna/bench/briefs.json` | 0 |
| `docs/architecture/luna-chat/01-interfaz-luna.md` | 7 (universo ×3, candidato ×3, mercado-genérico ×1) |
| `docs/architecture/luna-chat/02-plan-de-ejecucion.md` | 1 (candidato ×1) |
| **Total** | **22** apariciones en 6 archivos (más 1 caso dudoso en `luna-manual.ts:234`) |
