# Agentic Commercial Intelligence Workbench

**Estado:** arquitectura propuesta para ejecución por proyecto  
**Alcance:** Chat, workflows Mastra, artifacts interactivos, proactividad, monitores, investigación pagada y enrichment opt-in  
**No cambia:** contratos del warehouse, evidencia, licencia, privacidad, credits ledger, provider ports ni gobierno de Knowledge

## 1. La experiencia que estamos construyendo

Driftless no debe comportarse como un chatbot que responde y espera otro prompt. Debe comportarse como un director de inteligencia comercial que mantiene un trabajo vivo con el usuario:

```text
intención
→ preguntas que realmente cambian el trabajo
→ contrato visible
→ plan visible
→ prueba barata
→ artifact que crece en tiempo real
→ evaluación de calidad, costo y cobertura
→ recomendación de seguir, corregir o detener
→ checkpoint humano cuando hay gasto, alcance o acción externa
→ resultado reutilizable
→ siguiente acción sugerida
```

La unidad de experiencia no es un mensaje. Es un **Work Session** durable: conversación, contrato, plan, ejecuciones, artifacts, decisiones y resultados relacionados por un mismo `workSessionId`.

La interfaz usa lenguaje de resultados:

- “Encontré 12 oportunidades con evidencia reciente”.
- “Esta señal produjo demasiado ruido; propongo una alternativa más barata”.
- “Antes de gastar, necesito tu aprobación”.
- “Puedo vigilar esto cada lunes. ¿Quieres activarlo?”.

Nunca expone nombres de proveedores, SQL, warehouse, agentes internos, RFC, claims ni enrichment como arquitectura.

## 2. Lo aprendido de la referencia

La referencia observada funciona bien por su secuencia y por su manejo de estado, no por la estética del chat:

1. Convierte una petición vaga en una entrevista corta con progreso, opciones, respuesta libre, atrás y detener.
2. Compila las respuestas en un plan que el usuario puede inspeccionar.
3. Si al compilar descubre una contradicción o una definición incompleta, abre una segunda ronda únicamente sobre esos huecos.
4. Ejecuta una muestra antes de escalar.
5. Construye una tabla viva mientras trabaja; el texto sólo narra lo importante.
6. Verifica y recalifica elementos progresivamente.
7. Mide rendimiento real: candidatos revisados, calificados, tasa de éxito, costo y cobertura proyectada.
8. Si el supuesto inicial falla, explica por qué y propone otra señal o estrategia.
9. Reutiliza evidencia ya adquirida cuando el usuario corrige un criterio.
10. Termina con acciones concretas: ampliar, corregir, monitorear, encontrar contactos o preparar activación.

La proactividad correcta no es autonomía ilimitada. Es **iniciativa acotada entre checkpoints humanos**.

## 3. Topología agentica

### 3.1 Un director, especialistas acotados

La superficie conserva una sola voz: `CommercialIntelligenceOrchestrator`. Es responsable de entender el objetivo, explicar el plan, decidir el siguiente paso permitido y mantener coherencia entre turnos.

Debajo puede usar especialistas, pero no una sociedad abierta de agentes:

| Componente | Naturaleza | Responsabilidad |
|---|---|---|
| Orchestrator | Agent | Entender intención, narrar, recomendar y seleccionar el próximo checkpoint |
| Contract Compiler | Paso estructurado + validadores | Convertir lenguaje natural y contexto en un contrato ejecutable |
| Question Policy | Política determinística | Elegir solamente preguntas cuyo resultado cambia plan, costo, autoridad o validez |
| Plan Compiler | Workflow determinístico | Crear etapas, dependencias, stop conditions y estimados provider-neutral |
| Capability executors | Tools/workflows | Consultar señales, investigar web, resolver identidad, enriquecer o activar |
| Evidence verifier | Paso determinístico; agent sólo para casos ambiguos | Confirmar cobertura, contradicciones, frescura y citas |
| Plan Supervisor | Política + scorer | Comparar rendimiento observado con el esperado y recomendar continuar, revisar o suspender |
| Synthesizer | Agent | Expresar la inteligencia resultante sin inventar hechos |

Los especialistas pueden ejecutarse en paralelo únicamente cuando sus trabajos son independientes y su salida tiene un contrato verificable. Ningún especialista decide gasto, autorización, licencia o mutación externa.

### 3.2 Por qué no un multi-agent libre

Un network libre introduce coordinación implícita, costo difícil de limitar, repetición de investigación y una experiencia incoherente. Driftless necesita trazabilidad: cada acción debe pertenecer a un plan, capability y checkpoint. Mastra puede albergar especialistas, pero el workflow versionado sigue siendo la columna vertebral.

## 4. Contratos de interacción

### 4.0 Invariantes de escala y sustitución

Jalisco y `public_procurement_new_tender` son una rebanada de validación, no el modelo del producto. Los contratos base deben soportar sin cambios estructurales:

- múltiples fuentes contribuyendo evidencia —incluida evidencia contradictoria— a una misma señal;
- una fuente alimentando distintas capabilities mediante recipes independientes;
- una consulta combinando varias capabilities y geografías canónicas;
- permiso de exhibición, atribución, licencia y frescura evaluados por fuente y atributo;
- proveedores intercambiables seleccionados por capacidad, costo, cobertura, política y salud;
- enrichment como etapa posterior opt-in sobre una Entity seleccionada, con múltiples proveedores posibles detrás del mismo puerto.

`sourceId`, `capabilityId`, `providerId`, geografía y tipo de evento son datos del contrato o del catálogo; nunca discriminantes hardcodeados en el orchestrator, el protocolo de eventos o los componentes visuales. Añadir una fuente, capability o proveedor no debe requerir modificar el shell de Chat.

### 4.1 WorkContract

El contrato se compila antes de ejecutar trabajo material:

```ts
interface WorkContract {
  schemaVersion: '1.0'
  workSessionId: string
  objective: string
  offer: { summary: string; outcome?: string }
  target: {
    entityKinds: string[]
    positiveCriteria: Criterion[]
    exclusions: Criterion[]
  }
  trigger: {
    eventSemantics: string[]
    freshnessWindow?: string
    dedupeSemantics?: 'entity' | 'event' | 'entity_event'
  }
  geography: CanonicalGeography[]
  output: {
    artifactKind: ArtifactKind
    desiredCount?: number
    destination?: string
  }
  cadence?: ScheduleIntent
  authority: AuthorityEnvelope
  budget: BudgetEnvelope
  assumptions: Assumption[]
  unresolved: MaterialGap[]
  contradictions: ContractConflict[]
  sourceRefs: ContextRef[]
}
```

Geografía siempre usa identificadores canónicos; “Jalisco”, `MX-JAL` y equivalentes se resuelven antes de consultar. Slugs como `compras-jalisco` jamás llegan a copy de usuario.

### 4.2 HumanCheckpoint

Las preguntas y aprobaciones no son texto libre emitido por el modelo. Son objetos tipados:

```ts
interface HumanCheckpoint {
  id: string
  kind:
    | 'clarification'
    | 'resolve_conflict'
    | 'approve_quote'
    | 'approve_external_action'
    | 'activate_monitor'
    | 'confirm_memory'
  question: string
  whyItMatters: string
  options: Array<{ id: string; label: string; effect: ContractPatch }>
  allowCustom: boolean
  allowBack: boolean
  allowStop: boolean
  resumeToken: string
}
```

El backend valida cualquier respuesta y aplica un patch al contrato. El modelo nunca interpreta “sí” como autoridad universal.

### 4.3 ExecutionPlan

```ts
interface ExecutionPlan {
  id: string
  version: number
  contractVersion: number
  status: 'draft' | 'ready' | 'running' | 'suspended' | 'revising' | 'complete' | 'failed'
  steps: PlanStep[]
  expected: {
    coverage?: number
    yield?: number
    latencyMs?: number
    externalCostCredits: number
  }
  observed?: {
    reviewed: number
    qualified: number
    coverage?: number
    yield?: number
    latencyMs: number
    externalCostCredits: number
  }
  stopConditions: StopCondition[]
  revisions: PlanRevision[]
}
```

Toda revisión conserva causalidad: qué observación invalidó qué supuesto, qué cambió y qué trabajo anterior se reutiliza.

### 4.4 TypedAction

Los botones son transiciones válidas, no prompts decorativos:

```ts
type TypedAction =
  | 'review_results'
  | 'revise_criterion'
  | 'expand_search'
  | 'research_missing_evidence'
  | 'create_monitor'
  | 'find_contacts'
  | 'draft_outreach'
  | 'save_to_collection'
  | 'stop_work'
```

Cada acción declara precondiciones, costo, autoridad necesaria y siguiente estado permitido.

## 5. Política de preguntas

### 5.1 El agente no entrevista por costumbre

Cada pregunta candidata recibe una prioridad por impacto:

```text
priority = cambio_en_validez
         + cambio_en_routing
         + cambio_en_costo
         + reducción_de_falsos_positivos
         + necesidad_de_autorización
         - información_ya_disponible
         - fricción_para_el_usuario
```

Sólo se pregunta cuando la respuesta puede cambiar materialmente el resultado. Si el sistema puede usar un default seguro y reversible, lo declara como supuesto y continúa.

### 5.2 Cuestionamiento por capas

1. **Objetivo de producto.** Qué quiere lograr, qué cuenta como señal, universo, geografía y forma de salida.
2. **Compilación.** El sistema produce `WorkContract` y detecta huecos/contradicciones.
3. **Precisión semántica.** Pregunta solamente por definiciones materiales descubiertas: por ejemplo, qué significa “empezó a contratar”, límite de tamaño o deduplicación por empresa/vacante.
4. **Autoridad.** Pregunta exacta sobre costo, activación, escritura externa o periodicidad.

Reglas de UX:

- una pregunta conceptual por pantalla;
- máximo cinco opciones útiles más respuesta libre;
- progreso visible;
- atrás, detener y corregir siempre disponibles;
- explicar en una frase por qué importa;
- nunca repetir algo confirmado en el mismo contrato;
- al terminar una ronda, mostrar el contrato compilado antes de ejecutar.

## 6. Proactividad gobernada

| Nivel | El sistema puede | Ejemplos | Checkpoint |
|---|---|---|---|
| P0 Explicar | Mostrar estado, cobertura, limitaciones y siguiente paso | “Hay 16 licitaciones recientes” | No |
| P1 Recomendar | Proponer una mejor señal, criterio o acción | “Contratación activa dará mejor rendimiento” | No |
| P2 Preparar | Crear plan, preview, sample o borrador reversible y gratuito | Muestra de 10 oportunidades | No, si costo externo = 0 |
| P3 Ejecutar gobernado | Consumir créditos, enriquecer, escribir a sistema conectado | Investigación pagada, contacto | Sí, explícito o budget cap previo |
| P4 Repetir/actuar | Crear monitor, campaña o acción recurrente | Vigilar cada lunes | Sí, con alcance y kill switch |

El sistema avanza solo a través de P0–P2 mientras el trabajo sea gratuito, reversible y dentro del contrato. Se suspende antes de:

- gasto externo;
- enrichment o contacto personal;
- envío o escritura fuera de Driftless;
- activación de monitor recurrente;
- mutación de Knowledge;
- resolver una ambigüedad material sin default seguro.

## 7. Probe, supervisión y adaptación

El primer trabajo real debe ser el menor probe capaz de probar la hipótesis del plan. El probe calcula:

- cobertura del universo;
- tasa de calificación;
- falsos positivos observados;
- campos/evidencia faltante;
- frescura;
- latencia;
- costo por resultado útil;
- duplicación con artifacts existentes.

`PlanSupervisor` compara esperado vs observado:

```text
si cumple stop condition positiva → completar o pedir escala
si falta evidencia concreta → cubrir sólo ese hueco
si yield es bajo pero hay señal sustituta → proponer revisión de plan
si costo marginal supera el cap → suspender y explicar
si el criterio produce falsos positivos → corregir y reutilizar evidencia
si no hay ruta confiable → terminar honestamente
```

La revisión de plan debe ser visible: “Revisé 30; sólo 3 cumplen. La señal de expansión es cara de verificar. Propongo contratación activa, que puedo observar de forma más barata”.

## 8. Artifacts como trabajo vivo

Chat dirige; los artifacts contienen el trabajo. El registro inicial soporta:

| Artifact | Propósito |
|---|---|
| Plan | Etapas, progreso, estimados, revisiones y checkpoints |
| Opportunity Set | Empresas/señales calificadas, evidencia y estado por fila |
| Opportunity Dossier | Contexto profundo de una oportunidad elegida |
| Monitor | Contrato, frecuencia, último run, cambios y kill switch |
| Contact Selection | Personas candidatas obtenidas sólo tras opt-in |
| Outreach Draft | Mensaje con señal citada; nunca envío implícito |

Todo artifact es versionado y guarda:

- `artifactId`, `workSessionId`, `runId`, `planVersion`;
- estado `draft | live | partial | suspended | complete | failed`;
- source/evidence refs;
- patches ordenados e idempotentes;
- acciones permitidas según estado;
- errores y campos unknown sin ocultarlos.

La tabla de oportunidades actualiza filas y celdas progresivamente. Una fila puede pasar de “encontrada” a “verificando” a “calificada” o “descartada”, con la causa visible. Star, remove y corrección del usuario alimentan una reevaluación incremental, no un rerun completo.

## 9. Protocolo de eventos

El stream actual de texto/tool activity es insuficiente. La frontera Chat–Dashboard debe adoptar semántica compatible con AG-UI, manteniendo el API y la persistencia propios de Driftless:

```text
RUN_STARTED / RUN_FINISHED / RUN_ERROR
STEP_STARTED / STEP_FINISHED
TEXT_MESSAGE_START / CONTENT / END
TOOL_CALL_START / ARGS / END / RESULT
STATE_SNAPSHOT / STATE_DELTA
ACTIVITY_SNAPSHOT / ACTIVITY_DELTA
ARTIFACT_CREATED / ARTIFACT_PATCHED / ARTIFACT_FINALIZED
CHECKPOINT_REQUESTED / CHECKPOINT_RESOLVED
PLAN_REVISED
QUOTE_REQUESTED / APPROVED / DECLINED
RUN_SUSPENDED / RESUMED / CANCELLED
```

Snapshots permiten reconstruir el estado tras reconexión; deltas JSON Patch actualizan progreso sin reenviar todo. Los eventos persistidos son la verdad; SSE es una proyección recuperable. Las claves de idempotencia evitan duplicados al reconectar.

## 10. Ejecución durable con Mastra

Mastra sigue siendo el runtime. El trabajo comercial se implementa como workflows versionados con storage PostgreSQL para snapshots:

```text
compile_contract
→ request_material_clarification? [suspend]
→ compile_plan
→ run_probe
→ evaluate_probe
→ revise_plan? [suspend when material]
→ query_free_capabilities
→ request_paid_research? [suspend]
→ acquire_and_verify
→ publish_artifact
→ propose_next_action
```

El snapshot guarda referencias pequeñas — IDs, versiones, cursores y decisiones—, no datasets ni HTML. Los artifacts y evidencia viven en sus stores. `resume` valida principal, workspace, checkpoint, versión del contrato y autoridad actual antes de continuar.

Cancelación detiene trabajo futuro y conserva resultados parciales. Un mensaje enviado durante un run se encola como steering input; no abre otro run competidor sobre el mismo artifact.

## 11. Memoria y aprendizaje

Hay tres horizontes:

1. **Estado del run:** decisiones y supuestos de esta ejecución; persiste automáticamente en workflow/thread.
2. **Preferencia reusable:** algo confirmado por el usuario para trabajos futuros; se presenta como candidato “¿usar esto la próxima vez?”.
3. **Knowledge:** verdad gobernada del equipo; sólo Note o Suggested edit, nunca mutación silenciosa.

Driftless no debe copiar la escritura silenciosa del ICP observada en la referencia. Puede evitar fricción mediante una acción de un clic, pero conserva proposer ≠ approver.

## 12. Home, reportes y monitores

La proactividad fuera del turno nace de estado verificable, no de texto genérico:

- artifacts terminados pero no revisados;
- oportunidades calificadas sin contacto;
- monitores con cambios;
- signal yield o costo deteriorado;
- fuentes silenciosas;
- perfil que contradice el trabajo reciente;
- siguientes acciones comprometidas y no ejecutadas.

Un reporte periódico contiene máximo tres o cuatro hallazgos ordenados por impacto. Cada hallazgo explica dato, consecuencia y una `TypedAction`. “No relevante” alimenta feedback. Ningún reporte activa gasto o contacto.

Un monitor es un workflow persistente con contrato, cadence, watermark, destino, budget/authority, última ejecución, delta y kill switch. Su creación requiere preview y aprobación explícita.

## 13. Decisión de frameworks

### Conservar

- **Mastra:** workflows, tools, suspend/resume y snapshots persistentes. Es el motor del backend, no sólo un wrapper de tool calling.
- **Model Gateway:** mantiene DeepSeek u otros modelos intercambiables y medibles.
- **Contratos Driftless:** threads, runs, EvidenceRefs, credits, authority, gateway del warehouse y provider ports.

### Adoptar como contrato

- **Semántica AG-UI:** lifecycle, tool calls, state/activity snapshots y deltas. Se puede implementar gradualmente sobre el endpoint SSE actual sin entregar el control del dominio a un tercero.

### Evaluar mediante spike

- **assistant-ui:** `ExternalStoreRuntime` permite conservar el store, persistencia y backend existentes; soporta herramientas, cancelación, queueing y UI por capacidades. Probarlo contra un hilo real antes de reemplazar `ChatThreadView`.

### No adoptar como plataforma completa por ahora

- **CopilotKit:** resuelve AG-UI, shared state y generative UI, pero superpone runtime y estado con Mastra/Driftless. Sólo reconsiderarlo si el spike demuestra que mantener el bridge propio cuesta más que la duplicación.
- **AI SDK UI como runtime:** sus patrones de streaming/tool approval son útiles, pero no debe convertirse en un segundo dueño del workflow.

La UI generativa queda restringida a un registry allowlisted de artifacts y acciones. El modelo no genera componentes arbitrarios ni props confiables; todo payload se valida.

## 14. Mapeo al sistema actual

| Área actual | Decisión |
|---|---|
| `ChatService` | ADAPTAR: adelgazar a orquestación de sesión; sacar decisiones de flujo a contratos/policies/workflows |
| `MastraRuntime` single-shot | ADAPTAR: registrar workflows durables con Postgres y resume/cancel |
| `ChatStreamHub` con cuatro eventos | REEMPLAZAR incrementalmente por stream versionado de estado/activity/artifacts |
| `ChatThreadView` custom | SPIKE; conservar como fallback temporal hasta paridad del adapter |
| `ResearchArtifactPanel` | EVOLUCIONAR a workspace de artifacts tipados y vivos |
| `MarketIntelligenceGateway` | CONSERVAR exactamente como read boundary warehouse-first |
| Credits, quotes, approvals y provider attempts | CONSERVAR como infraestructura gobernada |
| Parallel | ADAPTAR como investigación exhaustiva pagada dentro del mismo plan |
| Radar conversacional legado | ELIMINAR de la superficie; nunca fallback |
| Collections/Records | CONSERVAR como destino operativo, no como sustituto de mercado |

## 15. Caminos dorados

### Oportunidades inmediatas

```text
“Vendo software a dependencias públicas”
→ usa perfil o pregunta sólo geografía/resultado material faltante
→ compila contrato
→ enseña plan corto
→ consulta warehouse
→ artifact recibe oportunidades citadas en vivo
→ resume por qué ahora y ángulo
→ ofrece revisar, monitorear o elegir una
```

### Investigación pagada dentro del mismo trabajo

```text
warehouse entrega cobertura parcial
→ muestra lo encontrado
→ explica el hueco exacto y el valor esperado de investigar
→ presenta costo/cap y alcance
→ usuario aprueba
→ reanuda el mismo plan y artifact
→ Parallel/WebSearchProviderPort cubre sólo el hueco
→ normaliza evidencia y actualiza filas
```

### Monitor

```text
“Avísame cuando empresas empiecen a contratar IA”
→ define señal, universo, geografía, dedupe, cadence y destino
→ segunda ronda sólo para contradicciones detectadas
→ preview del contrato y próxima ejecución
→ aprobación explícita
→ workflow suspendido entre ejecuciones
→ reporte de deltas, no lista completa repetida
```

### Contacto

```text
usuario elige oportunidad
→ acción “Encontrar a quién contactar”
→ explica campos, proveedor/categoría de fuente, costo y condiciones
→ aprobación explícita
→ resolve/enrich sólo esa organización
→ artifact de contacto + borrador que incorpora la señal citada
```

## 16. Evals de trayectoria obligatorios

1. Petición vaga: pregunta sólo lo material y muestra progreso.
2. Contradicción descubierta después de compilar: segunda pregunta dirigida, sin reiniciar.
3. Warehouse suficiente: primera oportunidad en menos de dos minutos, cero pago.
4. Cobertura parcial: conserva resultados y pide aprobación sólo por el hueco.
5. Aprobación rechazada: final útil con lo gratuito; no insiste ni cae en fallback.
6. Probe de bajo yield: mide, explica y propone señal alternativa.
7. Corrección de falso positivo: reusa evidencia y recalifica sin pagar/repetir todo.
8. Reconexión durante run: snapshot + deltas reconstruyen plan/artifact sin duplicar.
9. Steering en cola: se aplica al mismo Work Session cuando sea seguro.
10. Monitor: no se activa hasta confirmar señal, dedupe, cadence, destino y autoridad.
11. Enrichment: imposible antes de seleccionar oportunidad y aprobarlo.
12. Claim visible sin EvidenceRef: falla la entrega.
13. Licencia revocada: artifact se actualiza o queda no exhibible inmediatamente.
14. Modelo produce tool args inválidos: validator rechaza; no ejecuta parcialmente.
15. DeepSeek sin streaming/tool call: error observable y retry/fallback gobernado; nunca batch silencioso.

## 17. Definition of Done

Esta fase termina cuando un usuario puede, desde staging:

1. expresar una necesidad en lenguaje natural;
2. contestar sólo preguntas materiales;
3. inspeccionar un contrato y un plan entendibles;
4. ver oportunidades reales aparecer progresivamente con evidencia;
5. corregir un criterio y observar reutilización de trabajo;
6. aprobar o rechazar investigación pagada dentro del mismo artifact;
7. crear un monitor mediante checkpoint explícito;
8. elegir una oportunidad y llegar al gate de contacto separado;
9. cerrar y reabrir sin perder plan, artifacts ni decisiones;
10. recibir siguientes acciones útiles sin que el sistema gaste o actúe solo.

No cuenta como terminado si el modelo únicamente narra que planeó, si el progreso es una animación sin estado persistido, si el artifact aparece sólo al final, o si un flujo feliz depende de reconocer palabras exactas.

## 18. Referencias técnicas

- Mastra workflow snapshots y suspend/resume: <https://mastra.ai/en/reference/workflows/snapshots>
- Mastra resumeStream: <https://mastra.ai/blog/resumeworkflows>
- AG-UI events y snapshot/delta: <https://docs.ag-ui.com/concepts/events>
- assistant-ui custom runtimes: <https://www.assistant-ui.com/docs/runtimes/custom/overview>
- assistant-ui ExternalStoreRuntime: <https://www.assistant-ui.com/docs/runtimes/custom/external-store>
- assistant-ui AssistantTransport: <https://www.assistant-ui.com/docs/runtimes/custom/assistant-transport>
- DeepSeek chat completion, streaming y tools: <https://api-docs.deepseek.com/api/create-chat-completion>
