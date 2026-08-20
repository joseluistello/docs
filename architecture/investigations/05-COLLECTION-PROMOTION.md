# Phase 5 — Promote Investigation Rows to a Collection

## Goal

Turn verified Investigation candidates into durable operational records through an explicit,
reviewable human action.

## Product flow

1. User selects one or more candidate rows.
2. User chooses an existing Collection or creates one through the normal Collection UI.
3. Driftless previews field mapping, conflicts and rows that will be skipped.
4. User confirms.
5. Server performs an idempotent batch promotion and returns created, updated, skipped and failed
   counts with per-row reasons.

No model silently writes to a Collection. No background Investigation completion auto-promotes.

## Contract

Add a typed promotion request containing:

- investigation id;
- target collection id;
- selected candidate ids;
- explicit source-field -> collection-field mapping;
- idempotency key;
- conflict policy from a closed enum (`skip`, `update_blank_fields`).

Do not support destructive overwrite in the first slice.

Each created/updated record retains provenance:

- source investigation id;
- candidate id;
- evidence ids or a durable link back to the Investigation;
- promotion timestamp and actor;
- resolved entity id when present.

Use existing Collection and Entity service seams. Do not write tables directly from the controller.

## Identity and idempotency

Preferred identity order:

1. resolved entity id;
2. normalized company domain;
3. strong public identifier when the source contract permits it;
4. deterministic candidate id scoped to the source Investigation.

Never merge companies on fuzzy name alone. Replaying the same idempotency key or promoting the same
candidate to the same Collection must not create another record.

## Governance

- Human identity required.
- Workspace and Collection authorization required.
- Read the target Collection criterion before presenting/performing mapping.
- Respect Collection schema and lifecycle stages.
- Default new records to the Collection's valid initial stage.
- The model may suggest a mapping; code validates and the human confirms it.

## Acceptance

- Preview and final mutation agree on created/updated/skipped counts.
- Retry after a network timeout is safe.
- Mixed success reports every row; it does not roll back valid independent rows unless existing
  Collection semantics require transactionality.
- Promoted records link back to evidence without copying unbounded source payloads.
- Cross-workspace, stale mapping and invalid-stage cases fail closed.

## Rollback

Disable the promotion action. Existing promoted records remain ordinary Collection records with
provenance; no special reader is required.

