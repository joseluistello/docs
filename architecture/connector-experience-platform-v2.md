# Connector Experience Platform v2

Connector Experience v2 turns the working connector capability directory into a
product-grade experience. It is not a new-provider project. The scope is the
platform above Connections/Broker/Capabilities: dashboard clarity, explicit
import/index into Driftless-owned objects, retrieve over materialized connector
content, and governed writes design.

The key boundary remains unchanged: default context retrieve calls zero external
providers. Connector content becomes searchable only after an explicit
import/index step materializes it as Driftless-owned, citeable, freshness-tracked
data.

## Existing foundation

Connector Capability Platform v1 established:

- Nango owns OAuth, vault/provider credentials, provider runtime, sync cache, and
  provider webhooks.
- Driftless owns tenancy, connector registry, capability status, rollout, grants,
  read-only policy, audit, CLI/MCP/API shape, dashboard visibility, and user-facing
  next actions.
- Agents discover and invoke approved capabilities; they do not author scripts or
  browse Nango dashboards.
- Notion is the first read-only wedge: metadata sync, bounded records, bounded
  page content, no writes.

v2 builds on that foundation instead of bypassing it.

## Product lanes

### Lane A — dashboard connector UX

The dashboard should explain a connection without exposing implementation detail.
For each provider it should show:

- connection state and reconnect/setup next action;
- ready capabilities;
- gated, empty, failed, or unsupported capabilities;
- sync/model health;
- safe read affordances;
- import/index entry points once available;
- why writes are disabled or gated.

The dashboard must not expose provider tokens, raw Nango config, page text in
status panels, unbounded records, or internal deployment jargon.

This lane can ship independently because it reads existing capability-directory
metadata and does not change connector behavior.

## Dashboard information architecture

Connections should have two levels: a workspace connection list and a provider
detail view.

### Connection list

The list answers "is this system connected and usable?"

Rows show:

- provider name and logo;
- connection state label from the broker connection status;
- next action, if any;
- ready capability chips;
- attention chips for setup, empty, failed, gated, or reconnect states;
- a `writes disabled` chip for read-only connectors;
- primary action: connect, reconnect, open details, or disconnect.

User-facing copy must come from broker status/capability labels where available.
When dashboard-only copy is needed, use this vocabulary:

| State | Copy | Primary action |
| --- | --- | --- |
| `needs_reconnect` | Connection expired | Reconnect |
| `sync_starting` / `syncing` | Sync is starting | View status |
| `ready` | Ready | Open details |
| `empty` | No shared content found | Share content in the provider |
| `deploy_pending` | Setup is still running | Check again |
| `deploy_failed` | Setup needs attention | Open details |
| `gated` | Access is gated | Request access |
| `disabled` | Disabled by policy | None |
| `unsupported` | Not supported yet | None |

Avoid implementation words in the default UI: Nango, template, deployment,
function source, providerConfigKey, connectionId, token, script.

### Provider detail view

The detail view answers "what can I do with this connection?"

Sections:

1. **Status** — connection health, sync health, last known counts/freshness, and
   next action.
2. **Capabilities** — grouped by kind: syncs, record models, document content,
   import/index, retrieve, and writes.
3. **Read surfaces** — bounded commands or UI affordances for models, records,
   and document content. These show identities and counts, not raw full content by
   default.
4. **Import/index** — preview first, then execute. Show candidate counts, sample
   identities, skipped reasons, and freshness before allowing materialization.
5. **Retrieve** — hidden until imported content exists. When available, it must
   explain that retrieve searches Driftless-owned materialized content, not the
   provider live.
6. **Writes** — disabled/gated by default. If preview exists, show preview status
   and missing gates, never a direct write button.

The detail view must not become a provider IDE. It is an explanation and control
surface over Driftless-owned capabilities.

### Capability card shape

Each capability row/card should show:

- name;
- kind;
- effect (`read`, `write`, or `none`);
- status label;
- next action;
- bounded read/import command if ready;
- freshness/count when relevant;
- policy note for disabled writes.

It must not show raw provider content, credentials, or raw Nango config.

### Lane B — explicit import/index

Import/index is the bridge between external source data and Driftless-owned data.
It is explicit, bounded, audited, and user-owned. It is not a side effect of
connecting a provider, reading a record, or opening retrieve.

There are two valid materialization targets, and they are intentionally
different:

- **Collections import:** converts synced provider records into operational rows
  with a human-defined schema and workflow. Example: `ContentMetadata` rows become
  Records in a Collection using a saved connector mapping. Collections own field
  schema, status, views, and downstream work. They are not the default retrieve
  index.
- **Connector document index:** stores provider document/text content as
  Driftless-owned, citeable, freshness-tracked source data for search and future
  retrieve. It does not create Topics, it does not create Knowledge, and it does
  not pretend external documents are governed engineering memory.

The v2 retrieve path uses the connector document index, not Collections and not
live providers. Collections may later reference indexed connector documents, but
that is an explicit mapping, not an import side effect.

The materialized connector document contract must include:

- workspace id and connection/provider identity;
- external id and stable source url/title;
- source model/read action and sync run or freshness marker;
- normalized bounded content;
- content digest for idempotency;
- citation id;
- freshness/staleness state;
- tombstone/delete state;
- access scope;
- import/index run id.

A connector document row is the smallest durable unit retrieve can cite. Its
minimum shape is:

| Field | Purpose |
| --- | --- |
| `workspace_id` | tenant boundary for every read/write query |
| `provider` | normalized provider id, e.g. `notion` |
| `connection_id` / `connection_key` | the workspace connection that produced it |
| `external_id` | stable provider object id, unique per connection |
| `external_url` | user-facing source URL when available |
| `title` | display label, nullable but never synthesized as authoritative |
| `source_model` | record model that discovered the object, e.g. `ContentMetadata` |
| `source_action` | read action that produced content, e.g. `notion-page-content` |
| `source_updated_at` | provider freshness marker when available |
| `last_synced_at` | when Driftless last observed source metadata |
| `indexed_at` | when Driftless materialized the searchable content |
| `content_text` | normalized bounded text for search/retrieve |
| `content_digest` | idempotency and change detection |
| `citation_id` | stable citation handle returned by retrieve |
| `access_scope` | current visibility scope used to gate reads |
| `status` | `active`, `stale`, `deleted`, or `error` |
| `import_run_id` | audit/debug correlation for the materialization run |

Deletion and staleness are soft-state. If a source object disappears or the
connection loses access, the row is marked `deleted` or `stale`; it is not
physically removed by normal sync/import. Retrieve excludes deleted rows by
default and labels stale rows. A rebuild may replace rows idempotently by
`workspace_id + provider + connection + external_id`.

The import/index path must support preview/dry-run before writing. Preview shows
counts, bounded sample identities, estimated size, skipped reasons, and missing
setup. Execute performs idempotent upserts and records audit without logging page
text.

This lane requires storage/service work and can ship before retrieve consumes it.

### Lane C — retrieve over materialized connector content

Retrieve may search connector content only after Lane B materializes it. Retrieve
must not import Broker, Nango, provider clients, or live connector readers.

The detailed source, ranking, citation, freshness, budget, and failure contract
is defined in `docs/architecture/connector-retrieve-contract.md`. That contract
is the acceptance target for the retrieve implementation lane.

The retrieve extension should define:

- explicit source/provider filters;
- default behavior that remains Topics-first and provider-free;
- citation rendering from materialized provenance;
- freshness badges derived from sync/import state;
- trust labeling that distinguishes reviewed Knowledge from imported external
  source data;
- payload and result bounds;
- stale/deleted source behavior.

This lane is blocked on the import/index contract and storage path.

### Lane D — governed writes

Writes remain disabled until the governed write contract is implemented. A write
is not a normal capability becoming visible; it is a higher maturity level with
additional gates.

This lane extends the broker safety model in [[integration-broker]]: the broker
remains the execution boundary, criterion remains Driftless Knowledge, and Nango
remains provider plumbing. A write-capable connector must satisfy this section in
addition to the existing broker grant, rollout, audit, and bounded-invocation
rules.

A governed write requires:

- explicit provider/operation declaration;
- rollout gate and kill switch;
- human-owned principal or explicit external grant;
- criterion-before-write where risk-bearing;
- preview/diff before execution;
- idempotency key;
- correlation id;
- audit for preview and execution;
- typed provider errors;
- rate limits;
- rollback or compensating-action story where possible.

The first implementation may be a dark path or may remain blocked pending human
decision. No prod-visible write capability is enabled by default in this phase.

## Maturity mapping

- **L0 connected:** OAuth/auth exists and can be reconciled.
- **L1 capability directory:** Driftless explains what exists, what is ready, what
  is gated, and what is disabled.
- **L2 record models:** bounded provider records are discoverable and readable.
- **L3 document content:** bounded provider document content reads exist behind
  policy and identity gates.
- **L4 import/index:** connector content is materialized into Driftless-owned
  objects with provenance, freshness, citation identity, and access scope.
- **L5 retrieve over connector-backed index:** retrieve can search materialized
  connector content with explicit source filters, citations, freshness, and
  stable bounds.
- **L6 governed writes:** write operations exist behind grants, criterion,
  preview, idempotency, audit, and explicit rollout.

v2 primarily moves the existing wedge from L1/L3 into L4/L5 and designs the L6
gate without enabling writes accidentally.

## Explicit non-goals

- No new provider wedge in this phase.
- No live provider calls from context retrieve.
- No automatic Topic creation from connector reads.
- No implicit Collection import when a provider syncs.
- No broad Nango catalog enablement.
- No arbitrary provider scripts generated by agents.
- No prod-visible writes by default.
- No unbounded provider list/read operations.

## Kill switches

- `DRIFTLESS_BROKER_ENABLED=false`: broker endpoints disappear or return disabled
  errors; the API must boot without Nango env.
- `DRIFTLESS_BROKER_ROLLOUT=off`: external OAuth/MCP lane closes while internal
  operator access can remain available.
- Connector registry rollout: a capability can remain declared but not visible.
- Read-only connector policy: writes are hidden and rejected even if operation
  metadata exists.
- Future import/index rollout: materialization can be disabled while read-only
  records/page-content remain available.
- Future retrieve source flag: connector-backed retrieve can remain disabled while
  the index exists.
- Future write rollout: write preview/execution can remain disabled independently
  from read capabilities.

None of these switches delete provider data, Driftless records, Topics, or
materialized connector documents.

## Release sequencing

1. Contract and dashboard UX can ship first because they are read-only and explain
   existing capability state.
2. Import/index storage ships next, behind explicit preview/execute paths.
3. CLI/MCP import/index ships once preview and execute APIs exist.
4. Retrieve over connector content ships only after materialized objects exist and
   static tests prove retrieve imports no Broker/Nango/provider client.
5. Governed write preview can ship without execution.
6. Governed write execution remains dark or blocked until a human approves the
   first wedge and its rollout.
7. Docs, evals, and Knowledge write-back close the release.

## Staging gates

The staging gate must prove:

- dashboard build passes;
- capability directory still works in API/CLI/MCP;
- import/index preview is bounded and non-writing;
- import/index execute is idempotent and audited;
- retrieve over imported connector content is explicit, bounded, cited, and
  freshness-aware;
- default retrieve output remains stable and provider-free;
- write capabilities remain disabled or dark unless explicitly enabled;
- unsigned webhooks are rejected;
- no provider/Nango credential appears in output, logs, traces, docs, or audit
  detail.

## Human decisions

The following remain human-gated:

- whether materialized connector content lives in a new connector index table or
  reuses an existing operational substrate;
- whether imported connector content is visible by default in retrieve or only
  behind an explicit source/include flag;
- the first governed write wedge, if any;
- when a read-only beta becomes GA;
- when connector-backed retrieve is safe for production.

Agents may implement contracts and dark paths, but they must not silently decide
these product gates.
