# What the ResearchReport does not publish yet

The `/chat` result renders one record table — opportunities. It renders no
supplier table and no market-history table, and it exports no renderer for
either. This document is why, and what would have to land for each one.

The rule behind it: a table over an array that is always empty is a promise the
contract cannot keep. It reads as a feature with no data rather than as a
feature that does not exist, and it teaches the reader that empty is normal.

## The gap, exactly

`apps/api/src/cognitive/market-research/research-report.contract.ts` publishes:

```
answer · facts[] · inferences[] · opportunities[] · recommendedActions[]
evidence[] · coverage · warnings[] · errors[] · queryAudit[] · metrics
```

There is no `suppliers` and no `historicalRecords`. The client's
`ResearchReportView` declares `suppliers: SupplierResult[]` and
`history: MarketHistoryResult[]`, and `adapters.ts` reads them from
`raw['suppliers']` / `raw['history']` — a forward-compatible read, not a
hard-coded empty. The day the server publishes either key it arrives typed and
parsed. Until then both are `[]` on every run.

This is the same pair listed as `suppliers-in-report` and
`history-rows-in-report` in `BACKEND_GAPS` (`intelligence/phases.ts`).

## Minimum structure each renderer needs

Neither renderer can be written against prose. A supplier row inferred from the
answer text would be a structure the run never produced, attributed to a source
that never published it — which is the failure the whole evidence model exists
to prevent.

### `suppliers[]` — for a supplier table

| Field | Why the table needs it |
|---|---|
| `identityKey` | a stable row id; without it selection moves onto a different record when rows stream in |
| `displayName` | the row's subject |
| `observedKind` | an establishment and a registered supplier are different claims |
| `location` | the second column anyone scans |
| `activity` | what they actually do, as declared by the source |
| `contactSummary` `{ count, displayable, note }` | a contact that exists but may not be shown is not the same as no contact, and the table must not imply otherwise |
| `matchExplanation` + `matchedFields[]` | why this row is here at all — the column that makes the result checkable |
| `evidenceIds[]` | so a row opens its own evidence without a client-side join through facts |

### `historicalRecords[]` — for a market-history table

| Field | Why the table needs it |
|---|---|
| `id` | stable row id |
| `supplierName` (+ `supplierRfc` when published) | the subject |
| `buyer` | the counterparty — the whole point of a history row |
| `awardRef` / `contractNumber` | what the row refers to, so it can be looked up |
| `amount` (decimal **string**) | amounts exceed float precision; a number here loses cents on large contracts |
| `currency` **and** `amountScope` | an amount without both cannot be grouped or totalled, and grouping across either boundary is the error this domain most often makes |
| `awardDate` | ordering and period |
| `evidenceIds[]` | same reason as above |

`amount`, `currency` and `amountScope` must travel together or not at all. The
grouping helper that already exists (`research/domains.tsx`, `groupAwards`)
refuses to subtotal a group where any amount is missing, and it needs the scope
to know which rows may be added at all.

## When tabs may return

`/chat` has no tabs. They may return **only** when the report carries at least
two typed, populated domain collections in the same run — at which point a tab
is a way to move between things that exist. A static tab per domain, present
whether or not that domain has rows, is a domain selector wearing a different
name: it makes the reader choose a domain before seeing anything, which is the
manual-console paradigm this surface was built to replace.
