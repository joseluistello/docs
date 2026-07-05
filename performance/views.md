# F2.1 — Payload views & pagination contract

One vocabulary for partial-vs-full payloads across the whole API, so an agent (or
a human) learns it once and it means the same thing on every list/read endpoint.
Additive and backward-compatible: every endpoint keeps its existing default and
every view word it already shipped — this just makes the vocabulary canonical and
documents exactly what each tier carries. Source of truth:
`apps/api/src/ops/views.ts`.

## The three views

| View | Carries | Drops | Use it for |
|---|---|---|---|
| `summary` | index-safe row: id/slug, title, status/trust, badges, counts, anchors | durable bodies, heavy fields, history | a list row / board tile — the lightest read |
| `brief` | the durable **why**: what / decisions / gotchas / invariants | full `content`, event history, provider payloads | the default interactive read |
| `full` | everything — heavy bodies (`content`), event/history trails, relations, provider payloads | nothing | explicit opt-in only; pair with a small `limit` |

`brief` is the intended **default for lists** (charter, `charter.md` → "Pagination
+ views contract"). `full` is never a default — a caller asks for it.

### Per-primitive mapping

- **Topics** — `GET /topics`, `GET /topics/search`: default `summary` (the
  scannable index). For the LIST tier `summary` and `brief` coincide (the index
  already drops the body; a topic's `brief` why is fetched per-topic via
  `GET /topics/:slug`). `view=full` returns the complete canonical context per
  row. `GET /topics/:slug` is the full read; `POST /topics/retrieve` takes
  `brief` (default) / `full`.
- **Projects** — `GET /projects/:id?view=summary|brief|full` (F5.2): `summary`
  = counts only, `brief` = a bounded page of card summaries, `full` = a bounded
  page of full card details. No `view` preserves the legacy all-summaries shape.
- **Project card `next`** — the context bundle resolves by `refs` / `summaries`
  / `full` (F5.5). These map onto the canonical tiers (`refs`→summary,
  `summaries`→brief, `full`→full) and keep their original spellings.
- **Collections** — `GET /collections/:id/records?view=…` selects a *named
  collection view* (board/table) — a different concept from a payload tier; it
  is unchanged. Record payloads are already bounded (default page size +
  cursor).

### Legacy spelling aliases

`normalizeView` maps these onto the canonical tier so a caller may use the
standard word anywhere; the old words never stop working:

| Spelling | Canonical |
|---|---|
| `index`, `refs` | `summary` |
| `summaries` | `brief` |
| `detail` | `full` |

An unrecognized `view` returns `400` with `view must be one of: summary, brief,
full` — the same coded error contract every endpoint uses.

## Pagination contract

Two paging shapes coexist and both stay valid (additive):

- **Offset paging** — `limit` / `offset`, with an envelope
  `{ limit, offset, total, returned, has_more }` (projects' card page; topics
  list). Build it with `buildPageInfo`.
- **Keyset paging** — `{ records, nextCursor }` over a stable `(created_at, id)`
  ordering (collections; broker records). An opaque cursor, ignored if malformed.

Shared default bounds for an endpoint adopting the standard contract:
`DEFAULT_PAGE_LIMIT = 50`, `MAX_PAGE_LIMIT = 200` (`resolvePageLimit` clamps).
Topics' legacy list keeps its own "no `limit` = unbounded" back-compat.

## Error contract

Every error — validation, not-found, conflict, rate-limit, a translated Postgres
constraint violation, or an unhandled 500 — is returned as one envelope by the
`GlobalExceptionFilter`:

```json
{
  "statusCode": 400,
  "code": "INVALID_VALUE",
  "message": "…",
  "request_id": "…",
  "retryable": false,
  "endpoint": "GET /api/v1/workspaces/acme/topics"
}
```

Consumers branch on the stable machine `code` (see `ops/error-codes.ts`), never
on the English `message`. The code list is additive-only — never renamed or
repurposed.

## Why this matters for budgets

The payload ceilings in `budgets.md` assume a list defaults to a bounded,
body-free tier. Standardizing the vocabulary is what lets the regression tests
(F2.2) assert "this read stays under its ceiling" against ONE notion of which
tier a hot read returns by default.
