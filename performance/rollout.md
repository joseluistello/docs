# F10 — Roll-out: API back-compat audit

The performance program added new query params, two new POST/GET retrieve routes, a
search-vector column, and evolved one list response shape. F10.1 audits **every**
one of those changes against a single rule:

> An existing client that passes **none** of the new params must see the **same
> response shape** (no key removed, no array→object swap) as before the program.

New behavior is opt-in. This note is the audit; the verdict column is what an old
client experiences on a no-param call.

## Query-param additions (all additive — old client unaffected)

| Endpoint | New param(s) | Default when absent | Back-compat verdict |
|---|---|---|---|
| `GET /topics` | `view`, `limit`, `offset`, `has_external` | `view` → `summary` (the historical index shape); no `limit` → unbounded (legacy) | OK — `normalizeView(view, 'summary')` preserves the old default; same per-row keys |
| `GET /topics/search` | `view`, `limit`, `tags`, `stale` | `view` → `summary`; server clamps `limit` | OK — default tier unchanged; search was always index-only |
| `POST /topics/match-files` | body `history` (`none`/`recent`/`full`) | `recent` | OK — default `recent` reproduces the prior payload |
| `GET /collections/:id/records` | `view`, `limit`, `cursor`, `entity_id`, `drifted`, `updated_after` | see response-shape section | **GATED** — see below |
| `GET /collections/:id/retrieve` | new route | n/a | OK — net-new, additive |
| `GET /broker/connections/:provider/operations` | `refresh` | served from materialized metadata; `refresh` re-pulls live | OK — additive; default reads the cache |
| `GET /broker/connections/:provider/records` | `cursor`, `modifiedAfter`, `limit` | born as `{ records, nextCursor }` in F2 — never a bare array | OK — shape predates the program |
| `GET /broker/events` | `limit` | additive | OK |
| `GET /projects/:id` | `view`, `card_limit`, `card_offset`, `card_status` | **no `view` ⇒ the legacy `get()` (metadata + every card summary)** | OK — `if (!view) return this.projects.get(...)` short-circuits to the old shape |
| `GET /projects/:id/cards` | `limit` | unbounded list (array) | OK — array shape unchanged |
| `GET /projects/:id/cards/next` | `context` (`refs`/`summaries`/`full`) | `refs` (the lightest bundle) | OK — additive, default is the original tier |

## New endpoints (purely additive)

| Route | Notes | Verdict |
|---|---|---|
| `POST /topics/retrieve` | The unified ranker (search + match-files + list). Body `view` → `brief` default. Does not replace any existing route. | OK — additive |
| `GET /collections/:id/retrieve` | Records page + criterion Knowledge in one GET. | OK — additive |

## Schema additions (no response surface)

| Change | Exposure | Verdict |
|---|---|---|
| Topics `search_vector` (generated `tsvector`) column | Internal to the full-text search query path; never serialized into `CanonicalContext` / `CanonicalSummary` | OK — invisible to clients |

## The one response-shape evolution — and its gate

`GET /collections/:id/records` is the **only** route whose default response shape
changed. F6.2 ("cursor-paginate collection records, bounded by default") evolved it
from a **bare array** `CanonicalRecord[]` to the keyset envelope
`{ records, nextCursor }`. A pre-F6.2 client doing `res.map(...)` / `res.length`
would break on the object.

**Gate (F10.1, `collections.controller.ts`):** the controller returns the **legacy
bare array** when the caller passes **none** of the new pagination/view params
(`entity_id`/`drifted`/`updated_after`/`view`/`limit`/`cursor`). `status` predates
F6.2 and does **not** opt a caller in. Any new param ⇒ the caller is
pagination-aware ⇒ the `{ records, nextCursor }` envelope. The page stays **bounded**
(`DEFAULT_RECORD_LIMIT`) in both branches — the charter's safety bound is preserved;
only the wrapper differs by opt-in.

- Accepted nuance: a no-param call is now bounded to `DEFAULT_RECORD_LIMIT` (25)
  where it was once unbounded. This is a deliberate, charter-mandated safety bound
  (a large collection must never ship "everything" in one read). The **shape**
  (the load-bearing back-compat concern) is preserved; the bound is the intended
  improvement, and a client that needs more pages opts into the cursor.

**First-party clients** (CLI `collection records`, MCP `driftless_collection_record`
action:`list`) are pagination-aware in F10.2 / F10.3 — they pass `limit`/`cursor`,
so they consume the envelope and page server-side rather than relying on the legacy
array.

**Test:** `apps/api/src/collections/collections.controller.records-backcompat.integration.spec.ts`
asserts: no-param ⇒ bare array; `status` alone ⇒ bare array; `limit`/`cursor`/`view`
⇒ envelope (and pages to exhaustion).

## Verdict

Every program change is additive or gated. No response key was removed; no default
tier silently changed; the single array→object evolution is opt-in with the legacy
shape restored for params-free callers.
