# Unified retrieve contract (CLI · MCP · API)

One mental model for **reading at scale** across all four planes — Topics,
Projects, Collections, Broker — so an agent never has to learn per-surface rules.
Every retrieval read on every surface converges on the same vocabulary, defaults,
and output shape. The [`navigation.md`](./navigation.md) plan says *which plane to
move to*; this contract says *how every read behaves once you're there*.

It is deliberately **composable surfaces, not one mega-tool**: each plane keeps its
own bounded read, and they share this contract so results line up. A unified
primitive is only earned once every plane passes the retrieval-scale gate.

## The shared vocabulary

| Concept | Param | Meaning | Default |
|---|---|---|---|
| Intent | `query` / `task` | free-text "what I'm looking for / about to do" | — |
| Anchor | `files` | repo paths the work touches (topics only) | — |
| Scope | `status`, `tags`, `area`, `provider`, `effect`, `entity`, `drifted`/`stale`, `updated_after`, `fields` | structured narrowing (per plane) | — |
| Bound | `limit` | max rows this page | small, plane-specific |
| Page | `cursor` | opaque keyset/offset token for the next page | first page |
| Depth | `view` = `summary` \| `brief` \| `full` | payload tier (`full` is always opt-in) | `summary`/`brief` |
| Notes | `include_notes` | also surface shared private Notes (your OWN are always visible) | false |
| Explain | `explain` / `why_matched` | why each hit matched | off |

## The shared output shape

Every bounded read returns, in some form:

- **`shown`** + **`has_more`** (and a **`nextCursor`** when more exist) — bounded, pageable.
- **`results`/`records`/`operations`/`cards`** — the rows, at the requested `view`.
- **`trust`** where governance applies (`knowledge` \| `proposed` \| `note`) — an
  agent must never confuse a hint with team truth.
- **`stale`** / drift flag where drift applies — verify before relying.
- **`next_action`** — the next bounded call (the navigation rail).

## The invariants (hold on every surface)

1. **Bounded by default.** No read returns an unbounded set; the default page is
   small and `full` bodies are always an explicit opt-in.
2. **Filter + privacy BEFORE limit.** Visibility (the draft-privacy predicate) and
   all filters run in SQL before `LIMIT` — a page never leaks across the
   visibility boundary, and the caller's OWN Notes are never false-empty.
3. **`next_action` is the rail.** Every read names the next bounded call; the chain
   composes the planes (see `navigation.md`).
4. **No list-all to find one thing.** Searching is a server-side filter call
   (query + keyset), never a client-side scan of a full list.

## Where each surface implements it

| Plane | CLI | MCP | API |
|---|---|---|---|
| Topics (task) | `context retrieve "<task>" [--explain]` | `driftless_context_retrieve` | `POST /topics/retrieve` |
| Topics (files) | `context get --files`/`--diff` | `driftless_context_get_for_files` | `GET /topics/match-files` |
| Topics (browse) | `context list`/`search` `[--limit --cursor]` | `driftless_context_list`/`_search` | `GET /topics`, `/topics/search` |
| Projects | `project cards [--owner --cursor]` · `project card next` | `driftless_project_card` `list`/`next` | `GET /projects/:id/cards`, `/cards/next` |
| Collections | `collection retrieve`/`records [--limit --cursor]` | `driftless_collection` `retrieve` · `driftless_collection_record` `list` | `GET /collections/:id/retrieve`, `/records` |
| Broker | `broker operations --query` | `driftless_broker` `operations` (query) | `GET /broker/operations` |

The matrix of names + default views is [`surface-matrix.md`](./surface-matrix.md);
the retrieve-first routing for agents is `skills/driftless/references/retrieve.md`.
