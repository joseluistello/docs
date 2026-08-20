# E8 — Migración: qué se queda, qué se reescribe, qué muere, y en qué orden

Base: auditoría archivo-por-archivo de `staging` (commit `46cb84b`) — API, workflows, UI, prompts, evals y el warehouse (`gtm-fabrica`). Este plan asume la regla del encargo: **primero se congela el comportamiento (E2/E3/E7); el código llega después.** Continúa el método que el equipo ya usó bien en `legacy-radar-keep-delete-inventory.md` (C1: retiro completo, candado estructural) — esa disciplina se conserva.

## 1. KEEP — se conserva tal cual (y es mucho: el sustrato es bueno)

| Qué | Dónde | Por qué se queda |
|---|---|---|
| Frontera warehouse de 3 funciones + rol de mínimo privilegio | `radar/ports/market-intelligence-gateway.port.ts`, `adapters/postgres-market-intelligence.adapter.ts`, bundle de contratos hasheado | La mejor decisión del sistema: Driftless no puede leer tablas del warehouse ni queriendo. Escala a fuentes nuevas sin tocar producto |
| Separación gtm-fabrica (repo + Postgres aparte; packs/manifests/recipes/licencias) | repo `gtm-fabrica` | Responde §5.4 de E5: fuentes como datos, jamás como código/skill/UI de Driftless |
| Ledger de créditos append-only + pricing + quote/approval + reconcile | `credit_ledger`, `credits.service.ts`, `radar-pricing.ts`, `paid-research.ts` | Autoridad de gasto correcta y probada (doble autoridad quote+decisión, idempotencia, margen verificado) |
| Provider ports/adapters + resiliencia + candado de neutralidad | `radar/ports/*`, `radar/adapters/*`, `radar-architecture.spec.ts` | Proveedores intercambiables ya garantizados por build-failing test |
| Contratos de evidencia y artifacts (claim-sin-evidencia = no exhibible; sin `prohibited` serializable) | `signal-evidence-bundle.contract.ts`, `artifact-bodies.ts` | Es la tesis del producto hecha schema |
| Contratos A1 completos (28 eventos fail-closed, idempotencia, reducer replay) + `WorkSessionStore` persist-before-publish + eventIds determinísticos | `chat/agentic-contracts.ts`, `chat/work-session.store.ts` | Base sólida; el reductor de experiencia (E3 §5) se construye ENCIMA, no en su lugar |
| Espina Mastra del flujo de oportunidades (suspend/resume de 2 fases en aprobación) | `radar/planning/mastra-market-intelligence-workflow.ts` | Ejecución durable correcta; se adapta por dentro (abajo) sin cambiar su naturaleza |
| assistant-ui External Store bridge (server como única autoridad) | `chat/DriftlessChatRuntime.tsx`, `driftlessExternalStoreAdapter.ts` | La decisión del spike fue correcta; se conserva el patrón |
| Setup comercial estructurado + Commercial Context Compiler (como COMPILADOR) | `commercial-setup/`, compilador de bundle | Se convierte en el libro de hechos (E5 §2.3); el compilador vive, su *directiva* muere (abajo) |
| Outcome ledger + Memory Refinery (proposer≠approver) | `collections/` | El aprendizaje por resultados ya tiene columna vertebral |
| Flags/kill switches + candado del Radar legado + disciplina de evals (`NOT RUN`≠`PASS`, scorers anti-falso-positivo) | `commercial-feature-flags.ts`, `legacy-radar-candado.spec.ts`, `evals/managed-inference/` | Se completa el cableado de flags (deuda ya documentada) y la disciplina se hereda a E7 |

## 2. REWRITE — el propósito se queda, la forma cambia

Ordenado por impacto:

1. **`chat.service.ts` (runTurnLocked, ~1,300 líneas de orquestación a mano)** → el pipeline de turno de E5 §4 (compilar entrada → director → gobierno → efectos → eventos). Los dos workflows Mastra se componen (hoy no se hablan): el de sesión hospeda el turno; el de oportunidades ejecuta. El service queda como orquestador delgado de sesión.
2. **`cognitive/skills/chat.skill.ts`** → el manual del director (E5 §5.1). Mueren: la misión "Topics→Oportunidades→Collections", el bloque *First contact* ("ask what they sell"), el *"name the closest topics/areas that DO exist"* (la licencia del tour de inventario — sobrevivió literal desde el baseline rojo), y la invitación a narrar coberturas del `discover`. La superficie comercial deja de compartir skill con el chat de conocimiento: son dos productos con dos manuales.
3. **`work-contract.compiler.ts`** → de AUTOR (regex `OFFER_PATTERN`/`TARGET_PATTERN`) a VALIDADOR del contrato que el director propone. La doctrina de materialidad (offer=validez, target=enrutamiento) sobrevive como checks; la extracción por regex muere. Los catálogos de geografía canónica se quedan (servidor).
4. **`intent-preflight.ts`** → de dueño del turno a *hint* + guardia de producto. Muere la asimetría leads-en-una-escalera. `synthesisOnly` e `includeMarketTools` desaparecen: el director siempre tiene su cinturón corto proyectado.
5. **`question-policy.ts`** → gobernador (E5 §2.3): veta por libro de hechos, aplica presupuesto T2, conserva `FIELD_IMPACT` como desempate y el "No lo sé aún" persistente. Deja de redactar preguntas.
6. **`buildProfileGapDirective`** → muere como directiva de prompt ("Your ONLY job… invite to Commercial Setup" es RC1). Sus datos alimentan el libro de hechos; el perfil se completa como subproducto con `confirm_memory` (checkpoint ya congelado, hoy nunca usado).
7. **Proyección de payloads** (`chat-tools.ts` hace `JSON.stringify(bundle)` crudo) → capa de proyección cliente-segura: mapa de cobertura (E5 §2.2), señales/evidencia proyectadas, y el retiro de `list_connections`-con-`next_action` de esta superficie. El `CapabilityBundle` interno jamás vuelve a tocar un contexto de modelo.
8. **`proposalFor` (exige exactamente 1 señal para ofrecer investigación)** → invertido conforme E6 §8: cero cobertura ES el caso arquetípico de investigación web, con alcance hipotetizado y tope. `budget.externalCostCapCredits` deja de estar hardcodeado a 0: el envelope se llena desde el checkpoint aprobado.
9. **Shell de UI (`OperateChatSurface` + `ChatThreadView` + `DecisionRunway` + `ActivityTrail`)** → un shell alimentado por el reductor (E3 §5): muere el render de `runStatus` en 4 lugares, el `reset()` que deja "Terminado"+spinner conviviendo, los dos mapas de labels divergentes, y el colapso de tools distintos a filas idénticas (narración por `semanticKey`). El apilado de artifacts del mismo tipo (RC7) se reemplaza por tablero único por búsqueda.
10. **`customerSafeChatError` (denylist de ~10 tokens)** → catálogo allowlist versionado (E3 §5.5). El `<pre>{s.preview}</pre>` del path legacy muere con el path.
11. **Monitores** → el `RadarMonitorService`/webhook/schedule existente se re-ancla del run legado a la Work Session (ruta `create_monitor` POR FIN con dueño): prellenado desde el criterio, checkpoint `activate_monitor`, avisos de deltas al tablero madre, handoff de fallos al chat.
12. **Contactos** → `radar-enrichment.service.ts`/`contact-path.ts` (hoy vivos y deliberadamente sin cablear) se re-anclan detrás de `find_contacts` + `approve_external_action` + artifact `contact_selection` (todo ya congelado en A1), con la mecánica de C10.
13. **Composer** → estados de E3 §6 (placeholder/chips/primario por estado; "Enviar después" muere como concepto: steering).
14. **Copy** → catálogo central es-MX por superficie (hoy: inline en 8 mapas dispersos + mezcla EN/ES en el path legacy), barrido por el gate léxico extendido a `chat/*`.

## 3. DELETE — muere sin reemplazo

| Qué | Evidencia |
|---|---|
| `AgenticWorkbench.tsx` (shell paralelo muerto: `shouldRenderWorkbench` solo lo referencia su test) + sus mapas de labels divergentes | Nunca montado; portar a E7 los pins de test que aún valgan |
| `redesign/spike/chatExternalStoreAdapter.ts` | Copia stale del spike |
| El cinturón de ~20 tools en la superficie comercial (`list_topics`, `list_connections`, `broker_recent_events`, `search_docs`…) | Pertenecen al producto de conocimiento; en esta superficie son la materia prima del bibliotecario |
| Banner de cola "N mensajes en espera" (`queuedCount` jamás pasado — línea muerta) y el copy "Enviar después" | Inalcanzable / concepto retirado |
| ~20 tablas `gtm_*` huérfanas en el Postgres de Driftless (migraciones 124–137) | **FUERA DE ALCANCE de F0–F3 y de esta rama — no se toca.** Cero lectores/escritores fuera de specs, pero el retiro es una migración de datos con aprobación humana propia (el AGENTS.md de `gtm-fabrica` lo exige) y no comparte riesgo, revisión ni rollback con el rediseño de experiencia. Cuando se haga: migración forward-only nueva (`up()` retira / `down()` restaura); las migraciones históricas JAMÁS se editan (regla C1) |
| Secciones stale de `web-search-provider-evaluation.md` (referencia archivos borrados por `6bece81`) | Marcar superseded, apuntar a este doc-set |
| Housekeeping de topics driftless con anclas muertas (`gtm-capability-catalog`, `gtm-claim-vocabulary-allowlist`, `fabrica-de-fuentes-arquitectura` afirma "mismo monorepo") | Ya señalado por `context get --diff` en el rollout report; le toca a un humano curarlos |

## 4. Componentes nuevos estrictamente necesarios (7)

1. **`TurnIntent` + admisión** (E5 §2.1) — extiende la maquinaria de admisión A1 existente.
2. **El director** — un agente: manual (skill), loop de turno, cinturón corto proyectado.
3. **Capa de proyección cliente-segura** — mapa de cobertura + proyectores de payload; con contract-test contra el bundle del warehouse (mismo patrón del `market-intelligence-contract-bundle.spec`).
4. **Libro de hechos** — extensión del Commercial Context Compiler (campo→valor→procedencia→turno).
5. **Reductor de experiencia** (`ExperienciaVista`) — evolución de `agentic-events.ts` hacia proyección única + catálogo de errores.
6. **`notas_estrategia` por capability** — **sidecar versionado en la capa de proyección de Driftless**, keyed por `(capability_id, catalog_version)`; datos, no código, y **sin tocar el contrato Market Intelligence 1.0** (ver E5 §5.3 y E9 §3). Cero coordinación cross-repo.
7. **Suite E7** — 28 evals, en el harness por defecto desde el día uno (lección C7).

Nada más. En particular NO son necesarios: nuevos providers, nueva infraestructura de streaming (A1 alcanza), nuevo runtime de UI, nueva memoria.

## 5. Secuencia de implementación (fases; cada una shippeable sola)

| Fase | Contenido | Criterio de aceptación (gate) |
|---|---|---|
| **F0 — Congelar** | Este doc-set revisado por el equipo; catálogo de errores v1; léxico prohibido v1; E7 esqueleto (L1 en rojo) | Los 28 evals existen y los L1 corren (rojos) en CI |
| **F1 — Reductor y shell** | `ExperienciaVista` + shell único + composer por estado + allowlist de errores (solo cliente; cero cambio de servidor) | E7-21…24 y 28 verdes; los bugs observados irreproducibles |
| **F2 — El director** | TurnIntent + proyecciones + libro de hechos + gobernador; regex degradado a hint; muere synthesisOnly y el skill viejo | E7-01…06, 16, 17, 19 verdes; narración de catálogo estructuralmente imposible |
| **F3 — Estrategia honesta** | Mapa de cobertura + Sin cobertura + escalada invertida + muestra/calibración + supervisor→director | E7-07…10 verdes; primera muestra <2 min p50 instrumentada |
| **F4 — Gasto como experiencia** | Tarjetas de cotización, reporte usado/tope, T6 | E7-11…13 verdes. **GA de gasto real sigue gateado por el price book (riesgo P0 heredado del rollout report — no se relaja aquí)** |
| **F5 — Monitores** | Re-anclaje a Work Session + prellenado + checkpoint + deltas + handoff | E7-25 verde; "avísame cuando…" tiene dueño de punta a punta |
| **F6 — Contactos** | Re-anclaje de enrichment tras `find_contacts` + `approve_external_action` + dossier con personas + borrador | E7-26 verde; imposible antes de selección (se conserva el eval estructural) |
| **F7 — La vida del tablero** | Inicio con "Tus búsquedas", Reabierto, refresco, guardar en Collections, export | S9 completo; el tablero sobrevive a la sesión |

Dependencias: F1 no depende de nada del servidor; F2 es el corazón y habilita F3–F7; F5/F6 son paralelizables tras F3.

## 6. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | **El director sobre el tier barato no alcanza la calidad de juicio** (DeepSeek flash, thinking off, sin json_schema) | E5 §6: thinking on para intents de juicio; E7 corre contra ambos tiers ANTES de F2-merge; si falla, el director sube de tier — el costo real está en churn, no en ~6 turnos |
| 2 | Latencia del modelo-en-el-loop vs presupuesto de 2 min | El trabajo gratuito se despacha EN PARALELO al primer turno del director (T3); streaming de narración; medir p50/p95 desde F3 |
| 3 | La capa de proyección se desincroniza del catálogo del warehouse | Contract-test byte-a-byte (patrón bundle-spec existente); el mapeo tema→id vive en un solo módulo |
| 4 | Registro es-MX se degrada con el modelo vivo | E7-20 con juez de tier contrario (patrón ya probado en `evals/managed-inference`) |
| 5 | **Pricing real inexistente** (P0 del rollout report) | Heredado tal cual: F4 shippea la experiencia con precios placeholder en staging; producción de gasto real NO se activa sin price book |
| 6 | Re-anclar monitor/enrichment legacy arrastra el producto viejo | El candado del Radar sigue en CI; el re-anclaje pasa por los contratos A1, no por revivir endpoints de conversación |
| 7 | Las dos superficies (conocimiento y comercial) comparten shell y se re-contaminan | Decisión explícita en F2: manuales, cinturones y rutas separados por producto; compartir SOLO primitivas (assistant-ui, reductor). El eval E7-01 vigila la recaída |
| 8 | El equipo repara comportamiento editando el prompt (anti-patrón E5 §7) | Regla de PR: todo cambio de comportamiento trae su eval o su validación de gobierno |

## 7. Qué NO construir todavía

- Envío de outreach / deliverability (borradores sí — invariante).
- UIs especializadas por arquetipo (los seis negocios de la tesis comparten ESTA experiencia; se especializa el contenido vía `notas_estrategia`, no la superficie).
- Marketplace/selector de providers de cara al usuario (la neutralidad ya está en ports; el usuario ve "investigación web", punto).
- RBAC enterprise simulado (regla vigente en `product.md` — se ratifica).
- Mutación automática del ICP (Memory Refinery propone; humano aprueba — se ratifica).
- Memoria vectorial / embeddings para el director (E5 §7).
- Vista tabla densa (E4 §1: solo si el volumen real la exige).
- Migración a CopilotKit u otro dueño de runtime (decisión previa correcta — se ratifica).
- Internacionalización EN de esta superficie (es-MX primero; el wedge ES el registro).
- La fuente #22 como trabajo de producto (es trabajo de warehouse + licencia; el producto ya la absorbe por diseño).

## 8. Criterio de cierre del rediseño

El rediseño está terminado cuando: (1) los 15 bloqueantes de E7 están verdes en CI por defecto; (2) el DoD del workbench doc §17 se cumple punto por punto sobre staging; (3) la métrica "primera muestra útil" está instrumentada con p50 < 2 min sobre cobertura propia; y (4) la trayectoria canónica ("Quiero leads para vender Driftless…") produce, en staging, exactamente la conversación C1 — con un tablero real detrás.
