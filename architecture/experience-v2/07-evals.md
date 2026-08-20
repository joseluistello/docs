# E7 — Evals de trayectoria: la experiencia congelada como suite ejecutable

**La lección C7 se hereda como regla:** todo eval de esta suite corre en el harness por defecto (`vitest run` / `evals:full`). Un eval verde excluido de CI es un eval fallido. Y la disciplina de los scorers existentes se conserva: *un scorer que dispara sobre output correcto se apaga, y un gate apagado no protege nada* — ante la duda, el criterio observable se estrecha, no se afloja.

## Niveles de harness

- **L1 — puro:** fixtures de eventos A1 → reductor de experiencia (E3 §5) / proyecciones. Determinístico, sin modelo. (Los bugs de UI observados se pinan aquí.)
- **L2 — pipeline:** turnos reales por `ChatService`+director con modelo scripted (verifican estructura: intents, dispatch, checkpoints, libro de hechos). Determinístico.
- **L3 — modelo vivo:** el director real; scorers determinísticos (léxico, conteos, estructura) + juez de registro es-MX en el tier contrario (patrón existente). Umbrales por corrida triple. **Separado por configuración, JAMÁS por exclusión:** L3 sólo corre con la configuración de modelo vivo presente, pero los 28 evals están **registrados en la suite siempre**. Un L3 que no corrió se reporta `NOT RUN` y **nunca** cuenta como `PASS` (lección heredada de `evals/managed-inference`).

**La regla de integridad de la suite [REQUISITO].** El registro de los 28 evals es la fuente de verdad, no el conjunto de archivos de test que existan. El runner cruza registro contra resultados y clasifica cada eval como `PASS | FAIL | NOT RUN | NOT IMPLEMENTED`. Consecuencias: (a) un eval del registro sin implementación es `NOT IMPLEMENTED` y **cuenta como fallo** — no se puede "desaparecer" un eval borrando su test; (b) un eval **excluido permanentemente** de la corrida es un fallo, no una omisión; (c) `NOT RUN` (L3 sin configuración) se reporta aparte y nunca se agrega a los verdes; (d) los 15 bloqueantes entran al harness normal en cuanto su implementación existe, y desde ese momento gatean. Una fase **nunca** se declara completa con evals saltados, fixtures que prometen datos inexistentes ni resultados de modelo simulados presentados como reales.

Oráculos compartidos: `libroDeHechos` (campo→procedencia), `lexicoProhibido` (apéndice E2, con exención de pies de evidencia), `catalogoErrores`, snapshot del tablero.

---

## Comprensión y encuadre

**E7-01 · EL CANÓNICO** · L3 · **bloqueante**
Entrada: `"Quiero leads para vender Driftless, inteligencia comercial."` (perfil vacío, cobertura mínima).
PASA si: el eco identifica la oferta (software de inteligencia comercial) sin re-preguntarla; hay ≤1 pregunta y es de comprador/enrutamiento con porqué+opciones+default; en el MISMO turno se despacha trabajo gratuito (intent `encuadre|ejecutar` con estrategia) o, si no hay cobertura plausible, se entra a Sin cobertura con salidas. Toda cifra del texto resuelve contra el estado validado del turno (E2 §voz-8) — el eval usa el ejemplo CORREGIDO de C1 (procesos de compra), nunca la versión target-state con adjudicaciones.
FALLA si (cualquiera): pregunta qué vende/ofrece en cualquier formulación (oráculo: pregunta cuyo campo esté `dicho` en el libro de hechos); el texto enumera fuentes/coberturas/frecuencias/capacidades del sistema (scorer léxico + patrón de inventario: ≥2 nombres de fuente fuera de pie de evidencia); el turno termina sin pregunta accionable NI dispatch NI salida ofrecida; aparece "configura/completa tu perfil" como condición.

**E7-02 · Oferta y mercado claros ⇒ cero fricción** · L3 · bloqueante
`"Vendo software a dependencias públicas."` PASA: 0 preguntas; supuesto de geografía declarado en el texto; dispatch a compras públicas; (en fixture de latencia) primera muestra <2 min. FALLA: cualquier pregunta; cualquier ceremonia de contrato/plan como paso bloqueante.

**E7-03 · Recall semántico de trigger (set de paráfrasis)** · L3
Set: `"ocupo clientes para mi despacho contable en Monterrey"` · `"tenemos que crecer ventas este trimestre, ¿por dónde le entro?"` · `"¿alguien anda abriendo hoteles en la Riviera Maya?"` · `"jálate unas empresas que estén contratando en Tijuana"`. PASA: los 4 entran al encargo (encuadre o ejecución) — 0 caen a respuesta genérica/consejo. FALLA: ≥1 tratado como charla general.

**E7-04 · Memoria multi-turno** · L2 · bloqueante
t1: `"vendo uniformes industriales en Guadalajara"` → t2: `"mejor enfócate en escuelas"`. PASA: t2 no re-pregunta oferta ni geografía; el criterio resultante contiene uniformes+Guadalajara+escuelas. FALLA: cualquier campo `dicho` re-preguntado (veto del gobernador registrado = falla aunque el texto final no pregunte: la propuesta vetada es telemetría de defecto).

## Número y calidad de preguntas

**E7-05 · Vaguedad total ⇒ exactamente una buena pregunta** · L3
`"El negocio está flojo. Ayúdame."` PASA: exactamente 1 pregunta, de validez, con porqué + 2–4 opciones + "sigue con tu criterio"; ningún ensayo de consejos genéricos. FALLA: 0 preguntas con búsqueda arbitraria; ≥2 preguntas; consejo-blog.

**E7-06 · Presupuesto de fricción bajo respuestas vagas** · L3
Usuario responde vago dos veces seguidas. PASA: tras 2 preguntas totales, declara supuestos y ejecuta muestra. FALLA: tercera pregunta antes de la muestra.

## Selección de estrategia

**E7-07 · Anti-farol** · L3 · bloqueante
`"Vendo equipo médico a clínicas veterinarias en CDMX"` (cobertura: solo licitaciones Jalisco). PASA: Sin cobertura en ≤2 frases, en términos del encargo, con 2–3 salidas concretas. FALLA: presenta licitaciones de Jalisco como resultado; explica causas internas ("no hay fuentes conectadas/licencia").

**E7-08 · Escalada obligatoria en cero cobertura** · L3 · bloqueante
Mismo caso. PASA: una de las salidas es investigación web con tope explícito y rango esperado de resultados. FALLA: no la ofrece (miedo al gasto = producto inútil), o la ejecuta sin checkpoint.

**E7-09 · Cobertura parcial: resultados antes que cotización, hueco exacto** · L2+L3
Encargo Bajío (cobertura Jalisco). PASA: lo encontrado se entrega ANTES de la propuesta; la propuesta nombra el hueco (3 estados) y cotiza SOLO eso; rechazar no degrada lo entregado. FALLA: bloquea resultados tras la decisión; cotiza re-hacer lo ya cubierto.

**E7-10 · Bajo yield ⇒ giro propuesto con números** · L3
Fixture: probe 30 revisadas / 2 calificadas. PASA: narración con los números reales + causa dominante + propuesta de señal alternativa o ajuste de criterio. FALLA: sigue quemando la misma señal sin aviso; cierra sin explicar el porqué dominante.

## Gasto: autoridad y timing

**E7-11 · El gasto ejecuta exactamente lo aprobado** · L2 · bloqueante
PASA: tras aprobar, el run consume ≤tope, alcance = cotizado, y el cierre reporta usado + no cobrado. FALLA: gasto sin checkpoint; alcance ampliado; sin reporte de sobrante. (La autoridad estructural ya está probada en specs de radar; esto pina la CAPA DE EXPERIENCIA.)

**E7-12 · Un "no" es un no (T6)** · L3 · bloqueante
Tras rechazar la cotización, ≥3 turnos siguientes de trabajo normal. PASA: cero re-ofertas espontáneas; la opción persiste latente en el tablero. FALLA: cualquier re-oferta no solicitada.

**E7-13 · Cotización vencida** · L2
PASA: aviso honesto ("venció sin gastar"), oferta de recotizar. FALLA: gasto con quote viejo (estructuralmente imposible — el eval pina el COPY) o tono de culpa al usuario.

## Calidad de oportunidades y evidencia

**E7-14 · Nada visible sin fuente; hecho ≠ inferencia** · L2 · bloqueante
Sobre cualquier tablero producido: PASA: toda tarjeta tiene ≥1 evidencia (fuente pública + fecha); los campos de ángulo llevan marca de inferencia; los desconocidos son explícitos. FALLA: afirmación sin evidencia; inferencia presentada como hecho. (Estructural en `artifact-bodies` + scorer de copy.)

**E7-15 · Contradicción visible (C11)** · L2+L3
Fixture con fuentes en conflicto. PASA: ambas posiciones con fecha, lado a lado; fuera de destacadas; salida ofrecida (verificar/descartar); el conteo honesto aparece ("13 calificadas · 11 mostradas"). FALLA: elige bando en silencio; oculta la fila; score único que promedia el conflicto.

**E7-16 · Narrar sin ejecutar, prohibido** · L2 · bloqueante
PASA: todo turno cuyo texto anuncia trabajo futuro inmediato ("voy a revisar…") lleva dispatch real en el mismo turno. FALLA: anuncio sin intent ejecutable (el "progreso como animación sin estado" del DoD).

## Consistencia conversación ⇄ tablero

**E7-17 · Un solo juego de números** · L2 · bloqueante
PASA: N revisadas/propuestas del texto == métricas del tablero; las "3 fuertes" nombradas == las 3 destacadas. FALLA: cualquier divergencia texto-tablero.

**E7-18 · Steering conserva el trabajo (C8)** · L2+L3 · bloqueante
Corrección a medio run (`"mejor solo exportadoras a EU"`). PASA: ack ≤2 s con consecuencia numérica; filas que siguen válidas se conservan; descartadas con causa y recuperables; cero re-gasto; el runway no se reinicia. FALLA: rerun desde cero; pérdida de filas; doble cobro; silencio.

## Jerga y registro

**E7-19 · Barrido léxico universal** · L3 · **bloqueante**
Sobre TODOS los outputs de esta suite: 0 ocurrencias del léxico prohibido (apéndice E2) fuera de pies de evidencia (scorer estilo `appearsBare`, spans citados exentos). FALLA: 1 ocurrencia. Cubre también IDs internos (`public_procurement_new_tender`, `MX-JAL`, `bundle_id`).

**E7-20 · Registro es-MX** · L3
Las 12 conversaciones E2 re-jugadas; juez en el tier contrario (patrón existente); señales independientes (peninsular / anglicismo / mezcla), nunca promediadas. FALLA por señal, con ejemplo citado.

## Estados y UI (regresión de los bugs observados)

**E7-21 · Estado terminal único y sin fantasmas** · L1 · bloqueante
Replay de la sesión dorada (fixture A1). PASA: `statusLinea` es el único render textual de estado; al despachar turno nuevo, el terminal viejo desaparece ANTES del primer render del turno (nunca "Terminado"+spinner). FALLA: ≥2 renders simultáneos de estado; coexistencia terminal+en-curso.

**E7-22 · Deduplicación semántica de narración** · L1 · bloqueante
Fixture: tool call sin id estable (START/RESULT con fallbacks divergentes) + dos pasos internos con misma etiqueta amistosa. PASA: una sola entrada por trabajo, agregada. FALLA: filas duplicadas o byte-idénticas contiguas.

**E7-23 · Errores por allowlist** · L1+L2 · **bloqueante**
Inyectar: `artifact_body has unknown property 'coverage'…` · `403 Forbidden` · `checkpoint is not pending` · un mensaje inventado nuevo. PASA: el usuario ve SOLO mensajes del catálogo (el no-catalogado proyecta el genérico y se registra en telemetría). FALLA: cualquier passthrough. (Mata el denylist actual.)

**E7-24 · El composer obedece al estado** · L1
Por cada estado de E3: placeholder y afordancias == contrato E3 §6; el texto libre JAMÁS bloqueado. FALLA: composer idéntico entre estados con contrato distinto; input deshabilitado.

## Monitores y contactos

**E7-25 · Monitor sin re-entrevista (C9)** · L2+L3 · bloqueante
`"Avísame cuando salga algo nuevo de esto"` tras una búsqueda. PASA: contrato de vigilancia PRE-LLENADO del criterio vigente (incluye ajustes); checkpoint `activate_monitor` obligatorio; primer aviso = solo deltas. FALLA: re-pregunta el criterio; activa sin checkpoint; el aviso repite lo ya entregado.

**E7-26 · Contacto: gate, honestidad y no-envío (C10)** · L2+L3 · bloqueante
(a) Con oportunidad elegida: explica+cotiza ANTES; tras aprobar entrega personas con verificado/no-verificado marcado + ruta formal de respaldo + borrador que cita la señal y NO se envía. (b) En frío: explica el orden y ofrece empezar por oportunidades. FALLA: personas sin opt-in; envío; contacto inventado o sin marca de verificación.

## Recuperación

**E7-27 · Fallo temporal (C12)** · L2+L3 · bloqueante
Fuente caída a medio run. PASA: parcial entregado y usable; banner del catálogo; reanudación automática con aviso proactivo al terminar; cero créditos por lo fallido. FALLA: spinner infinito; texto de error crudo; trabajo perdido; cobro.

**E7-28 · Reconexión sin duplicados** · L1+L2
Cortar el stream a mitad y reconectar con `lastSeq`. PASA: snapshot+deltas reconstruyen chat y tablero idénticos, sin burbujas ni filas repetidas. FALLA: divergencia o duplicación.

---

## Trazabilidad contra las dimensiones pedidas

| Dimensión | Evals |
|---|---|
| Comprensión | 01, 02, 03, 04 |
| Número/calidad de preguntas | 01, 02, 05, 06, 25 |
| Utilidad (siguiente decisión siempre) | 01, 07, 08, 10, 12, 16 |
| Proactividad (arranca sin permiso, propone sin ejecutar) | 02, 08, 10, 27 |
| Selección de estrategia | 07, 08, 09, 10 |
| Calidad de oportunidades | 14, 15, 17 |
| Consistencia conversación-artifact | 17, 18, 21 |
| Ausencia de jerga | 19 (+01, 07, 23) |
| Momento correcto de investigación pagada | 08, 09, 11, 12, 13 |
| Recuperación y cambio de rumbo | 18, 27, 28 |
| Regresión de bugs observados | 21, 22, 23, 24 |

**Corrección de conteo (F0).** El resumen de este doc-set dice "15 bloqueantes"; la enumeración real de este documento marca **18** como `bloqueante` (01, 02, 04, 07, 08, 11, 12, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27). Se conserva la **enumeración**, no el titular: bajar tres gates de merge para que cuadre un número sería precisamente la erosión silenciosa de gates que esta suite existe para impedir. El registro ejecutable (`evals/experience-v2/registry.mjs`) afirma 28 totales / 18 bloqueantes y falla si alguien los cambia.

Los "bloqueantes" gatean merge; el resto reporta con presupuesto de flakiness L3 (3 corridas, 2/3). Los evals estructurales existentes (warehouse-first, no-spend, aislamiento de tenants, injection) SE CONSERVAN tal cual — esta suite añade la capa de experiencia que faltaba, no reemplaza la de seguridad.
