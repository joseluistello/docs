# Driftless Inteligencia Comercial — Rediseño de experiencia desde primeros principios

**Encargo:** diseñar cómo debe sentirse y funcionar Driftless (inteligencia comercial de México) partiendo del usuario y su trabajo — sin asumir que la solución actual es correcta — y entregar contratos de experiencia que otro equipo pueda implementar sin esta conversación.
**Base auditada:** `staging` @ `46cb84b`, archivo por archivo (API, workflows, UI, prompts, evals) + el warehouse `gtm-fabrica` + investigación web del comportamiento real de Origami (era origami.chat, 2026).
**Regla de lectura:** `[REQUISITO]` = contrato de producto congelable y evaluable; `[SUGERENCIA]` = técnica recomendada, sustituible si el requisito se conserva.

## El veredicto en cinco líneas

1. **El trabajo contratado es una decisión, no una lista:** "dime a quién perseguir AHORA, por qué, y cómo entro — con evidencia defendible". La tesis interna del equipo ya lo decía; la experiencia construida no lo ejecuta.
2. **No hay director.** La comprensión es regex, la estrategia es token-overlap, y el modelo solo redacta o deambula con 20 herramientas. Todos los síntomas observados (catálogo narrado, re-preguntar, "Terminado"×3, errores crudos) se derivan de siete causas raíz — ninguna es "un texto mal escrito". (E1)
3. **La corrección central:** un agente director con el significado y la estrategia, gobernado por los contratos determinísticos que ya existen y son buenos (gasto, evidencia, eventos A1, checkpoints). Lema: **el modelo interpreta y propone; el código valida y autoriza.** (E5)
4. **Una superficie: chat dirige, tablero contiene.** Tarjetas argumentadas (no spreadsheet), un solo reductor de experiencia (mata los estados duplicados por construcción), composer por estado, evidencia a un toque. (E3, E4)
5. **La experiencia se congela con el mismo rigor que ya congelaron los eventos:** 12 conversaciones contractuales + 9 estados + 28 evals de trayectoria en CI, bloqueantes. (E2, E3, E7)

## Los documentos

| Doc | Contenido | Úsalo para |
|---|---|---|
| [01-diagnostico](01-diagnostico.md) | El trabajo real; 7 causas raíz con evidencia de código; inferir/preguntar/jamás; proactividad | Entender POR QUÉ antes de tocar nada |
| [02-conversaciones](02-conversaciones.md) | Las 12 conversaciones turno a turno (chat+panel+composer+acciones), voz, reglas T1–T10, léxico prohibido | El contrato de comportamiento — copy incluida |
| [03-maquina-de-estados](03-maquina-de-estados.md) | 16 estados candidatos → 9; especificación completa por estado; el reductor de experiencia; composer por estado | Implementar el shell |
| [04-artifact-y-layout](04-artifact-y-layout.md) | El tablero (anatomía), dossier, evidencia, dominancia por fase, móvil/desktop, vida post-run; registro de decisiones vs Origami | Implementar el tablero |
| [05-arquitectura-cognitiva](05-arquitectura-cognitiva.md) | El director + TurnIntent + proyección cliente-segura + libro de hechos + gobernador; veredicto por candidato; respuestas sobre skills; modelo/tier | Implementar el cerebro |
| [06-skill-adversarial](06-skill-adversarial.md) | Triggers/negativos, preguntas permitidas/prohibidas, ejemplos/contraejemplos, selección de capability, escalada, presupuestos, fallos, 10 trampas | Escribir el manual del director y sus gates |
| [07-evals](07-evals.md) | 28 evals de trayectoria (15 bloqueantes) con entradas reales y criterios observables; trazabilidad por dimensión | Gatear todo lo anterior en CI |
| [08-migracion](08-migracion.md) | KEEP/REWRITE/DELETE contra staging real; 7 componentes nuevos; 8 fases; riesgos; qué NO construir | Planear la ejecución |
| [09-revision-warehouse](09-revision-warehouse.md) | Addendum: revisión de primera mano de `gtm-fabrica` — qué confirma, 3 correcciones (6 capabilities definidas / 1 activada; `notas_estrategia` re-domiciliada; precondición de scheduler para monitores) | Calibrar horizonte de cobertura y F3/F5 |

## Correcciones de revisión externa incorporadas (F0)

Ocho ajustes aplicados sin cambiar la dirección del rediseño. Se listan aquí para que un revisor los verifique de un vistazo:

1. **C1 ya no promete lo que la capacidad visible no demuestra** (143 empresas / equipos de ventas / ganadores-perdedores). Ejemplo reemplazado por uno sostenido por la señal de convocatorias; la versión con adjudicaciones queda marcada como target-state no evaluable. (E2-C1)
2. **Toda conversación lleva etiqueta de disponibilidad**: `v1 available` · `v1 fixture` · `later phase` · `requires-dependency`. (E2 §notación)
3. **Los precios de las conversaciones son fixtures, jamás constantes de producto.** (E2 §notación, E6 §9)
4. **"Monitor de mercado" y "vigía de disponibilidad de cobertura" son objetos distintos** y no se confunden en copy, contratos ni evals. (E2 §notación, E3 S6, E6 §9)
5. **`notas_estrategia` vive en un sidecar versionado de la capa de proyección de Driftless**, keyed por `(capability_id, catalog_version)`; **no modifica el contrato Market Intelligence 1.0**. (E5 §5.3, E8 §4)
6. **Toda cifra de capabilities/fuentes es un snapshot del SHA auditado**, resuelta en runtime; ningún código ni eval puede depender de ella. (E1 §Agravante, E9)
7. **El director jamás produce prosa factual sin referencias estructuradas**; narración, tablero y acciones se derivan de los mismos objetos validados. (E2 §voz-8, E5 §2.1-5)
8. **El retiro de las tablas `gtm_*` queda explícitamente FUERA de alcance** de F0–F3 y de esta rama. (E8 §3)

## Premisas del equipo que esta revisión CONTRADICE (pedido explícito del encargo)

1. **"El problema está en los textos/estados observados."** No: son proyecciones de 7 causas raíz; corregir copy sin contratar al director reproduce todo en el siguiente feature. (E1)
2. **"La seguridad exige que el entendimiento sea determinístico."** La premisa más cara. El determinismo es virtud en la AUTORIDAD (gasto, evidencia, checkpoints) y defecto en el SIGNIFICADO: tres escaleras de regex no entienden "para vender Driftless" y por eso el sistema re-pregunta. Se invierte la asignación. (E1-RC2, E5 §1)
3. **La entrevista/wizard del doc de workbench** ("una pregunta conceptual por pantalla, progreso, atrás"). Es la entrevista del Radar renacida con mejores modales. Se reemplaza por: máximo 2 preguntas como chips en el chat + **la muestra como mejor pregunta** (calibración por ejemplos). (E1 §4, E2-C1)
4. **La topología de 8 especialistas.** Se colapsa a: 1 director + compiladores/validadores/scorers determinísticos + tools. El *Synthesizer* como voz separada se elimina — así nació el bibliotecario. (E5 §3)
5. **"La investigación pagada requiere exactamente una señal"** (`proposalFor`). Invertida: cero cobertura es el caso arquetípico de investigación web acotada. (E6 §8)
6. **"Contrato visible → plan visible → probe" como secuencia de pantallas.** El contrato se PROYECTA como criterio editable del tablero y el plan como runway inspeccionable; ninguno bloquea. Ceremonia fuera; inspección disponible. (E3 §1, E4 §2)
7. **Skills separados por etapa (web research / monitores / contactos).** No: un solo manual con secciones por etapa cargadas por estado; la frontera dura es el checkpoint, no el skill. (E5 §5)
8. **El tier barato con thinking-off para todos los turnos.** El director ES el producto y sus turnos de juicio son ~6 por sesión; se mide con E7 y se sube de tier si falla. (E5 §6)
9. **"Cero resultados se maneja con honestidad descriptiva."** Insuficiente: se maneja con honestidad ESTRATÉGICA — siempre 2–3 salidas concretas, en <30 s. (E1-RC4, E2-C5)

## Premisas del equipo que esta revisión CONFIRMA (también hay que decirlo)

La separación física del warehouse tras 3 funciones SQL; fuentes como manifests/datos (jamás skills); la autoridad de gasto por cotización exacta + ledger append-only; los contratos A1 fail-closed; claim-sin-evidencia-no-exhibible; hecho≠inferencia como valores de producto; proposer≠approver para Knowledge y perfil; es-MX como wedge y su disciplina de evals; "chat dirige, artifact contiene" (DESIGN §0.9); assistant-ui como primitivas con el servidor como única autoridad; y la decisión de retirar el Radar con candado estructural — método que E8 hereda.

## El estado de la base, en una línea por área

Sustrato (gateway, créditos, evidencia, ports, A1): **excelente, se conserva**. Cerebro (comprensión, estrategia, preguntas): **no existe, se contrata** (el director). Superficie (shell, progreso, errores, artifact): **proyecta el motor, se reescribe sobre el reductor**. Etapas (monitores, contactos): **construidas y sin cablear, se re-anclan**. Cobertura de datos: **1 capability × 1 fuente licenciada — la experiencia debe ser excepcional en cobertura estrecha, y este diseño lo es por construcción** (Sin cobertura, escalada web, vigías).
