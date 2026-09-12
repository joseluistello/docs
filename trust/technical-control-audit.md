# Technical control audit

Status: observed code audit, September 8, 2026.

This document records what the current repository actually enforces for
commercial intelligence, contact enrichment, and external-action readiness.
It is evidence for the Trust & Data Governance Pack; it is not a claim that a
provider, workflow, or legal basis is already approved.

## Executive finding

The current code has useful provenance and safety primitives for market
research and contact-path classification, but the contact-enrichment boundary
is not yet a legal/governance boundary. A user-triggered request is treated as
authorization to enrich records. The request does not carry a declared
purpose, authorization reference, source-rights acknowledgement, or
suppression state, and the persistence model does not retain enough metadata
to enforce provider-specific display/export/retention/deletion terms.

Therefore contact enrichment must remain behind the launch gates in
`launch-gates.md`. The public legal pages should describe it as a gated,
workspace-authorized capability until the controls below are implemented and
verified.

## Evidence matrix

| Area | Observed control | Gap or limit | Evidence | Gate |
|---|---|---|---|---|
| Enrichment entry point | Route is authenticated and workspace-scoped; records are explicitly selected and capped at 50 | Request has no purpose, authorization reference, source-rights acknowledgement, or policy version | `apps/api/src/radar/radar.controller.ts`, `apps/api/src/radar/dto/radar.dto.ts` | G2, G5 |
| User action | Enrichment is on-demand and credits are charged/compensated | The POST itself is treated as sufficient authorization; no durable authorization/audit record was found | `apps/api/src/radar/radar-enrichment.service.ts` | G2, G5 |
| Contact safety | Contact paths distinguish personal, role, and general endpoints; general endpoints are not promoted to personal | No suppression/opt-out check blocks enrichment or later use | `apps/api/src/radar/contact-path.ts` | G5 |
| Provider provenance | Resolver returns `provider`, `sources`, confidence, verification, and attribution | `sources` are not persisted by `enrichOneRecord`; general-mailbox fallback stores neither provider nor source | `apps/api/src/radar/ports/endpoint-verifier.port.ts`, `apps/api/src/radar/radar-enrichment.service.ts` | G3, G6 |
| Field rights | Entity enrichment has field-level provenance and freshness concepts | Contact endpoints persist no licence status, may-display/may-export decision, retention, observed-at, or deletion handle | `apps/api/src/radar/contact-path.ts`, `apps/api/src/radar/radar-enrichment.service.ts` | G3, G6 |
| Deletion | Contact data is written into collection record fields and `contact_path` | No contact-specific deletion/expiry/propagation hook was identified in the audited path | `apps/api/src/radar/radar-enrichment.service.ts` | G6 |
| External sending | `origin/staging` contains a verified Nylas send-only path with hosted Gmail/Outlook connection, scoped send authorization, suppression checks, and campaign dispatch | Beta remains intentionally limited to send-only; keep allowlist, human authorization, monitoring, and public scope alignment | `origin/staging` Nylas provider and email architecture; verified staging E2E | G2, G5 |

## Required control contract before enabling contact operations

The implementation should make these checks explicit and fail closed:

1. The actor selects a declared purpose and the UI records the authorization
   event, workspace, actor, selected records, policy version, and timestamp.
2. Every endpoint carries origin/provider, source URL or source identifier when
   available, verification state, confidence, attribution, rights status,
   allowed uses, retention/expiry, and a deletion or suppression handle.
3. A suppression/opt-out check runs before enrichment, export, draft creation,
   and any outbound send. A suppression result must be explainable without
   exposing unnecessary personal data.
4. Provider-specific terms are evaluated per field, not inferred from the
   provider name. Unknown rights remain blocked for display/export.
5. Deletion and expiry remove or quarantine contact data from records,
   indexes, exports, drafts, campaign providers, and audit-linked replicas as
   applicable. The system must retain only the minimum evidence needed to
   prove the action.
6. Any Smartlead or future outbound adapter must have a separate send
   authorization and unsubscribe/bounce synchronization contract. Enrichment
   permission is not send permission.

## Staging-report reconciliation

The current beta direction is Nylas, not Smartlead. Nylas connects Gmail or
Outlook and sends only campaigns that Brein has separately authorized. The
send-only E2E, OAuth behavior, and provider controls are verified for the beta.
Brein does not read, list, search, or manage the user's inbox or replies in this
scope. Staging also contains Tomba pilot governance and provider-lineage work.
Keep the beta allowlisted and do not broaden the scope without a new review.

## Scope boundary

This audit does not conclude that the current code violates a particular law.
It concludes that the product cannot presently evidence the controls needed
to make a transparent, rights-aware product claim for contact enrichment or
outreach. Legal copy, provider activation, and commercial launch should remain
conditioned on these technical controls and the underlying contracts/source
rights.
