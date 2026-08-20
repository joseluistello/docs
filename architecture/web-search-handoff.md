# Web search — handoff para el agente que continúa

Lee esto antes de tocar nada. Es la mitad que el cuerpo del PR #274 no cubre:
ése está escrito para un revisor humano, éste para quien sigue el trabajo.

**Base:** `staging`. Rama: `claude/web-search-provider-eval-ai6un9`.
**Diseño completo:** [`web-search-provider-evaluation.md`](web-search-provider-evaluation.md)
**Métricas y fixtures:** [`web-search-fixtures-and-metrics.md`](web-search-fixtures-and-metrics.md)
**Tablero:** proyecto Driftless `Web Search Provider Evaluation` (`b875dad7`), 17 tarjetas.

---

## 1. Antes de correr un solo test — la trampa del entorno

`vitest` resuelve `@driftless/db`, `@driftless/model-gateway` y `@driftless/telemetry`
desde `dist/`. En un checkout limpio esos `dist/` no existen y **todo el suite
de `radar` y `chat` falla con `Failed to resolve entry for package`** — que
parece un error de código y no lo es.

```bash
pnpm install
pnpm -r --filter "./libs/*" build      # ← sin esto nada corre
```

Y la invocación correcta de los tests (las rutas van relativas a `apps/api`):

```bash
pnpm --filter @driftless/api exec vitest run src/radar src/chat
```

Estado de referencia al cerrar: **705 pass, 0 fail, 2 skipped.** Si al empezar
ves menos, algo se rompió antes de que llegaras.

---

## 2. Qué existe ya, y qué NO

Todo lo implementado es **provider-neutral**: no cambia según quién gane el
benchmark. Ninguno de estos módulos está cableado en `radar.module.ts` — son
inertes hasta que alguien los registre.

| Archivo | Qué resuelve |
|---|---|
| `radar/ports/web-search-provider.port.ts` | El contrato. `search` / `fetch` / `extract` / `estimate` / `cancel` / `health` |
| `radar/gtm/host-classification.ts` | Familia y grupo de origen por host final |
| `radar/gtm/claim-authority.ts` | Qué familia posee cada `claim_type` |
| `radar/gtm/evidence-router.ts` | Carriles, cinturón de herramientas, stop policy |
| `radar/gtm/untrusted.ts` | Valla de contenido no confiable + detector de inyección |
| `radar/gtm/web-ingest.ts` | `WebDocument` → Artifact / Observation / Claim |
| `radar/gtm/source-packs/web-search/manifest.ts` | Fábrica de packs tarifados |
| `radar/adapters/fixture-redact.ts` | Redacción de fixtures + gate anti-secretos |
| `evals/web-search/golden-queries.json` | 100 consultas congeladas |

**No existe:** ningún adapter, ninguna fixture, el bench runner, el cableado.

---

## 3. Lo siguiente: WS-04, el adapter del candidato principal

Es la pieza más pequeña que queda y desbloquea el resto.

### Lo que ya está verificado sobre la API (2026-08-01)

No hace falta que lo re-investigues; sí conviene que lo re-confirmes contra la
documentación antes de escribir el mapeo, porque estos precios se mueven.

| | |
|---|---|
| Search | `$1/1k` en modo barato · `$5/1k` en los dos superiores · 600 req/min |
| Extract | `$1/1k` · renderiza JS y parsea PDF · devuelve markdown |
| Devuelve por resultado | `url`, `title`, `publish_date`, `excerpts[]` (markdown) |
| Filtros | `after_date`, `include_domains` / `exclude_domains`, `location` (ISO-2), `max_age_seconds` |
| Resultados extra | `$1/1k` por encima de 10 — **no pidas más de 10** |

La clave **ya está desplegada** (`ParallelAdapter` la usa para FindAll). No hay
proveedor nuevo, ni secreto nuevo, ni revisión legal nueva.

### El mapeo que el port espera

- `mode: 'cheap' | 'balanced' | 'exhaustive'` → los tiers del vendor. El dominio
  nunca dice el nombre del tier.
- `excerpts[].span` → tienes que **calcularlo tú**: el vendor da el texto, no el
  offset. Búscalo en el markdown que devuelve y emite `offset:start-end`.
  Si no puedes localizarlo, emite `span: null` — no inventes uno.
- `publishedAt` → `publish_date`, y **`null` si el vendor no lo da.** Nunca la
  hora de fetch.
- `contentHash` → `null` en `search()` y `extract()` (no tuvimos los bytes),
  presente solo en `fetch()`.

### El candado te va a frenar, y está bien

`radar-architecture.spec.ts` falla el build si un token del vendor aparece fuera
de `radar/adapters/`. Ya están añadidos los de web search. Si tu adapter no
compila el spec, no es un bug del spec.

---

## 4. Fixtures (WS-03) — cuestan cero

Corregido respecto de lo que dije antes: **el bloqueo no era dinero, era que yo
no tengo llaves en mi contenedor.** Las capas gratuitas cubren la captura
completa:

| Proveedor | Gratis | Necesitas |
|---|---|---|
| Parallel | 5,000 req/mes + $5 | ~60 |
| Serper | 2,500 de prueba | ~60 |
| Jina Reader | sin clave, ~20 rpm | ~40 |
| Exa | $20 + $10/mes | ~20 |

### Cómo capturar

Las nueve clases obligatorias están en
[`web-search-fixtures-and-metrics.md §2`](web-search-fixtures-and-metrics.md).
Resumen de lo que importa al capturar:

1. **`_shared/` es el control del experimento.** El mismo HTML y el mismo PDF
   para todos los extractores. Si cada proveedor recibe su propia copia de la
   página, la comparación mide copias, no proveedores.
2. **Clases 1–3 y 9 son capturas reales.** Clases 4–8 (429, 5xx, timeout,
   partial, inyección) pueden ser sintéticas y se marcan `synthetic: true`.
3. **Redacta con el módulo, no a mano:**
   ```ts
   import { redact, assertNoSecrets } from '../adapters/fixture-redact'
   const { text, report } = redact(rawBody)      // preserva longitud por defecto
   assertNoSecrets(text, file)                   // lanza; no advierte
   ```
   Vive en `adapters/` y no en `gtm/` por una razón que el candado hace
   cumplir: redacta datos de wire de proveedor, así que nombra headers de
   vendor (`x-api-key`), y eso no puede aparecer en el dominio. Las fixtures
   que redacta también viven bajo `adapters/`.
   `redact()` preserva la **longitud en bytes** para que los offsets sigan
   apuntando al mismo texto. Si `report.lengthChanged` es `true`, **recaptura el
   `expected/`** — nunca ajustes el span a mano.
4. **`manifest.json`** con `sha256` y `captured_at` por archivo, más el `sha256`
   del cuerpo original. Sin fecha no sabes de cuándo es la web que mediste; sin
   hash no puedes detectar que alguien editó una fixture para que un test pasara.

---

## 5. Invariantes que no se rompen

Si un cambio necesita romper alguno de estos, no es un ajuste: es una decisión
de producto y necesita un humano.

1. **`observed_at` sale de la página.** `null` si la página no dice fecha.
   Rellenarlo con la hora de fetch convierte un boletín de 2019 leído hoy en
   algo observado hoy, y después nada aguas abajo puede notarlo.
2. **La web nunca crea un `claim_type` que un registro posee.** Corrobora o
   fecha; no establece ni corrige. Para licencias, sanciones e insolvencia, algo
   equivocado no es evidencia más débil — es daño a una empresa real.
3. **`live_verified` es inalcanzable desde un índice de búsqueda.** Un índice
   dice lo que el proveedor vio alguna vez.
4. **La familia y el origen los decide el HOST final, no el proveedor.** Dos
   proveedores que devuelven el mismo host son un solo origen.
5. **Una claim derivada de web no dispara escrituras.** Es la capa que queda en
   pie cuando el detector de inyección falla — y falla, aproximadamente una de
   cada diez veces contra ataques optimizados.
6. **La herramienta cara nunca entra al cinturón sola.** La escalada se
   demuestra contra `gtm_provider_attempts`, no se afirma.
7. **Ningún pack corre sin `cost_policy`.** `parseCostPolicy()` lanza. No lo
   debilites con un default.

---

## 6. Orden sugerido

```
WS-04 adapter principal  →  WS-03 fixtures  →  WS-07 bench  →  WS-14 quote+kill switch
                                                                       ↓
                                                        WS-15 shadow  →  WS-16 canary
```

WS-05 (fallback) y WS-06 (segunda opinión) son paralelizables con WS-04.
El fallback tiene un **requisito de selección, no una preferencia**: debe usar un
índice ascendente distinto al del principal. Un fallback sobre el mismo índice no
sirve ni para disponibilidad ni para independencia de familias.

Cada tarjeta en Driftless lleva su `validate` y su `acceptance`. Córrelos: son el
contrato, no una sugerencia.

---

## 7. Lo que está deliberadamente fuera de alcance

Anotado para que no reaparezca como "mejora" a media implementación —
§0.2 del documento de diseño tiene el razonamiento completo:

- Encender `tool-policy.ts` (está *dark* a propósito; su activación es una
  decision card humana que toca todas las superficies)
- Promover `gtm_provider_waterfall` a Collection
- Cascada general por capacidad (enriquecimiento antes que web)
- Monitores por segmento y `FindAll preview` como sonda

---

## 8. Dos cosas pendientes de decisión humana

1. **El aviso del hook de diseño** marca dos `<img>` en `untrusted.spec.ts` como
   imágenes rotas. Son payloads de ataque dentro de un spec de seguridad — el
   vector bajo prueba. Es un falso positivo y **no está silenciado**: suprimirlo
   requiere confirmación del dueño.
2. **Los precios** se verificaron el 2026-08-01 contra las páginas oficiales.
   Re-verifícalos antes de contratar: cuatro proveedores de esta categoría
   cambiaron precio o cerraron en los últimos doce meses.
