# Intelligence Core — registro de decisiones

Bitácora de las decisiones que el plan E10 (`10-intelligence-core-plan.md` §16)
marcó como pendientes de humano o de evidencia empírica. Una decisión aquí
tiene: qué se decidió, **la alternativa literal que se descartó**, quién puede
revertirla y qué costaría.

Append-only. Corregir una decisión = entrada nueva que la supersede, no una
edición silenciosa de la anterior.

---

## D-001 · Clave del caché de assessments — `queryVersionDiscriminator`

**Estado:** APLICADA (default del plan). Reversible con una columna.
**Referencia:** plan §2 (nota tras los contratos), §5, §16.3. Tarjeta C0.1.
**Decidido por:** el implementador, aplicando el default que el plan propone.
El plan pedía un sí/no explícito del founder; se aplica el default y se deja
registrada la alternativa para que ese sí/no siga siendo posible sin
arqueología.

### Lo que se aplicó

La clave única de `intel_assessments` es:

```
(signal_id, workspace_id, commercial_profile_hash,
 COALESCE(query_version_discriminator,''), classifier_version, taxonomy_version)
```

donde `query_version_discriminator`:

- **`NULL` = fit BASE** — el juicio "esta oferta ↔ esta señal", que no depende
  de la versión de la query. Reusable entre versiones del mismo encargo Y entre
  encargos distintos que compartan `commercial_profile_hash`.
- **no-`NULL` = overlay de exclusión semántica** — hash de las exclusiones
  `tipo: 'semantica'` de esa versión de la query. Solo estas obligan a volver a
  preguntarle al modelo.

Las exclusiones `tipo: 'lexica'` NO entran en la clave: se aplican
determinísticamente en la etapa de filtros, así que no cambian ningún juicio.

### La alternativa literal descartada

El spec original pedía **`query_version` en la clave**:

```
(signal_id, workspace_id, commercial_profile_hash,
 query_version, classifier_version, taxonomy_version)
```

Es más simple y más literal. Se descartó por su costo: cada refinamiento —
`version+1` sobre el mismo `queryId`, que es el gesto central de la
experiencia — invalidaría **todo** el caché de fit, incluido el juicio base que
no cambió. Con K=50 y lotes de 10, una sesión de refinamiento típica de 5
versiones pasa de ~5 llamadas al clasificador a ~25: **~5×** en costo y latencia
por sesión, para re-derivar juicios idénticos.

### Cómo revertir (si el founder prefiere la literalidad)

1. Migración additive: columna `query_version integer` en `intel_assessments`,
   nueva UNIQUE que la incluya, la vieja se retira.
2. `OpportunityAssessment.queryVersionDiscriminator` → `queryVersion: number`
   en `contracts.ts` (bump de `INTEL_SCHEMA_VERSION` a 1.1).
3. La lógica de lookup en `persistence/assessments.store.ts` (C3.2).

No hay pérdida de datos: los assessments existentes quedan como historia.
El costo del cambio es la migración, no el rediseño.

### Qué observar para saber si fue la decisión correcta

`reproducibilidad.assessmentsCacheHits` en G9 (refinamiento). La decisión se
sostiene si el fit base sale 100% de caché y solo se evalúan overlays nuevos.
Si en la práctica casi toda refinación trae exclusiones semánticas, la ventaja
se evapora y la alternativa literal vuelve a ser preferible.

---

## D-002 · Taxonomía de fit y pesos de ranking — PENDIENTE DE APROBACIÓN

**Estado:** REDACTADA, sin aprobar. Bloquea C3.3 y C5.1.
**Referencia:** plan §16.1 y §16.6. Tarjeta C0.2.

`fit-tax/1.0.0` (`apps/api/src/intelligence/taxonomy/fit-tax-1.0.0.md`) y
`rank/1.0.0` (`.../rank-1.0.0.ts`) están redactados tal como el plan los
propone, con los 2 ejemplos por nivel sobre el caso G1 y el vocabulario cerrado
de 13 códigos referenciado por `contracts.ts`.

**No están aprobados.** Codifican el juicio comercial del founder, y un agente
no puede firmarlo por él. El documento lleva el marcador
`PENDIENTE DE APROBACIÓN` y un test lo verifica mecánicamente
(`rank-1.0.0.spec.ts`), de modo que el gate no puede olvidarse.

Lo que sí avanzó sin la aprobación: C0.3, C0.4, C1 y C2 — ninguno depende de la
semántica de los niveles, solo de que el vocabulario sea cerrado.

Al aprobar: registrar aquí la entrada D-002b con la fecha, quién aprobó y las
correcciones aplicadas; quitar el marcador del doc y actualizar el test.

---

## D-004 · La clave de dedupe NO puede ser `event_group_key`

**Estado:** APLICADA por necesidad. Un supuesto del plan resultó falso.
**Referencia:** plan §4.5. Tarjeta C1.3.

### El supuesto que no se sostuvo

El §4.5 dice: agrupar por «entidad normalizada + `event_group_key` (existe en
el warehouse desde su migración 0009)». La columna existe en el warehouse, pero
**no cruza el gateway**: el contrato Market Intelligence 1.0 está congelado con
`additionalProperties: false` y `MarketSignal` no la expone. Exponerla sería
modificar `gtm-fabrica`, que este plan prohíbe explícitamente (§3, hard rule 7).

### Lo que se aplicó

La clave más conservadora derivable de lo que SÍ cruza el gateway:

```
(entity.id, signal_type, fecha del evento)     // efectiva si existe, si no publicación
```

`entity.id` es la entidad **ya resuelta por el warehouse**, no un nombre
parecido. Eso es lo que hace estructuralmente imposible la sobre-fusión de dos
entidades distintas.

### La asimetría que gobierna la decisión

Los dos errores no cuestan lo mismo:

- **Sobre-fusionar** (juntar dos oportunidades reales) pierde una venta y es
  invisible: el usuario nunca sabrá qué no vio.
- **Sub-fusionar** (no juntar dos constancias del mismo evento) repite una fila
  y es visible: molesta, y se corrige.

Por eso, ante la duda, esta etapa **no fusiona**. El gate de C4 sobre dedupe
("grupos de golden fusionados exactamente; 0 sobre-fusiones") mide las dos
direcciones, así que si la sub-fusión resulta ser un problema real en G8, se
verá con datos en vez de suponerse.

### Cuándo revisitar

Si el golden muestra sub-fusión significativa, la salida NO es aflojar la clave
(eso reintroduce el riesgo de sobre-fusión), sino pedir a gtm-fabrica que
exponga `event_group_key` en la versión 1.1 del contrato — una conversación
cross-repo, con su propio expand/contract, fuera del alcance de este plan.

---

## D-005 · La señal no lleva geografía de entidad — G10 no se puede cerrar entero

**Estado:** APLICADA con límite declarado. **G10 queda parcialmente bloqueado.**
**Referencia:** plan §2 (`FilaOportunidad.entidad.geografia`), §8 G10. Tarjeta C1.4.

### El supuesto que no se sostuvo

El contrato de la fila declara `entidad.geografia: string[]`, y G10 pide que
«el componente `geografia` del score degrade las señales de CDMX para una
oferta de GDL». Ambas cosas suponen geografía **por señal**.

`MarketSignal.entity` es `{id, display_name, kind}`. No hay geografía, y el
contrato Market Intelligence 1.0 está congelado con
`additionalProperties: false`. Lo único geográfico que cruza el gateway es
`geography_coverage`, que es de la **capability**, no de la señal.

### Lo que se aplicó

1. El componente `geografia` se calcula a granularidad de capability, con la
   única distinción que se puede hacer con honestidad:
   - cobertura **exacta** de la zona pedida ⇒ `1` (toda señal suya está en zona);
   - cobertura **más amplia** (nacional para una consulta estatal) ⇒ `0.6`. Sus
     señales pueden estar fuera y no hay cómo saberlo por señal: el descuento
     es incertidumbre declarada, no un castigo inventado.

   El descuento existe justamente para que el componente no sea una constante
   decorativa — un número en el desglose que nunca cambia nada. Hay spec.

2. `entidad.geografia` de la fila queda **vacía**, y la fila declara
   `'ubicación de la entidad'` en sus `desconocidos`. Rellenarla con la
   cobertura de la capability afirmaría que la entidad está en todos los estados
   que la fuente cubre — un hecho inventado, exactamente lo que
   hecho≠inferencia prohíbe.

### Consecuencia honesta para el golden

**G10 no puede quedar verde por completo con el contrato actual.** Lo que sí es
verificable hoy: que una fuente de cobertura más amplia se degrada frente a una
exacta. Lo que NO: que una señal concreta de CDMX se degrade dentro de una
fuente nacional. Marcarlo verde sin esa mitad sería teatro.

Cerrarlo entero requiere geografía por señal en un contrato 1.1 del warehouse —
conversación cross-repo, fuera del alcance de este plan.

---

## D-002b · Taxonomía de fit y pesos de ranking — APROBADA

**Estado:** APROBADA TAL CUAL. Supersede el estado pendiente de D-002.
**Fecha:** 2026-08-06. **Aprobó:** el founder, con confirmación explícita
(sesión de revisión del Intelligence Core; se le presentó el documento completo
y las tres decisiones de juicio que contiene: la pregunta definitoria de §1, la
regla "solo `alto` destaca / `abstencion` > `bajo` inventado" de §2, y el
vocabulario de 13 códigos de §3).

- `fit-tax/1.0.0` queda como el criterio comercial vigente; `rank/1.0.0` como
  punto de partida sujeto a la calibración de C5.1 (que tiene su propia
  revisión humana de top-3).
- Se consideró y NO se pidió: un código de razón para umbral de monto ("monto
  demasiado chico para valer la pena"). Si la calibración o el uso real lo
  exigen, entra como `fit-tax/1.1.0` con su propia entrada aquí.
- Cambios aplicados al cerrar el gate: marcador del doc → `ESTADO: APROBADA`,
  header de `rank-1.0.0.ts`, y el test mecánico ahora protege la dirección
  contraria (el marcador pendiente no puede reaparecer sin decisión nueva).
- **Desbloquea:** C3.3 (micro-eval del clasificador) y C5.1 (etiquetado y
  calibración). El etiquetado del golden sigue siendo trabajo humano (~2 h) —
  este gate no lo sustituye.

---

## D-003 · Tier del clasificador — PENDIENTE (gate empírico C3.1)

**Estado:** NO DECIDIDA. Es una decisión empírica, no de diseño.
**Referencia:** plan §10.1, §14, §16.4. Tarjeta C3.1.

La elección entre (a) tier con `json_schema` y (b) primario con `json_object` +
validación se decide midiendo la tasa de salida inválida contra 3 lotes de
señales reales, con gate `<2%`. El plan es explícito: **si ambos tiers fallan el
gate, se para y se escala a humano** — no se afloja el gate.

Esta sesión no llegó a C3.1.

---

## D-006 · C1.3 no cumple aún su criterio literal «G8 verde» — deuda declarada

**Estado:** DEUDA ABIERTA, con fecha de cierre atada a C1.4.
**Abierta:** 2026-08-06 (hallazgo de revisión externa de la sesión C0→C1.3).
**Referencia:** plan §15, tarjeta C1.3 («Acepta: G8 verde; specs de
no-sobre-fusión adversariales»).

### El hecho

C1.3 se declaró completa con sus specs unitarios verdes (11/11), pero su
criterio de aceptación es literalmente **«G8 verde»**, y G8 sigue
`NOT IMPLEMENTED`. Las dos afirmaciones conviven sin contradicción, y conviene
decir por qué en vez de dejarlo a interpretación:

- El **motor** de dedupe existe y está probado: agrupa señales sin sobre-fundir
  entidades distintas, y `fuentesDistintas` cuenta nombres de fuente, no
  documentos (13 constancias del mismo portal ⇒ 13 items, 1 fuente).
- El **eval** G8 asere sobre un `OpportunityResult`, y todavía no se construye
  ninguno: `materialize.ts` es C1.4.

Es decir: la tarjeta entregó su mitad, pero su criterio de salida depende de la
siguiente. El error fue de secuenciación del plan, no de implementación.

### Por qué se registra en vez de corregirse en silencio

La regla de la sesión es que una tarjeta cuyo criterio de aceptación no se
cumple **no está done**. Marcar C1.3 como completa sin esta nota dejaría el
estado del proyecto un escalón por delante de la realidad — el mismo defecto
que el golden set entero existe para impedir.

### Cierre

Esta deuda queda saldada **al cerrar C1.4** (`rank.ts` + `materialize.ts` +
`results.store.ts`), que es cuando G8 puede correr de verdad. Si al cerrar C1.4
G8 NO queda verde, esta entrada se supersede con una nueva que diga por qué —
no se borra.

**Cierre (misma sesión, al completar C1.4):** G8 quedó **PASS** en modo
`--sin-modelo` y está en `baseline.json`. La deuda queda saldada tal como se
declaró: el motor de C1.3 era correcto y solo faltaba la materialización contra
la cual aserir.

---

## D-007 · G9 no se marca verde por su mitad determinista

**Estado:** APLICADA. G9 sigue `NOT IMPLEMENTED` a propósito.
**Referencia:** plan §8 G9. Tarjetas C2.3 / C4.3.

### El hecho

G9 declara cuatro expectativas:

1. el resultado v2 lleva `diff` contra v1;
2. conservadas y descartadas son correctas, cada descartada con su causa;
3. el fit base sale **100 % de caché**;
4. solo se evalúan los **overlays semánticos nuevos**.

C2.3 cumple (1) y (2): refinar con una exclusión léxica produce un diff
correcto, y hay specs que lo prueban. (3) y (4) necesitan el clasificador y la
tabla de assessments — C3.2 y C4.3 — que no existen.

### Lo que se aplicó

Los tests de la mitad determinista viven en
`apps/api/src/intelligence/golden/refinamiento-determinista.spec.ts`, **fuera**
de la suite golden (el archivo no termina en `.golden.spec.ts`). Corren en la
suite unitaria y protegen el comportamiento igual, pero **no reclaman el id
G9**, así que el runner no lo marca PASS.

### Por qué, y no al revés

Si esos tests estuvieran en la suite golden, el runner leería «G9 PASS» — y eso
afirmaría que el caché de fit funciona sin que exista una sola línea de él. Es
la misma trampa que se corrigió con la medición de G1: un eval que pasa por la
mitad de sus expectativas es un verde de mentira, no un avance parcial.

La alternativa descartada fue **partir G9 en dos entradas del registro**
(`G9-DET` y `G9-SEM`). Se descartó porque el §8 del plan congela un set de 14
casos y cambiar su cardinalidad para poder pintar un verde es exactamente el
tipo de ajuste que el registro existe para impedir. Si el equipo prefiere el
split, es una línea en `registry.mjs` y un archivo renombrado — pero debe ser
una decisión suya, no una conveniencia del implementador.

### Cierre

G9 queda verde en **C4.3**, cuando (3) y (4) se puedan verificar de verdad.

---

## D-003b · C3.1 NO se ejecutó — falta credencial, y el gate no se afloja

**Estado:** D-003 SIGUE ABIERTA. C3.1 es `NOT RUN`, no `FAIL` ni `PASS`.
**Fecha:** 2026-08-06 (sesión C3).
**Referencia:** plan §10.1, §14, §16.4. Tarjeta C3.1.

### Qué se intentó

La sesión tenía autorización para ejecutar C3.1 **si** el entorno traía
`TEST_GTM_DATABASE_URL` (vault de staging, para los 3 lotes de señales reales) y
`EXPERIENCE_V2_LIVE_API_KEY` (acceso a modelo). Se verificaron ambas al abrir la
sesión: **las dos ausentes**, junto con `ANTHROPIC_API_KEY`, `SUPABASE_URL` e
`INTEL_GTM_URL`.

### Por qué no se hizo igual

El gate de C3.1 es **empírico y solo empírico**: «tasa de salida inválida < 2 %
contra 3 lotes de señales REALES». Sin señales reales y sin modelo, cualquier
cosa que se produjera aquí sería una de dos:

- una medición contra fixtures, que **no mide lo que el gate mide** — la tasa de
  salida inválida depende del modelo y del texto real de las señales, no de la
  forma del payload; o
- un prompt y un batch runner **sin medición**, presentados como si la decisión
  de tier estuviera tomada.

La segunda es la peligrosa: dejaría en el repo un artefacto que parece C3.1
cerrada y sin nada que respalde la elección de tier. El plan es explícito en que
si el gate falla se para y se escala; con más razón si el gate **no se puede
correr**.

### Lo que sí quedó listo para cuando haya credencial

- **C3.2 completa**: `intel_assessments` es un caché operativo con lookup por la
  clave de D-001, INSERT append-only e invalidación perezosa por versión. En
  cuanto el clasificador emita juicios, hay dónde guardarlos y de dónde leerlos.
- **El pipeline acepta el fit**: `cacheFit` inyecta juicios persistidos al
  ranking, con `cacheHit` reportado en `reproducibilidad`. La costura está
  probada de punta a punta.
- **El listón del gate ya está medido**: el baseline determinista NO resuelve G1
  (`golden/g1-baseline.spec.ts`), así que la comparación «el clasificador debe
  superar el baseline» tiene un punto de partida real y no una suposición.
- **El formato de etiquetado** para C3.3/C5.1 (`evals/intelligence/etiquetado/`).

### Condición de cierre

D-003 se cierra cuando se corra la medición **con señales reales y modelo real**,
y se commitee su transcript. Ni antes, ni con datos sintéticos.
