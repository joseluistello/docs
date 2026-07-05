# Connector Retrieve Contract

Connector-backed retrieve is the L5 lane of Connector Experience v2. It lets
Driftless search materialized connector documents, but only after an explicit
import/index writes those documents into Driftless-owned storage.

This contract exists to prevent the most dangerous shortcut: retrieve must never
call a provider live. It reads Topics and Driftless-owned connector documents. It
does not read Nango, Broker, Notion, Drive, provider SDKs, or provider APIs during
a retrieve request.

## Non-goals

- No provider live calls from retrieve.
- No automatic Topic creation from connector documents.
- No automatic Collection record creation.
- No writes to external systems.
- No raw provider credentials, connection ids, tokens, or Nango config in output.
- No default behavior that silently mixes external source data into Knowledge.

## Source Model

Retrieve has two source families:

| Source | Backing data | Trust label | Default |
| --- | --- | --- | --- |
| `topics` | reviewed/draft/note topic rows | `reviewed`, `draft`, `note` | on |
| `connectors` | `connector_documents` rows | `external` | off until explicitly requested or product gate enables it |

`topics` remain the canonical context memory path. Connector documents are
external source data: useful, citeable, freshness-tracked, but not Knowledge.

Connector-backed retrieve may be enabled through an explicit source filter:

```json
{
  "query": "authentication design",
  "sources": ["topics", "connectors"],
  "providers": ["notion"],
  "connector_models": ["ContentMetadata"],
  "limit": 10
}
```

If `sources` is omitted, the default remains `["topics"]` until the product
explicitly changes the default behind a rollout gate.

## Query Contract

Connector retrieve accepts only bounded, workspace-scoped filters:

| Field | Meaning |
| --- | --- |
| `sources` | `topics`, `connectors`, or both |
| `providers` | optional connector provider ids, e.g. `notion` |
| `connector_models` | optional source models, e.g. `ContentMetadata` |
| `connector_status` | default `active`; may include `stale`; never includes `deleted` unless explicitly requested by an operator surface |
| `freshness` | optional `fresh`, `stale`, or `any` |
| `modified_after` | source freshness lower bound |
| `limit` | total returned results, capped by retrieve budget |
| `view` | `brief` by default; `full` only returns bounded snippets, not raw full provider dumps |

Provider filters are not authority. The tenant boundary is always
`workspace_id`, and connector document reads must apply the same access scope that
the import/index path stored on each row.

## Result Shape

Every result carries a source discriminator:

```json
{
  "source": "connector",
  "trust": "external",
  "provider": "notion",
  "title": "Architecture Notes",
  "snippet": "bounded text snippet",
  "citation": {
    "id": "conn:notion:...",
    "label": "Notion · Architecture Notes",
    "url": "https://notion.so/...",
    "provider": "notion",
    "external_id": "..."
  },
  "freshness": {
    "status": "fresh",
    "source_updated_at": "2026-06-29T00:00:00.000Z",
    "indexed_at": "2026-06-29T00:02:00.000Z"
  },
  "why_matched": ["query:text", "title"]
}
```

Topic results keep their existing shape and `trust` semantics. Connector results
must not reuse `reviewed`, `draft`, or `note`; the only connector trust label is
`external`.

## Ranking

Ranking is blended only after each source produces bounded candidates.

1. Query each selected source under its own source-specific bounds.
2. Score within source using the native indexed fields:
   - Topics: existing topic retrieve ranking.
   - Connectors: title + materialized `content_text` full-text rank, then
     freshness and indexed time as tie breakers.
3. Merge results with a source-aware bias:
   - Topics rank ahead when scores are comparable because they are team memory.
   - Connector documents may outrank topics only on strong text relevance.
   - Stale connector documents are demoted but may appear if explicitly allowed.
4. Return a single bounded result set with source labels and citations.

The merge must not require loading unbounded connector rows into Node.

## Freshness

Connector freshness is derived from materialized fields, not provider calls:

- `fresh`: active row, recent import/index relative to product threshold, and no
  known source staleness marker.
- `stale`: row is active but source metadata or import state is old.
- `deleted`: source disappeared or access was lost; excluded from normal retrieve.
- `error`: last import attempted and failed; excluded unless an operator surface
  asks for diagnostics.

Freshness is a signal, not trust. A fresh connector document is still
`trust:"external"`.

## Citations

Connector citations come from `connector_documents.citation_id` and provenance
columns, not from provider lookups at retrieve time.

Citation requirements:

- stable within a workspace for a given connector document;
- includes provider, display label, source URL when available, external id, and
  freshness fields;
- never includes provider secrets, connection ids, Nango provider config keys, or
  raw sync payloads;
- survives re-indexing of the same external object.

## Payload Budgets

Connector retrieve must be cheaper than live provider reads:

- default `limit` should stay small and share the existing retrieve caps;
- snippets are bounded independently from stored `content_text`;
- `view:"full"` may include a larger bounded excerpt, never arbitrary full
  provider payload;
- output carries `has_more`/`next_action` instead of expanding automatically;
- deleted/error rows are excluded by default to avoid noisy payloads.

## Failure Semantics

Connector-backed retrieve should fail closed and explain the next action:

| Condition | Behavior |
| --- | --- |
| source not requested | no connector lookup |
| connector retrieve disabled by rollout | return topics only plus `connector_source:"gated"` if requested |
| no materialized documents | return empty connector section and next action: run index preview/import |
| provider filter unsupported | 400 with supported providers from registry |
| access scope mismatch | omit rows; do not reveal titles |
| connector index unavailable | fail connector source only; do not break topic retrieve |
| stale rows only | return stale-labeled rows only when requested, otherwise next action suggests re-index |

If `sources:["connectors"]` is explicitly requested and connector retrieve cannot
run, the response should be explicit rather than silently returning topics.

## Static Guard

The implementation must include a static test proving the retrieve path imports
none of:

- `broker.service`;
- `nango.service`;
- provider client modules;
- `notion-content.service`;
- any source-controlled Nango function file.

The allowed dependency is a connector document query service/repository over
Driftless-owned storage.

