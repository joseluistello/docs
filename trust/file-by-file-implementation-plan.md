# File-by-file implementation plan

This is the handoff for the coding agent. It is based on the current
repository layout observed in `apps/api`, `apps/web`, and `libs/db`. It is
intentionally narrow: no new package, no new transport, no broad refactor.

## Slice A — Provenance and rights

### Modify

- `libs/db/src/entities/record.entity.ts`
  - Keep dynamic customer fields in `fields`.
  - Extend `field_meta` or add a dedicated relation for contact endpoint
    rights; do not hide compliance state in an untyped string.
- `apps/api/src/radar/contact-path.ts`
  - Add the logical provenance/rights shape to `ContactEndpoint`.
  - Preserve the distinction between personal, role, and general endpoints.
  - Keep `assertNoGeneralAsPersonal` as a domain invariant.
- `apps/api/src/radar/ports/endpoint-verifier.port.ts`
  - Extend `ResolvedEndpoint` only with metadata the adapter can substantiate.
  - Never synthesize license approval from provider identity.
- `apps/api/src/radar/radar-enrichment.service.ts`
  - Persist `sources`, provider, observed time, verification, attribution, and
    policy decision.
  - Preserve fallback provider/source instead of writing null by default.
  - Reject or quarantine unknown rights according to policy.
- `apps/api/src/radar/radar.module.ts`
  - Wire the policy/provenance service through existing module boundaries.

### Add

- `libs/db/src/entities/contact-endpoint-provenance.entity.ts` if a normalized
  table is selected.
- `libs/db/src/entities/provider-policy.entity.ts`.
- `libs/db/src/migrations/<timestamp>-contact-governance.ts`.
- `apps/api/src/radar/contact-governance.service.ts`.
- `apps/api/src/radar/contact-governance.service.spec.ts`.

## Slice B — Authorization ledger

### Reuse and modify

- `libs/db/src/entities/audit-log.entity.ts`
  - Continue using it for immutable action evidence, but do not put raw emails,
    message bodies, OAuth data, or full audience payloads in `detail`.
- `apps/api/src/audit/audit.service.ts`
  - Keep ordinary audit best-effort behavior for non-blocking telemetry.
  - Authorization creation must use a transactional, fail-closed persistence
    path; an audit write failure cannot silently authorize a sensitive action.
- `apps/api/src/radar/radar.controller.ts`
  - Expand the enrichment DTO with a bounded purpose/policy acknowledgement or
    resolve an authorization before calling the service.
- `apps/api/src/radar/dto/radar.dto.ts`
  - Add enum validation; do not accept arbitrary legal claims from clients.
- `apps/api/src/radar/radar-enrichment.service.ts`
  - Require a valid enrichment authorization before provider calls.

### Add

- `libs/db/src/entities/data-authorization.entity.ts`.
- `apps/api/src/authorization/authorization.service.ts`.
- `apps/api/src/authorization/authorization.module.ts`.
- `apps/api/src/authorization/dto/create-authorization.dto.ts`.
- Tests for replay, expiry, revocation, workspace isolation, and action
  separation.

## Slice C — Suppression

### Add

- `libs/db/src/entities/suppression-entry.entity.ts`.
- `apps/api/src/suppression/suppression.service.ts`.
- `apps/api/src/suppression/suppression.module.ts`.
- `apps/api/src/suppression/suppression.controller.ts` for authorized human
  management only.
- `apps/api/src/suppression/suppression-policy.spec.ts`.

### Integrate

- `radar-enrichment.service.ts`: check before provider calls.
- export service/controller: check before materializing output.
- future campaign/send service: check at final execution time.
- `apps/api/src/email/unsubscribe.controller.ts`: map unsubscribe events to a
  suppression entry where the event is attributable to a workspace.

Do not make suppression dependent on a vendor API being available. Local
suppression must block first; provider synchronization is a secondary action.

## Slice D — Retention and deletion

### Modify

- `apps/api/src/retention/retention.job.ts`
  - Add contact expiry and provider-deletion work only after the data model and
    provider contracts exist.
  - Make runs idempotent and report unresolved provider deletions.
- `apps/api/src/collections/records.service.ts`
  - Route contact deletion/expiry through one policy-aware operation.
- `apps/api/src/export/export.service.ts`
  - Keep exports scoped and add governed contact fields only when permitted.
- `apps/api/src/export/export.controller.ts`
  - Require/export an explicit export authorization for sensitive contact data;
    preserve current owner/admin and human-session checks.

### Add

- `apps/api/src/retention/contact-retention.service.ts`.
- `apps/api/src/retention/contact-deletion.service.ts`.
- Tests covering record fields, serialized paths, indexes, exports, drafts,
  campaign references, and provider failures.

## Slice E — Google data

### Inspect and modify

- `apps/api/src/integrations/integrations.service.ts`.
- `apps/api/src/integrations/nango.service.ts`.
- `libs/db/src/entities/oauth-token.entity.ts`.
- existing connection/revocation controllers and retention paths.

Required behavior:

- scope catalog per feature;
- incremental consent;
- token revocation and deletion;
- no copy from private Google data into shared commercial records;
- audit of connection, use, and disconnect without logging contents.

## Slice F — Frontend

The coding agent should first locate the current Radar collection UI before
editing. The required surfaces are:

- enrichment confirmation;
- export confirmation or blocked-field explanation;
- send confirmation when a send surface exists;
- provider/Google connection disclosure;
- provenance detail view;
- suppression/opt-out state.

Do not add a global consent wizard. Use progressive confirmation at the action
boundary and link to Privacy/Terms.

## Explicitly out of scope for the first implementation

- automatic legal-basis selection per contact;
- a generic policy engine for every product feature;
- a new queue/transport/cache;
- activation of Smartlead, Hunter, or Tomba without provider evidence. Smartlead is legacy-only; the active beta sender is Nylas and remains send-only.
- generalized CRM campaign automation;
- claims of regulatory certification.

## Coding-agent handoff checklist

Before opening a PR, the coding agent must provide:

1. migration list and rollback notes;
2. changed files mapped to slices above;
3. tests for every acceptance-test row;
4. proof that raw contact data is absent from audit details/logs;
5. provider-policy fixtures for approved, restricted, unknown, and blocked;
6. deletion and suppression integration evidence;
7. full harness result, including unrelated baseline failures separately.
