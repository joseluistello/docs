# Connector Capability Platform

Driftless treats each external integration as a governed capability directory, not
as a loose list of provider scripts. The directory answers the agent's first
question before any action: what exists, what is healthy, what is allowed, what is
disabled, and what should I do next?

Nango remains the auth vault, provider runtime, webhook source, and record cache.
Driftless owns the product contract: tenancy, rollout, grants, read-only policy,
bounded invocation, status copy, audit, and the agent-facing explanation.

## Why the directory exists

The Notion wedge proved that OAuth alone is not enough. A connection can be
authorized while its sync is still starting, its record model is empty, its custom
read action is not set up, or its writes must be hidden even in a permissive
staging policy. Agents need one structured answer instead of guessing from Nango's
dashboard, catalog, or operation names.

The capability directory is that answer. It is served from Driftless's reviewed
registry plus persisted connection health. It does not list provider data, page
text, credentials, or raw tokens.

## Source Of Truth

Provider catalog:
Capabilities already present in Nango or the provider ecosystem. Driftless can
discover them, but it never auto-enables the broad catalog.

Connector registry:
`apps/api/src/broker/connector-registry.ts` declares the product-approved
capabilities for each provider. Unknown providers fail closed. Registered stubs can
exist at L0/L1 without bootstrapping any sync or action.

Source-controlled custom functions:
Custom Nango functions live under `apps/api/src/integrations/nango/**` and are
reviewed code. The backend deploys only versioned source from the repo. Agent
runtimes do not generate scripts, patch provider code, or deploy arbitrary
functions.

Provisioning:
Connection confirm/reconnect bootstraps the registry's rollout-visible read
capabilities idempotently. Catalog templates and custom functions use different
deployment kinds; confusing those paths is a platform bug.

Invocation:
A capability is usable only when it is registry-declared, connected, provisioned
where needed, healthy, rollout-visible, grant-allowed for the caller, effect-
compatible with connector policy, and bounded.

## Capability Types

`sync`:
A read-only provider-to-Nango mirror, such as Notion `content-metadata`.

`record_model`:
A bounded read surface over records produced by a sync, such as
`ContentMetadata`.

`read_action`:
A bounded, idempotent live provider read, such as Notion page content.

`document_content`:
A normalized document shape for citeable content. This is a source-data shape, not
a Driftless Topic.

`write_policy`:
The explicit statement that writes are disabled in v1. Future writes require a
separate governed write phase.

## Status Vocabulary

Capabilities use provider-general states:

- `declared`
- `deploy_pending`
- `deployed`
- `deploy_failed`
- `sync_starting`
- `syncing`
- `ready`
- `empty`
- `needs_reconnect`
- `gated`
- `disabled`
- `unsupported`

Status is derived from the registry declaration, connection health, sync
bootstrap status, read-action bootstrap status, sync health, record model
availability, rollout, grants, and read-only policy. It is intentionally plain
language: no Nango template/function/deploy jargon should leak into user-facing
next actions.

## Maturity Levels

L0 connected:
OAuth/auth state exists and Driftless can show reconnect/setup status.

L1 capability directory:
The provider is declared in the registry and visible as a governed connector, but
may not expose live records or content yet.

L2 record models:
The connector exposes bounded record reads from synced models.

L3 document content:
The connector exposes bounded, citeable document content reads.

L4 import to Collections:
Source records can be mapped into Driftless Collections. Collections own schema,
records, and anchors after import.

L5 retrieve over connector-backed index:
Connector-backed documents participate in a governed retrieval index. This is
live as an explicit, opt-in flow: `broker index <provider>` (preview, then
execute) materializes bounded documents into Driftless-owned
`connector_documents`, and retrieve reads them only when the caller passes
`sources:["connectors"]`. Default retrieve stays Topics-only; retrieve never
calls a provider live.

L6 governed writes:
Write capabilities are enabled only after explicit policy, grants, idempotency,
audit, and product UX exist. Writes are disabled before that phase.

## Tool Synthesis (MCP)

Ready read capabilities are synthesized into first-class MCP tools per
workspace: connect Notion and `driftless_notion_records` /
`driftless_notion_page_content` appear in `tools/list`; connect a records-only
provider and its `driftless_<provider>_records` tool appears — with no new tool
code. Rules, enforced by tests:

- Only capabilities with status `ready` and effect `read` synthesize. A write
  or `write_policy` never becomes a tool, even if a payload claims `ready`.
- Tool descriptions are fixed templates plus charset-validated criterion slugs.
  Upstream free text (capability descriptions, provider payloads) is never
  interpolated — tool-description injection has no vector.
- Input schemas are fixed per kind with the bounds in the schema (records
  `limit ≤ 50`, content `maxBytes ≤ 12000`), and clamped again at dispatch.
- Dispatch is a closed enum onto existing broker routes; a new content read
  requires a reviewed mapping, mirroring the registry's own rules.
- Bounded and fail-open: at most 20 synthesized tools, deterministic order,
  appended after the static registry; any broker failure yields the static
  `tools/list` unchanged. Gated by `DRIFTLESS_MCP_TOOL_SYNTHESIS` (default: on
  in staging with the broker, off in production until explicitly enabled).

## Agent Contract

Agents discover capabilities before invoking them. They should prefer:

1. List connections.
2. Read the provider capability directory.
3. Pick a `ready` read capability.
4. Use the bounded read hint from the directory.
5. Stop or ask for setup when the directory reports `empty`, `needs_reconnect`,
   `gated`, `deploy_pending`, or `deploy_failed`.

Agents do not author scripts. They do not inspect Nango dashboards. They do not
guess whether a model or read action exists. They call the Driftless broker.

## Current Product Boundary

Notion is the first L3 wedge:
`content-metadata` sync, `ContentMetadata` records, `notion-page-content` read
action, and `notion_page` document content. Writes are disabled.

HubSpot is declared as the first L2 (records-only) wedge: one read-only sync
from Nango's catalog, no content reads, no writes. It ships at rollout
`internal` until its Nango template/model names are verified against the
catalog in staging; promoting to `beta` is the explicit go-live act. A
mismatched template name surfaces as a recorded sync-bootstrap failure on the
connection status — never a crash.

Google Drive and Google Docs may be declared as L1 stubs to prove the registry is
platformic. A stub must not create routes, deploy functions, start syncs, or claim
ready records/content.

There is no default `context retrieve` over connector content. Connector data is
external source data; it reaches retrieve only after the explicit index step
(`broker index`) and only when the caller opts in with `sources:["connectors"]`
(results carry `trust:"external"`, a citation, and freshness). This avoids
silently changing core retrieval latency, trust semantics, and citation behavior.

There are no arbitrary runtime scripts. Creating or changing a custom Nango
function is a reviewed code change plus a registry declaration.

There are no writes. Read-only connectors hide write operations from listing and
search and reject write invocation even in staging open mode.

## Adding A Provider

Start at the lowest honest maturity level.

1. Add a registry entry with provider id, display name, rollout, mode, required
   scopes, health dependencies, and maturity.
2. Declare only reviewed capabilities.
3. If adding a custom read action, commit its Nango function source and declare its
   deployment kind.
4. Add capability-status tests before wiring CLI/MCP.
5. Add eval requirements for required capabilities and forbidden effects.
6. Run staging live gates before main/prod.

The provider should become more useful by moving through maturity levels, not by
special-casing product behavior.
