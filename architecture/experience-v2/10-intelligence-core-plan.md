# E10 — Intelligence Core: plan de implementación ejecutable

**Objetivo:** construir primero el Intelligence Core, su CLI/harness y el contrato autoritativo `OpportunityResult`; recablear el chat después. **No** continúa F4–F7 ni rediseña lo visual.
**Estado:** PLAN para revisión — nada de esto está implementado. Un agente sin contexto adicional debe poder ejecutarlo leyendo este documento (y los docs 01–09 que referencia por sección).
**Base:** staging @ `93d11e2` (incluye F0–F3 y sus revisiones adversariales), `gtm-fabrica` @ `d29123b`.

## Hard rules (gobiernan todo el plan; cada tarjeta las hereda)

1. El producto autoritativo es `OpportunityResult`. Chat, tablero, CLI, monitores y evals consumen el MISMO contrato (los consumidores de usuario, vía UNA función de proyección cliente-segura del mismo objeto).
2. El modelo puede clasificar; **jamás reordena ni selecciona aguas abajo** de `OpportunityResult`.
3. El fit es **relativo a una oferta/query**, nunca propiedad universal de la señal.
4. **Sin Redis ni caching layer**: la persistencia derivada vive en Postgres, versionada y auditable. El "caché" ES la tabla de assessments.
5. Una consulta gratuita **no requiere workflow durable** (síncrona). Mastra queda para investigación pagada y monitores.
6. Investigación pagada, monitores y enrichment siguen siendo acciones explícitas posteriores (invariantes intactas).
7. No modificar producción ni AWS. No desplegar. Las cifras de cobertura son snapshots del SHA auditado, jamás constantes de código o eval.

---

## 1. Diagnóstico breve y arquitectura objetivo

**Diagnóstico (evidencia en docs 01, 09 y las revisiones del PR #279):** el producto del sistema no está definido como objeto de datos sino como desenlace conversacional. Consecuencias observadas en staging: dos rankings para la misma consulta (la prosa re-juzga; el tablero proyecta el orden del warehouse), imposibilidad de atribuir una mala respuesta a su capa, el agente compensando con razonamiento lo que ninguna capa le resuelve, y evals herméticos verdes con defectos reales en staging (los herméticos prueban las capas con contrato; el juicio comercial no tiene ninguno).

**Arquitectura objetivo:**

```
gtm-fabrica (hechos, evidencia, licencias, capabilities)
      │  únicamente las 3 funciones SQL existentes (discover/query/evidence)
      ▼
INTELLIGENCE CORE (Driftless, síncrono, reproducible)
  compilar query → seleccionar capabilities → recuperar → filtrar →
  dedupe → candidatos top-K → FIT por modelo (batch, persistido, versionado)
  → ranking determinista explicable → materializar
      │
      ▼
OpportunityResult (autoritativo, versionado, con diff)
      ├─► proyección cliente-segura → chat (narración por referencias) + tablero
      ├─► CLI/harness (objeto completo, con lineage)
      ├─► evals (golden set, gates)
      └─► monitores futuros (diff entre corridas)
```

Principio rector (corrige la hipótesis "Core determinista"): **reproducibilidad por construcción, no determinismo por prohibición del modelo.** El único paso con modelo (fit) se ejecuta por lote, contra schema estricto, y su salida se **persiste como dato versionado**; todo lo demás es determinista. Mismo input + mismos versionados ⇒ mismo `OpportunityResult` byte a byte (excluyendo timestamps).

## 2. Contratos TypeScript completos (v1.0, congelados en C0)

Módulo nuevo: `apps/api/src/intelligence/contracts.ts`. Parsers fail-closed (patrón `agentic-contracts.ts`: `strictObject`, propiedades desconocidas rechazadas), fixtures neutrales, `INTELLIGENCE_JSON_SCHEMA` exportado.

```ts
export const INTEL_SCHEMA_VERSION = '1.0' as const

// ————— La entrada —————
export interface EncargoQuery {
  schemaVersion: typeof INTEL_SCHEMA_VERSION
  queryId: string                    // uuid, estable a través de versiones
  version: number                    // 1..n; un refinamiento = version+1, mismo queryId
  priorVersion: number | null
  workspaceId: string
  oferta: { resumen: string; resultado: string | null }   // "software para dependencias públicas"
  compradorHipotesis: string[]       // en lenguaje de usuario; [] = inferir del tipo de señal
  geografia: string[]                // ids canónicos (MX-JAL); [] = sin restricción
  ventana: { publicadoDesde: string | null; efectivoDesde: string | null }  // ISO con zona
  exclusiones: ExclusionCriterio[]   // ver abajo — tipadas, no texto suelto
  limite: { deseadas: number; maxCandidatas: number }     // defaults 15 / 200
  commercialProfileHash: string      // sha256(oferta.resumen + compradorHipotesis ordenados + perfil persistido usado)
  origen: 'chat' | 'cli' | 'monitor' | 'eval'
  createdAt: string
}
export interface ExclusionCriterio {
  id: string
  texto: string                      // "hardware", "solo inferencias"
  tipo: 'lexica' | 'semantica'       // léxica: aplicable determinísticamente; semántica: la juzga el clasificador
}

// ————— El juicio persistido (fit) —————
export type FitNivel = 'alto' | 'medio' | 'bajo' | 'descartado' | 'abstencion'
export interface OpportunityAssessment {
  schemaVersion: typeof INTEL_SCHEMA_VERSION
  assessmentId: string
  signalId: string
  workspaceId: string
  commercialProfileHash: string
  queryVersionDiscriminator: string | null  // null = fit BASE (oferta↔señal); no-null = overlay de exclusiones semánticas (hash de exclusiones)
  classifierVersion: string          // 'fit-clf/1.0.0@<modelId>' — prompt+schema+modelo
  taxonomyVersion: string            // 'fit-tax/1.0.0' — definiciones de niveles y vocabulario de razones
  nivel: FitNivel
  razones: Array<{ codigo: string; detalle: string }>  // codigo ∈ vocabulario cerrado de la taxonomía
  confianza: 'alta' | 'media' | 'baja'
  evaluatedAt: string
  latencyMs: number
  tokensIn: number | null
  tokensOut: number | null
  costUsd: number | null             // null = desconocido; JAMÁS 0 inventado
}

// ————— El resultado autoritativo —————
export interface OpportunityResult {
  schemaVersion: typeof INTEL_SCHEMA_VERSION
  resultId: string
  query: EncargoQuery                // eco completo, versionado
  catalogVersion: string
  generatedAt: string
  cobertura: CoberturaVerdicto
  filas: FilaOportunidad[]           // TODAS (destacadas, relevantes, descartadas, conflicto) — el estado discrimina
  metricas: MetricasEmbudo
  diff: ResultDiff | null            // ≠ null si query.version > 1
  reproducibilidad: { assessmentsCacheHits: number; assessmentsNuevos: number; abstenciones: number }
}

export interface CoberturaVerdicto {
  status: 'suficiente' | 'parcial' | 'sin_cobertura'
  explicacion: string                            // lenguaje de usuario, jamás causas internas
  huecos: Array<{ id: string; descripcion: string; investigableWeb: boolean }>
  salidas: SalidaPropuesta[]                     // SIEMPRE ≥2 si status ≠ 'suficiente'
}
export interface SalidaPropuesta {
  kind: 'afinar_criterio' | 'investigar_web' | 'vigia_cobertura' | 'redirigir_adyacente'
  etiqueta: string
  huecoIds: string[]
  // SIN precio/tope/vigencia: la cotización la compone la maquinaria de quotes existente al despachar
}

export interface FilaOportunidad {
  filaId: string                     // determinista: derivado de signalId (estable entre versiones del query)
  entidad: { nombre: string; tipo: string; geografia: string[] }  // nombres cliente-seguros
  quePaso: { resumen: string; fechas: FechasSenal; estadoSenal: 'activa' | 'vencida' | 'cancelada' | 'desconocido' }
  porQueAhora: string                // DERIVADO de hechos por plantilla por-capability (determinista)
  fit: { nivel: FitNivel; razones: Array<{ codigo: string; detalle: string }>; confianza: 'alta'|'media'|'baja'; inferencia: true; assessmentId: string }
  score: ScoreDesglosado
  estado: 'destacada' | 'relevante' | 'descartada' | 'conflicto'
  causaDescarte: { etapa: EtapaPipeline; codigo: string; detalle: string } | null
  evidencia: EvidenciaAgrupada
  conflicto: { posiciones: Array<{ afirmacion: string; fuente: string; fecha: string }> } | null
  desconocidos: string[]
  lineage: FilaLineage
}
export interface FechasSenal { publicado: string; efectivo: string | null; cierre: string | null }
export interface ScoreDesglosado {
  total: number
  componentes: { fit: number; frescura: number; fase: number; confianzaEvento: number; geografia: number }
  rankingVersion: string             // 'rank/1.0.0' — pesos versionados
}
export interface EvidenciaAgrupada {
  fuentesDistintas: number           // deduplicadas por fuente — arregla "Fuentes (13)" del mismo portal
  items: Array<{ fuenteNombre: string; url: string; fechaPublicacion: string | null; fechaConsulta: string; atribucion: string | null }>
}
export type EtapaPipeline = 'seleccion_capability' | 'retrieve' | 'filtros' | 'dedupe' | 'candidatos' | 'fit' | 'rank'
export interface FilaLineage {                    // SOLO CLI/evals — la proyección cliente lo omite
  capabilityId: string
  capabilityVersion: number
  dedupe: { grupoId: string; fusionadaCon: string[] } | null
  fit: { assessmentId: string; cacheHit: boolean } | null
  prescore: number
}

export interface MetricasEmbudo {
  recuperadas: number; filtradas: number; deduplicadas: number
  candidatasEvaluadas: number; propuestas: number; descartadas: number
  costoClasificacionUsd: number | null
  latenciaMs: { retrieve: number; fit: number; total: number }
}

export interface ResultDiff {
  desdeVersion: number; haciaVersion: number
  conservadas: string[]; promovidas: string[]; degradadas: string[]
  descartadas: Array<{ filaId: string; causa: string }>
  nuevas: string[]
}

// ————— La proyección cliente-segura (la ÚNICA vía a chat/tablero) —————
// paraCliente(result): elimina lineage, capabilityId/version, rankingVersion/classifierVersion,
// y traduce vocabulario de fuente→usuario (etapas de licitación, fechas relativas).
// Chat y tablero consumen EXCLUSIVAMENTE esta proyección del MISMO objeto.
export declare function paraCliente(result: OpportunityResult): OpportunityResultCliente
```

**Decisión que requiere revisión humana (desviación deliberada del spec):** el spec pedía `query_version` en la clave del assessment. Literalmente, cada refinamiento invalidaría TODO el caché de fit. Propongo `queryVersionDiscriminator`: `null` para el fit base (oferta↔señal — reusable entre versiones y queries con la misma oferta) y un hash de exclusiones para overlays de exclusión semántica. Si el equipo prefiere la literalidad, el cambio es una columna — pero pagará ~5× en costo de clasificación por sesión de refinamiento.

## 3. Ownership exacto

| Componente | Repo/lugar | Regla |
|---|---|---|
| Hechos, evidencia, licencias, entidades, recipes, capabilities, harvest | `gtm-fabrica` (intocado por este plan) | Cero cambios. Ninguna migración, ninguna función SQL nueva |
| Lo que cruza el gateway | SOLO `discover_capabilities_v1` / `query_signals_v1` / `get_signal_evidence_v1` vía el port/adapter existentes | El Core consume el port `MarketIntelligenceGateway`; jamás SQL directo |
| **Intelligence Core** | **NUEVO: `apps/api/src/intelligence/`** — `core/` (funciones puras, sin NestJS, sin I/O salvo interfaces inyectadas) + `intelligence.module.ts` (wrapper Nest) + `persistence/` | Vive en Driftless porque necesita: perfil comercial del workspace, model-gateway, ledger futuro, y servirá al chat. NO es repo aparte (evitar tercera frontera prematura) |
| Persistencia derivada (`intel_assessments`, `intel_results`) | Postgres de **Driftless** (`libs/db` migración additive) | Es juicio comercial workspace-scoped, NO hechos: jamás en el vault |
| Clasificador (prompt versionado, schema, batch) | `apps/api/src/intelligence/classifier/` (`fit-clf.prompt.md` + `fit-clf.schema.ts`) | Modelo vía `ModelGatewayService` existente; provider-vocabulary jamás en el Core |
| Mapping tema↔capability + plantillas `porQueAhora` + `notas_estrategia` | Sidecar de proyección existente (`coverage-map.ts` se muda/absorbe a `intelligence/`) | Datos versionados en Driftless (decisión E9 §3, se conserva) |
| CLI/harness | `apps/api/src/intelligence/cli/` + bin `pnpm --filter @driftless/api intel` | Corre contra DB + vault de staging con credenciales de dev; NUNCA contra prod |
| Golden set + runner | `evals/intelligence/` (golden JSON + `run.mjs` con la disciplina del registry E7) | Gatea en `check.sh` |
| Chat/tablero | Consumen `paraCliente(result)` (fase C8) | Prohibido leer filas de otra fuente |

## 4. Pipeline por etapas (cada etapa: entrada→salida tipada, todo inspeccionable)

1. **Query compilation.** CLI: flags→`EncargoQuery` (determinista). Chat (C8): el director compila NL→`EncargoQueryDraft`, el servidor lo valida/normaliza (geografía canónica, defaults declarados). El compilador de NL NO existe antes de C8.
2. **Capability selection (determinista).** Del catálogo licenciado vigente: `geografia ∩ geography_coverage` + `compradorHipotesis ∩ subject_kinds` + el mapping oferta→temas (datos del sidecar, hoy `TEMAS`/`demuestra` en `coverage-map.ts`). Salida: capabilities elegidas con razón, o `sin_cobertura` con salidas. **El agente ya no selecciona capability jamás.**
3. **Retrieval.** `query_signals_v1` por capability, paginado por cursor, tope `maxCandidatas`. Salida: señales crudas + conteo.
4. **Deterministic filters.** Ventana temporal (`published_after`/`effective_after` — ya soportados por el gateway), estado de señal, exclusiones **léxicas** (match literal documentado). Cada exclusión registra `{filaId, etapa:'filtros', codigo, detalle}`.
5. **Deduplication.** Agrupar por entidad normalizada + `event_group_key` (existe en el warehouse desde su migración 0009); fusionar evidencia; `fuentesDistintas` deduplicado por `fuenteNombre` (arregla "Fuentes (13)"). Salida: grupos con `fusionadaCon[]`.
6. **Semantic candidate retrieval (top-K).** Prescore determinista (frescura + estado + confianza del evento + geografía) y corte a K (default 50). SOLO estos K llegan al modelo. Los no-candidatos quedan `estado:'relevante'|'descartada'` por prescore, con causa.
7. **Model-based batch fit.** Para cada candidato SIN assessment vigente (lookup por clave §5): lotes de 10 filas/llamada, schema estricto, `abstencion` permitida. Presupuesto duro por query (§6).
8. **Persisted/versioned assessment.** INSERT de cada assessment nuevo; los hits se reportan en `reproducibilidad`.
9. **Deterministic ranking.** `score.total = Σ wᵢ·componenteᵢ` con pesos en `rank/1.0.0` (datos versionados, no constantes sueltas). `destacada` = top-3 por score con `fit ∈ {alto}` (fallback documentado si <3 altos); `conflicto` nunca destaca. **Ninguna llamada a modelo en esta etapa ni después.**
10. **Result materialization.** Construir `OpportunityResult`, persistir en `intel_results`, calcular `diff` contra `(queryId, version-1)` si aplica.

## 5. Persistencia (Postgres, sin Redis, sin caching layer)

Migración additive en `libs/db` (forward-only, patrón del repo):

```sql
CREATE TABLE intel_assessments (
  assessment_id uuid PRIMARY KEY,
  signal_id text NOT NULL,
  workspace_id uuid NOT NULL,
  commercial_profile_hash text NOT NULL,
  query_version_discriminator text,           -- NULL = fit base
  classifier_version text NOT NULL,
  taxonomy_version text NOT NULL,
  nivel text NOT NULL CHECK (nivel IN ('alto','medio','bajo','descartado','abstencion')),
  razones jsonb NOT NULL,                     -- [{codigo, detalle}]; codigos del vocabulario cerrado
  confianza text NOT NULL CHECK (confianza IN ('alta','media','baja')),
  evaluated_at timestamptz NOT NULL,
  latency_ms integer NOT NULL,
  tokens_in integer, tokens_out integer, cost_usd numeric,
  UNIQUE (signal_id, workspace_id, commercial_profile_hash,
          COALESCE(query_version_discriminator,''), classifier_version, taxonomy_version)
);
CREATE INDEX ON intel_assessments (workspace_id, commercial_profile_hash);

CREATE TABLE intel_results (
  result_id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  query_id uuid NOT NULL,
  query_version integer NOT NULL,
  catalog_version text NOT NULL,
  result jsonb NOT NULL,                      -- el OpportunityResult completo, re-parseado al leer (fail-closed)
  generated_at timestamptz NOT NULL,
  UNIQUE (query_id, query_version)
);
```

Reglas: append-only en la práctica (una re-evaluación con `classifier_version` nuevo es FILA nueva — historia auditable de cómo cambió el juicio); lectura del fit vigente = "el assessment de las versiones actualmente configuradas"; nunca UPDATE de nivel/razones; retención fuera de alcance de este plan.

## 6. Anti-explosión combinatoria y de costos

- **Embudo antes del modelo:** filtros deterministas + dedupe + prescore top-K. Con K=50 y lotes de 10 ⇒ **≤5 llamadas por query fría; 0 en refinamientos con mismo perfil** (fit base cacheado; solo overlays de exclusión semántica nuevos).
- **Presupuestos duros por query (config, no constantes):** `maxLlamadasClasificador` (default 6), `maxCostoClasificacionUsd` (default 0.05), `deadlineFitMs` (default 25 000). Al agotar: las filas sin evaluar quedan `abstencion` visibles y rankeadas por prescore; el resultado lo declara en `reproducibilidad.abstenciones`. Jamás fallo silencioso ni etapa parcial oculta.
- **Invalidación = versión, jamás borrado:** bump de `classifier_version`/`taxonomy_version` ⇒ re-evaluación **perezosa** (al tocar la señal en una query), nunca recomputo masivo. Cambio de oferta ⇒ nuevo `commercial_profile_hash` ⇒ assessments nuevos, los viejos quedan como historia.
- **Latencia (SLO, medidos por el harness):** primer parcial materializable (retrieve+prescore, filas "sin evaluar aún") ≤5 s p50; resultado completo ≤30 s p50 con caché frío, ≤6 s con caché caliente.
- **Escala de datos hoy:** decenas de señales por capability — los topes son techos de seguridad, no optimizaciones prematuras. Documentar que a >5 000 señales/capability la etapa 6 necesitará un prefiltro léxico/embedding en SQL (fuera de alcance, anotado como v1.1).

## 7. CLI / harness (`pnpm --filter @driftless/api intel <cmd>`)

```
intel query   --oferta "software para dependencias públicas" [--comprador dependencias]
              [--geo jalisco] [--desde 90d] [--excluir "hardware:semantica"] [--deseadas 15]
              [--workspace <slug>] [--json] [--etapas] [--show-excluded] [--show-merged]
              [--sin-modelo]        # corre C1: fit=abstencion, solo determinista
intel explain --result <resultId> --fila <filaId>       # score desglosado + lineage + assessment
intel diff    --query <queryId> --v1 1 --v2 2           # ResultDiff humano y --json
intel assessments --signal <id> [--workspace <slug>]    # historia del juicio para una señal
intel eval    [--golden evals/intelligence/golden/*.json] [--update-baseline] [--solo <G-id>]
```

Output humano (por defecto): eco del query compilado → tabla por etapa (`recuperadas 37 → filtradas 34 → dedupe 31 → candidatas 20 → evaluadas 20 (hits 14, nuevas 6) → propuestas 12`) → top con score desglosado por componente → cobertura y salidas → costo/latencia. `--json` = `OpportunityResult` completo (con lineage). `--show-excluded` lista cada excluida con `{etapa, codigo, detalle}`; `--show-merged` los grupos de dedupe. **Regla:** el CLI imprime el objeto, no re-interpreta nada; es el mismo código del Core que usará el chat.

## 8. Golden set inicial (`evals/intelligence/golden/*.json`)

Formato por caso: `{ id, query, fixtures | 'staging-vault', expectativas: propiedades }` — propiedades, no filas exactas. Etiquetado inicial: **humano (founder), sesión de ~2 h — dependencia explícita, gate de C5.**

| ID | Caso | Expectativas observables |
|---|---|---|
| G1 | **El caso de staging:** oferta software/dependencias públicas, señales reales de Jalisco | La licitación de licencias de ciberseguridad rankea #1 con `fit alto`; iluminación, autobuses y uniformes/sombreros NO entran a destacadas y sus `causaDescarte`/`fit bajo` llevan razón del vocabulario |
| G2 | C2 del doc-set (nómina/maquiladoras/norte) con fixtures de expansión | 0 preguntas requeridas del query; capabilities de expansión seleccionadas; supuesto geo declarado en el eco |
| G3 | C3 (uniformes/GDL) | Warehouse-only, 0 costo de clasificación en refinamiento repetido (caché), citas 100% |
| G4 | C4 (Bajío) | `cobertura: parcial` + hueco nombrado (3 estados) + salida `investigar_web`; lo cubierto se entrega completo |
| G5 | C5 (veterinarias CDMX) | `sin_cobertura` + ≥2 salidas; cero filas de relleno; explicación sin causas internas (barrido léxico) |
| G6 | C11: fixture con fuentes en conflicto | fila `estado: conflicto`, ambas posiciones con fecha, excluida de destacadas |
| G7 | Evidencia insuficiente (claim sin evidencia exhibible en fixture) | La fila NO aparece; `metricas.descartadas` la cuenta; el conteo es honesto |
| G8 | Dedupe: 13 constancias del mismo portal para una señal | `fuentesDistintas: 1`, items agrupados; jamás "13 fuentes" |
| G9 | Refinamiento: G1 + exclusión `"hardware:semantica"` → v2 | `diff` correcto (conservadas/descartadas con causa); fit base 100% caché; solo overlays nuevos |
| G10 | Geografía: oferta GDL con señales CDMX en fixture | componente `geografia` del score las degrada; razón visible en `explain` |
| G11 | Ventana: señal vencida hace 6 meses | degradada por `frescura`/estado, no destacable |
| G12 | Reproducibilidad: G1 dos veces seguidas | resultados byte-idénticos (excluyendo `generatedAt`/ids de result) con caché caliente |
| G13 | Presupuesto: K=50 con `maxLlamadas=2` | corta limpio, `abstenciones` reportadas, exit honesto |
| G14 | Multi-capability (C6): fixtures de `public_procurement_award` junto a new_tender | filas de ambas bajo el mismo criterio; cero cambios de código respecto a G1 (solo datos de mapping) |

(Las paráfrasis NL — E7-03 — entran al golden en C8, cuando exista el compilador NL→query.)

## 9. Métricas y gates

| Métrica | Definición | Gate | Fase |
|---|---|---|---|
| precision@3 | destacadas correctas / 3, promedio sobre golden etiquetado | ≥ 0.8 | C5 |
| recall etiquetado | positivos etiquetados presentes en propuestas / positivos totales | ≥ 0.85 | C5 |
| Falsos positivos en destacadas | negativos etiquetados que aparecen como destacadas | = 0 | C5 |
| Dedupe | grupos de golden fusionados exactamente; 0 sobre-fusiones | exacto | C4 |
| Citas completas | filas visibles con ≥1 evidencia y `fuentesDistintas` correcto | 100% (estructural) | C1 |
| Latencia a primer parcial / total | p50 del harness sobre golden | ≤5 s / ≤30 s frío | C4 |
| Costo de clasificación | USD por query fría (K=50) y por refinamiento | ≤ $0.05 / ≈$0 | C3 |
| Estabilidad de ranking | misma entrada+versiones ⇒ mismo orden | 100% | C4 |
| Reproducibilidad | G12 byte-idéntico | 100% | C4 |
| Calibración del clasificador | micro-eval de fit contra etiquetas por-fila (aparte del pipeline) | acc ≥ 0.85; y **> baseline determinista** | C3/C5 |

Runner con la disciplina E7 heredada Y las dos correcciones de la revisión del PR #279: **falla con exit ≠ 0 de vitest/subproceso** y **falla ante tests que no matchean ningún ID del registro**. `NOT RUN` jamás cuenta PASS. Gates cablean a `check.sh` desde C0.

## 10. El modelo como clasificador controlado

1. **Schema estricto:** salida = array de `{signalRef, nivel, razones[{codigo, detalle}], confianza}`; `codigo` de vocabulario cerrado (taxonomía versionada); parser fail-closed con 1 reparación acotada que re-envía el error. **Structured outputs obligatorios:** decisión empírica en C3 entre (a) tier con `json_schema` (hoy el fallback) o (b) primario con `json_object` + validación; gate: tasa de salida inválida < 2%. La lección D1 del PR (prompt sin schema) queda prohibida por tarjeta: el prompt SIEMPRE contiene el schema y un ejemplo.
2. **Prompt versionado:** `classifier/fit-clf.prompt.md` con semver; cambiarlo = bump de `classifier_version` = re-evaluación perezosa. El prompt recibe SOLO: oferta (texto), exclusiones semánticas, y por fila los campos cliente-seguros (`quePaso`, entidad, fechas). Jamás el bundle, jamás vocabulario interno.
3. **Batch:** lotes de 10; sin streaming; deadline por lote; reintento 1 con backoff; lote fallido ⇒ `abstencion` para sus filas, con `razones:[{codigo:'sin_evaluar', …}]`.
4. **Abstención primera clase:** información insuficiente ⇒ `abstencion` (mejor que un `bajo` inventado); la UI eventualmente lo muestra como "sin evaluar aún"; el eval del clasificador la premia frente al falso `alto`.
5. **Eval independiente:** micro-eval de fit por fila (C3), separada del pipeline — así "clasificación semántica" deja de ser una capa inatribuible (síntoma 5).
6. **Nunca reordenar aguas abajo:** garantizado por (a) chat/tablero consumen `paraCliente(result)`, (b) eval estructural: los ids destacados de la narración == `result.filas[estado=destacada]` (E7-17 se vuelve trivial), (c) **candado**: test que falla si algo fuera de `intelligence/core/rank` importa/reimplementa ordenamiento sobre filas (patrón `legacy-radar-candado`).

## 11. Migración desde la arquitectura actual

- **Conservar (intocado):** gtm-fabrica completo; gateway de 3 funciones + adapter; ledger/quotes/aprobaciones; eventos A1 + reducer F1; evidencia/artifact-bodies; setup comercial/libro de hechos; disciplina de evals.
- **Congelar (no extender hasta C8/C9):** `commercial-coordinator`, `turn-intent`, `director.skill`, rutas comerciales actuales de `chat.service`, workflow Mastra de oportunidades. Cero features nuevos ahí mientras el Core no exista.
- **Adaptar:** `coverage-map.ts` (su mapping y proyección se absorben como datos del Core §3); `escalation.ts` (su lógica se re-domicilia en `CoberturaVerdicto.salidas` — y AHÍ muere `proposalFor` de una-señal, D10/D11); `artifact-bodies` (mapeo `FilaOportunidad`→`OpportunityRow` en C8); `narration-gate` (en C8 corre POST-resultado contra estado real — arregla D6/D7); el director (C8: pierde `estrategia`, gana `ejecutar:{queryDraft}` + schema en el prompt — arregla D1).
- **Eliminar (C9, con candado):** ramas `market_opportunity|paid_research_*` legacy de `runTurnLocked`; `synthesisOnly` e `includeMarketTools`; `sintetizarRespuestaDeFilas` como autoridad; los pasos de query/discover/evidence del workflow Mastra (queda SOLO `research-approval` y la base de monitores futuros); `question-policy.ts` viejo; el belt de 20 tools en la superficie comercial. `chat.service.ts`: objetivo −600 líneas del pegamento comercial.
- **Retiro de los múltiples caminos:** hoy hay 3 (legacy regex/synthesis, director F2, y el belt general). C8 hace que el camino director consuma el Core; C9 borra los otros dos de la superficie comercial y deja UN camino, con candado estructural que impide re-importarlos (mismo método que el retiro del Radar).
- **Mastra reservado:** consulta gratuita = llamada síncrona al Core (hard rule 5). Mastra queda exclusivamente para: aprobación/ejecución de investigación pagada (suspend/resume existente) y monitores (F5 futuro, diff de results).

## 12. Recableado posterior (C8 — resumen del contrato)

Turno comercial: mensaje → director (delgado: compila `EncargoQueryDraft`, conversa, propone decisiones; **no** selecciona capability, filas ni orden) → gobernador (igual, más los fixes D4/D5: presupuesto persistido, veto que también poda la prosa) → **Core síncrono** → `OpportunityResult` → (a) artifact `opportunity_set` derivado de `filas` vía mapeo determinista, (b) narración generada DESDE el resultado — plantilla en C8.1; modelo-con-referencias después, con el gate post-ejecución — donde toda cifra/organización referencia `filaId`, (c) eventos A1 → reducer → chat y tablero **idénticos por construcción**. Refinamiento: steering → `query v+1` → Core → `diff` autoritativo → la UI anima exactamente el diff y la narración lo dice con sus números ("6 siguen, 2 fuera por X, 3 nuevas").

## 13. Rollback y coexistencia temporal

- C0–C7 son **aditivos puros**: módulo nuevo, tablas nuevas, CLI nuevo. Rollback por tarjeta = revert del diff. Nada toca los caminos vivos.
- C8 entra detrás del flag existente `agentic_workbench` (no se crea flag nuevo): workspace con flag = director+Core; sin flag = camino actual. **Coexistencia acotada a C8→C9** con fecha de muerte explícita: C9 elimina los caminos viejos y el candado impide su regreso. Prohibido el estado permanente de dos autoridades (hard rule 1) — si C9 se pospone >2 semanas tras C8, es un incidente de plan, no una opción.
- Datos: `intel_*` son derivados; borrarlos no pierde hechos (se regeneran). Migraciones forward-only con `down()` real.

## 14. Riesgos

| Tipo | Riesgo | Mitigación |
|---|---|---|
| Técnico | Primario sin `json_schema` ⇒ tasa de inválidos alta en el clasificador | Decisión empírica C3 con gate <2%; tier fallback disponible; reparación acotada |
| Técnico | Latencia del fit rompe el SLO | top-K, lotes, parcial-primero (filas visibles pre-fit), presupuesto duro con abstención |
| Semántico | Taxonomía de fit mal definida ⇒ etiquetas y clasificador derivan | Taxonomía como doc versionado aprobado por humano (C0.2); vocabulario cerrado de razones; micro-eval C3 |
| Semántico | Golden sesgado a 1 fuente licenciada ⇒ negativos poco diversos | Fixtures desde las 6 capabilities definidas (test vault), no solo la licenciada; G14 obliga multi-capability |
| Operativo | Etiquetado humano es cuello de botella | Sesión única de ~2 h con formato preparado; el plan lo declara gate explícito de C5 |
| Operativo | Credencial de vault de staging para el CLI de dev | Reusar `TEST_GTM_DATABASE_URL` del cross-repo spec; sin cambios AWS |
| Costo | Explosión por refinamientos | Fit base cacheado por perfil-hash; overlays solo para exclusiones semánticas; presupuesto duro |
| Producto | Core correcto ≠ producto valioso (el juicio codificado puede no ser el del founder) | El golden ES el juicio del founder; C5 incluye su revisión de top-3 reales; matriz final ata síntomas→gates |
| Plan | Sobre-ingeniería si el baseline determinista ya pasa golden | C1 corre golden `--sin-modelo` PRIMERO; C3 debe **superar** ese baseline o se pospone (gate honesto contra mi propio diseño) |

## 15. Proyecto: fases y tarjetas

Formato por tarjeta: **Obj** (objetivo) · **Área** (archivos probables) · **Cambios** · **Inv** (invariantes) · **Acepta** (criterios observables) · **Val** (comando) · **Tests** · **Riesgo** · **Rollback** · **Entrega** · **Deps** · **Fuera de alcance**.

### C0 — Contrato y baseline rojo

**C0.1 · Contratos + parsers + fixtures**
Obj: congelar los tipos del §2 con parsers fail-closed. Área: `apps/api/src/intelligence/contracts.ts`, `contracts.fixtures.ts`, `contracts.spec.ts`. Cambios: tipos, `parseEncargoQuery/parseAssessment/parseOpportunityResult/paraCliente` (proyección con lista explícita de campos omitidos), fixtures neutrales (ids `capability_one`, sin marcas). Inv: propiedades desconocidas rechazadas; `paraCliente` jamás emite `capabilityId/lineage/…Version`; timestamps con zona. Acepta: specs verdes; round-trip parse(serialize(x))≡x; proyección probada por búsqueda de strings prohibidos sobre el JSON serializado. Val: `pnpm --filter @driftless/api exec vitest run src/intelligence/contracts.spec.ts`. Tests: ~20 unit. Riesgo: bajo. Rollback: revert. Entrega: contrato 1.0. Deps: —. Fuera: cualquier lógica de pipeline.

**C0.2 · Taxonomía de fit v1 + pesos de ranking v1 (GATE HUMANO)** — **REDACTADA · PENDIENTE DE APROBACIÓN**
> `taxonomy/fit-tax-1.0.0.md` y `taxonomy/rank-1.0.0.ts` existen con el contenido que esta tarjeta propone; el gate humano NO está cerrado. Bloquea C3.3 y C5.1. Registro: `DECISIONS.md` D-002.

Obj: definir `fit-tax/1.0.0` (qué significa alto/medio/bajo/descartado/abstención, con 2 ejemplos por nivel usando el caso G1) + vocabulario cerrado de `razones.codigo` (~12 códigos: `necesidad_directa`, `necesidad_derivada_fase`, `giro_incompatible`, `excluido_por_usuario`, `sin_evaluar`, …) + `rank/1.0.0` (pesos propuestos: fit .45, frescura .20, fase .15, confianzaEvento .10, geografía .10). Área: `apps/api/src/intelligence/taxonomy/fit-tax-1.0.0.md` + `rank-1.0.0.ts` (datos). **Requiere aprobación del founder antes de C3/C5.** Acepta: doc revisado y aprobado (registro en el PR); códigos referenciados por los contratos. Val: revisión humana. Deps: C0.1. Fuera: calibración (C5).

**C0.3 · Golden set + runner rojo-honesto**
Obj: los 14 casos del §8 como JSON + `evals/intelligence/run.mjs` con registro (patrón E7) **incluyendo desde el día uno los dos fixes de la revisión del PR #279**: exit≠0 de vitest = FAIL del runner; test sin ID del registro = FAIL. Todos los golden nacen `NOT IMPLEMENTED` (rojos con razón). Área: `evals/intelligence/{golden/*.json,run.mjs,registry.mjs,baseline.json}`, `scripts/harness/check.sh` (+step), `package.json`. Acepta: `pnpm intel:eval` corre, reporta 14 rojos con razones, exit 1; check.sh lo incluye. Val: `node evals/intelligence/run.mjs`. Riesgo: fixtures irreales — mitigado tomando señales reales de staging para G1. Deps: C0.1. Fuera: implementar caso alguno.

**C0.4 · Migración `intel_assessments` + `intel_results`**
Obj: §5 tal cual, additive. Área: `libs/db/src/migrations/…`, entidades. Inv: UNIQUE del assessment exacto al §5; jamás tocar tablas existentes. Acepta: migrate up/down limpio en DB efímera; specs de constraint (duplicado exacto = no-op/conflict claro). Val: `pnpm db:migrate` + spec. Deps: C0.1. Fuera: escritura desde el pipeline.

### C1 — Core mínimo sin modelo

**C1.1 · Selección determinista de capability**
Obj: etapa 2 del §4 como función pura sobre el catálogo + mapping (datos absorbidos de `coverage-map.ts` sin romper sus consumidores actuales). Área: `intelligence/core/select-capabilities.ts`. Inv: cero llamadas a modelo; capability no licenciada/`unavailable` = inexistente; razón de selección/no-selección registrada. Acepta: G5 parcial (detecta sin_cobertura); specs con catálogo fixture de 6 capabilities. Val: vitest del módulo. Deps: C0.1. Fuera: salidas de cobertura (C1.5).

**C1.2 · Retrieval + filtros deterministas**
Obj: etapas 3–4 vía el port existente, paginación acotada, exclusiones léxicas con causa. Área: `core/retrieve.ts`, `core/filters.ts`. Inv: solo las 3 funciones del gateway; `maxCandidatas` respetado; toda exclusión con `{etapa,codigo,detalle}`. Acepta: specs con adapter fixture; conteos del embudo correctos. Val: vitest. Deps: C1.1.

**C1.3 · Dedupe de señales y evidencia**
Obj: etapa 5; `fuentesDistintas` honesto. Área: `core/dedupe.ts`. Inv: 0 sobre-fusiones (entidades distintas jamás se funden); grupo conserva TODA la evidencia. Acepta: G8 verde; specs de no-sobre-fusión adversariales. Val: vitest + `node evals/intelligence/run.mjs --solo G8`. Deps: C1.2.

**C1.4 · Prescore + ranking + materialización v0**
Obj: etapas 6/9/10 con `fit=abstencion` universal (sin modelo); persistir `intel_results`. Área: `core/prescore.ts`, `core/rank.ts`, `core/materialize.ts`, `persistence/results.store.ts`. Inv: ranking 100% determinista; score desglosado por componente; `porQueAhora` por plantilla per-capability (datos). Acepta: G3, G10, G11, G12 (reproducibilidad byte-a-byte) verdes en modo `--sin-modelo`; G1 medido y REPORTADO (pasa o no — dato para el gate C3). Val: runner golden. Deps: C1.3, C0.4.

**C1.5 · Veredicto de cobertura + salidas**
Obj: `CoberturaVerdicto` con ≥2 salidas cuando no-suficiente; re-domiciliar la lógica de `escalation.ts` — **aquí muere la regla una-señal** para siempre (la salida `investigar_web` se propone desde cero cobertura). Área: `core/coverage.ts`. Inv: explicación sin léxico interno (barrido en spec); salidas sin precio (hard rule 6 — la cotización es del checkpoint). Acepta: G4, G5 verdes. Val: runner. Deps: C1.1, C1.4.

### C2 — Harness/CLI

**C2.1 · `intel query` + salida humana/JSON + etapas**
Obj: §7 core. Área: `intelligence/cli/{index.ts,render.ts}`, bin en package.json. Inv: el CLI imprime el objeto, jamás re-computa; `--json` = contrato exacto. Acepta: correr G1 contra vault de staging de dev imprime embudo + top con desglose; `--json | jq` parsea. Val: ejecución manual documentada en el card + spec de render con fixture. Deps: C1.4. Fuera: NL (C8).

**C2.2 · Inspección: `--show-excluded`, `--show-merged`, `explain`, lineage**
Obj: atribución por capa (síntoma 5) operable. Acepta: toda fila excluida es explicable con etapa+código; `explain` muestra desglose de score + assessment (o abstención). Val: specs de render + golden G7. Deps: C2.1.

**C2.3 · `intel diff` + versionado de query**
Obj: `ResultDiff` autoritativo entre versiones persistidas. Acepta: G9 (mitad determinista) verde: refinar exclusión léxica produce diff correcto. Val: runner. Deps: C2.1.

### C3 — Clasificador por modelo (persistido y versionado)

**C3.1 · Prompt + schema + batch runner + decisión de tier (GATE)**
Obj: §10.1–10.4. Área: `intelligence/classifier/{fit-clf.prompt.md,fit-clf.schema.ts,batch.ts}`. Inv: el prompt CONTIENE el schema y un ejemplo (prohibición D1); entrada del modelo solo campos cliente-seguros; abstención permitida; presupuesto duro. Acepta: contra 3 lotes de señales reales, tasa de salida inválida <2% en el tier elegido (si ambos fallan, PARAR y escalar a humano); costo/lote medido y reportado (no inventado). Val: script de captura tipo `capture.mjs` con transcript commiteado. Riesgo: el gate puede fallar en ambos tiers. Rollback: el Core sigue útil `--sin-modelo`. Deps: C0.2, C1.4.

**C3.2 · Persistencia/caché del assessment + invalidación por versión**
Obj: §5+§6: lookup por clave, INSERT de nuevos, hits reportados. Inv: jamás UPDATE de nivel; bump de versión = re-evaluación perezosa. Acepta: G9 completo (refinamiento con 100% caché base); spec de clave única. Val: vitest + runner. Deps: C3.1, C0.4.

**C3.3 · Micro-eval del clasificador + comparación contra baseline**
Obj: eval de fit por fila contra etiquetas (subconjunto de G1/G5/G10 etiquetado por humano) + **gate honesto**: el clasificador debe superar el baseline determinista de C1.4 en el subconjunto semántico; si no, C3 se congela y se documenta. Acepta: acc ≥0.85 y > baseline; reporte en `evals/intelligence/`. Val: runner. Deps: C3.1, C0.2 aprobada, etiquetas humanas del subconjunto.

### C4 — Ranking/dedupe/coverage/lineage/diff completos

**C4.1 · Score final + explicabilidad** — integra fit real al ranking; `destacada` exige fit alto; conflicto jamás destaca. Acepta: G1 verde COMPLETO (ciberseguridad #1, negativos fuera con razón); G6 verde. Val: runner. Deps: C3.2.
**C4.2 · Lineage completo + métricas de embudo + SLOs medidos** — Acepta: latencias p50 sobre golden dentro de SLO, reportadas por el runner (no afirmadas). Deps: C4.1.
**C4.3 · Diff con overlays semánticos** — Acepta: G9 con exclusión semántica: diff correcto, solo overlays nuevos evaluados. Deps: C4.1, C3.2.

### C5 — Golden y calibración (GATE HUMANO)

**C5.1 · Sesión de etiquetado + calibración de pesos + ratchet**
Obj: founder etiqueta el set completo (~2 h, formato preparado); calibrar `rank/1.x` si precision@3 <0.8; congelar `baseline.json` con TODOS los verdes (lección del PR: el baseline nunca se queda atrás de la realidad); gates §9 cableados como bloqueantes en check.sh. Acepta: los 13 golden implementables verdes (G14 queda para C6); métricas §9 en gate. Val: `node evals/intelligence/run.mjs` exit 0 + check.sh. Deps: C4.*, humano. Fuera: tocar el clasificador para "pasar" (cambios de prompt = bump de versión + re-corrida completa).

### C6 — Multi-capability

**C6.1 · Segunda capability end-to-end por fixtures**
Obj: probar el invariante de escala: `public_procurement_award` (definida en gtm-fabrica) atraviesa el Core **sin cambios de código** — solo datos de mapping/plantillas. Vault de test con fixtures de esa capability (SIN tocar licencias reales ni AWS; el helper test-only de display-authorization del warehouse existe para esto en DB efímera). Acepta: G14 verde; diff de la tarjeta muestra 0 líneas en `core/` (solo datos + fixtures). Val: runner. Deps: C5.1. Fuera: activar licencias reales (humano/legal, fuera del plan).

### C7 — Gateway estable

**C7.1 · API pública congelada + candados**
Obj: congelar `IntelligenceCore.query(EncargoQuery): Promise<OpportunityResult>` + `paraCliente` + política de versionado (semver de contrato; catálogo de cambios compatibles); candado no-reorden (test que falla si fuera de `core/rank` se ordena/filtra filas de un result) + candado de proyección (grep de campos internos en consumidores cliente). Acepta: candados en el suite default; doc de API de 1 página en el módulo. Deps: C4.*. Fuera: exponerlo por HTTP/MCP (decisión posterior).

### C8 — Recableado del chat

**C8.1 · Director delgado + schema en el prompt**
Obj: `TurnIntent.ejecutar` pasa a `{ queryDraft: EncargoQueryDraft }`; muere `estrategia`; el manual del director INCLUYE el schema JSON del intent + ejemplo (fix D1); structured output según la decisión C3.1; reparación acotada real (fix D2); compilador NL→query con el libro de hechos. Acepta: E7-01/02/04 L2 verdes contra el pipeline nuevo; **una corrida L3 real commiteada como transcript** (fix del gap "cero observaciones de modelo"). Val: vitest e7 + transcript. Deps: C7.1.
**C8.2 · El turno consume el Core**
Obj: `chat.service` comercial = compilar → gobernador (con fixes D4/D5: presupuesto persistido en el summary; veto que también poda la pregunta de la prosa) → Core síncrono → result → artifact body mapeado de `filas` → narración por plantilla DESDE el resultado (ids only) → eventos A1. `narration-gate` corre POST-resultado contra `filas/metricas` reales (fix D6/D7) y muere el fallback sin gate. Acepta: E7-14/16/17 verdes; eval nuevo: ids de destacadas en narración == destacadas del result (imposible divergir); las trayectorias herméticas se actualizan y los 2 tests rojos del PR se resuelven aquí (la narración del usuario ES derivada del resultado — se elimina la ambigüedad que los rompió). Deps: C8.1.
**C8.3 · Refinamiento = diff en la superficie**
Obj: steering → query v+1 → Core → diff → eventos patch por fila + narración con los números del diff. Acepta: E7-18 verde de punta a punta; G9 reproducido vía chat. Deps: C8.2.

### C9 — Simplificación y retiro

**C9.1 · Un solo camino comercial + candado**
Obj: eliminar de la superficie comercial: ramas legacy `market_opportunity|paid_research_*` del turno, `synthesisOnly`/`includeMarketTools`, `sintetizarRespuestaDeFilas` como autoridad, belt de 20 tools, pasos query/discover/evidence del workflow Mastra (queda `research-approval`); candado estructural anti-regreso (patrón radar-candado). El flag `agentic_workbench` se vuelve default-on y se agenda su muerte. Acepta: grep-candados verdes; trayectorias E2E verdes por el único camino; `chat.service.ts` −500 líneas mínimo (medido en el diff). Rollback: revert de la tarjeta (por eso es UNA tarjeta atómica de deletes). Deps: C8.3 estable en staging ≥3 días.
**C9.2 · Limpieza de módulos huérfanos**
Obj: borrar `question-policy` viejo, `work-contract.compiler` autor (queda validador), `escalation.ts` original (re-homed en C1.5), dead code señalado por las revisiones. Acepta: `knip`/grep de no-referencia; suite verde. Deps: C9.1.

### C10 — Staging E2E y pase visual mínimo

**C10.1 · E2E sobre staging + correcciones de honestidad visual (NO rediseño)**
Obj: correr las consultas del golden contra staging real vía chat y CLI; corregir SOLO los defectos de honestidad que bloquean la lectura del resultado (lista cerrada, de la revisión UI): métrica del tablero honesta (deja de contar descartadas), render de `fuentesDistintas`, `despachoPendiente` reconocido en `RUN_STARTED` (mata los 20–50 s de "Entendiendo tu encargo"), un solo control de Detener, chips reales en sin_cobertura/pausa. Acepta: transcript E2E commiteado; los 5 fixes con sus specs; PruebaVisual con el assertion `data-status-line` REPARADO (hoy no puede fallar). Val: e7 + E2E manual documentado. Deps: C9.1. Fuera: dossier, dominancia de layout, densidad — todo E4 pendiente queda para después.

## 16. Adversarial conmigo mismo: decisiones humanas o investigación pendientes

1. **Taxonomía de fit (C0.2)** — no puede escribirla un agente solo: codifica el juicio comercial del founder. Bloquea C3/C5.
2. **Etiquetado del golden (C5.1, ~2 h humanas)** — sin esto, precision/recall son teatro.
3. **Clave del caché de assessments** — mi `queryVersionDiscriminator` DESVÍA del spec literal (§2); necesita un sí/no explícito.
4. **Tier del clasificador (C3.1)** — decisión empírica con gate; puede fallar en ambos tiers y requerir escalación.
5. **Riesgo de sobre-diseño del clasificador** — si el baseline determinista de C1.4 pasa G1 (posible: "software"↔"licencias de software de ciberseguridad" comparte léxico), C3 debe justificarse con el subconjunto genuinamente semántico (G5, paráfrasis) o posponerse. El plan lo hace gate, no supuesto.
6. **Pesos de ranking** — los defaults son míos; C5 los calibra pero el founder revisa los top-3 resultantes.
7. **Credencial de vault de staging para el CLI** — operativa (reusar `TEST_GTM_DATABASE_URL`); sin ella, C1/C2 corren solo contra fixtures.
8. **Los 2 tests rojos ya mergeados** (`TRAYECTORIA ·`) — este plan los resuelve en C8.2, pero si se quiere staging verde ANTES, hay que decidir: revert temprano o esperar a C8.
9. **`porQueAhora` por plantilla**: suficiente para licitaciones (fechas/cierre); para señales de fase (expansión) puede quedar pobre — se revisa con G14, posible plantilla enriquecida por capability como datos.

## 17. Matriz: problema observado → responsable → cambio → prueba → gate

| Problema observado | Componente responsable | Cambio propuesto | Prueba que lo demuestra | Gate de salida |
|---|---|---|---|---|
| Respuesta y tablero con rankings distintos | No existe objeto autoritativo | `OpportunityResult` + `paraCliente` + narración por ids | Eval "ids destacados narración == result" + G1 | C8.2 |
| No se puede atribuir una mala respuesta a su capa | Pipeline sin outputs por etapa | Lineage + `--show-excluded/--explain` + micro-eval del clasificador | G7, C2.2 specs, C3.3 | C2/C3 |
| Uniformes/autobuses/iluminación destacados para oferta de software | Fit inexistente (orden del warehouse) | Fit por modelo persistido + ranking con fit alto para destacar | **G1** | C4.1 |
| "Fuentes (13)" del mismo portal | Evidencia sin dedupe | `EvidenciaAgrupada.fuentesDistintas` | G8 | C1.3 |
| Refinamiento opaco (tablero viejo sin explicación) | Sin versionado de query ni diff | `query v+1` + `ResultDiff` + narración del diff | G9 + E7-18 e2e | C8.3 |
| Parallel/pagada aparece demasiado pronto | Regla una-señal + escalada sin dueño | `CoberturaVerdicto.salidas` (checkpoint SIEMPRE; propuesta solo con hueco nombrado) | G4, G5 + E7-08/09 | C1.5/C8 |
| Agente sabe demasiado de la operación interna | Payloads crudos + selección en el modelo | Core selecciona; director solo compila query; entrada del clasificador cliente-segura | Candados C7.1 + barridos léxicos | C7/C8 |
| 20–50 s de "Entendiendo tu encargo" | despacho enmascarado + sin parciales | Core síncrono ≤5 s primer parcial + ack en RUN_STARTED | SLO C4.2 + fix C10.1 | C4/C10 |
| Tests herméticos verdes, staging con defectos | El juicio comercial no tenía contrato ni eval | Golden set con positivos/negativos reales + gates §9 en check.sh | C0.3 runner + C5.1 | C5 |
| Dos autoridades de narración (prosa vs `sintetizarRespuestaDeFilas`) | Synthesizer renacido | Narración derivada del resultado; retiro C9 | Los 2 tests rojos del PR, resueltos | C8.2/C9.1 |
| Costos/latencia de clasificación no acotados | Sin presupuesto por query | top-K + lotes + presupuesto duro + abstención | G13 + métricas §9 | C3/C4 |
| Evals que no pueden fallar / rojos invisibles | Runner permisivo | exit≠0 = FAIL; test sin ID = FAIL; baseline ratchet completo | C0.3 (heredado a E7 runner) | C0 |

---

**Siguiente paso propuesto:** revisión humana de este plan (en particular §16.1–.4) → cargo las tarjetas como Project en Driftless con dependencias → C0 arranca.
