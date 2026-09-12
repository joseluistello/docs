# 09 — Plan de ejecución: Ada v2 en un solo PR

2026-09-11. Estado: **plan para aprobación del fundador**. Sin código detrás.

Alcance: todo lo acordado en los docs 07 y 08 en un PR contra `staging`: prerrequisitos del harness, sistema de skills con diez recetas, conducta (proactiva, aclara, saldo, límites), orquestación de campañas con tarjeta de proceso y pasos en segundo plano, tarjetas de resultado sobre `DataArtifactRenderer`, y el bench con medidor de utilidad como condición de merge.

Un PR, pero **commits ordenados por paquete** (A→E) para que sea revisable y para que el bench se pueda correr en cada corte. Todo detrás de una bandera `LUNA_V2` (env, default `on` en staging, `off` en producción hasta que el bench pase), de modo que el merge no cambie producción hasta que tú lo decidas.

Estimación honesta: 12 a 14 días hábiles de trabajo continuo. Lo que no cabe en eso se dice en §7.

---

## Paquete A — El harness deja de castigar (días 1-3)

### A1. Razonamiento por turno
- **Qué ve la persona:** Ada replantea cuando una búsqueda da cero; deja de repetir la misma llamada tres veces.
- **Cambio:** el esfuerzo de razonamiento viaja del skill activo al proveedor. `metadata.reasoning: bajo | medio` → `runStreaming({ reasoning })` en `luna-turn.service.ts` → `ModelInvocation.thinking = { enabled: true, effort }` en `mastra-model.adapter.ts:323` (hoy fuerza `enabled:false` siempre que el modelo lo permite) → `reasoning_effort: 'low' | 'medium'` en `libs/model-gateway/src/adapters/openai-compatible.ts:158`. Sin skill activo: `bajo`. La pasada de forma (`toolChoice:'none'`) se queda sin razonamiento.
- **Riesgo:** latencia y costo. Se mide en A7 antes y después sobre los 20 briefs; si p50 sube más de 2× con `bajo`, el default baja a `none` y solo los skills de análisis piden `bajo`.

### A2. El workspace en el prompt
- **Qué ve la persona:** "cómo va mi pipeline" responde a la primera; Ada nunca vuelve a decir "no hay CRM".
- **Cambio:** `luna-input.compiler.ts` compila una sección `## Tu workspace hoy` (≤ 400 caracteres, caché 60 s por workspace): colecciones con `record_count` y `stage_counts` (`CollectionsService.stageCountsByCollection`), secuencias con estado y `ready`, buzón (`sender.status`), y los tres saldos (créditos de contacto, consultas del mes, tope de inferencia) leídos por el mismo camino que `usage`. Entra al manual antes de `## El estado de este turno`.
- **Spec:** `luna-input.compiler.spec.ts` — la sección existe, cabe, degrada a vacío si una lectura falla, nunca lleva un UUID (regla de fuga existente).

### A3. Intents reordenados
- **Qué ve la persona:** Ada intenta antes de rendirse.
- **Cambio:** `INTENT_GUIDE` en `luna-manual.ts`: `responder` → `cierre` → `proponer_decision` → `encuadre` → `limite`. `limite` solo cuando un paso del skill lo declara o falta un conector. Bump de manual a 3.0.0. `luna-manual.spec.ts` y las expectativas de intent de los 20 briefs se revisan una por una (bench 6 ya las reescribió por precedencia; se vuelven a escribir por la nueva).

### A4. Argumentos persistidos
- **Qué ve la persona:** al expandir "Ver el detalle": "buscó: bombas hidráulicas · empresas · todo México".
- **Cambio:** `tool.finished` lleva `args` (crudo) y `args_label` (lenguaje de producto, construido por `describeScope` extendido en `luna-mcp-tools.ts`). `board.runs` se llena en `collecting.exec` (`luna-turn.service.ts:700-768`): `{run_id, tool, args, ref_label}`. Sin migración: `payload` es jsonb libre. Cliente: `lunaRuntime.ts` conserva `args_label`; `ToolRow.tsx` lo muestra al expandir.

### A5. Payload limpio
- **Qué ve la persona:** se acaba "no es un censo ni una prueba de capacidad" en cada respuesta.
- **Cambio:** en `luna-mcp-tools.ts`, al proyectar un resultado de mercado, `warnings[]` (los tres fijos) y `next_action` salen del objeto que ve el modelo y pasan a `_footnote` (una frase en español), que solo lee el proyector de tarjetas (D1). Regla nueva del manual: "la fuente va al pie de la tarjeta; no la repitas".

### A6. El validador permite la pregunta legítima
- **Qué ve la persona:** Ada pregunta el comprador cuando no lo sabe, una vez, con default.
- **Cambio:** `LunaIntentValidator` (`luna.contracts.ts:502`) recibe `allowedQuestionKeys` del turno = `requiere` del skill activo que no estén en el libro de hechos. Una `encuadre.pregunta` sobre una de esas llaves no es defecto `pregunta`. Se mantiene el bloqueo de preguntar lo ya sabido.

### A7. Bench de control
- Correr los 20 briefs con A1-A6 y sin ellos. Tabla: intent, refs, ruta, costo, p50, herramientas por turno. Es la línea base del PR.

---

## Paquete B — Sistema de skills y diez recetas (días 3-7)

### B1. Loader y contrato
- Nuevo `apps/api/src/luna/skills/` con `luna-skills.ts`: lee `*/SKILL.md`, parsea frontmatter (`name`, `description`, `metadata: {version, reasoning, tools, cierra_con, requiere, siguiente, costo, gatillos, excluye}`), valida en carga de módulo (cuerpo ≤ 2 500, descripción ≤ 1 024, `tools` existen en el catálogo del MCP, sin `<>`), y expone `SKILLS` congelado. Mismo patrón que `cognitive/skills.ts`.
- `references/` se leen a demanda por B4. Referencia compartida `_shared/limites.md` (lo que Ada no puede hacer, cuánto por llamada, a dónde mandar a la persona).

### B2. Índice en el manual
- `luna-manual.ts`: nueva sección fija `## Lo que sabes hacer` = `name · description` de cada skill (≈ 1 400 caracteres). **Salen** `TOOL_ROUTING` y `CRM_RULES`; de `ERROR_HANDLING` salen las líneas por herramienta. Presupuesto resultante ≈ 14 700 de 15 000 (§2 del doc 08). `luna-manual.spec.ts` se actualiza: las secciones eliminadas dejan de exigirse; el índice se exige en toda etapa.

### B3. Router de dos etapas
- `luna-skill-router.ts`: determinista. Entradas: mensaje normalizado, etapa, tablero (selección, guardado, plan pendiente), libro de hechos. Reglas: `gatillos` y `excluye` de cada skill (frases), más señales de estado. Salida: hasta 2 candidatos con `confianza: alta | baja`.
- Confianza alta → el cuerpo se inyecta en el system prompt del turno y el cinturón se recorta (B5). Baja → solo "probable: X" en el estado; el modelo decide.
- `turn.accepted` lleva `skills: [{name, version, by:'router'|'model', confianza}]` (payload jsonb, sin migración). `diagnostics.skills_used` en el resultado del turno para el bench.
- Spec: `luna-skill-router.spec.ts` con los 10 × 20 mensajes de disparo (E1) como tabla: es la prueba de disparo de la guía, a costo cero.

### B4. `skill_open` y `skill_reference`
- Herramientas de sesión en `luna-mcp-tools.ts` (junto a `board_read`): `skill_open {name}` devuelve el cuerpo; `skill_reference {skill, ref}` devuelve la referencia. Presupuesto 4 500. Registran `by:'model'` en `skills_used`.

### B5. Cinturón por skill
- `luna-stage.ts`: `toolsForTurn(stage, catalog, skills)` = unión de `metadata.tools` de los skills activos + herramientas de sesión; sin skill activo, el catálogo completo menos los retenidos (como hoy). `luna-boundary.spec.ts` sigue garantizando que `people_reveal` nunca entra.

### B6. Las diez recetas
Cada una con la plantilla del doc 08 §1 (antes de empezar, pasos con plan B, cómo cierras, ejemplo, errores frecuentes) y el frontmatter completo. Orden de escritura, por impacto en las sesiones reales de ayer:
1. `como-va-mi-pipeline` (incluye "análisis de mi CRM")
2. `quien-le-ha-vendido` (reusa `cognitive/skills/market-investigation/references/procurement-intelligence.md`, enlazada, no copiada)
3. `cuantos-hay`
4. `buscar-empresas-y-proveedores` (reusa `supplier-sourcing.md`)
5. `senales-y-oportunidades`
6. `trabajar-una-cuenta`
7. `conseguir-contactos`
8. `armar-secuencia`
9. `que-sabe-el-equipo`
10. `guardar-en-crm`

### B7. Conducta cableada
- `siguiente`: la pasada de cierre recibe la lista y el gate suave `siguiente_ofrecido` marca si el `cierre`/`responder` trae una salida de esa lista (como `salidas` ancladas o decisión). No bloquea; mide.
- `requiere`: alimenta A6.
- `costo`: regla del manual "todo paso con costo se propone con precio, saldo y lo que queda; si no alcanza, el lote que cabe". El saldo viene de A2.
- `limites.md`: cargada por todo skill activo como referencia de nivel 3 en el primer turno de la sesión y a demanda después.

---

## Paquete C — Orquestación de campañas (días 7-10)

### C1. El Plan en el tablero
- `luna.contracts.ts`: `BoardProjection.plan: LunaPlan | null` con `{plan_id, objetivo, skill:'campana', pasos: [{id, skill, titulo, status: pendiente|corriendo|esperando_toque|listo|fallido|omitido, conteo?: {hecho,total}, costo?: {creditos, saldo_despues}, decision_id?, run_id?}], costo_estimado, creado, actualizado}`. Se pliega por `board.patched` con path `/plan` (sin migración). Espejo en `apps/dashboard/src/luna/contracts.ts`.
- Herramientas de sesión: `plan_write {objetivo, pasos}` y `plan_advance {paso_id, status, conteo?, decision_id?}`. Solo el skill `campana` las lleva en `tools`.
- `stageFor`: plan con pasos pendientes → etapa `en_campana` (nueva), que el router usa para reabrir `campana` en "sigue".

### C2. La tarjeta de proceso
- `apps/dashboard/src/luna/cards/PlanCard.tsx` + parte `data-luna-plan-card`, insertada como hoy la tarjeta de tablero (`lunaRuntime.ts:747-780`) en el turno que creó o avanzó el plan. Pasos con estado, conteos, costo estimado y saldo; el paso `esperando_toque` incrusta la `DecisionCard` existente por `decision_id`; el paso `corriendo` muestra progreso de C3. Precedente visual: `InvestigationLane.tsx`.

### C3. Pasos en segundo plano
- `luna-plan-runner.service.ts`: ejecuta un paso cuya receta lo marca `segundo_plano: true` (hoy: descubrir personas por cuenta, buscar empresas por lotes) fuera del turno. Usa el mismo `LunaToolBacking` y el mismo `Harvest`, con un `run_id` propio, y publica `run.progress {run_id, status, phase, detail}` + `board.patched /plan/pasos/<i>/conteo` a través de `LunaStreamHub` y `appendEvent` (eventos con `turn_id = run_id`; `run.progress` ya está en el CHECK de la migración 185).
- Exclusión: un paso corriendo bloquea `beginTurn` con `conflict` (mismo camino que un turno en curso) salvo mensajes de control ("para", "sigue"). El turno del usuario que dispara el paso cierra con `cierre` parcial: "voy por las personas de 50 cuentas; te aviso aquí".
- Cliente: `lunaRuntime.ts:362` (`run.progress`, hoy vacía) actualiza la tarjeta de proceso; reconexión por `sinceSeq` ya existe.
- Límites: máximo 60 llamadas por paso, 10 minutos por paso, parada por saldo (C5).

### C4. La receta `campana`
- `requiere: [cuantas, criterio, buzon]`. Pasos: empresas (lotes de 25 con variación de criterio, dedupe por dominio) → guardar (decisión) → personas (segundo plano; `people_search` por cuenta) → cotizar (`people_quote` hasta 50) → revelar (decisión con precio y saldo; si no alcanza, lote que cabe) → secuencia (borrador, `sequence_check`) → revisar y activar (decisión, se resuelve en el dashboard). Escribe el plan antes del paso 1 con costo estimado. "Sigue con la campaña" reanuda en el primer paso no listo.
- No llama herramientas de negocio directamente: abre las recetas de cada paso (`skill_open`) y usa `plan_write`/`plan_advance`.

### C5. Topes de producto
- Borrador de secuencia: `contacts.maxItems` 5 → 50 en `apps/mcp/src/tools/families/secuencias.ts:146` y en el DTO del API; `max_recipients` se respeta. Spec de secuencias actualizado.
- `company_search`: el proveedor no expone cursor reutilizable (`empresas.ts:124`). **No hay paginación posible en este PR.** El plan B es el del skill: varias búsquedas con criterio distinto y dedupe por dominio. Se documenta en `limites.md`.

### C6. Decisiones que cargan lo que la persona editó
- `onResolve(outcome, payload)` en `slots.ts`/`cards/*`; `POST :id/decisions/:decisionId/resolve` acepta `payload` (filas elegidas, texto editado, colección elegida) y `luna-decisions.service.ts` lo usa en `guardar_en_crm`, `dejar_nota`, `cambios_masivos`.
- Los cuatro kinds en `UNAVAILABLE_KINDS` (`accion_externa`, `fusionar_conocimiento`, `sugerir_edicion`, `investigar`) salen del esquema `DecisionDraft` que ve el modelo: no más botones muertos. Sus tarjetas quedan en el código para cuando se habiliten.

---

## Paquete D — Tarjetas de resultado (días 10-12)

### D1. Proyector y evento
- `data-artifact.contract.ts`: `datasetRef.kind` admite `'luna_run'` con `{run_id, turn_id}`.
- `luna-board.ts`: `cardFromToolResult(name, parsed, harvest): DataArtifactSpec | null` para las seis tarjetas (Lista → `DataTableView`; Conteo → `MetricGridView`; Pipeline → `BarChartView` + métricas; Cuenta → `EvidenceListView` + métricas; Secuencia → `DataTableView`; Contexto → `EvidenceListView`), validado por `validateDataArtifactSpec`. Mismos `Ref` que el gate.
- Evento `card.shown {spec, payload, footnote}`: **migración** que amplía el CHECK de `luna_session_events.kind` (migración 185) y `luna-boundary.spec.ts`. Cliente: parte `data-luna-result-card` → `DataArtifactRenderer` + barra de acciones (por fila: las herramientas del skill; en lote: la decisión de `cierra_con`). Dentro de un plan activo, la tarjeta se incrusta en el paso.

### D2. Tarjeta Análisis
- Solo para `como-va-mi-pipeline` en este PR. El modelo emite un `DataArtifactSpec` con `json_schema` estricto (`strict:true` encendido en `mastra-model.adapter.ts:297` para este esquema únicamente, porque el contrato de tarjeta sí cumple el dialecto estricto). Pasa por el mismo validador; si falla, tabla canónica.

### D3. Manual
- Regla "tarjeta y una frase": cuando el turno produjo `card.shown`, la narración es una o dos frases que la leen; no repite cifras ni filas. Medidor `narracion_corta_con_tarjeta`.

---

## Paquete E — Evals como condición de merge (transversal, cierra el día 12-14)

### E1. Briefs y disparo
- `briefs.json`: los 20 actuales revisados por precedencia nueva + 20 nuevos (2 por skill), con `expect.skill`, `expect.must_deliver`, y los casos de conducta: `must_ask` (3), `saldo-insuficiente-lote-parcial`, `limite-con-salida` por cada tope de producto, `campana-50-personas` (con `seed` de saldo y buzón).
- `trigger-sets/<skill>.json`: 10 sí / 10 no por skill, escritos como habla la gente. Se ejecutan en `luna-skill-router.spec.ts` (router) y en un `bench --trigger` (modelo con índice, sin router) para medir la autoselección.

### E2. Medidores nuevos en `run-bench.ts`
- `utilidad`: juez modelo (el fallback caro, `gpt-5.6-luna`, con razonamiento medio) con rúbrica de tres puntos: respondió lo pedido / dio salidas concretas / no inventó. Se guarda la justificación.
- `skill_trigger`, `siguiente_ofrecido`, `pregunta_correcta`, `costo_declarado`, `limite_con_salida`, `narracion_corta_con_tarjeta`.
- Brazo `sin skill` (el que ya existe en `luna-manual.ts:690`) como baseline en cada corrida.

### E3. Condición de merge
- Sobre los 40 briefs: `utilidad` media ≥ 2.4/3 y ≥ +0.8 contra el brazo sin skill; `intent` ≥ 16/20 en los originales; `unresolved_refs = 0`; `skill_trigger` ≥ 90 % en router y ≥ 80 % en autoselección; p50 ≤ 30 s; costo medio ≤ US$0.05 por turno.
- Si no se cumple, no se mergea; se itera sobre las recetas con los transcripts (el bucle de la guía).

---

## Orden de commits dentro del PR

1. `feat(luna): razonamiento por turno y bench de control` (A1, A7)
2. `feat(luna): el workspace en el prompt y los tres saldos` (A2)
3. `feat(luna): intents por utilidad, argumentos persistidos, payload limpio` (A3, A4, A5)
4. `feat(luna): el validador permite la pregunta legítima` (A6)
5. `feat(luna): loader, índice y router de skills` (B1-B5)
6. `feat(luna): diez recetas y la referencia de límites` (B6, B7)
7. `feat(luna): el Plan y la tarjeta de proceso` (C1, C2)
8. `feat(luna): pasos en segundo plano y la receta campana` (C3, C4)
9. `feat(luna): topes de producto y decisiones con payload` (C5, C6)
10. `feat(luna): tarjetas de resultado sobre DataArtifactRenderer` (D1-D3)
11. `test(luna): briefs, disparo, juez de utilidad y condición de merge` (E1-E3)

Cada commit deja el bench verde en lo que ya existía. La bandera `LUNA_V2` envuelve B en adelante; A entra sin bandera porque son correcciones.

---

## Verificación antes de pedir revisión

- `apps/api`: `vitest run src/luna src/luna-decisions src/cognitive`, `tsc --noEmit`, `luna-boundary.spec.ts` (nunca cobra sola), `luna-manual.spec.ts` (presupuesto y secciones).
- `apps/dashboard`: `vitest run src/luna`, `tsc --noEmit`, y una captura real en staging de: conteo → muéstramelos → guardar; cómo va mi pipeline; campaña de 50 hasta la decisión de revelar (sin cobrar).
- `apps/mcp`: specs de `secuencias` y `surface-parity` (el catálogo público no cambia de tamaño: `skill_open`, `skill_reference`, `plan_*` son de sesión, no del MCP).
- Migración de `card.shown` aplicada en staging con `list_migrations`.
- Bench completo (E3) adjunto al PR como `bench-7.md`.

---

## 7. Lo que este PR no incluye, y por qué

- **Paginación real de `company_search`.** El proveedor no da cursor. Queda el plan B por lotes.
- **`investigar`, `accion_externa`, `fusionar_conocimiento`, `sugerir_edicion`.** Se ocultan al modelo; habilitarlas es trabajo de sus propios servicios.
- **Modo automático con tope de inferencia sobre el Plan.** El Plan lo prepara (costo estimado, saldos); el corte automático por tope entra cuando el modo automático exista en planes de pago.
- **Agents API de OpenAI para "Investigar".** Evaluación aparte.
- **Streaming de narración.** Con la tarjeta ya en pantalla, la frase corta llega en menos de dos segundos; el streaming deja de ser urgente.

## 8. Riesgos que pueden mover la fecha

1. **El razonamiento encendido cambia el comportamiento del gate.** Más texto, más cifras, más defectos `cifra`. Mitigación: A7 primero; la regla de cifras derivadas (pendiente desde bench 6) puede tener que entrar aquí.
2. **Concurrencia entre pasos en segundo plano y turnos.** El bloqueo por sesión en `beginTurn` es simple; "para" y "sigue" como mensajes de control necesitan una ruta que no pase por el modelo.
3. **Presupuesto del manual.** Dos cuerpos de 2 500 más el índice dejan 300 de holgura. Si un skill crece, se recorta el cuerpo y se pasa a `references/`, no se sube el techo.
4. **El juez de utilidad no es determinista.** Se corre tres veces por brief y se toma la mediana; la rúbrica pide justificación citable.

## 9. Lo que necesito de ti para arrancar

1. Tu sí a este alcance y a la bandera `LUNA_V2`.
2. Los tres casos de prueba de la campaña con datos reales de tu workspace de staging (criterio, buzón conectado, saldo) para el brief `campana-50-personas`.
3. Que revises los 20 mensajes de disparo por skill cuando estén (B3): son la definición de "cuándo" de cada receta, y eso es criterio de producto, no de código.
