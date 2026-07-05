# Connector capability directory

How Driftless models what an external connector (Notion, Drive, …) can do, and the
boundary that keeps agents from inventing provider scripts at runtime.

This is an internal architecture/operator doc (developer-facing).

## The five layers

1. **Provider catalog** — capabilities that already exist in Nango / the provider's
   catalog (prebuilt templates). These are *discovered*, not authored. Driftless never
   auto-enables the broad catalog.

2. **Connector registry** (`apps/api/src/broker/connector-registry.ts`) — the
   **product-approved** capabilities Driftless declares for a provider: read-only sync
   bootstrap, read actions, write actions (declared, never enabled in v1), record
   models, document shapes, rollout, policy. A provider not in the registry is
   fail-closed — the broker bootstraps and exposes nothing for it.

3. **Nango function sources** (`apps/api/src/integrations/nango/**`) — **source-
   controlled custom capabilities**. Each is a reviewed file (e.g.
   `notion/actions/notion-page-content.ts`) authored against the Nango `createAction`
   SDK. It runs in **Nango's runtime**, not in the Driftless API process, and is
   excluded from the API TypeScript build.

4. **Provisioning** — on connection confirm/reconnect the backend deploys the
   registry's declared, rollout-visible capabilities, each by its **deployment kind**:
   - `catalog_template` → `POST /functions/deployments` with `type:'template'`.
   - `custom_function` → read the versioned source from disk and
     `POST /functions/deployments` with `type:'function'`, `function_name`,
     `function_type`, `code`.
   Idempotent (2xx or 409 = success); a failure (including a missing source file) is
   recorded as connection status and never breaks the connection.

5. **Invocation** — runtime calls a capability **only after** rollout + grant + policy
   pass, and only if the capability is registry-declared and rollout-visible. For a
   registered **read-only connector**, write operations are additionally hidden from
   listing/search and rejected on invoke — even in `open` policy mode and even if a
   write was materialized from an older catalog bootstrap (the connector read-only cap,
   stronger than operation-policy mode).

## The deployment-kind bug this fixed

v1 deployed the custom `notion-page-content` action as `type:'template'` (the catalog
path). Nango returned `404` (no such prebuilt template), so the page-content read
`500`'d. A custom Driftless function MUST be deployed as `type:'function'` with its
source as `code`. The registry now carries an explicit `deployment.kind` per read
action so the backend never confuses the two again.

## Hard rule — agents cannot author scripts

Normal agents **discover and invoke** approved capabilities. They **never** author or
deploy provider scripts at runtime. Creating or changing a Nango function is a reviewed
**code change**: a new file under `apps/api/src/integrations/nango/**` plus its registry
declaration, merged via PR. The backend only deploys the versioned source it reads — it
never generates code ad hoc.

See also: `apps/api/src/integrations/nango/README.md` (the function-source boundary),
`docs/integrations/notion.mdx` (the Notion connector + operator runbook).
