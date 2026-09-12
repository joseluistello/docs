# Trust & Data Governance — Implementation Blueprint v1

Status: implementation specification. This document describes the minimum
product and API controls required before enabling contact enrichment,
exportation, Google data workflows, or outbound sending as governed
capabilities.

## Objective

Make every sensitive action explainable and reversible without adding a legal
questionnaire to normal product usage.

The system must distinguish four things:

1. discovering a commercial signal;
2. enriching a record;
3. exporting data from Brein;
4. sending an external communication.

No action grants permission for the next action.

## Delivery order

| Slice | Deliverable | Release condition |
|---|---|---|
| A | Provenance and rights metadata | Every persisted contact endpoint has origin and rights state |
| B | Authorization ledger | Enrichment, export, and send have independent auditable authorizations |
| C | Suppression service | Opt-outs and bounces block all downstream actions |
| D | Retention/deletion | Contact data expires and deletes across derived surfaces |
| E | UX and public disclosures | User-facing copy matches active capability flags |
| F | Provider activation | A provider is enabled only after its evidence and tests pass |

## Product invariants

- Unknown rights fail closed for display/export/contact.
- A general mailbox is never represented as a personal endpoint.
- Enrichment authorization never authorizes sending.
- A suppression match takes precedence over confidence, credits, or campaign state.
- Provider adapters cannot activate a provider whose register row is not
  approved.
- Google private data cannot become a shared commercial contact dataset.
- A public source is not automatically a redistribution license.
- Every externally visible claim must be traceable to stored evidence or be
  labeled as an inference.

## Proposed implementation boundaries

Keep the first implementation in the existing radar and platform service
boundaries. Do not create a new package or a generic caching layer.

- `apps/api/src/radar/`: contact provenance, authorization checks, enrichment
  policy, and contact-path persistence.
- Existing audit/event service: immutable authorization and action events.
- Existing records/collections service: record updates and deletion hooks.
- Existing provider configuration: provider approval and policy version.
- `apps/web/`: confirmation modals, blocked states, provenance display, and
  policy links.
- `docs/trust/`: policy, provider, source, and acceptance evidence.

## Definition of done

The implementation is ready for controlled activation only when the acceptance
tests in `acceptance-tests.md` pass and the launch gates in `launch-gates.md`
are marked with evidence links. Documentation alone is not sufficient.

The repository-specific handoff is in `file-by-file-implementation-plan.md`.
