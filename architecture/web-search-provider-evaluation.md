# Evaluación de proveedores de web search / fetch para Driftless

**Base:** `staging` — es donde vive el Radar, el warehouse GTM y los cuatro
Source Packs. `main` no tiene `apps/api/src/radar/`.
**Estado:** el núcleo provider-neutral está **implementado y verde**; los
adapters y el benchmark **no**, y no pueden estarlo sin capturas reales contra
cuentas de pago.

### Estado por tarjeta

| Tarjeta | Estado | Verificación |
|---|---|---|
| WS-01 Port + candado | ✅ `review` | 47 tests |
| WS-02 Golden set congelado | ✅ `review` | 100 casos, todos los hosts clasifican |
| WS-08 HostClassification | ✅ `review` | 23 tests |
| WS-09 EvidenceRouter + cinturón | ✅ `review` | 29 tests, corpus real de los 10 `forbidden` |
| WS-10 WebIngest | ✅ `review` | 29 tests |
| WS-11 Autoridad por `claim_type` | ✅ `review` | 16 tests |
| WS-12 Frontera + inyección | ✅ `review` | 21 tests, contención 1.00 |
| WS-13 Packs tarifados + ledger | ✅ `review` | 17 tests |
| WS-03 Fixtures | ⛔ bloqueada | Necesita capturas reales |
| WS-04/05/06 Adapters | ⛔ bloqueada | Necesitan cuentas de pago |
| WS-07 Bench | ⛔ bloqueada | Sin fixtures no mide |
| WS-14 Quote + kill switch | ⏳ pendiente | Depende de WS-04/05 |
| WS-15/16 Shadow + canary | ⛔ bloqueada | Requieren staging vivo y presupuesto |

**Radar + chat: 705 tests en verde, 0 fallos.**

Todo lo implementado es **provider-neutral**: nada de esto cambia según quién
gane el benchmark, que es exactamente lo que permite decidir el proveedor al
final en vez de al principio.
**Fecha de los precios:** 2026-08-01, verificables en las fuentes del final.
**Proyecto:** independiente. No toca la arquitectura DeepSeek/Luna ni el
gateway de inferencia.

**Artefactos:**

| Archivo | Qué es |
|---|---|
| [`apps/api/src/radar/ports/web-search-provider.port.ts`](../../apps/api/src/radar/ports/web-search-provider.port.ts) | El contrato TypeScript, provider-neutral, junto a los otros dos ports del Radar |
| [`evals/web-search/golden-queries.json`](../../evals/web-search/golden-queries.json) | 100 consultas reales de Driftless, congeladas, con trampa declarada por caso |
| [`web-search-fixtures-and-metrics.md`](web-search-fixtures-and-metrics.md) | Catálogo de fixtures redactadas, reglas de redacción y fórmulas de las 10 métricas |

---

## 0. Frontera del proyecto (lo primero, porque es lo que más fácil se rompe)

Este proyecto **no** comparte código, despliegue ni cadencia con la arquitectura
de inferencia:

- **No toca `libs/model-gateway` ni `apps/api/src/agent-runs/model-gateway.service.ts`.**
  Un proveedor de web search no es un modelo. No entra al catálogo de modelos, no
  usa `provider-credential.service`, no aparece en `model-list`, no consume el
  presupuesto de tokens.
- **No bloquea el gateway de inferencia.** Toda llamada web es asíncrona respecto
  del stream del chat y tiene `AbortSignal`. Si el proveedor web cae, el chat
  responde con lo que hay en el almacén y lo dice; nunca se queda esperando.
- **Vive en `apps/api/src/radar/`**, bajo el mismo patrón port/adapter que ya
  existe para `DiscoveryProviderPort` y `EndpointVerifierPort`, y bajo el mismo
  candado (`radar-architecture.spec.ts`).
- **El contrato es provider-neutral por construcción.** El propio candado ya
  exige que `ports/discovery-provider.port.ts` no mencione a `parallel` ni a
  `exa`; el nuevo port hereda esa regla.

### Nota sobre las referencias del encargo

`docs/architecture/commercial-intelligence-chat-plan.md` **no existe en ninguna
rama**. El resto del encargo sí: `apps/api/src/radar/**` vive en `staging`
(80 commits por delante de `main`), y este documento está anclado ahí, más el
contexto Driftless del área `InteligenciaComercial`
(`commercial-intelligence-system-dictionary`, `fabrica-de-fuentes-arquitectura`,
`gtm-claim-vocabulary-allowlist`, `gtm-dynamic-freshness-scheduling`,
`opportunity-flow-research-contracts`, `radar-comercial-parallel-roadmap`).

Una diferencia que importa para el golden set: **COFEPRIS no está en `staging`**
— vive en `work/cofepris-warehouse`, tres commits por delante. Los Source Packs
registrados en `staging` son `denue`, `iieg-jalisco`, `dirind` y `company-site`.
Consecuencia de diseño, no de redacción: la **tabla de autoridad por
`claim_type` (§5.5) se construye desde los packs realmente registrados**, no
desde una lista fija. Si no lo hiciera, los diez casos `forbidden` del golden
set que citan COFEPRIS estarían protegiendo un registro que en `staging` todavía
no existe — y "protegido por un pack ausente" es indistinguible de "no
protegido".

---

## 0.1 Qué ya existe en `staging` y qué añade este diseño

Esta sección es la que decide el tamaño real del trabajo. La parte cara ya está
construida.

### Ya existe (y el diseño lo reutiliza tal cual)

| Pieza | Dónde | Qué aporta |
|---|---|---|
| Warehouse de lectura | `gtm/warehouse-query.service.ts` | El carril de costo cero. Superficie deliberadamente cerrada a `listClaims`/`listEntities` |
| Los tres stores | `gtm/artifact-store` · `observation-store` · `evidence-claim-store` | Dedup por `content_hash`, span validado antes de escribir, claims append-only |
| Gramática de spans | `libs/db/src/gtm/artifact-span.ts` | `page:` · `offset:` · `selector:`, un parser y un formateador |
| Serialización con citación | `gtm/gateway-result.ts` | Descarta toda claim sin observación citable |
| Independencia de orígenes | `gtm/corroboration.ts` | Ya resuelve `iieg-jalisco` vs `denue` |
| Política de costo por pack | `gtm/gtm-cost-policy.ts` | `parseCostPolicy()` **lanza** si un pack no está tarifado |
| Ledger de intentos | `gtm/provider-attempt.service.ts` | `cost_per_accepted_usd` por capacidad, sin tabla nueva |
| Ciclo de vida de packs | `gtm/source-pack-registry.service.ts` | `experimental → shadow → active` con bloqueo pesimista |
| Obstrucciones | `gtm/obstruction-ledger.service.ts` | Taxonomía cerrada de 12 clases con CHECK en BD |
| Créditos y reembolsos | `credits.service.ts` · `radar-pricing.ts` | `debitAndRun` idempotente, `MARGIN_FLOOR` verificado en spec |
| Escalón cero | `gtm/source-packs/company-site/` | Sitio propio, $0, honra `robots.txt` |
| Candado port/adapter | `radar-architecture.spec.ts` | Falla el build si el vocabulario de un vendor entra al dominio |
| Warehouse en el chat | `chat/chat-tools.ts` · `cognitive/surface-tools.ts` | `query_gtm_warehouse`, con `describeClaim()` y sin JSON crudo |
| Aviso de cobertura gratis | `conversation/radar-conversation.service.ts` | Antes de cotizar, avisa que hay datos gratis para esa geografía |
| Perfil comercial | topic `perfil-comercial` por workspace | Geografía, comprador y exclusiones aprendidos entre búsquedas |

### El hallazgo

`ParallelAdapter` en `staging` llama **solo** a `/v1beta/findall/*` y
`/v1/monitors`. Las dos primitivas de $0.001 —**Search y Extract**— no se usan
en ninguna parte del repo.

Es decir: hoy el sistema solo sabe comprarle a Parallel su producto **caro**
(FindAll: $2.00 + $0.15/match en `core`). El comentario de
`noteWarehouseCoverage` lo dice con la factura en la mano — *"a $6 Parallel run
for 59 companies"*. Las primitivas baratas ya están contratadas, cubiertas por
la misma `PARALLEL_API_KEY` desplegada, y sin usar.

### Lo que este diseño añade

| Añade | Por qué no existe ya |
|---|---|
| `WebSearchProviderPort` | No hay contrato para search/fetch/extract; `DiscoveryProviderPort` modela enumeración de cuentas, no adquisición de evidencia |
| Adapter de las primitivas baratas | Nadie llama a Search ni a Extract |
| `EvidenceGapRouter` | El "DENUE primero" existe como **mensaje de chat**, no como regla de adquisición. Su propio comentario dice: *"Deliberately NOT a gate"* |
| `WebIngestService` | Los tres stores existen y **nada escribe filas derivadas de la web** |
| Tabla de autoridad por `claim_type` | Nada impide hoy que una claim web pise una de DENUE |
| Frontera de contenido no confiable | No hace falta mientras nadie ingiera páginas arbitrarias. Con web search, sí |

### Cómo encaja con el aviso de cobertura que ya existe

`noteWarehouseCoverage()` es informativo **a propósito**: su comentario advierte
que nunca debe bloquear ni descontar la cotización, porque un tropiezo del
warehouse no puede romper el flujo de dinero que tiene al lado. **Ese diseño se
respeta.**

El router no lo convierte en compuerta. Vive una capa abajo, en adquisición, y
lo que hace es darle al aviso **una tercera opción que hoy no existe**. Hoy la
cotización es binaria: pagas la búsqueda nueva, o nada. Con las primitivas
baratas hay un escalón intermedio:

> Ya tengo 340 empresas de Jalisco en el almacén.
> · Rellenar huecos de las que ya tengo — **~0 créditos**
> · Búsqueda nueva y exhaustiva — **25 créditos**

Ese escalón intermedio es el producto de este proyecto. El ahorro de centavos
por request es secundario; lo que cambia es **la conversación**.

---

## 0.2 Alcance: qué NO hace este proyecto

Escrito explícitamente porque tres ideas adyacentes salieron durante el diseño,
son buenas, y **ninguna entra**. Dejarlas anotadas aquí evita que reaparezcan
como “mejoras” a mitad de implementación.

| Fuera de alcance | Por qué no ahora |
|---|---|
| **Encender `tool-policy.ts`** | Está *dark* a propósito — su propio encabezado dice que ninguna superficie lo consulta todavía, y liberalizarlo está gateado por una decision card humana. Afecta a **todas** las herramientas en **todas** las superficies. Encenderlo como efecto secundario de un proyecto de web search sería un cambio de plataforma disfrazado de feature |
| **Promover `gtm_provider_waterfall` a Collection** | Es el movimiento que convertiría la cascada en producto configurable sin deploy — y toca una tabla que ya está en producción. Merece su propio proyecto y su propia decisión |
| **Cascada general por capacidad** (Apollo/ColdIQ/Hunter antes de Parallel para `entity_facts`) | La intuición es correcta —un lookup de costo fijo antes de uno agéntico sin techo— pero es una decisión de compra sobre proveedores de enriquecimiento, no sobre web search. La cascada de contactos ya existe y ya funciona; generalizarla es otro proyecto |
| **Monitores por segmento y `FindAll preview` como sonda** | Son estrategia de compra sobre el producto **caro** de Parallel. Valen, y el hallazgo de §0.1 los justifica, pero no son web search |

Lo que sí entra: **el port, sus adapters, el router de huecos, la ingesta
gobernada y la evaluación.** Nada más.

### La compuerta de costo, versión mínima

La pregunta “¿cómo hago que Parallel solo se use cuando toca?” se resuelve
**dentro del router**, sin motor de políticas y sin tocar nada compartido.

El router arma el cinturón; el modelo no elige escalar:

| Herramienta | `costClass` | Aparece en el cinturón cuando… |
|---|---|---|
| `web_search_gap` | `cheap` | …el router registró un hueco de evidencia abierto (§4, pasos 1-4 agotados) |
| `web_search_retry` | `moderate` | …`web_search_gap` dejó `outcome: 'no_result'` **registrado** para ese hueco |
| discovery exhaustiva | `expensive` | …**nunca automáticamente**. Ya vive detrás del flujo de cotización existente |

Dos propiedades que esto compra gratis:

1. **La escalada se demuestra, no se afirma.** El “escalón anterior falló” no es
   lo que el agente dice: es una consulta a `gtm_provider_attempts`, que ya
   registra `outcome` por intento. El agente no puede convencerse a sí mismo de
   que ya intentó.
2. **Compone hacia adelante en vez de refactorizarse.** Las herramientas se
   declaran con el `costClass` correcto desde el día uno. El día que se encienda
   `tool-policy.ts` —su propio comentario ya promete que los reads irán
   *"bounded by the tool's outputBudget/costClass"*— heredan el comportamiento
   sin tocarlas.

Y a prueba de inyección por construcción: una página comprometida no puede
llamar a una herramienta que no está en el cinturón. No depende de disciplina de
prompt.

---

## 1. Recomendación comparativa

### 1.1 El veredicto

| Rol | Proveedor | Precio verificado | Por qué |
|---|---|---|---|
| **Principal** | **Parallel** — `Search` modo `turbo` + `Extract` | $1.00 / 1k búsquedas · $1.00 / 1k extracciones | Único candidato que devuelve **excerpts + `publish_date`** en la misma llamada al precio más bajo del mercado, y cuyo `Extract` cubre **JS y PDF** al mismo precio. Ya está contratado, cableado y con la clave desplegada. |
| **Fallback** | **Serper.dev** (búsqueda) + **Jina Reader** (lectura) | $0.30–$1.00 / 1k búsquedas · ≈$0.10 / 1k páginas | Es **Google** con `gl=mx&hl=es&location=` y `tbs=qdr:` — la mejor segmentación México/español disponible — sobre un **índice ascendente distinto**, que es lo que hace válida la corroboración entre familias. |
| **Discovery exhaustiva** | **Parallel FindAll** (ya integrado) | preview $0.10 · base $0.25 + $0.03/match · core $2.00 + $0.15/match · pro $10.00 + $1.00/match | Ya está en `radar-cogs.ts` y ya está tarifado en `radar-pricing.ts`. No es una decisión nueva: es la decisión de **no** meter discovery exhaustiva por la puerta barata. |
| **Segunda opinión exhaustiva** | **Exa** `deep` — solo tras quote + aprobación | $12–$15 / 1k | Índice neural propio y verdaderamente independiente. Se usa cuando FindAll devuelve `honest_no_data` y el caso justifica el gasto. Nunca por defecto. |

### 1.2 Esta recomendación es **provisional y falsable**

No se asume que Parallel sea la respuesta. Es la **entrada por defecto al
benchmark**, elegida por precio verificado y por costo de integración cero. El
shadow benchmark (§11) la degrada automáticamente si ocurre cualquiera de estas
tres cosas:

1. `citation_coverage < 0.95` sobre el golden set — es decir, sus excerpts no
   producen spans re-derivables contra el artifact almacenado. Sería fatal:
   `toGatewayResult()` descarta las claims sin citación, así que ese gasto se
   tira entero en la serialización.
2. `freshness_accuracy < 0.85` — `publish_date` equivocado es peor que ausente.
3. `costo_por_respuesta_util` > 1.5× el par Serper+Jina en las categorías
   `espanol-mexicano` y `ambigua`. Ahí es donde un índice global suele ser
   delgado y donde Google es fuerte.

Si se cumple (1) o (3), el par **Serper + Jina Reader** pasa a principal. Si se
cumple (2), Parallel sigue como buscador pero la fecha se deriva del documento
que **nosotros** traemos por `fetch()`, no de lo que el proveedor declara.

### 1.3 Por qué el precio por request no decide

Serper es 3× más barato por request que Parallel turbo. Y aun así no es el
principal recomendado. La razón está en el §7 (costo por respuesta útil), pero se
resume en una frase: **Serper devuelve snippets sin fecha ni span, así que cada
resultado necesita una segunda llamada para convertirse en evidencia, y una
tercera para fecharla.** Parallel devuelve las tres cosas en una. Al precio
absoluto de ambos —céntimos por cuenta— la diferencia de precio es ruido frente a
la diferencia de pasos y de superficie de fallo.

Y hay un costo que la tabla de precios nunca muestra: **un proveedor nuevo cuesta
una revisión legal, un secreto en producción, un adapter, un candado, un
runbook y una entrada en el registro de subprocesadores.** Parallel ya pagó todo
eso.

### 1.4 Descartados, y por qué

| Proveedor | Precio | Razón del descarte |
|---|---|---|
| **Google Custom Search JSON API** | $5/1k, tope 10k/día | **Cerrado a clientes nuevos** desde 2025 y **retiro total el 2027-01-01**. Contrato muerto: no se construye sobre algo con fecha de defunción publicada. |
| **Bing Web Search API** | — | **Retirado el 2025-08-11.** Su reemplazo (*Grounding with Bing Search* en Azure AI Agents) no es una API de búsqueda: es un producto de agentes que obliga a un proyecto de Azure AI Foundry. Es un compromiso de plataforma, no un adapter. |
| **Brave Search API** | $5/1k | Mismo precio que Parallel `advanced` con menos capacidades: sin excerpts alineados a objetivo, sin extract, sin PDF. Además **eliminó su capa gratuita en febrero de 2026**, lo que en esta categoría es una señal de dirección, no un ajuste. Se queda en el bench como control. |
| **Exa como principal** | $7/1k (subió desde $5 en marzo de 2026) | 7× el principal por una fortaleza —búsqueda semántica sobre índice propio— que sirve para **descubrir**, no para **rellenar huecos**. Nuestras consultas de hueco son búsquedas de entidad nombrada, donde el keyword search gana. Se conserva para discovery exhaustiva. |
| **Perplexity Search / Sonar** | $5/1k + tokens (+ Pro $14–22/1k) | Desalineado con el contrato, no solo con el precio: es una superficie orientada a **respuesta sintetizada**, y este sistema prohíbe exactamente eso — la síntesis de un modelo presentada como evidencia. Además cobra por request *y* por tokens, lo que hace el COGS por consulta no acotable antes de llamar; `estimate()` no podría cumplir su contrato. |
| **Tavily** | ~$5–8/1k básica; avanzada = 2 créditos | 5–8× el principal sin capacidad que nos falte. Queda en el bench. |
| **Linkup** | $5/1k estándar; $50/1k deep | Igual que Tavily en la capa barata. Su `deep` a $50/1k está en el rango de FindAll `pro` sin la salida estructurada de FindAll. |
| **SerpApi** | $9–25/1k | 10–25× Serper por el mismo SERP de Google. Dominado en precio sin compensación. |
| **Firecrawl** | ~$0.60–$3.20 / 1k páginas según plan | Buen producto de fetch, pero solo gana a Parallel Extract en planes con compromiso alto, y su `/extract` se factura en una **vía de tokens separada**. Eso choca de frente con `parseCostPolicy()`, que rechaza un pack sin política de costo precisamente para que ningún origen corra "gratis por accidente". Bench-only. |
| **Zyte / ScrapingBee / Bright Data** | Zyte ~$1.01–$16.08/1k (browser, por dificultad); ScrapingBee 5–75 créditos/req | No son proveedores de búsqueda: son **músculo de acceso** para hosts hostiles — el cajón 2 de la Fábrica. Se mantiene **Zyte** como escalón de escalada solo para hosts que bloqueen, nunca en la ruta normal. |
| **Apify** | por actor | Precio por actor, distinto en cada uno: no se puede declarar una `GtmCostPolicy` estable. Un origen no tarifable no se puede correr. |
| **Diffbot** | — | Es un producto de *knowledge graph*: compite con el almacén en lugar de rellenar sus huecos. Comprarlo sería sustituir el activo que la Fábrica existe para construir. |

### 1.5 El dato que justifica todo el diseño

En los últimos doce meses, en esta categoría exacta:

- Microsoft **retiró** las Bing Search APIs por completo (2025-08-11).
- Google **cerró** Custom Search JSON API a clientes nuevos y anunció su retiro
  (2027-01-01).
- Brave **eliminó** su capa gratuita (febrero 2026).
- Exa **subió** el precio de búsqueda un 40 % (marzo 2026: $5 → $7 / 1k).

Cuatro cambios unilaterales y disruptivos de proveedor en un año. **El riesgo de
proveedor en web search no es hipotético: está demostrado.** Ese es el argumento
real a favor del port, de tarifar cada pack y de tener siempre un fallback vivo —
no la elegancia arquitectónica.

---

## 2. Matriz de capacidades

Precios en USD, verificados al 2026-08-01. `n/d` = el proveedor no lo publica,
que en este documento cuenta como *desconocido*, nunca como *ilimitado*.

### 2.1 Búsqueda

| Proveedor | $/1k req | Resultados incluidos | Extra | Latencia declarada | Rate limit | JS | PDF | Excerpts | Fecha de publicación | Filtro fecha | Filtro dominio | País/idioma |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Parallel `turbo`** | **$1.00** | 10 | $1/1k | p50 ~200 ms | 600/min | vía Extract | vía Extract | **sí** | **sí** | `after_date` | include/exclude | `location` ISO-2 |
| Parallel `basic` | $5.00 | 10 | $1/1k | ~1 s | 600/min | vía Extract | vía Extract | sí | sí | sí | sí | sí |
| Parallel `advanced` | $5.00 | 10 | $1/1k | ~3 s | 600/min | vía Extract | vía Extract | sí | sí | sí | sí | sí |
| **Serper.dev** | **$0.30–$1.00** | 10 (1 créd.) | 11–100 = 2 créd. | ~1 s | n/d | no | no | snippet | **no fiable** | `tbs=qdr:` | `site:` | **`gl`/`hl`/`location`** |
| Brave | $5.00 | 20 | n/d | n/d | por plan | no | no | snippet | parcial | `freshness` | no | `country`/`search_lang` |
| Tavily básica | ~$5–8 | 5–20 | 2 créd. avanzada | n/d | por plan | no | no | sí | parcial | `days` | include/exclude | `country` |
| Linkup estándar | $5.00 | n/d | — | n/d | n/d | no | no | sí | parcial | sí | sí | n/d |
| Perplexity Search | $5.00 | n/d | + tokens | n/d | n/d | no | no | sí | sí | sí | sí | n/d |
| **Exa** | $7.00 | 10 | $1/1k | n/d | n/d | vía contents | categoría `pdf` | sí (+$1/1k resumen) | sí | `start/endPublishedDate` | include/exclude | filtro de idioma |
| Exa `deep` | $12–$15 | — | — | multi-paso | n/d | sí | sí | sí | sí | sí | sí | sí |
| SerpApi | $9–$25 | 10 | — | n/d | por plan | no | no | snippet | no fiable | `tbs` | `site:` | `gl`/`hl` |
| ~~Google CSE~~ | $5.00 | 10 | — | — | 10k/día | no | no | snippet | no | `sort=date` | sí | `gl`/`lr` |
| ~~Bing Web Search~~ | retirado | — | — | — | — | — | — | — | — | — | — | — |

### 2.2 Fetch / extract

| Proveedor | $/1k páginas | JS | PDF | Devuelve bytes | Markdown | Excerpts por objetivo | Fecha | Notas |
|---|---|---|---|---|---|---|---|---|
| **Parallel Extract** | **$1.00** | **sí** | **sí** | no (respuesta de proveedor) | sí | sí | sí | 1–3 s cacheado, 60–90 s en vivo; `full_content` opcional |
| **Jina Reader** | ≈**$0.10** ($0.02/1M tokens de salida) | limitado | parcial | sí | sí | no | no | Capa sin clave a ~20 rpm; 500 rpm con clave. **Adquirido por Elastic (oct. 2025)** |
| Exa `/contents` | $1.00 | sí | sí | no | sí | highlights | sí | `livecrawl` con `maxAgeHours` |
| Firecrawl `scrape` | $0.60–$3.20 | sí | sí (1 créd./pág.) | sí | sí | no | parcial | `stealth` = 5 créd./pág.; `/extract` se factura aparte por tokens |
| Zyte (browser) | $1.01–$16.08 según dificultad | sí | parcial | sí | no | no | no | $0.48/1k con compromiso de $500/mes |
| ScrapingBee | 5 créd. JS / 25 premium / 75 stealth | sí | no | sí | no | no | no | Multiplicadores hacen el COGS difícil de acotar antes de llamar |
| **Escalón cero** (`company-site`, ya existe) | **$0.00** | no | no | sí | no | no | no | Respeta `robots.txt`, UA honesto, 1.5 MB / 8 s; drawer 1 |

### 2.3 Gobernanza: licencia, privacidad, región

Esta tabla es la que decide si los bytes pueden **persistirse** en
`gtm_artifacts` — no es un anexo legal, es un campo del contrato
(`WebContentLicense`).

| Proveedor | Persistir artifact | Mostrar excerpt citado | Redistribuir (2ª puerta de la Fábrica) | Región de proceso | Riesgo notable |
|---|---|---|---|---|---|
| Parallel | revisar contrato antes de `active` | sí, con atribución | **asumir NO** hasta revisión explícita | n/d — solicitar por escrito | Vendor joven; concentración de proveedor si es search + extract + FindAll |
| Serper | resultado SERP = metadatos de Google | atribución obligatoria | **no** | n/d | Reproducción de SERP: derecho de terceros sobre snippets; créditos caducan a 6 meses |
| Jina Reader | sí (traemos los bytes) | sí | depende del sitio, no del proveedor | n/d | Continuidad tras la adquisición por Elastic |
| Exa | revisar | sí | **no** | n/d | Volatilidad de precio demostrada |
| Zyte | sí | sí | depende del sitio | UE/EE. UU. | Acceso a hosts que bloquean: revisar caso por caso |

**Regla de arranque:** todo adapter nace declarando
`{ mayStoreArtifact: false, mayDisplayExcerpt: false, mayRedistribute: false }`.
Cada `true` requiere una cita del contrato en `license_note`. Un `true` por
defecto es cómo se persiste algo que no se podía persistir.

---

## 3. Arquitectura

```
                       ┌──────────────────────────────────────┐
   pregunta ──────────▶│ EvidenceRouter                        │
                       │  1. warehouse-first (costo 0)         │
                       │  2. detección de hueco                │
                       │  3. cascada web (solo por hueco)      │
                       │  4. stop policy                       │
                       └───────┬───────────────────┬───────────┘
                               │                   │
                 ┌─────────────▼──────┐   ┌────────▼────────────────┐
                 │ WarehouseQuery     │   │ WebSearchProviderPort   │
                 │ Service (existe)   │   │ (nuevo — provider-neutral)│
                 └────────────────────┘   └────────┬────────────────┘
                                                   │  (radar-architecture.spec
                                                   │   impide que el vocabulario
                                                   │   del vendor cruce esta línea)
                    ┌──────────────┬───────────────┼───────────────┐
                    ▼              ▼               ▼               ▼
              adapters/A     adapters/B      adapters/C      company-site
              (principal)    (fallback)      (exhaustiva)    (escalón cero, existe)
                    │              │               │               │
                    └──────────────┴───────┬───────┴───────────────┘
                                           ▼
                       ┌───────────────────────────────────────┐
                       │ WebIngestService                       │
                       │  Artifact → Observation → EvidenceClaim│
                       │  (usa los stores que YA existen)       │
                       └───────────────────────────────────────┘
```

**Nada de esto es infraestructura nueva.** Los tres stores
(`ArtifactStoreService`, `ObservationStoreService`,
`EvidenceClaimStoreService`), el ledger de obstrucciones, el de intentos de
proveedor, el de créditos y el lifecycle de Source Packs ya existen y ya tienen
tests de integración. Lo único genuinamente nuevo es **el port, sus adapters y
el router**. Ese es el argumento de integración más fuerte del diseño: la parte
cara ya está construida.

### 3.1 El contrato

Contrato completo y comentado: [`web-search/web-search-provider.port.ts`](web-search/web-search-provider.port.ts).
La forma, en seis líneas:

```ts
export interface WebSearchProviderPort {
  readonly id: string
  capabilities(): WebSearchCapabilities          // estático, sin I/O
  estimate(op: WebSearchOperation): WebSearchEstimate  // SÍNCRONO y PURO: sin red, sin cargo
  health(): Promise<WebSearchHealth>
  search(req: WebSearchRequest, ctx: WebSearchContext): Promise<WebSearchResponse>
  fetch(req: WebFetchRequest, ctx: WebSearchContext): Promise<WebSearchResponse>
  extract(req: WebExtractRequest, ctx: WebSearchContext): Promise<WebSearchResponse>
  cancel(handle: WebSearchHandle, ctx?: WebSearchContext): Promise<void>
}
```

Seis decisiones que el contrato codifica, y por qué cada una:

1. **`estimate()` es síncrono y puro.** Corre *antes* de que el humano vea un
   precio. Si pudiera llamar a la red podría gastar; si pudiera cobrar, cobraría
   por una cotización. Es la misma razón por la que
   `DiscoveryProviderPort.draftFromBrief` está documentado como *compilación*, no
   como búsqueda. Devuelve `usdExpected` **y** `usdWorstCase`, porque cotizar el
   caso esperado y comerse la cola es exactamente cómo el piso de margen del 60 %
   deja de sostenerse sin que nadie lo note.

2. **`fetch()` y `extract()` son verbos distintos.** `fetch()` = tenemos los
   bytes, los hasheamos, el artifact es de primera mano y el span se re-deriva
   del blob almacenado. `extract()` = el proveedor tuvo los bytes y nos da su
   lectura; el artifact es `provider_response` y el span apunta al markdown del
   proveedor. Fusionarlos permitiría que una respuesta de proveedor se hiciera
   pasar por una página que leímos — el tipo exacto de pudrición de procedencia
   que el Evidence Ledger existe para impedir.

3. **`capabilities().spanKinds`.** Un adapter que solo devuelve prosa declara
   `[]`, y el router deja de enviarle huecos de evidencia: la claim resultante se
   caería igualmente en `toGatewayResult()`. Mejor no gastar.

4. **`UntrustedText` es un tipo marcado.** Todo string que escribió un tercero
   entra marcado; la única salida es `renderUntrusted()`. No es teatro: la tríada
   letal aquí es real (el Radar lee criterios privados del workspace, ingiere
   páginas arbitrarias y puede escribir records), y un tipo marcado es la única
   defensa que **no compila** si se olvida.

5. **`partial` + `missing[]` obligatorios.** Nunca truncar en silencio. La misma
   doctrina de `WAREHOUSE_MAX_LIMIT` (que lanza en vez de recortar) y de
   `GatewayResult.truncated`.

6. **`FAILURE_CLASS_OF` es una tabla de datos.** Cada fallo cae en exactamente una
   de las 12 clases cerradas de obstrucción. Como dato y no como `switch` dentro
   de un `catch`, porque la revisión matutina agrega por clase y un modo de fallo
   que no se puede archivar es un modo de fallo que nadie cuenta.

### 3.2 Lo que el port deliberadamente **no** hace

El proveedor **no** asigna `source_family`. La familia se decide por el **host
final** tras redirecciones, en el dominio (`HostClassification`). Dos proveedores
que devuelven `eleconomista.com.mx` devuelven **la misma familia y el mismo
origen**; contar eso como corroboración fabricaría confianza a partir de una
decisión de routing. Es exactamente el error que `corroboration.ts` ya evita para
`iieg-jalisco` vs `denue` — y la sindicación lo hace peor: un teletipo de agencia
reproducido por cuatro medios es **un** origen.

---

## 4. Routing recomendado

```
1. WAREHOUSE FIRST
   WarehouseQueryService.listClaims({ entityKind, claimType, geography })
   ¿Hay claim vigente (stale_after > now) y citable?  → SE ACABÓ. Costo: $0.
       ↓ no
2. ¿Es este claim_type de familia autoritativa (government)?
   → sí: la web NO puede crearlo. Se emite `honest_no_data` o se encola
     el Source Pack oficial. Costo web: $0.                 ← 10 casos del golden set
       ↓ no
3. HUECO DE EVIDENCIA declarado: { entityId, claimType, freshnessNeeded, why }
       ↓
4. ESCALÓN CERO — company-site (ya existe, $0)
   ¿Responde? → listo.
       ↓ no
5. PROVEEDOR BARATO, modo `cheap`, presupuesto acotado
   maxResults ≤ 10 · afterDate desde freshnessNeeded · locale {mx, es}
   sourcePolicy.excludeHosts = agregadores conocidos
   ↑ estos parámetros NO son configuración nueva: salen del topic
     `perfil-comercial` del workspace (geografía, comprador, exclusiones,
     aprendidos entre búsquedas). El perfil ya pre-llena el contrato borrador;
     aquí pre-llena también la consulta web.
       ↓ resultado delgado o contradictorio
6. UNA segunda pasada `balanced` — y solo una.
       ↓ sigue delgado
7. STOP. `honest_no_data`. Nunca se escala solo a exhaustiva.
```

**Discovery exhaustiva es otro producto, no el siguiente escalón.** Requiere
`CreditsService.quote()` + aprobación humana explícita. La razón es económica y
está en los números: un hueco cuesta ~$0.006; un FindAll `core` cuesta hasta
$6.50. Un router que pueda escalar solo de uno a otro convierte una consulta de
$0.006 en una de $6.50 sin que nadie lo autorice — un factor de mil.

### 4.1 Stop conditions

Se reutiliza `GtmStopReason` tal cual está. Sin vocabulario nuevo:

| Razón | Cuándo | Estado terminal |
|---|---|---|
| `coverage_sufficient` | El hueco quedó cubierto con claim citable | `completed` |
| `low_marginal_value` | La segunda pasada aportó < 1 origen independiente nuevo | `completed` |
| `honest_no_data` | Sin resultado, o `claim_type` autoritativo sin registro | `completed` |
| `budget_exhausted` | `ctx.budgetUsdRemaining <= 0` | `stopped` |
| `unresolvable_contradiction` | Dos orígenes independientes y fechados en conflicto | `failed` |
| `manual` | Kill switch o cancelación del usuario | `stopped` |

Ese mapeo ya existe en `ResearchRunService.STATUS_FOR_REASON`, con su política de
reembolso asociada. No se toca.

### 4.2 Kill switch

Tres niveles, del más rápido al más lento:

1. **Lifecycle del Source Pack** — `transitionLifecycle(pack, 'degraded')`. El
   router deja de seleccionarlo. **Sin deploy, sin reinicio.** La transición ya
   está bloqueada por la máquina de estados existente.
2. **`CircuitBreaker`** por adapter (ya existe en `adapters/resilience.ts`): 5
   fallos abren el circuito 30 s. Un proveedor caído falla rápido y visible en
   vez de que cada run queme su presupuesto de reintentos en paralelo.
3. **Variable de entorno** `WEB_SEARCH_ENABLED=false` — apaga toda la capa. El
   chat sigue respondiendo desde el almacén y **lo dice**.

---

## 5. Integración: Artifact → Observation → Evidence Claim

### 5.1 El mapeo, campo por campo

```
WebDocument
  ├─ contentHash / bytes ──▶ ArtifactStoreService.insert(
  │                            blob, sourcePackId, mediaType, acquiredVia, licenseNote)
  │                          · dedup gratis: ON CONFLICT (content_hash, source_pack_id)
  │                          · acquiredVia: 'http' si fetch() · 'search_api' si search()/extract()
  │                          · mediaType: 'provider_response' cuando NO tuvimos los bytes
  │
  ├─ excerpts[] ──────────▶ ObservationStoreService.insert(
  │                            artifactId, sourceFamily, span, rawValue)
  │                          · sourceFamily la asigna HostClassification(finalUrl), no el proveedor
  │                          · span: offset:a-b (HTML/markdown) · page:n (PDF) · selector:css (DOM)
  │                          · parseArtifactSpan() lanza ANTES de cualquier escritura
  │
  └─ extracción ──────────▶ EvidenceClaimStoreService.insert({
                               modalidad, confidenceMethod, attributionVerdict,
                               observedAt, fetchedAt, effectiveAt, staleAfter,
                               citation: { observationIds }, contradictsClaimIds })
```

### 5.2 `modalidad` y `confidence_method` — las dos que se confunden

| Origen | `modalidad` | `confidence_method` inicial |
|---|---|---|
| `search()` — excerpt del índice del proveedor | `search_index` | `provider_reported` |
| `extract()` — lectura del proveedor | `search_index` | `provider_reported` |
| `fetch()` — bytes que trajimos nosotros | `direct_fetch` | `provider_reported` |
| Dos orígenes **independientes** de acuerdo | (se conserva) | `corroborated` |
| Re-lectura directa de la superficie original | `direct_fetch` | `live_verified` |

`live_verified` **no se alcanza nunca desde un índice de búsqueda**. Un índice
dice lo que el proveedor vio alguna vez, no lo que la página dice ahora. Confundir
esas dos cosas es la definición operativa de *Live Query* vs *Live Observation*
en el diccionario del sistema.

### 5.3 Frescura — cuatro fechas, cuatro significados

Esta es la parte que la evidencia web rompe más seguido, y `GtmClaimInput` ya
tiene los cuatro campos:

| Campo | Qué es | De dónde sale |
|---|---|---|
| `observed_at` | Cuándo se **observó el hecho** | `WebDocument.publishedAt`. **`null` si el proveedor no lo da — nunca se sustituye por la hora de fetch.** |
| `fetched_at` | Cuándo llegaron los bytes | `WebDocument.retrievedAt`. Siempre conocido. |
| `effective_at` | La fecha **de la que habla** el hecho | Extraída del contenido (ej. "a partir de enero de 2026"). |
| `stale_after` | Cuándo deja de ser re-servible | TTL por `claim_type` (§5.4). |

Poner `retrievedAt` en `observed_at` convierte un boletín de 2019 leído hoy en
"observado hoy". Es un error de una línea con consecuencias de meses, y por eso
el port marca `publishedAt` como `string | null` con el comentario explícito de
que `null` debe sobrevivir.

### 5.4 TTL por tipo de claim

Alineado con el criterio ya recogido en `gtm-dynamic-freshness-scheduling`: la
cadencia la manda la tasa de cambio observada, no un calendario fijo. Valores de
arranque, a recalibrar con datos:

| `claim_type` | `stale_after` inicial |
|---|---|
| `news_event`, `disruption_event` | 30 días |
| `facility_announcement`, `investment_announcement` | 180 días |
| `hiring_signal` | 45 días |
| `company_website`, `company_identity` | 365 días |
| `scian_activity`, `staffing_range`, `location` (derivado de web) | 180 días — **más corto que el del padrón**, porque es corroboración, no registro |
| `sanitary_license`, `trade_program`, cualquier familia autoritativa | **la web nunca los escribe** |

### 5.5 La web no suplanta a un registro oficial — dos mecanismos

**Mecanismo 1 — tabla de autoridad por `claim_type`.** Cada `claim_type` declara
qué familia lo posee. Una claim derivada de web sobre un `claim_type` de familia
autoritativa:

- **nunca** se escribe como reemplazo;
- se escribe como **candidata a contradicción** (`contradictsClaimIds` apuntando
  a la claim oficial), con `attribution_verdict: 'unchecked'`;
- no puede subir `confidence_method` por encima de `provider_reported`.

Ejemplo real del golden set (`gs-094`): LinkedIn declara plantilla global y
desactualizada; DENUE declara rango de personal ocupado de la unidad económica.
Contradicen. La salida correcta son **dos claims** con la contradicción
registrada — no una que pisa a la otra. `EvidenceClaimStore` es *append-only*
justamente por esto: no tiene `update()` ni `patch()`, solo `insert()`.

**Mecanismo 2 — el allowlist de vocabulario que ya existe.**
`KNOWN_COMPANY_CLAIM_TYPES` en `chat-tools.ts` es un conjunto curado
(`scian_activity`, `staffing_range`, `location`) deliberadamente desacoplado de
lo que los packs cosechan en crudo. Un `claim_type` derivado de web **no aparece
en el chat** hasta que se le escriba una rama de `describeClaim()` y se le admita
explícitamente. La puerta ya está puesta; solo hay que no abrirla por descuido.

### 5.6 Que el texto web no ejecute instrucciones

Cuatro capas. Ninguna basta sola; la literatura de 2026 es clara en que la mejor
defensa publicada aún deja pasar del orden de una de cada diez inyecciones
optimizadas. Por eso la capa 4 es la que realmente importa.

1. **Tipo marcado.** `UntrustedText` no puede concatenarse a un prompt sin pasar
   por `renderUntrusted()`, que envuelve en un bloque delimitado con preámbulo
   explícito de "esto es dato, no instrucción". Olvidarlo **no compila**.
2. **El modelo nunca ve markdown crudo.** Ve líneas renderizadas al estilo del
   `describeClaim()` que la herramienta del almacén ya usa: nombre de empresa +
   descripción en lenguaje de negocio. Nunca el `claim_type`, el JSON del valor,
   ni el cuerpo de la página.
3. **Detector + rechazo.** Un documento que dispare el detector (comentarios HTML
   imperativos, texto oculto por CSS, capas de texto en PDF, campos `instructions`
   en JSON-LD, o cadenas que imiten al sistema) se **descarta**, y cualquier claim
   ya derivada de él se marca `attribution_verdict: 'reject'`. Se usa el veredicto
   que ya existe en vez de inventar una 13.ª clase de obstrucción: la taxonomía
   está cerrada con un CHECK en la base y ampliarla es una migración más una
   actualización del topic del que se tomó. Si el volumen llega a justificar un
   reporte agregado, esa migración es una tarjeta aparte (`WS-12b`), no un efecto
   colateral.
4. **La capacidad, no la detección.** Una claim derivada de web **no puede
   disparar una escritura**. No actualiza un record, no aprueba nada, no dispara
   outbound. Solo un humano, o una claim fundada en el almacén, puede. Esa es la
   frontera de autorización que el código del agente no puede cruzar — y es la
   única capa que sigue en pie cuando la detección falla.

---

## 6. Modelo de costos

### 6.0 El punto de partida real

El comentario de `noteWarehouseCoverage()` guarda la factura que originó todo
esto: **una corrida de $6 para 59 empresas** — unos **$0.10 por empresa**, y el
resultado es enumeración, no evidencia citable.

Un hueco resuelto con las primitivas baratas cuesta **$0.006 por empresa** y sí
produce artifact, span y fecha. No es el mismo trabajo —FindAll enumera un
universo que no tienes, el hueco enriquece uno que sí— y por eso ambos siguen
existiendo. Pero cuando el universo **ya está en el almacén**, pagar $0.10 por
empresa para volver a enumerarla es comprar dos veces lo mismo.

### 6.1 Costo interno por consulta

Un **hueco** típico de una cuenta: 2 búsquedas + 4 extracciones.

| Combinación | Cálculo | Costo por cuenta |
|---|---|---|
| **Parallel turbo + Extract** | 2 × $0.001 + 4 × $0.001 | **$0.006** |
| Serper (tier alto) + Jina | 2 × $0.0003 + 4 × $0.0001 | **$0.001** |
| Serper (tier bajo) + Jina | 2 × $0.001 + 4 × $0.0001 | $0.0024 |
| Exa + contents | 2 × $0.007 + 4 × $0.001 | $0.018 |
| Brave + Firecrawl (Standard) | 2 × $0.005 + 4 × $0.00083 | $0.0133 |

### 6.2 Impacto sobre el catálogo de créditos

`radar-pricing.ts` fija `MARGIN_FLOOR = 0.6` y `CREDIT_USD = 0.99`. La pregunta
que importa: **¿la búsqueda web mueve el piso de margen?**

Operación `standard`: 25 créditos = $24.75 de ingreso, `expectedCogsUsd` = $7.00,
margen actual **71.7 %**.

| Proveedor web añadido | COGS web (25 cuentas) | COGS total | Margen | ¿Sostiene el piso? |
|---|---|---|---|---|
| Parallel turbo + Extract | $0.15 | $7.15 | 71.1 % | sí, con enorme holgura |
| Serper + Jina | $0.03 | $7.03 | 71.6 % | sí |
| Exa + contents | $0.45 | $7.45 | 69.9 % | sí |
| Brave + Firecrawl | $0.33 | $7.33 | 70.4 % | sí |

**Conclusión económica, y es la más importante del documento: en la capa barata,
la elección de proveedor no mueve el precio del producto.** La diferencia entre
el más caro y el más barato de la tabla es de 1.2 puntos de margen sobre una
holgura de 11.7. Optimizar de $0.006 a $0.001 por cuenta ahorra $0.12 en una
operación de $24.75.

Por lo tanto **la elección debe hacerse por calidad, frescura y fidelidad de
citación — no por precio**, siempre que se mantenga en la capa barata. Y el
control económico que sí importa es el que impide que la capa barata escale sola
a FindAll `pro` ($10 + $1/match): ahí sí se juega el margen entero. Ese control es
`quote + aprobación`, no una optimización de céntimos.

### 6.3 `GtmCostPolicy` por pack

`parseCostPolicy()` **lanza** si un pack no tiene política. Eso convierte
"tarifar antes de correr" en una garantía mecánica y gratuita: un proveedor nuevo
no puede ejecutarse hasta que alguien escriba su precio.

Un Source Pack por **(proveedor, operación)** — no uno por proveedor — para que
`computeSourcePackCogs()` siga siendo honesto cuando búsqueda y extracción tienen
unidades distintas:

```ts
// web-search-<principal>
{ unit: 'per_request', fixed_usd: 0, per_unit_usd: 0, provider_usd_per_unit: 0.001,
  note: 'Búsqueda, modo barato, 10 resultados incluidos. Resultados extra se cobran aparte.' }

// web-extract-<principal>
{ unit: 'per_request', fixed_usd: 0, per_unit_usd: 0, provider_usd_per_unit: 0.001,
  note: 'Extracción por URL, incluye render JS y parseo de PDF.' }

// web-search-<fallback>
{ unit: 'per_request', fixed_usd: 0, per_unit_usd: 0, provider_usd_per_unit: 0.001,
  note: 'SERP. Tarifa del escalón de compra más conservador; recalibrar al consumo real.
         11-100 resultados cuestan 2 créditos: pedir >10 duplica el costo unitario.' }
```

`egress_bytes` y `compute_seconds` se **miden**, no se estiman —
`computeSourcePackCogs()` los factura del uso real. El costo web es
casi todo `provider_usd`; verlo descompuesto es lo que permite responder "¿subió
el proveedor o subimos nosotros el volumen?".

### 6.4 Ledger de uso — **sin tabla nueva**

`gtm_provider_attempts` ya tiene exactamente las columnas necesarias:
`capability`, `provider_class`, `rank`, `outcome`, `latency_ms`, `cost_usd`,
`detail`. Se usa con `capability: 'web_search' | 'web_fetch' | 'web_extract'` y
`provider_class = WebSearchProviderPort.id`.

Y `ProviderAttemptService.successRates()` responde entonces, gratis, la pregunta
que decide la cascada: **`cost_per_accepted_usd` por proveedor y capacidad.** Es
la misma mecánica que ya reordena la cascada de contactos. Dos detalles que ya
están bien resueltos ahí y que aquí importan igual:

- El denominador es `invoked`, no `attempts`: un escalón saltado por falta de
  clave nunca tuvo oportunidad de acertar, y contarlo en su contra puntuaría al
  proveedor por *nuestra* configuración.
- `cost_usd` es `null` cuando el adapter no puede tarifarse, y `0` cuando es
  genuinamente gratis. Colapsarlos haría inútil la métrica.

El registro es *fire-and-forget* con la promesa rastreada: una caída de telemetría
degrada la visibilidad, nunca la consulta del cliente.

### 6.5 Proyección a Stripe

**La búsqueda web no es un SKU.** No hay pack nuevo, ni precio nuevo, ni línea
nueva en el checkout. Es COGS dentro de operaciones que ya se cobran:

- Entra en `expectedCogsUsd` de las operaciones existentes → §6.2.
- La compra de créditos sigue igual: `BillingService` → `checkout.session.completed`
  → `CreditsService.purchase(idempotencyKey = payment event id)` con `orIgnore()`,
  porque la entrega duplicada de Stripe es la norma, no un caso borde.
- El único cambio en la proyección es la **recalibración semanal**: los COGS
  medidos incluyen ahora la línea web, y `MARGIN_FLOOR` se verifica en el spec —
  violarlo rompe el build en vez de erosionar el negocio en silencio.

### 6.6 Idempotencia y reintentos

**Las llamadas web no se debitan individualmente del ledger.** Son COGS dentro de
una operación que ya se cobró con `debitAndRun`. Esto no es un ahorro contable:
es lo que impide que un reintento por 429 le cueste créditos al cliente.

Donde una llamada web sea iniciada por el usuario de forma independiente, va por
`debitAndRun` con:

```
idempotencyKey = sha256(workspaceId | runId | capability | normalizedQuery | YYYY-MM-DD)
```

El día en la llave es deliberado: la misma pregunta mañana es una pregunta
distinta —el punto entero de la frescura— pero repetida hoy por un reintento no
debe cobrarse dos veces.

Reintentos: `withRetry` con backoff exponencial y *full jitter* (ya existe), solo
para 429 y 5xx. Un 4xx distinto de 429 es **nuestro** bug y se relanza de
inmediato: reintentarlo quema presupuesto y retrasa el error real. **Un reintento
reutiliza siempre la misma llave de idempotencia.**

---

## 7. Matriz de pruebas

Las nueve clases de fixture, las diez métricas y sus umbrales duros están en
[`web-search/fixtures-and-metrics.md`](web-search/fixtures-and-metrics.md).
Resumen de lo que se prueba y dónde:

| Capa | Test | Tipo | Corre en CI |
|---|---|---|---|
| Candado | Ningún token de vendor fuera de `adapters/` | unit (extiende `radar-architecture.spec`) | sí |
| Candado | Ningún spec de adapter alcanza red real | unit (mock deny-all + escaneo de URLs) | sí |
| Port | `estimate()` es puro: sin red, sin escritura | unit | sí |
| Port | Toda `WebSearchFailure` mapea a una clase de las 12 | unit exhaustivo sobre el `Record` | sí |
| Adapter | Replay de las 9 clases de fixture | unit | sí |
| Adapter | `partial:true` cuando faltan URLs | unit | sí |
| Adapter | 429/5xx → `retryable:true`; 4xx → `retryable:false` | unit | sí |
| Adapter | `cancel()` idempotente sobre handle terminado | unit | sí |
| Spans | Todo span devuelto re-parsea y re-deriva el texto del artifact | unit contra `_shared/` | sí |
| Ingesta | Artifact → Observation → Claim con citación completa | integration | no (`*.integration.spec.ts` excluido) |
| Ingesta | `publishedAt: null` **no** se rellena con `retrievedAt` | unit | sí |
| Gobernanza | Los 10 casos `forbidden` no escriben claim y gastan $0 | unit sobre el router | sí |
| Gobernanza | Claim web sobre `claim_type` autoritativo → contradicción, no reemplazo | integration | no |
| Gobernanza | Contención de inyección = 1.00 sobre el corpus de la clase 8 | unit | sí |
| Independencia | Dos proveedores con el mismo host → un solo origen | unit sobre `HostClassification` | sí |
| Economía | Ningún pack sin `cost_policy` puede correr (`parseCostPolicy` lanza) | unit | sí |
| Economía | `MARGIN_FLOOR` se sostiene con la línea web incluida | unit sobre `radar-pricing` | sí |
| Bench | Golden set completo contra fixtures grabadas | script (`evals/`), no CI | no |
| Shadow | Corrida en vivo en staging con presupuesto acotado | manual, con runbook | no |

---

## 8. Tarjetas Driftless

Proyecto creado en Driftless: **Web Search Provider Evaluation**
(`b875dad7-50ef-4550-a2d2-b327d47907ca`), con las 17 tarjetas cargadas,
sus dependencias, y `validate` + `acceptance` por tarjeta.
Base: `staging` (§0).

| # | Tarjeta | Depende de | `validate` | `acceptance` |
|---|---|---|---|---|
| **WS-01** | Candado de vocabulario sobre el port *(el port ya está en `radar/ports/`)* | — | `pnpm vitest run apps/api/src/radar/radar-architecture.spec.ts apps/api/src/radar/ports` | El port no nombra ningún vendor; `estimate()` es síncrona; `FAILURE_CLASS_OF` cubre las 9 fallas y todas caen en las 12 clases; el candado falla si un token de vendor entra al dominio |
| **WS-02** | Congelar el golden set + clasificador de hosts inicial *(el JSON ya está en `evals/web-search/`)* | — | `node -e "…"` valida 100 casos, IDs únicos, 9 categorías, 10 `forbidden` | El JSON no vuelve a cambiar durante la evaluación; cada host de `expect` tiene familia y grupo de origen asignados; la tabla de autoridad se deriva de los packs registrados, no de una lista fija |
| **WS-03** | Harness de fixtures + candado de "cero llamadas vivas" | WS-01 | `pnpm vitest run apps/api/src/radar/adapters` con red deshabilitada | Un spec que intente salir a la red **falla**; `manifest.json` con `sha256` y `captured_at` por archivo; las 9 clases presentes |
| **WS-04** | Adapter A — candidato principal (search + extract) | WS-01, WS-03 | `pnpm vitest run …/adapters/a.spec.ts` | Replay verde de las 9 clases; spans re-derivables; `usage.costUsd` no nulo; `capabilities()` declarado y verificado contra fixtures |
| **WS-05** | Adapter B — candidato fallback (search + fetch) | WS-01, WS-03 | `pnpm vitest run …/adapters/b.spec.ts` | Igual que WS-04; además `publishedAt` sale `null` cuando el proveedor no lo da, sin sustituto |
| **WS-06** | Adapter C — segunda opinión exhaustiva | WS-01, WS-03 | `pnpm vitest run …/adapters/c.spec.ts` | Igual que WS-04; `estimate().usdWorstCase` refleja el precio publicado del tier profundo |
| **WS-07** | Bench runner + las 10 métricas | WS-03, WS-04, WS-05, WS-06 | `node evals/web-search/run-bench.mjs --fixtures` | Reporte por categoría y agregado; puertas duras evaluadas; el reporte incluye a los proveedores que perdieron |
| **WS-08** | `HostClassification` + grupos de origen (sindicación) | WS-01 | `pnpm vitest run …/gtm/corroboration.spec.ts …/host-classification.spec.ts` | Cuatro reprints de un teletipo = 1 origen; dos proveedores con el mismo host = 1 origen; `iieg-jalisco`/`denue` sigue verde |
| **WS-09** | `EvidenceRouter`: warehouse-first, huecos, stop policy | WS-01, WS-08 | `pnpm vitest run …/evidence-router.spec.ts` | Los 10 casos `forbidden` terminan en `honest_no_data` **sin gastar**; nunca escala solo a exhaustiva; toda salida usa un `GtmStopReason` existente |
| **WS-10** | `WebIngestService`: Artifact → Observation → Claim | WS-08, WS-09 | `pnpm vitest run …/web-ingest.spec.ts` + integración con Postgres | 100 % de las claims escritas tienen observación citable; `observed_at` nunca se rellena desde `retrievedAt`; dedup por `content_hash` demostrado |
| **WS-11** | Tabla de autoridad por `claim_type` | WS-10 | `pnpm vitest run …/claim-authority.spec.ts` | Una claim web sobre `claim_type` autoritativo se escribe como contradicción con `attribution_verdict:'unchecked'`; nunca alcanza `live_verified` |
| **WS-12** | Frontera de contenido no confiable + detector de inyección | WS-10 | `pnpm vitest run …/untrusted.spec.ts …/injection.spec.ts` | Contención = 1.00 sobre los 6 vectores; concatenar `UntrustedText` sin `renderUntrusted()` **no compila**; ninguna claim web dispara escritura |
| **WS-12b** | *(opcional)* 13.ª clase de obstrucción `content_integrity` | WS-12 | `pnpm vitest run libs/db` + migración idempotente | Solo si el volumen justifica reporte agregado. Incluye migración, actualización de `obstruction-taxonomy.ts` y del topic del que se tomó la taxonomía |
| **WS-13** | `cost_policy` + Source Packs + ledger de uso | WS-04, WS-05 | `pnpm vitest run …/gtm-cost-policy.spec.ts …/provider-attempt.service.spec.ts` | Ningún pack corre sin política; `successRates()` devuelve `cost_per_accepted_usd` por capacidad web; sin tabla nueva |
| **WS-14** | Quote + aprobación + kill switch + circuit breaker | WS-09, WS-13 | `pnpm vitest run …/radar-pricing.spec.ts …/resilience.spec.ts` | Exhaustiva exige `quote()` + aprobación; `degraded` saca al pack sin deploy; `MARGIN_FLOOR` se sostiene con la línea web |
| **WS-15** | Shadow benchmark en staging (en vivo, con tope) | WS-07, WS-13 | `bash scripts/harness/check.sh` + runbook de shadow | ≥ 3 días en `shadow`; costo reportado vs facturado divergen ≤ 5 %; p50/p95 reales medidos; ningún resultado servido a un cliente |
| **WS-16** | Canary, promoción de lifecycle y runbook de rollback | WS-14, WS-15 | `pnpm vitest run …/source-pack-registry.service.spec.ts` + smoke en staging | `experimental → shadow → active` respetado (saltarse `shadow` **falla**); rollback probado en staging; runbook en `runbooks/` |

La compuerta de costo (§0.2) no es una tarjeta aparte: vive dentro de **WS-09**,
que es donde se arma el cinturón.

### El orden de construcción

Esto es lo que yo construiría, y por qué en este orden:

1. **WS-01 + WS-04 — las primitivas baratas detrás del port.** Es la pieza más
   pequeña y la de mayor retorno: misma clave, mismo vendor, cero revisión legal,
   y desbloquea todo lo demás. Hoy el sistema literalmente no sabe hacer una
   búsqueda de $0.001.
2. **WS-09 — el router de huecos y el cinturón.** Es lo que convierte "DENUE
   primero" de mensaje en regla, lo que crea el escalón intermedio de la
   cotización, y donde vive la compuerta de costo de §0.2. Aquí está el cambio
   de producto, no en el ahorro.
3. **WS-08 + WS-10 + WS-11 + WS-12 — la ingesta gobernada.** Sin esto el trabajo
   web no entra al almacén y lo vuelves a pagar cada vez; con esto, **el almacén
   compone**. WS-11 y WS-12 no son opcionales: son la condición para dejar entrar
   contenido web a un almacén en el que un cliente se apoya.
4. **WS-03 + WS-05/06 + WS-07 + WS-15/16 — la evaluación formal.** Confirma o
   desmiente al proveedor por defecto. Va después a propósito: el port ya hace
   que cambiar cueste una línea, así que la evaluación puede correr sin bloquear
   el valor.

**Ruta crítica de la evaluación:** WS-01 → WS-03 → WS-04/05/06 (paralelizables)
→ WS-07 → WS-15 → WS-16. La rama de gobernanza (WS-08 → WS-09 → WS-10 →
WS-11/12) corre en paralelo desde el principio y **bloquea a WS-16**: no se
promueve nada a `active` sin la frontera de autoridad y la de inyección en su
sitio.

---

## 9. Rollout

### 9.1 CI — fixtures, cero llamadas vivas

No es una convención, es un candado (WS-03): los specs de adapter corren con la
red denegada, y cualquier intento de salir **falla el test**. Además, un escaneo
estático prohíbe que `WEB_SEARCH_*_API_KEY` se lea fuera de `adapters/`, igual
que `radar-architecture.spec` ya prohíbe `PARALLEL_API_KEY` en el dominio.

Motivo: un benchmark que a veces sale a la red produce números que dependen del
día. Y un CI que llama a un proveedor de pago tiene una factura que nadie
presupuestó y una dependencia de disponibilidad externa para mergear.

### 9.2 Shadow benchmark

Todos los candidatos en `lifecycle: 'shadow'` — **corren y nadie consume su
salida**. Mínimo 3 días de tráfico real, con tope de presupuesto duro.

Se mide: las 10 métricas, más la reconciliación de costo contra la factura del
proveedor. Divergencia > 5 % entre lo reportado por el adapter y lo facturado es
**bloqueante**: todo el modelo de créditos descansa en que el COGS medido sea el
real.

### 9.3 Canary

`transitionLifecycle` ya impide saltarse etapas: `experimental → shadow → active`
es la única ruta, con bloqueo pesimista para que dos transiciones concurrentes no
puedan colar un salto ilegal. El canary es, literalmente, promover **un** pack a
`active` y dejar los demás en `shadow`.

Alcance del canary: un workspace, un Opportunity Flow, presupuesto acotado. Se
promueve al resto cuando `cost_per_accepted_usd` y `citation_coverage` se
sostienen 7 días.

### 9.4 Fallback

La cascada se ordena por `cost_per_accepted_usd` observado, no por precio de
lista — **política en datos, no en código**, igual que la cascada de contactos.
Un proveedor cuyo circuito abre sale de la fila hasta que cierre.

### 9.5 Rollback

En orden de velocidad:

| Nivel | Acción | Tiempo | Alcance |
|---|---|---|---|
| 1 | `transitionLifecycle(pack, 'degraded')` | segundos, sin deploy | Ese pack sale del router |
| 2 | `WEB_SEARCH_ENABLED=false` | un reinicio | Toda la capa web; el chat responde desde el almacén y lo dice |
| 3 | Revertir el binding en `radar.module.ts` | un deploy | Vuelve al proveedor anterior; **una línea**, porque el dominio depende del port |
| 4 | Marcar las claims del periodo con `attribution_verdict:'reject'` | una migración de datos | Solo si se sirvió evidencia incorrecta. **Nunca se borra**: el ledger es append-only y "qué creímos y cuándo" tiene que seguir siendo respondible |

El nivel 4 es la razón por la que `EvidenceClaimStore` no tiene `update()`. Un
rollback que borra evidencia mala destruye también la prueba de que se sirvió —
que es exactamente lo que hace falta para responderle a un cliente.

---

## 10. Riesgos

### 10.1 Legales

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Redistribución de contenido del proveedor** | Alto. La 2.ª puerta de la Fábrica (API de datos vendible) podría redistribuir contenido que no nos pertenece | `WebContentLicense.mayRedistribute` arranca en `false` y solo cambia con una cita del contrato en `license_note`. El anillo global separa lo derivado de fuentes públicas de lo del proveedor |
| **Reproducción de SERP** | Medio. Los snippets de un SERP son de terceros | Los snippets no se persisten como artifact; se usan para *seleccionar* URLs, y la evidencia se funda en el documento traído por `fetch()` |
| **Datos personales — LFPDPPP de 2025** | Alto. Páginas corporativas contienen nombres, correos, teléfonos | El escalón cero ya rehúsa construir direcciones y nunca presenta un buzón general como personal. La redacción de fixtures elimina datos personales que no sean contacto profesional publicado por la propia empresa. **Ver §10.4 — el marco cambió** |
| **`robots.txt` y términos de sitio** | Medio | `WebFetchRequest.respectRobots` es `true` por defecto; ponerlo en `false` exige base legal documentada. El escalón cero ya lo honra en código. **Pero `robots.txt` ya no es donde se decide el acceso — ver §10.4** |
| **Difamación por atribución errónea** | Alto, baja probabilidad. Una sanción o quiebra atribuida a la empresa equivocada (`gs-096`, `gs-063`) | Esos `claim_type` son de familia autoritativa: la web no los escribe. Casos `forbidden` del golden set con puerta dura de abstención = 1.00 |
| **Subprocesadores** | Medio | Todo proveedor nuevo entra al registro de subprocesadores antes de `active`. Es una casilla del gate de WS-16, no una tarea posterior |

### 10.2 Técnicos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Spans que no se re-derivan** | Alto. Sin span no hay observación, y `toGatewayResult()` tira la claim: el gasto se pierde entero | `citation_coverage ≥ 0.95` es puerta dura. `capabilities().spanKinds` declara la capacidad y el router no envía huecos a quien no la tiene |
| **Inyección de prompt** | Alto | Cuatro capas (§5.6). La determinante es la 4.ª: una claim web **no puede escribir**. Contención = 1.00 es puerta dura |
| **Colapso de independencia por sindicación** | Alto y silencioso. Cuatro reprints contados como cuatro familias fabrican confianza | `HostClassification.originGroup`; extiende `CORROBORATION_GROUPS`, que ya resolvió el caso `iieg-jalisco`/`denue` |
| **Frescura mentida** | Alto. `publishedAt` derivado del fetch envejece mal en silencio | `publishedAt` es `string \| null` y el `null` sobrevive; `freshness_accuracy` se verifica a mano sobre 40 documentos |
| **Páginas JS que devuelven HTML vacío que "parece" válido** | Medio. Un portal ATS sin render devuelve una página sin datos que no es un error (`gs-053`, `gs-055`) | Casos explícitos en el golden set; `capabilities().rendersJavaScript` verificado contra fixture, no declarado por el vendor |
| **Concentración de proveedor** | Medio. Si el principal cubre search + extract + FindAll, una caída suya apaga tres capacidades | El fallback usa un **índice ascendente distinto**, no otro reventa del mismo. Es requisito de selección, no una preferencia |
| **PDF escaneado sin capa de texto** | Medio | Debe fallar como `format_tables_ocr`, ruidosamente. Un PDF escaneado que devuelve cadena vacía y se toma por "sin datos" es el fallo silencioso caro |
| **Deriva del golden set** | Medio | Congelado al mergear (WS-02). Cambios van a un v2 con su propia línea base |

### 10.3 Económicos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Cambio unilateral de precio o retiro** | **Demostrado**: cuatro casos en 12 meses (§1.5) | El port hace que cambiar sea una línea en `radar.module.ts` más un archivo hermano. El fallback se mantiene **vivo y ejercitado en shadow**, no en un documento |
| **Escalada silenciosa a exhaustiva** | Alto. $0.006 → $6.50 es un factor de mil | El router **nunca** escala solo. Exhaustiva exige `quote()` + aprobación |
| **COGS reportado ≠ facturado** | Alto. Todo el modelo de créditos depende de que el COGS medido sea real | Reconciliación contra factura al cierre del shadow; divergencia > 5 % bloquea la promoción |
| **Cola de costo no acotada** | Medio. Un proveedor que cobra por request *y* por tokens no permite cotizar antes de llamar | Motivo declarado del descarte de Perplexity. `estimate()` debe poder devolver `usdWorstCase`; un proveedor que no lo permita no puede ser principal |
| **Créditos que caducan** | Bajo. Los créditos prepagados de Serper caducan a 6 meses | El pack declara la caducidad en su nota; la compra se dimensiona al consumo observado en shadow, no al descuento por volumen |
| **Costo de operación > ahorro** | Medio. Mantener tres adapters cuesta más que los céntimos que ahorran | §6.2 lo dice sin rodeos: en la capa barata el proveedor no mueve el precio. Se mantienen **dos** adapters en producción (principal + fallback). El tercero vive en el bench y solo se activa tras aprobación |

---

### 10.4 Dos cosas que cambiaron mientras se escribía esto

Ambas se descubrieron revisando el diseño contra el mundo, no contra el código,
y las dos invalidan supuestos del documento. Se dejan aquí con fecha porque
volverán a envejecer.

#### La web abierta se cerró (verificado 2026-08-01)

Cloudflare **bloquea crawlers de IA por defecto**, con tres categorías
separables —Search, Agent, Training— disponibles para todos los clientes,
incluida la capa gratuita, desde el 1 de julio de 2026. Pay-Per-Crawl (un muro
402) evolucionó a Pay-Per-Use, que paga al publicador cuando la IA **usa** el
contenido en una respuesta, no cuando el bot descarga la página.

Y hay una fecha a seis semanas: **el 15 de septiembre de 2026** empieza el
bloqueo por defecto de crawlers *mixed-use* en cualquier página **con
anuncios** — que son exactamente `eleconomista.com.mx`, `elfinanciero.com.mx`,
`milenio.com`. La familia `directory` de la que depende toda la evidencia de
EVENTOS del golden set.

Tres consecuencias, en orden de incomodidad:

1. **El escalón cero se identifica honestamente, y eso es justo lo que se
   bloquea.** `DriftlessRadarBot/1.0` en el `user-agent` es una declaración
   spoofable; en este régimen no compra acceso, lo niega. El rung gratis que
   sostiene el modelo de costo se degrada solo, sin que ningún cambio nuestro lo
   explique — y sin que nada lo mida (§WS-20).
2. **`robots.txt` dejó de ser donde se decide el acceso.** Para cerca de la
   mitad del tráfico de IA en 2026 es una señal que se ignora, y la aplicación
   se movió a la capa de red. Lo seguimos honrando —es lo correcto y es nuestra
   política— pero honrarlo ya no basta para *entrar*.
3. **Invierte parcialmente el §3.1.** Ahí se argumenta que `fetch()` es superior
   en procedencia a `extract()` porque sostenemos los bytes. Sigue siendo cierto
   — **y si nuestro fetch honesto recibe 403 en una porción creciente de la web,
   la ruta superior en procedencia es la que no funciona.** Eso fortalece el
   caso de comprar fetch a un proveedor con relaciones de crawl propias, no solo
   por precio.

**El arreglo tiene estándar, y encaja con la filosofía que el manifiesto ya
declara.** Web Bot Auth: HTTP Message Signatures (RFC 9421), Ed25519, header
`Signature-Agent`, y un directorio JWKS en
`/.well-known/http-message-signatures-directory`. Respaldado por Cloudflare,
Amazon, Akamai y OpenAI; spec W3C cerrada en mayo de 2026; grupo IETF
constituido en 2026. Cloudflare tiene una categoría **Verified AI Agent** y una
acción *Challenge Agent* que pide firma en vez de CAPTCHA.

El manifiesto del escalón cero ya dice *"un scraper que miente sobre quién es no
puede decir que practica cortesía"*. Web Bot Auth es esa misma honestidad,
criptográfica en vez de declarativa: deja de ser una afirmación y pasa a ser
verificable. Y el repo ya sirve `/.well-known/agent-skills/index.json`, así que
publicar el JWKS extiende un patrón que existe.

**Lo que la firma NO compra:** permiso para ignorar `robots.txt`. Prueba QUIÉN
somos; no autoriza qué podemos tomar.

#### El marco legal mexicano es otro (verificado 2026-08-01)

La `LFPDPPP` que este documento citaba es la de 2010. **Dejó de existir el 21 de
marzo de 2025**, cuando entró en vigor una ley nueva publicada en el DOF el 20
de marzo de 2025, producto de la reforma constitucional de diciembre de 2024.

| Cambio | Consecuencia para este diseño |
|---|---|
| **El INAI fue disuelto.** La autoridad es ahora la Secretaría Anticorrupción y Buen Gobierno, que reporta directamente al ejecutivo | Cualquier referencia a INAI como supervisor está muerta |
| **El reglamento sigue pendiente** a julio de 2026 | Las obligaciones son exigibles; la letra fina no está escrita. Estamos diseñando contra un marco incompleto, y eso se declara en vez de ignorarse |
| **La ley no incorpora** portabilidad, aplicación extraterritorial ni tratamiento por IA | Los huecos importan tanto como el articulado: no podemos apoyarnos en obligaciones que no impone ni asumir protecciones que no da |

Las decisiones de producto no cambian —seguimos sin construir direcciones, sin
presentar un buzón general como personal, y redactando datos personales de las
fixtures— pero **la cita legal que las justifica sí cambia**, y una justificación
que apunta a una ley derogada no justifica nada.

---

## 11. Cómo se decide, en una frase

El benchmark ordena por **costo por respuesta útil** (§4.7 del documento de
métricas), no por precio por request; descalifica sin promediar a quien falle
cualquiera de las cuatro puertas duras (citación ≥ 0.95, abstención = 1.00,
contención de inyección = 1.00, `partial` honesto); y desempata por
`precision@10`, luego `recall`, luego `freshness_accuracy`.

Si Parallel gana, no cambiamos de proveedor y la ganancia es el port, el router y
la gobernanza. Si pierde, cambiamos de proveedor **con una línea** — que es
exactamente lo que este proyecto existe para hacer posible.

---

## Fuentes de precio (verificadas 2026-08-01)

- [Parallel — Pricing](https://parallel.ai/pricing) · [Search API](https://docs.parallel.ai/api-reference/search-api/search) · [Extract API](https://docs.parallel.ai/extract/extract-quickstart.md) · [Rate limits](https://docs.parallel.ai/getting-started/rate-limits.md)
- [Exa — Pricing](https://exa.ai/docs/reference/pricing)
- [Serper.dev](https://serper.dev/) · [Serper pricing explicado](https://apiserpent.com/blog/serper-pricing-credits-explained)
- [Brave Search API — pricing](https://www.trustradius.com/products/brave-search-api/pricing) · [fin de la capa gratuita, feb. 2026](https://www.implicator.ai/brave-drops-free-search-api-tier-puts-all-developers-on-metered-billing/)
- [Tavily — pricing](https://coldiq.com/blog/tavily-pricing) · [comparativa de APIs de búsqueda](https://www.buildmvpfast.com/api-costs/ai-search)
- [Linkup — pricing](https://coldiq.com/blog/linkup-pricing)
- [Perplexity — API pricing](https://www.cloudzero.com/blog/perplexity-api-pricing/)
- [Firecrawl — pricing](https://fastcrw.com/blog/firecrawl-pricing-explained)
- [Jina AI Reader — pricing](https://www.xpay.sh/saas-pricing/jina-reader/) · [Reader API](https://jina.ai/reader/)
- [Zyte / ScrapingBee — comparativa de precios](https://www.proxies.sx/blog/best-web-scraping-api-comparison-2026)
- [Google Custom Search JSON API — cierre y retiro](https://searlo.tech/google-custom-search-json-api-closed-to-new-customers)
- [Bing Search APIs — retiro 2025-08-11](https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement)
- [Prompt injection en agentes — panorama 2026](https://unit42.paloaltonetworks.com/ai-agent-prompt-injection/)
