# El desfragmentador de proveedores (una sola puerta)

**Estado:** diseño aprobado por el fundador. El registro y el router de
capabilities (Fase 0) ya están implementados en
`radar/adapters/provider-registry.ts` y `radar/adapters/capability-router.ts`;
el resto son las fases siguientes.
**Base ya aprobada (10 sep 2026):** cualquier llamada a un proveedor externo
pasa por un solo camino, que revisa la política, aparta el costo, llama, anota
lo que costó y devuelve el resultado.

**Ampliación (este plan):** además de la puerta, este documento fija el
**surface de capabilities con sus endpoints reales** (§3.8), el **modelo de la
persona y lo poseído** (§3.9) y la **economía con costos medidos** (§3.10), y
suma las Fases 5 y 6. La decisión es adaptar y ampliar este documento, no crear
otro.

**Qué es.** No es un clon del producto de otro: es la capa interna que
desfragmenta proveedores. Un registro cerrado declara qué primitivas ofrece
cada uno; un router las recorre en orden y **se detiene en el primer resultado
usable**, con un presupuesto que impide que el recorrido se salga de control.
Los proveedores de hoy son Hunter y Tomba; el diseño es para N.
**Insumo:** auditoría de solo lectura sobre `origin/staging` (0e275dc). Cada
afirmación de este documento tiene su archivo y línea en esa auditoría; aquí
van solo las que deciden el diseño.

---

## 1. Qué problema resuelve, en producto

- **No sabes cuánto te cuesta cada cliente.** De los proveedores que usamos por
  uso, solo tres anotan su costo: los modelos de lenguaje, Tomba y el
  descubrimiento de personas de Parallel. El directorio de Hunter, la búsqueda
  web de Parallel, el enriquecimiento de empresas del Radar y Nylas llaman al
  proveedor sin dejar rastro. Por eso el panel interno dice que en 30 días se
  gastaron USD 5.38.
- **Agregar un proveedor toca unos diez archivos.** El ciclo de autorizar,
  cobrar, llamar y reembolsar está copiado tres veces en
  `radar-enrichment.service.ts`. El evento de costo, de 16 campos, se escribe a
  mano en ocho lugares. En la gobernanza, "tomba" aparece escrito a mano ocho
  veces.
- **El nombre del proveedor le llega al usuario**, aunque tu regla es que nunca
  lo nombremos: en los errores 403 de REST, en la respuesta del directorio
  ("Hunter Data Platform…"), en `people/acquired`, en el `contact_path` que se
  guarda en el CRM, en cuatro herramientas del MCP y en mensajes como "The
  selected Hunter candidate…".
- **Hay código muerto que confunde:** Datagma, Exa, la cascada de ColdIQ, el
  router GTM, un gateway de descubrimiento que nadie inyecta, un
  `enrichContacts` sin llamadores, una tabla de "waterfalls" que solo lee
  código muerto, y cuatro calculadoras de COGS que nadie importa.

## 2. Una decisión tuya que no forma parte de la puerta

**Descubrir personas solo funciona en staging.** La política de Parallel Entity
Search devuelve `staging_evaluation_only` en cualquier entorno que no sea
staging (`conditioned-provider-governance.service.ts` ~151-160). En producción,
Brein no puede encontrar a los decisores de una empresa para que el vendedor
elija a quién revelar. Revelar correos, que ya decide el plan desde #658, solo
tiene candidatos cuando vienen del Radar o del onboarding.

Es el mismo tipo de decisión que tomaste con Hunter y Tomba:

- **(a)** abrir el descubrimiento de personas en producción, igual que el
  directorio y el piloto de Tomba;
- **(b)** usar la búsqueda de personas de Hunter como fuente de candidatos (hoy
  su revelado está bloqueado por la política);
- **(c)** dejarlo así y lanzar sin descubrir personas.

La puerta funciona con cualquiera de las tres. Lo que decidas solo cambia la
política de un proveedor en el registro.

## 3. El diseño

### 3.1 El registro de proveedores

Un archivo, una entrada por proveedor. Toma de `libs/model-gateway` lo que ya
funciona: una lista cerrada, una ficha declarativa, un libro de precios
versionado en el repo y la regla "nulo no es cero".

```ts
type Capability =
  | 'company_search'    // buscar empresas
  | 'person_discovery'  // descubrir personas de una empresa
  | 'email_reveal'      // revelar el correo de una persona elegida
  | 'web_search'        // búsqueda web para investigar
  | 'account_discovery' // búsqueda y monitoreo de cuentas del Radar
  | 'email_send'        // enviar campañas
  | 'llm'               // modelos de lenguaje (la puerta es model-gateway)

interface ProviderEntry {
  key: ProviderKey                 // la MISMA clave que ya existe en el libro de costos
  capabilities: Capability[]
  billing:
    | { kind: 'usage'; unit: 'request' | 'credit' | 'send' | 'token';
        price: PriceRef | null }   // null = desconocido, nunca 0
    | { kind: 'fixed_external' }   // Clerk, Render, Vercel…: se lleva fuera de Brein
  policy: ProviderPolicyRef        // lo que hoy vive en CONDITIONED_PROVIDER_POLICIES
  status: 'active' | 'pilot' | 'retired'
}

interface PriceRef {
  amount: number | { fromEnv: 'TOMBA_USD_PER_FINDER_CREDIT' }  // una tarifa que pones tú
  currency: 'USD' | 'EUR'
  source: string   // de dónde sale el número
  version: string  // se guarda en price_book_version; hoy la reconciliación lee un campo que nunca existe
}
```

Las claves del libro de costos no cambian (`discovery`,
`parallel_entity_search`, `tomba`, `openai`…), para que el historial siga
sumando. Las claves nuevas son `hunter` (ya existe para el revelado),
`parallel_search` y `nylas`.

El registro NO lleva URLs, autenticación ni caché: cada adaptador sigue
manejando su transporte.

**La regla de conmutación cambió (14 sep 2026).** La versión anterior prohibía
todo fallback. Lo correcto es más fino: **hay fallback por capability, nunca por
identidad.** Un rung puede relevar a otro para `email_enrichment` porque ambos
responden la MISMA persona y el MISMO dominio; nunca puede relevarlo usando un
handle opaco que pertenece a otro proveedor, porque ese handle está cifrado
contra su emisor. La elegibilidad (`canAttempt`) es donde vive esa distinción: un
rung que no puede consumir el input se salta a costo $0, no se intenta.

### 3.2 La puerta

```ts
door.call(
  { key: 'tomba', capability: 'email_reveal' },
  { workspaceId, operation: `selected-email:${recordId}:${rank}`, attemptKey, recordId, runId },
  (adapter) => adapter.reveal(request),
): Promise<{ result; cost: RecordedCost; decision: PolicyDecision }>
```

Cinco pasos, siempre en este orden:

1. **Política.** Lee la entrada del registro: interruptor general, entorno,
   derechos y supresión. Una negación devuelve una decisión tipada, con un
   mensaje que no nombra al proveedor.
2. **Apartar el costo.** Escribe la reserva con `attemptKey`. Si falla, la
   operación se detiene, igual que hoy.
3. **Llamar al adaptador.**
4. **Anotar lo que costó.** Unidades que reporta el adaptador por el precio del
   registro, con su versión. Si anotar falla, se deja en el log y la operación
   sigue, igual que hoy.
5. **Revisar el resultado**, cuando la política lo pide (hoy
   `authorizeProviderResult` para Tomba).

**Lo que la puerta no hace:** cobrar ni reembolsar créditos al cliente. Eso se
queda en los servicios de dominio, que usan el mismo `attemptKey` que la clave
del débito, como hoy. Tampoco reemplaza a `model-gateway`: los modelos ya
tienen su propia puerta y solo se suman al registro para que el catálogo esté
completo.

**Una prueba de arquitectura la hace cumplir:** ningún adaptador de proveedor
se invoca fuera de la puerta. Sigue el patrón de `radar-architecture.spec.ts`,
que hoy prohíbe nombres de proveedor fuera de `adapters/`, así que el registro
vive en `adapters/` o esa regla se ajusta de forma explícita.

### 3.3 Qué NO cambia

- Precios al cliente, créditos, débitos y reembolsos.
- Las reglas de tu marco de confianza. Solo cambia de dónde las lee.
- Las claves y el historial del libro de costos.
- La conmutación entre modelos y los presupuestos de `model-gateway`.

### 3.4 Las primitivas

El desfragmentador no devuelve vocabulario de proveedor; devuelve estas
primitivas, cada campo con procedencia, atribución y derechos:

| Primitiva | Forma | Quién la produce hoy |
|---|---|---|
| `Company` | nombre, dominio, tamaño, industria, teléfonos, correos, redes, funding | Hunter Discover / Company Enrichment; Tomba Domain Search |
| `Person` | nombre, cargo, seniority, departamento, decisor | Hunter Discover People / Multi-Domain Search; Parallel |
| `EmailEndpoint` | correo, verificación, score, atribución, fuentes | Hunter/Tomba Finder |
| `PhoneEndpoint` | número, tipo, atribución, fuentes | Hunter reveal; Tomba `enrich_mobile` |
| `LinkedIn` | URL de perfil | Hunter/Tomba Finder y Enrichment |

LinkedIn es la **única** red social en alcance. Twitter/Facebook/GitHub no se
guardan. `EndpointKind` en `contact-path.ts` ya contempla `phone` y `linkedin`;
lo que falta son productores, no modelo.

### 3.5 El router con alto en el primero

`CapabilityRouter` generaliza la cascada que ya funciona en
`cascade-endpoint-verifier.ts` y le agrega el contrato económico:

```
route(capability, input, budget):
  for rung of rungsFor(capability):          // orden del registro: gratis primero
    if not rung.canAttempt(input):            // E2: $0, sin red
        record not_routable; continue
    if calls >= budget.maxCalls:              // E5: freno duro
        record skipped_budget; return budget_calls
    if knownUsd + rung.expectedCostUsd > maxKnownUsd:
        record skipped_budget; return budget_usd
    outcome = rung.execute(input)             // E3: el rung reserva antes de llamar
    record cost (null ≠ 0)
    if outcome.accepted and isUsable(result):
        return result                         // E4: SE DETIENE. No toca lo de atrás.
  return empty
```

### 3.6 El contrato de economía (no negociable)

- **E1 — Gratis antes que pagado.** El orden pone primero lo documentado a $0
  (Domain Finder, Discover, Multi-Domain Search, Email Count). La regla es
  política; el orden es dato.
- **E2 — Elegibilidad antes de todo I/O.** Un rung que no aplica cuesta $0 y se
  salta; nunca se "intenta para ver".
- **E3 — Reservar antes de llamar.** La reserva se escribe con el `attempt_key`
  antes del fetch; si falla, no se llama.
- **E4 — Alto en el primer usable.** Requisito textual del fundador: si el
  segundo proveedor ya encontró el correo, el tercero **no se llama**.
- **E5 — Techo por operación.** `maxCalls` y `maxKnownUsd` son un segundo freno,
  independiente de E4: aunque el alto se rompiera, el presupuesto para las
  llamadas.
- **E6 — Sin paralelo.** Secuencial a propósito. `Promise.all` pagaría por las
  respuestas que se tiran.
- **E7 — Idempotencia.** Un `attempt_key` = una reserva = un cobro. El retry
  reusa; nunca duplica.
- **E8 — Cobrar antes, reembolsar si no se entregó.** El patrón existente
  (`chargeForAccount` + `refundUndelivered`) se conserva.
- **E9 — Telemetría de cada rung**, incluido `skipped_budget`, para poder ver
  "llamadas pagadas después de un alto", que debe ser siempre 0.
- **E10 — Frenos.** Kill switch por proveedor, más circuit breaker para saltar
  un rung que viene fallando.

**Precio nulo no es cero.** `resolvePrice` devuelve `null` cuando la tarifa no
está configurada o es inválida; un 0 configurado es un cero real. Así el ledger
distingue "no se puede medir" de "es gratis".

### 3.7 Los candados

La spec de `capability-router` fija la economía como aserciones, no como
intención:

- el alto en el primero (`calls === ['a','b']`, el tercero jamás se ejecuta);
- el techo de llamadas (`maxCalls` detiene aunque el alto falle);
- el techo de dólares conocidos;
- la elegibilidad a $0 (un rung inelegible no ejecuta ni consume llamada);
- la secuencialidad (`peak de concurrencia === 1`);
- el costo desconocido contado y, si se pide, rechazado.

`provider-registry` fija el registro: ofertas únicas, capacidades dentro del
conjunto cerrado, gratis antes que pagado, y "precio nulo no es cero".

### 3.8 El surface y las capabilities (sobre los endpoints reales)

El registro declara primitivas; el surface las nombra en lenguaje simple y
esconde al proveedor. En alcance, cuatro:

| Capability | Primario | Fallback | Costo real |
|---|---|---|---|
| `person_discover` | Hunter `POST /v2/multi-domain-search` (enmascarado, `reveal_handle`, flags de existencia) | — | **$0** |
| `email_enrichment` | Hunter `POST /v2/multi-domain-search/reveal` (1 cr; devuelve correo, teléfono y LinkedIn) | Tomba `GET /v1/email-finder` · `GET /v1/enrich` (1 cr) | ~$0.01 |
| `phone_enrichment` | Hunter reveal (si el teléfono viene en el mismo crédito) | Tomba `GET /v1/phone-finder` (5 cr) | $0–$0.045 |
| `linkedin_resolve` | Hunter reveal (`linkedin_url`) | Tomba `GET /v1/linkedin` (1 cr) | ~$0.01 |

Fuera de alcance: `company_enrich` y `person_enrich` (la empresa es un campo
del contacto, no un objeto enriquecible). El registro usa ya estos nombres:
`email_enrichment` y `phone_enrichment`.

**El contrato de la puerta no cambia** (§3.2): `door.call(ref, ctx, exec)` con
los cinco pasos y las reglas E1–E10 (§3.6). Lo que se agrega es que el motor del
recorrido es `CapabilityRouter` —hoy inerte— y no el walk a mano del servicio.

**Tres superficies, un solo camino:**

- **Interna — la puerta.** Toda llamada a un proveedor externo pasa por aquí;
  una prueba de arquitectura lo hace cumplir.
- **Cliente — el reveal.** `POST /radar/people/reveal` **compone**
  `email_enrichment + phone_enrichment + linkedin_resolve`. No se expone
  `email_enrichment` directo: abriría un segundo camino que salta derechos y
  gobernanza.
- **MCP — discovery display-only.** `company_search`, `people_search`,
  `people_quote`, `people_acquired`. Las coordenadas solo salen por el
  `people_reveal` gobernado (spend, oculto del cinturón; lo llama el resolver).

### 3.9 El modelo de la persona y lo poseído

- **Una persona es un solo registro** (identidad por handle). Nace en
  `person_discover`, gratis, con nombre, empresa, cargo, ubicación y redes; los
  canales de contacto están ocultos.
- **Los canales son estado de posesión, no objetos.** Correo y teléfono van de
  `oculto → tuyo`. Revelar desbloquea el canal sobre el **mismo** registro; no
  crea uno nuevo.
- **"Contactos" es la vista de lo que posees**: el mismo registro, con algún
  canal desbloqueado, en otra vista. Comprar es poseer; pagar es un origen
  correcto, no un subproducto accidental.
- **La empresa es un campo del contacto**, nunca un objeto guardado aparte.
- **LinkedIn es un canal más**; Twitter/Facebook/GitHub no se guardan.

### 3.10 La economía real (medida, no supuesta)

Precios publicados al momento de escribir esto: Hunter **$0.0084–0.017** por
search credit (Starter $34/2,000; Scale $209/25,000); Tomba **$0.0089** por
finder credit; Tomba `phone-finder` **5 créditos = $0.0445**. El reveal de
Hunter devuelve correo, teléfono y LinkedIn en **un mismo crédito**.

Con el crédito a **$0.116** (Founder $29 / 250 contact credits):

| Operación | Ingreso | COGS real | Margen |
|---|---|---|---|
| Correo (2 cr) vía Hunter | $0.232 | ~$0.010–0.017 | ~93–96% |
| Teléfono (6 cr) vía Hunter | $0.696 | ~$0 | ~100% |
| Teléfono (6 cr) vía Tomba | $0.696 | $0.045 | ~94% |
| Reveal completo (8 cr), peor caso | $0.928 | ~$0.055 | ~94% |

- **Tarifa de referencia obligatoria:** grabar `hunter.search_credit` y
  `tomba.finder_credit` en el libro de precios (hoy nulos). Sin tarifa, el costo
  es *desconocido*, no cero (§3.6, "precio nulo no es cero").
- **Anotar cada llamada**, incluidas las vacías y las fallidas: el alto en el
  primero ahorra llamadas, no las que ya se hicieron.
- **Piso de margen:** con crédito a $0.116, 1 crédito por correo ya supera el
  piso; el teléfono por Tomba necesita **≥2 créditos** para el target de 70% y
  **1 crédito** apenas libra el piso de 60%. Cobrar 2 y 6 es holgado.
- **El riesgo no está en contactos** (~94% de margen) sino en **inferencia +
  discovery**, que sí es cost-plus.
- **Aplicado (Fase 6):** `expectedCogsUsd` de `contacts` bajó de `0.30` (un
  placeholder sin medir que hacía "perder" el correo en Founder) a **`0.017`**
  (tope del rango publicado de Hunter), y `phone_reveal` de `0` a **`0.0445`**
  (Tomba `phone-finder`, 5 cr). Es el costo documentado, no un supuesto: por eso
  el candado del `contacts` más apretado pasó a ser `monitor_renewal`. El
  **all-in por plan** sigue pendiente de la línea de **inferencia**, el único
  costo que aún no tiene tasa fija.

## 4. Fases

Cada fase es un PR a staging. Cada arreglo lleva la prueba que falla sin él. Al
cerrar cada fase, el panel de economía se revisa con datos reales en staging.

### Fase 0 — el registro y el router de capabilities (implementado)
- `radar/adapters/provider-registry.ts`: lista cerrada de capacidades y
  proveedores, con precio `null` = desconocido y gratis-antes-que-pagado.
- `radar/adapters/capability-router.ts`: el recorrido con alto en el primero,
  elegibilidad a $0, techo de llamadas y de dólares, y telemetría por rung.
- Las specs que fijan E2, E4 y E5 como aserciones.
- **Sin cambio de comportamiento:** todavía no se cablea al servicio de
  revelado. Es la base que la Fase 1 enciende.

### Fase 1 — fallback real en `email.find`
- **1a (implementado):** `SelectedEmailRouter` dejó de hardcodear "Hunter revela
  Hunter". Lee el registro: recorre los proveedores de `email_enrichment` en orden,
  salta los que no son *routable* y los que no pueden consumir el input, y elige
  el primero elegible. El handle de Hunter nunca cruza de vendor.
- **1b (implementado):** Hunter quedó encendido como piloto restringido
  (`hunter-pilot-v1`): display y contacto sí, export no, con su propio freno
  `HUNTER_CONTACT_ENRICHMENT_ENABLED`. La autorización de enrichment pasó a ser
  por OPERACIÓN (acción, propósito, selección, expiración), no por vendor, para
  que un mismo consentimiento humano cubra el fallback entre proveedores.
- **1c (implementado):** `RadarEnrichmentService` recorre proveedores dentro del
  MISMO intento. Preflight y supresión se evalúan ANTES de cobrar; se cobra una
  sola vez; cada proveedor reserva y anota su propio costo; un `no-result` releva
  al siguiente y un acierto (o un buzón general, o un bloqueo de derechos) corta.
  Si ninguno entrega, se reembolsa una vez y se libera el claim. La supresión es
  de cuenta/persona, así que detiene el walk completo antes de cualquier débito.
- **Nota de economía:** el alto en el primero y el techo de llamadas del kernel
  de `CapabilityRouter` fijan el contrato; el servicio materializa el alto por
  proveedor con el costo real de cada uno. Una prueba de extremo a extremo
  demuestra que Hunter sin resultado y Tomba con acierto llaman a los dos y
  debitan UNA vez.

### Fase 2 — la data gratis de Hunter al producto (en curso)
- Empresas (`/v2/discover`) y Personas (`/v2/multi-domain-search`, enmascarado
  sin reveal) ya existían y están cableadas en staging.
- **Domain Finder (`/v2/domain-finder`) implementado:** resuelve un nombre de
  empresa a su dominio más probable, a $0 y sin reveal, con claim token para
  poder guardar la empresa. Ruta `POST /companies/domain-finder`.
- **Enforcer de staging:** la operación ya depende solo de
  `HUNTER_DIRECTORY_EVALUATION_ENABLED`; en `render.yaml` staging la tiene en
  `"true"` y producción en `sync: false`, así que operativamente es solo staging.
  No se añadió un chequeo de rama en código para no romper la vista previa.
- **Discover People (`/v2/discover/people`) pendiente:** su contrato es GET y
  duplica la lista de empresas de Discover; se deja para cuando haya un
  consumidor real, en vez de shipear código sin uso.

### Fase 3 — teléfono + LinkedIn (productores implementados)
- **Productores implementados:** Tomba pide `enrich_mobile=true` y lee
  `phone_number`/`phone_data[]`; Hunter lee `phone_number` del Finder y del
  reveal. El servicio agrega un endpoint `phone` a la persona entregada, con la
  misma procedencia y derechos que el correo. LinkedIn sigue siendo la ÚNICA red
  (el perfil ya se producía; twitter/facebook/github no se guardan).
- **El flag booleano no es un número:** `phone_number: true` es disponibilidad,
  nunca un valor.
- **Cobro aparte pendiente de tarifa:** las operaciones `phone_reveal`,
  `company_enrich` y `person_enrich` se agregan a `radar-pricing.ts` cuando el
  fundador fije la tarifa (hoy nula = desconocida, nunca 0). Hasta entonces el
  teléfono viaja con el mismo reveal pagado del correo.
- **Antes de encender el cobro:** medir cobertura de teléfono; el umbral
  acordado es >50%.

### Fase 4 — gobernanza por proveedor y limpieza (en curso)
- **Gobernanza por proveedor (implementado):** `conditionedPolicy` genérica
  reemplazada por `contactPilotPolicy(provider)`; la decisión de autorización ya
  no exige `provider_id === 'tomba'` ni compara una sola versión de política, y
  `providerEnabled()` decide por flag de cada proveedor. Ya no hay un solo
  "tomba" cableado en el camino de decisión.
- **Router GTM muerto, borrado (implementado):** `gtm-provider-resolver.ts`, su
  spec y el fixture `fake-provider-adapter.ts` no tenían ningún llamador de
  producción.
- **Pendiente, con razón:** el registro vive en `radar/adapters/` y el candado
  `radar-architecture.spec.ts` prohíbe que el dominio importe un adapter, así
  que la gobernanza no puede leer el registro directamente sin ajustar esa
  regla. La cascada de ColdIQ sigue alimentando `ENDPOINT_VERIFIER`, que el
  servicio aún consume; borrarla exige primero sustituir ese puerto. La tabla
  `gtm_provider_waterfalls`, las variables sin uso de `render.yaml` y el puerto
   `ENTITY_ENRICHMENT_PROVIDER` quedan en la siguiente pasada por el mismo
   motivo: no se borra un contrato compartido sin verificar el consumidor.

### Fase 5 — el surface y el contrato (en curso)
- **Hecho:** las capabilities se renombraron en el registro (`email_enrichment`,
  `phone_enrichment`).
- **Hecho:** `CapabilityRouter` es el motor del reveal de persona. El walk vive
  detrás de `SelectedEmailProviderPort.revealFirstUsable`, en el adapter, así que
  el dominio no nombra un proveedor y el orden sale del registro. Un no-result o
  un error de proveedor releva al siguiente; se corta en el primer correo usable.
- **Hecho:** el candado. El dominio no importa adapters
  (`radar-architecture.spec`), y `contacts.service` no puede volver a hardcodear
  un vendor (spec de fuente).
- **Pendiente:** retirar el walk a mano de `RadarEnrichmentService` (su semántica
  terminal —bloqueado/buzón general— es distinta de un router puro).
- **Pendiente (con decisión):** rungs de `phone_enrichment` (Tomba `phone-finder`,
  5 cr) y `linkedin_resolve`. Se encienden cuando la cobertura de teléfono pase
  el umbral acordado (>50%) y el fundador fije la tarifa.
- **Pendiente:** crear la clase única **"la puerta"** y migrar a ella
  `SelectedEmailRouter`, la gobernanza y el servicio.
- **Pendiente:** colapsar `Contactos` a **vista del mismo registro** (hoy la
  identidad ya es una sola, por handle; falta la vista compartida con el
  directorio).

### Fase 6 — la economía medida (hecho con costo documentado)
- **Hecho:** el libro de precios referencia la tarifa de Hunter y de Tomba por
  env, con `source` y `version`; `HUNTER_USD_PER_SEARCH_CREDIT` se valida y se
  despliega `sync:false`.
- **Hecho:** el adapter de Hunter anota el costo real por llamada (tarifa ×
  créditos reportados); null cuando no hay tarifa, nunca 0. La puerta registra
  cada intento, incluidos los que no entregaron nada.
- **Hecho:** `expectedCogsUsd` recalibrado al costo documentado: `contacts`
  `0.30 → 0.017`, `phone_reveal` `0 → 0.0445`; el piso se re-probó y el candado
  del más apretado se movió a `monitor_renewal`.
- **Pendiente:** el **all-in por plan** (contactos + inteligencia + inferencia):
  necesita la tasa de inferencia medida en shadow, que es la única línea que aún
  no tiene precio.
- **Pendiente:** reemplazar el costo documentado por el **medido** cuando haya
  corridas reales suficientes (`cogs-observed` lo reporta y falla; un humano
  edita el literal).

Al final, **agregar un proveedor = su adaptador + una entrada en el registro.**

## 5. Riesgos

- **Pruebas que fijan la implementación actual.** La spec de
  `radar-enrichment` construye el servicio con 16 argumentos por posición y
  espera nombres de proveedor. También hay specs de gobernanza, del router y de
  la cascada. Se reescriben por fase, nunca se desactivan.
- **Semántica que hay que conservar tal cual:**
  - si falla la reserva, la operación se detiene;
  - si falla el registro posterior, se traga el error;
  - en el revelado, el débito ocurre antes de la reserva;
  - `attemptKey` es igual a la clave del débito;
  - los prefijos de `operation` que usan el p90 y el panel.
- **Contratos públicos.** Quitar `provider` de las respuestas del MCP y de REST
  cambia lo que ve un cliente que ya lea ese campo. Con la beta cerrada es el
  momento más barato para hacerlo.

## 6. Decisiones

**Ya decididas por el fundador (14 sep 2026):**

1. **Fallback por capability, sí.** Hunter y Tomba pueden relevarse para la
   misma persona y dominio; nunca por handle ajeno.
2. **Solo LinkedIn** como red social. Twitter/Facebook/GitHub no se guardan.
3. **Se cobra teléfono y todo el enrichment.** Las tarifas exactas son la
   decisión de precio pendiente (punto 4 abajo).
4. **Adaptar y ampliar este documento**, no crear uno nuevo.

**Pendientes:**

1. **Surface y motor (Fase 5):** confirmar que `CapabilityRouter` es el motor de
   la puerta y que las capabilities se renombran a `email_enrichment` /
   `phone_enrichment`; retirar el walk a mano.
2. **El modelo de lo poseído (Fase 5):** confirmar que `Contactos` es vista del
   mismo registro y que el reveal no crea un objeto; "empresa = campo".
3. **Descubrir personas en producción:** la opción (a), (b) o (c) de la
   sección 2. La Fase 1 no la necesita para `email.find`; la Fase 3 sí para
   ofrecer candidatos en producción.
4. **Quitar el nombre del proveedor de las respuestas del MCP y de REST.**
   Recomendado: sí, ahora, mientras la beta está cerrada.
5. **El webhook de Smartlead:** si ya no se usa, se borra con el resto de
   Smartlead.
6. **Tarifas que faltan (Fase 6):** Tomba por crédito (ya tiene su variable),
   la búsqueda de personas de Hunter, y las operaciones de teléfono. Sin ellas,
   esos costos se ven como desconocidos, no como cero.
