# E5 — Arquitectura cognitiva: cómo se implementa la experiencia

Este documento se escribió DESPUÉS de congelar la experiencia (E2/E3) y deriva la arquitectura de ella — no al revés. Todo aquí es `[SUGERENCIA]` salvo lo marcado `[REQUISITO]`.

## 1. Lo que la experiencia exige del sistema

De E2/E3 se derivan siete capacidades, y cada una señala a quién debe pertenecer:

| Capacidad exigida | ¿Modelo o código? | Por qué |
|---|---|---|
| Absorber significado (oferta/comprador/geo/implícitos, en cualquier formulación) | **Modelo** | El regex ya demostró su techo (RC2): tres escaleras de keywords no entienden "para vender Driftless" |
| Decidir estrategia (qué señal usar, cuándo proponer web, cuándo cambiar) | **Modelo, sobre datos calculados** | Es juicio con contexto; el token-overlap no razona |
| Preguntar solo lo material, jamás lo sabido | **Modelo propone, código veta** | El modelo entiende qué falta; el código sabe qué ya se dijo y cuántas van |
| Autorizar gasto/monitor/contacto/escritura | **Código, siempre** | Autoridad = contratos tipados + checkpoints; el modelo NUNCA otorga autoridad (ya está bien construido) |
| Ejecutar consultas/verificación/investigación durable | **Código (workflows)** | Idempotencia, resume, ledger — ya existe y es bueno |
| Hablar con una sola voz, en es-MX, sin jerga | **Modelo, con gates** | Con allowlist léxico + citas mecánicas + catálogo de errores |
| Proyectar una sola verdad visible | **Código (reductor)** | E3 §5 |

**El lema [REQUISITO]: el modelo interpreta y propone; el código valida y autoriza.** La versión actual violó la primera mitad (código interpretando significado); la tentación clásica viola la segunda (modelo con autoridad). Ninguna de las dos.

## 2. La topología: un director, contratos que gobiernan, workflows que ejecutan

```
        usuario ⇄ CHAT + TABLERO (reductor de experiencia, E3 §5)
                          ▲ eventos A1 (se conservan)
┌─────────────────────────┴──────────────────────────────────────┐
│  DIRECTOR (un agente LLM, una voz)                             │
│  entrada por turno (compilada por el servidor):                │
│   · mensaje + hilo · perfil comercial · libro de hechos        │
│     (dicho/recordado/inferido/faltante) · estado del tablero   │
│   · MAPA DE COBERTURA cliente-seguro · resultados de ejecución │
│   · memoria de sesión (supuestos, decisiones, rechazos)        │
│  salida por turno: UN TurnIntent tipado + texto de narración   │
├────────────────────────────────────────────────────────────────┤
│  CAPA DE GOBIERNO (determinística — valida, jamás autora)      │
│   · validador de TurnIntent (admisión A1, ya existe)           │
│   · gobernador de preguntas (presupuesto T2 + veto por sabido) │
│   · política de gasto (cotización/tope/vigencia — ya existe)   │
│   · gate léxico + catálogo de errores + citas mecánicas        │
├────────────────────────────────────────────────────────────────┤
│  ESPINA DE EJECUCIÓN (Mastra, durable — ya existe, se adapta)  │
│   · flujo de oportunidades (query→evidencia→cobertura→quote)   │
│   · investigación web aprobada · monitores programados         │
│   · contactos/enrichment opt-in · refresco de tablero          │
├────────────────────────────────────────────────────────────────┤
│  SUSTRATO (se conserva tal cual)                               │
│   gateway de 3 funciones al warehouse · ledger de créditos     │
│   quotes/aprobaciones · provider ports (Parallel/Exa/Apollo)   │
│   evidencia/citas · outcome ledger · Collections como destino  │
└────────────────────────────────────────────────────────────────┘
```

### 2.1 El TurnIntent — el contrato clave nuevo

El director emite exactamente UN intent tipado por turno (más su narración). Vocabulario inicial:

```ts
type TurnIntent =
  | { kind: 'encuadre'; contractPatch; estrategia: EstrategiaPropuesta; preguntaPropuesta?: CheckpointDraft }
  | { kind: 'ejecutar'; estrategia: EstrategiaPropuesta }            // dispara la espina
  | { kind: 'steering'; contractPatch; conservar: 'revalidar_filas' }
  | { kind: 'proponer_decision'; draft: QuoteDraft|MonitorDraft|ContactDraft }  // el código cotiza/compone la tarjeta real
  | { kind: 'cierre'; variante: 'completo'|'sin_calificadas'|'parcial'|'sin_cobertura'; salidas: TypedAction[] }
  | { kind: 'responder' }                                            // solo narración (preguntas del usuario sobre el tablero)
```

Reglas: (1) el validador rechaza intents malformados con retry acotado (la máquina de reparación ya existe); (2) un intent rechazado JAMÁS llega al usuario — se degrada a `responder` con salida útil; (3) la pregunta propuesta pasa por el **gobernador**: si el libro de hechos marca el campo como `dicho|recordado`, veto + telemetría (así el re-preguntar se vuelve estructuralmente imposible, no solo desaconsejado); (4) la autoridad de gasto sigue EXACTAMENTE en la maquinaria actual de quotes — el director solo puede *proponer* una decisión, nunca resolverla.

**(5) Referencias estructuradas obligatorias [REQUISITO].** El TurnIntent lleva, junto a la narración, las **referencias** que la sostienen: los ids de las filas del tablero, las métricas y las evidencias sobre las que el turno afirma algo. La capa de gobierno **resuelve cada referencia contra el estado validado del turno**; una referencia que no resuelve invalida la narración (reparación acotada → degradación a la variante sin cifras), nunca se muestra. Corolario duro: **narración, tablero y acciones se derivan de los MISMOS objetos**. El director no puede emitir prosa factual — un conteo, una organización, una fecha, un monto, un costo — que no esté anclada a un objeto que el tablero también muestra. Esto es lo que hace estructuralmente imposible la divergencia texto⇄tablero (E7-17) y la cifra inventada, sin depender de que el modelo se porte bien.

### 2.2 El mapa de cobertura cliente-seguro — la pieza que mata la narración de catálogo

**[REQUISITO]** El director NUNCA recibe el `CapabilityBundle` crudo (hoy: 12 KB con `capability_id`, `cadence`, `limitations`, `expected_cost_usd` — la materia prima del reporte de inventario). El servidor proyecta:

```ts
interface MapaCobertura {
  temas: Array<{
    tema: string             // "compras públicas estatales" — lenguaje usuario
    geografias: string[]     // ["Jalisco"] — nombres, no códigos
    fuerza: 'fuerte'|'parcial'
    notas_estrategia?: string  // guía por capability (ver §5.3), redactada cliente-seguro
  }>
  investigacion_web: { disponible: boolean; requiere_aprobacion: true }
}
```

El mapeo tema→capability_id vive en el servidor; cuando el director elige "compras públicas estatales", la capa de ejecución resuelve el id. **El modelo no puede filtrar vocabulario que nunca tuvo.** El mismo principio aplica a TODO payload que toque al director: señales, evidencia y conexiones llegan proyectados a forma cliente (hoy `list_connections` entrega `next_action` de operador — eso desaparece de este contexto).

### 2.3 El libro de hechos (known-facts ledger)

Compilado por el servidor cada turno (extiende el Commercial Context Compiler existente): cada campo del encargo con valor + procedencia + turno de origen (`dicho@t1 | perfil | inferido@t2 | faltante`). Usos: (a) el eco del encuadre lo lee; (b) el gobernador veta preguntas sobre lo sabido; (c) los conflictos (perfil≠mensaje) se detectan aquí y generan la única pregunta legítima de tipo conflicto; (d) E7 lo usa como oráculo de "re-preguntó lo sabido".

## 3. Veredicto sobre cada candidato de la lista

| Candidato | Veredicto | Detalle |
|---|---|---|
| **Un agente principal** | **SÍ — y solo uno** | Una voz, un contexto, una memoria de sesión. Más agentes conversando ≠ más inteligencia: introduce coordinación implícita, coste no acotable y voz incoherente (el propio doc de workbench §3.2 ya lo argumenta bien — lo confirmamos). |
| **Workflows determinísticos** | **SÍ — como espina de ejecución, no de conversación** | El error actual fue poner el flujo determinístico también a "entender" (regex) y dejar al modelo de adorno. Mastra ejecuta lo comprometido (queries, verificación, gasto aprobado, monitores) con suspend/resume; la conversación es del director. Los dos workflows actuales se componen: el de sesión hospeda el turno del director; el de oportunidades es la espina que `ejecutar` dispara. |
| **Skills con progressive disclosure** | **SÍ — exactamente uno** (§5.1) | |
| **Especialistas** | **NO como agentes; SÍ como pasos** | De la tabla de 8 del workbench doc: Orchestrator → ES el director. Contract Compiler → validador de lo que el director propone (deja de autorar con regex). Question Policy → gobernador (veta, no redacta). Plan Compiler → determinístico desde `EstrategiaPropuesta` tipada. Capability executors → tools. Evidence verifier → determinístico. Plan Supervisor → scorer que ALIMENTA al director (le entrega yield/costo observado; el director decide proponer giro). **Synthesizer → SE ELIMINA**: una voz separada para "redactar" es como nació el bibliotecario; el director narra siempre. |
| **Herramientas** | **SÍ, pocas y proyectadas** | El cinturón del director: `ejecutar_estrategia`, `consultar_tablero`, `leer_evidencia(id)`, `consultar_pipeline` (CRM, para preguntas de pipeline), `proponer_decision`. Se ACABA el cinturón de 20 (list_topics, broker_recent_events, list_connections… fuera de esta superficie: pertenecen al chat de conocimiento, que es otro producto). |
| **Policies** | **SÍ — las existentes se conservan** | Gasto/quote/tope/vigencia, warehouse-first, no-persons-en-señales, stop conditions. Se les suma el gobernador de preguntas y el gate léxico como CI. |
| **Memoria** | **SÍ — tres horizontes, sin novedad** | (1) Sesión: snapshot Mastra + memoria del director (supuestos, rechazos — "dijo no a investigación esta sesión"). (2) Perfil comercial: se construye como subproducto ("¿guardo que vendes X a Y para la próxima?" — un clic, proposer≠approver se conserva). (3) Knowledge: solo Note/Suggested edit (invariante intacta). NO añadir memoria vectorial/embeddings para esto — el volumen no lo justifica y la autoridad sí lo prohíbe. |
| **Artifacts** | **SÍ — los 6 tipos ya congelados** | `opportunity_set` (tablero), `opportunity_dossier`, `monitor`, `contact_selection`, `outreach_draft`, `plan` (proyectado al runway). Hoy solo se crean 2: la brecha es de wiring, no de contrato. |
| **Checkpoints** | **SÍ — los 6 tipos ya congelados** | Hoy solo se producen 3; `activate_monitor`, `approve_external_action`, `confirm_memory` se estrenan con monitores, contactos y perfil (E8 fases 4–5). |
| **¿Sobra algo?** | Sí | El Synthesizer (arriba); la "entrevista" como forma (muerta con el Radar — no revive como wizard del workbench); generative UI abierta (registry allowlisted, ya decidido, se confirma); y los tres clasificadores regex como DUEÑOS del turno (§4). |

## 4. El turno, de punta a punta (reemplaza las escaleras de regex)

```
mensaje → [servidor] compila entrada del director (contexto §2)
       → [director] TurnIntent + narración
       → [gobierno] valida intent · veta/ajusta pregunta · gate léxico narración
       → [efectos] patch de contrato / dispatch a espina / tarjeta de decisión / cierre
       → [eventos A1] → [reductor] → UI
```

- El preflight regex actual (`classifyChatRoute`/`classifyIntent`) **deja de decidir el destino del turno**. Puede sobrevivir como *hint* barato en la entrada del director y como guardia de producto (p. ej. bloquear la superficie comercial para pedidos no comerciales), pero la ruta la decide el director con el turno completo. Muere la asimetría "leads está en una escalera y no en la otra".
- `synthesisOnly` muere. El director siempre tiene su cinturón corto; la seguridad viene de que las herramientas están proyectadas y la autoridad es del código — no de amordazar al modelo.
- El presupuesto por turno se conserva (deadline, max steps) y se instrumenta por intent.

## 5. Las preguntas explícitas del equipo

### 5.1 ¿Un "Market Intelligence Skill"? — Sí: uno, y es el manual del director

Un solo skill (= system prompt + referencias cargables) que ES el manual de operación del trabajo comercial: identidad y voz (E2 §voz), el modelo del encargo, cómo razonar cobertura sobre el mapa, la política de preguntas (su lado modelo), los contratos de cada estado (E3), y las reglas de honestidad evidencial. **Con progressive disclosure por etapa, no por fuente:** el núcleo es corto; las secciones de investigación web, monitores y contactos se cargan cuando la sesión entra a esa etapa (server-side, por estado de la sesión — no por decisión del modelo).

Advertencia frontal **[REQUISITO]**: un skill NO arregla identidad por sí solo — la versión actual ya era "commercial intelligence assistant" y narró catálogo igual, porque el resto del sistema lo contradecía. El skill solo funciona acoplado al TurnIntent, al mapa proyectado y al gobernador. Prohibido resolver defectos de comportamiento "agregando un párrafo al skill": cada regla nueva de comportamiento nace como eval (E7) o como validación de la capa de gobierno.

### 5.2 ¿Skills separados para web research / monitores / contactos? — No

Son **etapas del mismo trabajo con políticas propias**, no trabajos distintos. Separarlos en skills con triggers propios fragmenta la identidad (¿quién contesta cuando el usuario mezcla "búscame clientes y avísame si sale algo nuevo"?) y reintroduce el riesgo de under-triggering que ya sufrieron (rutas clasificadas sin dueño). Cada etapa aporta: una sección del manual (cargada por estado), sus checkpoints tipados (ya congelados) y su maquinaria determinística (ya construida). La frontera dura no es el skill: es el checkpoint.

### 5.3 ¿Referencias por capability? — Sí, como DATOS que viajan con el catálogo

Cada capability puede llevar `notas_estrategia` redactadas cliente-seguro (ejemplo para compras públicas: "la fase importa: convocatoria abierta = urgencia por fecha de cierre; adjudicada = el ángulo es el ganador y sus subcontratistas; el monto publicado ≠ monto final"). El servidor las inyecta en el mapa de cobertura SOLO cuando esa capability está en juego. Así el conocimiento por señal escala como **datos versionados**, no como prompts ni código. Es la respuesta correcta a "¿cómo sabe el director vender bien cada tipo de señal?" sin explotar el prompt.

**Dónde viven [REQUISITO] (corregido tras revisar el warehouse — ver `09-revision-warehouse.md` §3):** el contrato del catálogo (Market Intelligence 1.0) está congelado con `additionalProperties: false` en ambos niveles y verificado byte-a-byte contra un manifest hasheado. **`notas_estrategia` NO modifica ese contrato — ni ahora ni como paso intermedio.** Fase 1 (la única en alcance): las notas viven en un **sidecar versionado dentro de la capa de proyección de Driftless**, un archivo de datos keyed por `(capability_id, catalog_version)` con su propia versión de sidecar; el proyector lo hace *join* contra el bundle **después** de validarlo, y si una clave no existe la nota simplemente no viaja (ausencia nunca es error). Dueño: producto; cero coordinación cross-repo; cero riesgo para el bundle-check. Fase 2 (opcional, fuera de alcance): graduarlas al catálogo en un contrato `v1.1` con su bump de manifest y transferir la autoría a quien opera el warehouse.

### 5.4 ¿Metadata/manifests por fuente en lugar de skills por fuente? — Sí, rotundo y ya es así

La arquitectura actual acertó por completo aquí y no se toca: las fuentes viven como source packs + manifests + recipes en el warehouse (repo aparte), invisibles tras el gateway de 3 funciones. **Una fuente jamás será un skill, un prompt, una rama de código en Driftless ni un concepto de UI.** Añadir la fuente 22 no toca ni al director, ni al shell, ni a este doc-set — ese es el test de escala del §4.0 del workbench doc, que confirmamos como invariante.

## 6. El modelo que ejecuta al director `[SUGERENCIA con tradeoff]`

Hoy: DeepSeek v4-flash primario (thinking off por defecto), gpt-5.6-luna como fallback, sin `json_schema` en el primario. Riesgo a nombrar sin rodeos: **el director ES el producto**, y los turnos donde se juega (encuadre, estrategia, steering, cierre honesto) son pocos por sesión (~3–6) pero de juicio denso. Optimizar esos turnos por costo de inferencia es optimizar lo barato a costa de lo caro (churn de usuarios).

Recomendación: (a) thinking **encendido** para intents `encuadre|steering|proponer_decision|cierre` (acotado; el cache salt por workspace ya existe); (b) correr E7 contra ambos tiers y decidir con datos — si flash no pasa E7-01/02/09, el director sube de tier y la narración mecánica (títulos, resúmenes de refresco) se queda en el barato; (c) exigir `json_schema` (structured outputs) para TurnIntent en el tier que lo soporte — la validación fail-closed ya existe, pero el modo `prompted` del primario pagará más reparaciones. El costo real del producto está en la investigación pagada y en el churn, no en estos ~6 turnos.

## 7. Qué NO construir (anti-arquitectura)

- **Sociedad de agentes** (investigador + crítico + redactor conversando): coste/latencia sin evidencia de mejora para ESTE trabajo; la verificación adversarial que sí importa (evidencia, contradicciones) ya es determinística.
- **Skills por fuente o por proveedor** (§5.4).
- **Memoria vectorial del workspace** para el director: el contexto necesario es pequeño y estructurado (perfil + libro de hechos + tablero); los embeddings solo introducen autoridad difusa.
- **Generative UI abierta**: el registry de artifacts/acciones allowlisted se mantiene (todo payload validado — A1 ya lo garantiza).
- **Un segundo dueño del estado** (CopilotKit u otro runtime paralelo al Work Session): la decisión previa del equipo era correcta; assistant-ui como primitivas de interacción con External Store, el servidor como única autoridad.
- **Prompt-engineering como sistema de control**: el prompt del director es corto y estable; el control vive en contratos, gobernador, gates y evals. (El síntoma a vigilar: si un PR "arregla" comportamiento editando solo el skill, exigir el eval que lo pruebe.)
