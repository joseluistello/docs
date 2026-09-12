# 08 — El sistema de skills de Ada

Propuesta, 2026-09-11. Estado: **borrador para decisión del fundador**. No hay código detrás.

Antecedente: el diagnóstico de la sesión de staging del 10 de septiembre (ver la bitácora de 00-PLAN y el doc 07). Ada corre con `gpt-5.6-luna`, el harness apaga el razonamiento, el validador premia el silencio, el bench mide obediencia y no utilidad, el modelo empieza cada turno sin saber qué hay en el workspace, y **hay un solo skill: un manual de 6 700 caracteres de reglas sin una sola receta de varios pasos**. Este documento diseña el reemplazo de ese último punto. Los otros cuatro son prerrequisitos (§7).

Base: la guía de Anthropic para construir skills (progressive disclosure en tres niveles, descripción = qué + cuándo, problem-first, patrones de orquestación secuencial y selección de herramienta por contexto, pruebas de disparo y funcionales contra baseline), adaptada a un harness que no es Claude: Ada es OpenAI, el "system prompt" es el manual compilado, y el catálogo de herramientas es nuestro MCP.

## 1. Qué es un skill de Ada

Una **receta de producto**: cómo resolver una pregunta que alguien que vende le hace a Ada, de principio a fin, con las herramientas del MCP, incluyendo qué hacer cuando el primer paso no da nada. No es una regla de estilo (eso es el manual) ni una herramienta (eso es el MCP). En la analogía de la guía: el MCP es la cocina, el skill es la receta.

Cada skill es una carpeta, igual que las que ya existen en `apps/api/src/cognitive/skills/`:

```
apps/api/src/luna/skills/<nombre>/
├── SKILL.md            # obligatorio: frontmatter + receta (≤ 2 500 caracteres de cuerpo)
└── references/         # opcional: profundidad que se carga solo si el turno la pide
```

Sin `scripts/`: lo determinista vive en el servidor como herramienta o como proyector, nunca como código que el modelo ejecuta.

### Frontmatter (contrato)

```yaml
---
name: quien-le-ha-vendido
description: Averigua quién le ha vendido un producto o servicio a un comprador público y con qué recurrencia. Úsalo cuando la persona pregunte "quién le vende a", "quién ganó", "quién es el proveedor de", "adjudicaciones de", o nombre a una dependencia y un producto. No lo uses para buscar proveedores en general (eso es buscar-empresas-y-proveedores).
metadata:
  version: 1.0.0
  reasoning: bajo            # bajo | medio — cuánto razonamiento pide el turno
  tools: [market_search_awards, market_get_supplier_history, market_aggregate_awards, market_search_suppliers]
  cierra_con: lista           # lista | conteo | pipeline | cuenta | secuencia | contexto | analisis | ninguna
---
```

- `description` lleva **qué hace + cuándo dispara + cuándo no**, con las frases que la gente dice en español mexicano. Es el nivel 1 de disclosure y lo único que el modelo ve de los skills que no abrió.
- `tools` es la lista blanca del turno: el cinturón se recorta a esas herramientas más las de sesión (`board_read`). Menos catálogo, menos tokens, menos herramienta equivocada.
- `reasoning` decide el esfuerzo de razonamiento del turno (§7.1).
- `cierra_con` declara la tarjeta que el turno debe producir cuando exista el doc 07; hasta entonces, la forma de la narración.

### Cuerpo (plantilla fija)

```markdown
# Quién le ha vendido

## Antes de empezar
Qué del estado del turno importa (tablero, resumen del workspace, criterio dicho).

## Pasos
1. Paso → herramienta y argumentos. Qué esperas ver.
2. Si el paso 1 trae 0 filas → plan B concreto (quitar estado, sinónimos, cambiar de dominio).
3. …
Cada paso dice qué hacer con cero filas. Un skill sin plan B no se acepta.

## Cómo cierras
Intent, forma de la respuesta, qué NO decir. Una frase de lectura y la tarjeta.

## Ejemplo
Pregunta → llamadas en orden → respuesta.

## Errores frecuentes
`query_not_selective` → causa → corrección. `Collection not found` → causa → corrección.
```

Tono de la guía: explicar el porqué, imperativo, sin MUST en mayúsculas, sin XML. Cuerpo corto; la profundidad va a `references/`.

## 2. Los tres niveles de disclosure, en el presupuesto de Ada

El manual tiene 15 000 caracteres de presupuesto. Hoy la parte fija ocupa ~6 700 y el estado compilado el resto.

| Nivel | Qué | Cuándo se carga | Tamaño |
|---|---|---|---|
| 1 | Índice de skills: `name` + `description` de los 10 | Siempre, dentro del manual, **en lugar de** `TOOL_ROUTING` y `CRM_RULES` | ~1 400 |
| 2 | Cuerpo del SKILL.md de los skills activos (máximo 2) | Cuando el router los selecciona para el turno | ≤ 2 500 c/u |
| 3 | `references/<x>.md` | A demanda: la herramienta `skill_reference` o el router con confianza alta | ≤ 4 500 (cap de resultado) |

Presupuesto resultante: fijo recortado (~5 300) + índice (1 400) + 2 cuerpos (5 000) + estado (~3 000) ≈ 14 700. Cabe, sin tocar el techo. El nivel 3 no entra al system prompt: llega como resultado de herramienta, con el cap que ya existe.

## 3. El router: cómo se dispara un skill

Dos etapas, las dos observables en el evento `tool.finished` para poder medirlas.

1. **Pre-router determinista** (servidor, antes de la primera llamada al modelo). Lee el mensaje, la etapa y el tablero, igual que `criterionFromMessage` ya lee estado y giro. Reglas por skill: frases gatillo y frases de exclusión de la `description`, más señales de estado (hay selección → `guardar-en-crm` sube; hay decisión pendiente → nada nuevo). Devuelve hasta 2 candidatos con confianza. Cubre la mayoría de los turnos a costo cero.
2. **Autoselección del modelo** (con razonamiento encendido). El índice está en el manual; si el pre-router no eligió o eligió mal, el modelo llama `skill_open { name }` y recibe el cuerpo como resultado de herramienta. Si abre una `reference`, llama `skill_reference { skill, ref }`.

Regla de precedencia: pre-router con confianza alta inyecta el cuerpo en el system prompt de ese turno; con confianza baja solo sugiere ("probable: quien-le-ha-vendido") y deja que el modelo abra. Un skill abierto queda anotado en el turno (`skills_used: [{name, version, by: 'router' | 'model'}]`), que es lo que el bench necesita para medir disparo.

## 4. El catálogo v1 (diez recetas)

Una por pregunta real que la gente hace. Todas problem-first. Las herramientas son las del MCP actual.

| Skill | Dispara con | Pasos (resumen) | Plan B obligatorio | Cierra con |
|---|---|---|---|---|
| **cuantos-hay** | "cuántos", "hay muchos", "qué tan grande" | `market_count_suppliers` → guardar filtros en `board.runs` → ofrecer "muéstramelos" | conteo 0 → ampliar un filtro a la vez y decirlo | conteo |
| **buscar-empresas-y-proveedores** | "búscame", "empresas de", "proveedores de", "quiénes" | decidir Empresas (enrichment, `company_search`) vs Proveedores (`market_search_suppliers`) por la regla de separación; buscar con los filtros del conteo si lo hubo | `query_not_selective` → agregar estado o giro; 0 filas → sinónimos del publicador | lista |
| **quien-le-ha-vendido** | "quién le vende a", "quién ganó", "adjudicaciones de" | `market_search_awards` por comprador y producto → `market_get_supplier_history` de los 3 primeros → `market_aggregate_awards` para recurrencia | 0 adjudicaciones → sin estado; luego sinónimos; luego `market_search_suppliers` por texto y decir que es candidato, no incumbente | lista |
| **senales-y-oportunidades** | "licitaciones", "oportunidades", "señales", "qué está abierto" | `market_search_opportunities` → `market_get_opportunity` de las actionables → priorizar por `proposal_deadline` | 0 → quitar estado; cambiar `query` a sujeto; leer `participation_status` con cuidado | lista |
| **como-va-mi-pipeline** | "cómo va", "mi pipeline", "mis oportunidades", "análisis de mi CRM" | `collection_query` sin id → elegir la del CRM → `aggregate` por etapa → `query` de las 5 más recientes | id inválido → volver a listar, nunca adivinar; cursor malformado → re-consultar sin cursor; **nunca** decir "no hay CRM" si la lista trajo una colección | pipeline / análisis |
| **trabajar-una-cuenta** | nombre de una empresa del CRM, "qué sé de", "próximo paso con" | `collection_query get` → `people_acquired` filtrado → señales del registro → proponer siguiente acción | registro no encontrado → buscar por nombre en la colección antes de decir que no existe | cuenta |
| **conseguir-contactos** | "contactos de", "quién decide en", "consígueme el correo" | leer saldo (`usage`) → `people_search` → `people_quote` → proponer `revelar_contactos` | sin saldo → `limite` crédito con el precio; sin candidatos → decirlo por cuenta | cuenta |
| **armar-secuencia** | "secuencia", "mándales", "correos a", "cadencia" | `people_acquired` → `sequence_create_draft` → `sequence_check` → proponer `revisar_secuencia` | sin buzón listo → `limite` conector con el enlace; sin contactos adquiridos → ofrecer conseguir-contactos | secuencia |
| **que-sabe-el-equipo** | "qué sabemos de", "el playbook", "cómo vendemos", antes de prospectar un giro nuevo | `context_retrieve` con la tarea → `context_get` del más relevante → aplicar al criterio | 0 temas → decirlo y proponer dejar nota al cerrar | contexto |
| **guardar-en-crm** | "guárdalos", "al CRM", "quédate con estos" | `board_read selection` → `proponer_decision guardar_en_crm` con vista previa | selección vacía → `limite` dato, nunca guardar | ninguna |

Lo que sale del manual y entra a los skills: `TOOL_ROUTING` entero, `CRM_RULES` entero, y de `ERROR_HANDLING` las líneas específicas de herramienta. Se queda en el manual lo universal: identidad y voz, escalera, contrato de salida, orden de intents (reordenado, §7.3), gate final.

## 5. Cómo se prueba cada skill

Tres pruebas, las de la guía, adaptadas al bench que ya existe (`apps/api/src/luna/bench`).

1. **Disparo.** Por skill, 10 mensajes que deben dispararlo y 10 que no, escritos como habla la gente (con typos, sin nombrar el producto, casos vecinos: "cuántos" contra "búscame"). Medidor nuevo: `skill_trigger` = disparó el correcto / no disparó uno ajeno. Meta de la guía: 90 %.
2. **Funcional.** Los 20 briefs actuales más 2 por skill nuevo, con `expect.skill` y `expect.must_deliver` ("una lista con al menos una fila, o la cobertura consultada y por qué 0"). Medidor nuevo: **utilidad**, un juez modelo con rúbrica de tres puntos (respondió lo que se pidió / dio salidas concretas / no inventó). Es el medidor que hoy no existe y que hubiera atrapado "tu CRM no existe".
3. **Baseline.** Cada brief corre con skill y sin skill (el manual ya tiene el brazo "sin skill" en `luna-manual.ts:690`). Se reporta delta de utilidad, herramientas por turno, costo y p50. Un skill que no mejora utilidad no se mergea.

Los dumps del bench guardan `skills_used`, así que un skill que dispara y no ayuda se ve en la tabla.

## 6. Versionado y gobierno

- `metadata.version` en el frontmatter; se estampa en `diagnostics.skills_used` de cada turno, como hoy se estampa `MARKET_INVESTIGATION_SKILL_VERSION` en los reportes.
- Los skills son código: entran por PR con su bench. No se editan desde el dashboard en v1.
- Personalización por workspace **sin tocar el skill**: el skill lee el playbook del equipo por `context_retrieve` (ya existe el tema `senales-de-compra` y los criterios de colección). El skill es la receta; Cerebro pone los ingredientes del cliente.

## 7. Prerrequisitos (los otros cuatro puntos del diagnóstico)

Sin estos, los skills son recetas para un cocinero que no puede leerlas.

1. **Razonamiento encendido.** `mastra-model.adapter.ts:323` apaga el razonamiento siempre que el modelo lo permite. Cambio: el skill activo decide (`metadata.reasoning`), default `bajo`; `medio` para análisis y cierre. Medir p50 y costo antes y después en los 20 briefs.
2. **El workspace en el prompt.** Un párrafo compilado y cacheado (TTL 60 s) en `luna-input.compiler.ts`: colecciones con conteos por etapa, secuencias y su estado, buzón, saldo de contactos. ~300 caracteres. Adiós al redescubrimiento.
3. **Intents reordenados.** `responder` y `cierre` antes que `limite`; `limite` solo cuando un paso del skill lo declara. Hoy "el primero que aplica gana" y `limite` es el primero.
4. **Payload limpio.** Las tres advertencias fijas de mercado y el `next_action` salen del texto que ve el modelo (`luna-mcp-tools.ts` los quita al proyectar); vuelven como pie de tarjeta cuando exista el doc 07.
5. **Argumentos persistidos.** `tool.finished` guarda `args`; `board.runs` deja de estar vacío. Sin esto no hay "muéstramelos hereda filtros" ni depuración del 32 contra 13.

## 8. Orden de trabajo

- **PR 1 (2 días):** prerrequisitos 1, 2, 3, 5. Bench antes y después.
- **PR 2 (3 días):** el loader de skills, el router de dos etapas, `skill_open` / `skill_reference`, el índice en el manual, y **tres skills**: `como-va-mi-pipeline`, `quien-le-ha-vendido`, `cuantos-hay` + `buscar-empresas-y-proveedores` (van juntos). Con sus 20 mensajes de disparo cada uno y el medidor de utilidad.
- **PR 3 (3 días):** los otros seis skills. Payload limpio. `TOOL_ROUTING` y `CRM_RULES` salen del manual.
- Después: doc 07, tarjetas.

Casos de prueba del PR 2, para que los revises antes de escribir nada:

1. "¿Quién le ha vendido uniformes al IMSS en los últimos dos años?" → debe cerrar con una lista de proveedores con montos anclados, o con "0 en la cobertura consultada" y los candidatos por texto marcados como candidatos.
2. "Dame un análisis de mi CRM" → 40 registros, 3 etapas, las 5 más recientes, una recomendación. Nunca "no existe".
3. "¿Cuántos proveedores de bombas hidráulicas hay? … Muéstramelos" → conteo con filtros visibles, lista con los mismos filtros.

## 9. Decisiones que necesita el fundador

1. **Diez skills problem-first** (por pregunta), no por familia de herramienta. Sí/no.
2. **Router de dos etapas** (determinista + autoselección del modelo). Sí/no, o solo una de las dos.
3. **El medidor de utilidad con juez modelo** como gate de merge para cada skill. Sí/no.
4. **Orden**: prerrequisitos primero (PR 1), luego tres skills (PR 2). O los tres skills primero para ver el efecto antes.

## 10. Orquestación: "50 personas de distintas empresas para una campaña"

Una receta por pregunta no cubre esto. Es una **cadena de recetas** con pasos pagados, decisiones humanas en medio y minutos de duración. Lo que el flujo exige hoy, con las primitivas tal como están:

| Paso | Receta | Herramienta | Límite real hoy |
|---|---|---|---|
| 1. Empresas | buscar-empresas-y-proveedores | `company_search` | máx. 25 por búsqueda, sin paginación → 2-3 búsquedas con criterio distinto |
| 2. Al CRM | guardar-en-crm | decisión `guardar_en_crm` | un toque |
| 3. Personas | conseguir-contactos | `people_search` por cuenta, `people_quote` | 50 llamadas externas secuenciales; no caben en un turno (8 pasos, 150 s) |
| 4. Revelar | conseguir-contactos | decisión `revelar_contactos` | un toque, con precio y saldo |
| 5. Secuencia | armar-secuencia | `sequence_create_draft`, `sequence_check` | **máx. 5 contactos por borrador** → 10 borradores, o subir el tope |
| 6. Activar | armar-secuencia | decisión `revisar_secuencia` | se resuelve en el dashboard, nunca en el chat |

Lo que el harness no tiene y hace falta para que Ada orqueste y la UI lo refleje:

1. **Un Plan en el tablero.** `board.plan { objetivo, pasos[{skill, status, conteo, checkpoint?}], run_id }`. Sobrevive turnos y sesiones. "Sigue con la campaña" retoma donde quedó. Hoy el tablero tiene selección, guardado y pendientes; no tiene proceso.
2. **La tarjeta de proceso en el hilo.** Los pasos con su estado (pendiente, corriendo, listo, esperando tu toque), los conteos ("38 de 50 cuentas con persona elegida"), y las tarjetas de decisión existentes **incrustadas en el paso** que las necesita. Es el componente más importante del chat, antes que las tarjetas de resultado del doc 07. Precedente: `InvestigationLane` ya pinta un trabajo largo con progreso.
3. **Pasos en segundo plano.** Un paso que excede el turno (los 50 `people_search`) corre como trabajo del servidor y emite `run.progress` (el evento ya existe en el contrato; la rama del cliente en `lunaRuntime.ts:362` está vacía). El turno cierra con "lo estoy haciendo, te aviso"; el hilo se actualiza solo.
4. **La receta orquestadora.** `campana` no llama herramientas: compone recetas, escribe el plan, decide qué paso sigue, y sabe parar en cada checkpoint pagado. Es el único skill que abre otros skills.
5. **Dos topes de producto que hay que subir:** borradores de secuencia de 5 a 50 contactos (o lote), y paginación en `company_search`.

Orden revisado, para que la orquestación no quede al final:

- **PR 1** prerrequisitos (razonamiento, workspace en el prompt, intents, argumentos).
- **PR 2** sistema de skills + tres recetas.
- **PR 3** Plan + tarjeta de proceso + pasos en segundo plano + receta `campana`, y los dos topes. Aquí Ada ya arma la campaña de 50 de punta a punta, con la UI mostrando el avance.
- **PR 4** las seis recetas restantes + tarjetas de resultado (doc 07), que ahora se incrustan en la tarjeta de proceso.

## 11. Conducta: proactiva, pregunta cuando hace falta, consciente del saldo y de sus límites

Las cuatro son requisitos del fundador. Ninguna se resuelve con una regla más en el manual: el manual ya dice "resultado primero" y "ofrece 2 o 3 salidas", y Ada no lo hace porque el harness la castiga por hacerlo. Cada requisito va con el mecanismo que lo hace posible y con cómo se mide.

| Requisito | Por qué falla hoy | Mecanismo | Se mide con |
|---|---|---|---|
| **Proactiva** | Cierra y se calla: el siguiente paso no existe como objeto, solo como frase que el validador puede rechazar | Cada skill declara `siguiente: [...]` (después de contar → mostrar; después de listar → guardar; después de guardar → conseguir personas con precio). El cierre lleva **una** salida concreta como botón o decisión, nunca como pregunta abierta. En una campaña, el Plan ya dice qué sigue. Lo gratis se hace sin preguntar (escalera). | medidor `siguiente_ofrecido`: el turno cerró con una salida accionable (sí/no) |
| **Aclara cuando hace falta** | El validador tiene regla `pregunta` y 18 de 20 briefs prohíben preguntar → el modelo aprendió a no preguntar nunca, ni cuando le falta el comprador | Cada skill declara `requiere: [comprador, producto]`. Si falta un requerido y no está en el perfil ni en el hilo, la pregunta está permitida y es **una sola, con default propuesto**: "asumo todo México; dime si es un estado". Si el default es gratis, hace el trabajo con el default en el mismo turno y pregunta al cerrar (hace y pregunta, no pregunta y espera). El perfil del workspace rellena defaults antes de preguntar. | briefs nuevos con `must_ask` (hoy solo existe `forbid_question`); medidor `pregunta_correcta`: preguntó solo por un requerido ausente |
| **Consciente del saldo** | El saldo de contactos, las consultas del mes y el tope de inferencia no están en el prompt; `usage` es una herramienta que hay que acordarse de llamar | El resumen del workspace (§7.2) incluye los tres saldos. Cada skill declara `costo: gratis \| externo \| creditos`. Todo paso con costo se propone con precio, saldo y lo que queda después. Si no alcanza, propone el lote que sí alcanza: "alcanza para 32 de 50; ¿voy con esos o recargas?". El Plan de campaña calcula el costo total **antes** de empezar y lo muestra en la tarjeta de proceso. En modo automático, el tope de inferencia del plan pagado corta el Plan, no el turno. | medidor `costo_declarado`: todo paso pagado propuesto trae precio y saldo; brief `saldo-insuficiente-lote-parcial` |
| **Consciente de sus límites** | Los límites viven en el código (25 empresas, 5 contactos por borrador, no manda correos, no conecta Gmail) y Ada los descubre chocando con ellos | Una referencia compartida `references/limites.md`, cargada por todo skill: qué no puede hacer, cuánto puede hacer por llamada, y **a dónde mandar a la persona** para cada límite (Configuración → Conexiones, el dashboard de la secuencia). Cada skill lleva sus errores frecuentes con la corrección. El cierre dice qué no pudo y dónde se hace, en términos del encargo. | medidor `limite_con_salida`: cada `limite` nombra el tipo y una salida; los 2 briefs `redirige` existentes + uno por tope de producto |

Dos cambios de harness que estas cuatro exigen y que no estaban en §7:

6. **El validador distingue pregunta legítima de pregunta perezosa.** Hoy la regla `pregunta` bloquea preguntar por un dato que ya está en el libro de hechos; eso se queda. Lo que cambia: cuando el skill activo declara un requerido ausente, preguntar por él no cuenta como defecto. Sin esto, cualquier receta que pida aclarar muere en el gate.
7. **Los tres saldos entran al estado compilado** y la escalera los usa: gratis se hace, con costo se propone con número, sin saldo se propone el lote que cabe. `usage` deja de ser algo que Ada tiene que recordar llamar.

Lo que **no** se hace: no se le pide al modelo "sé proactivo" en el manual. Se le da el siguiente paso como objeto, la pregunta permitida como campo del skill, el saldo en el prompt y los límites en una referencia. La conducta sale de la estructura.
