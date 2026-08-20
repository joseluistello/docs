# Market data — the tool contract

This is the contract every market-data operation follows, across all four
surfaces that expose it (HTTP, MCP `driftless_market_data`, the CLI `market`
command, and the agent tool belt). It does not restate what each operation
searches for — that lives in [`semantic-api.md`](./semantic-api.md) and
[`commercial-intelligence-v1.md`](./commercial-intelligence-v1.md). This
document is the shape every one of them shares: what a success response
carries, what a refusal carries, and how pagination works — so a caller
learns the contract once and every operation follows it, rather than
re-discovering the same shape eleven times.

## The envelope

Every success response — search, get, aggregate, count, screen alike — is one
`MarketDataEnvelope<T>`:

```ts
interface MarketDataEnvelope<T> {
  schemaVersion: 'market-data/domain/1'
  requestId: string
  operation: MarketDataOperation
  interpretedRequest: InterpretedRequest   // the request AFTER normalization
  results: T
  page: PageInfo | null                    // null for a single-record read or a count
  coverage: CoverageDeclaration[]
  corpusBasis: CorpusBasis
  semanticWarnings: SemanticWarning[]
  provenance: Provenance[]
  diagnostics: Diagnostics
  searchFeedback?: OpportunitySearchFeedback  // opportunity search only
}
```

Every key in this envelope is **camelCase** — deliberately distinct from the
snake_case the rest of the platform (Knowledge, Collections, Projects) uses.
This is not an inconsistency to fix: it is the dialect the shipped market-data
contract already speaks (HTTP body, MCP tool result, the ChatGPT plugin), and
unifying it would break every existing consumer for no benefit to any of
them. See topic `market-data-surface-dialects`.

- **`interpretedRequest`** is what the layer actually ran, after normalizing
  the caller's input (a state name resolved to its code, a fuzzy municipality
  resolved to its canonical spelling). `normalizations` says what changed and
  why, so a caller can tell a normalized value from a literal one.
- **`results`** is the operation's own payload — a row array for a search, one
  object for a `get_*`/`count_*` read, a group array for an aggregate.
- **`page`** is `null` whenever the operation does not paginate (`get_supplier`,
  `get_opportunity`, `market_capabilities`, `count_suppliers`) — a count
  answers one exact integer, not a page of one.
- **`coverage`** and **`corpusBasis`** are what makes an answer honest: which
  published sources contributed, and which snapshot of the corpus this read
  saw. They are written by the platform layer and can never be authored by a
  model or a caller.
- **`semanticWarnings`** names a misreading this domain actively invites (an
  award is not a payment, a risk mark is not a conviction, a name is
  approximate identity) — never decoration, always attached by the layer.
- **`provenance`** says where each row was read, explicitly **not** that it is
  current or verified (`PROVENANCE_DISCLAIMER` rides every response that
  carries rows).

## Refusals

A refusal is never a bare 400. Every domain-specific rejection is a typed
`MarketDataException` carrying a `market_data` block alongside the platform's
own `code`/`message`/`request_id`:

```json
{
  "code": "VALIDATION_FAILED",
  "message": "This batch carries 60 rfcs, above the 50 this operation screens in one call.",
  "request_id": "req-1",
  "market_data": {
    "semantic_code": "batch_too_large",
    "why": "A batch screen answers one bounded scan, not an open-ended list. Serving more than 50 would mean either scanning unboundedly or silently dropping the RFCs past the ceiling — both are worse than telling you the ceiling up front.",
    "suggested_correction": "Split \"rfcs\" into batches of at most 50 and call once per batch.",
    "retryable": false,
    "recovery": { "action": "fix_arguments" }
  }
}
```

- **`why`** explains the misunderstanding, not just the rule — most refusals
  in this domain are a well-formed question about a field or shape that does
  not mean what the caller assumed, not a typo.
- **`suggested_correction`** is prose aimed at an LLM: the concrete next call
  that would work.
- **`recovery.action`** is the same fact, machine-readable, drawn from a
  closed four-value vocabulary so a caller can branch without parsing prose:
  `narrow_query`, `fix_arguments`, `restart_without_cursor`, `retry_backoff`.
  It is derived one-to-one from `semantic_code` — never set independently of
  it — so the machine field and the human-readable one can never disagree.
- **`retryable`** says whether trying again, unmodified, can help. It is
  `false` for every shape/value/vocabulary refusal (the identical call
  reproduces the identical refusal) and `true` only for the operational
  handful — timeout, unavailable, stale projection — where the world, not the
  request, is expected to change.

Recurring `semantic_code` values worth knowing before calling anything:

| `semantic_code` | Fires when | `recovery.action` |
|---|---|---|
| `query_too_broad` | A search or count carries no narrowing dimension — an unbounded scan of the corpus | `narrow_query` |
| `invalid_field_value` | A value is structurally wrong for its field (a malformed RFC, an empty batch) | `fix_arguments` |
| `batch_too_large` | A batch operation (`screen_risks`) carries more items than it screens in one call | `fix_arguments` |
| `invalid_cursor` | A cursor's filters don't match the query it's attached to | `restart_without_cursor` |
| `cursor_stale` | The corpus changed underneath a cursor mid-pagination | `restart_without_cursor` |
| `market_data_timeout` | The bounded statement timeout was hit | `retry_backoff` |
| `serving_projection_unavailable` | A read depends on a serving projection that has no active publication yet | `retry_backoff` |

`suppliers/count` and `risks/screen` both reuse `query_too_broad` and
`invalid_field_value`/`batch_too_large` respectively — no operation invents
its own one-off error vocabulary.

## Pagination — keyset, never offset

Every operation that returns more than one row (`search_*`, `aggregate_awards`,
`get_supplier_history`) pages with an opaque **keyset cursor**, never
`OFFSET`. `page.nextCursor` carries:

- the contract version, so a cursor from an older response shape cannot be
  resumed against a newer one,
- the corpus snapshot (`corpusBasis`) it was issued against, so pagination
  can never interleave two published snapshots,
- a digest of the filters (and, for `aggregate_awards`, of `comparePeriod`),
  so continuing with a *different* filter set is refused rather than served,
- the last row's (or group's) position in the total order.

Two distinct refusals come out of a broken cursor, because the correct
recovery differs: a **filter change** mid-pagination is `invalid_cursor` (the
caller changed something); a **corpus change** is `cursor_stale` (nobody's
mistake — the published data moved). Both recover the same way: restart
without a cursor.

`page.hasMore`/`page.returned` are computed from an honest `limit + 1` read,
never inferred from `returned === limit` — a corpus that holds exactly a
multiple of the page size would otherwise produce a phantom empty last page.

## The eleven operations

| Operation | Route | Paginates | Notes |
|---|---|---|---|
| `market_capabilities` | `GET capabilities` | no | corpus-observed values, read fresh every call |
| `search_suppliers` | `POST suppliers/search` | yes | needs ≥1 narrowing dimension |
| `get_supplier` | `GET suppliers/:sourceSlug/:sourceRecordId` | no | strong key, no search |
| `count_suppliers` | `POST suppliers/count` | no (`page: null`) | same narrowing rule as `search_suppliers`; returns one exact integer, never an approximation |
| `search_opportunities` | `POST opportunities/search` | yes | hybrid or lexical strategy |
| `get_opportunity` | `GET opportunities/:id` | no | |
| `search_awards` | `POST awards/search` | yes | one currency + one amount scope |
| `get_supplier_history` | `POST awards/history` | yes | one RFC's awards |
| `aggregate_awards` | `POST awards/aggregate` | yes (groups) | optional `compare_period` — see below |
| `search_risks` | `POST risks/search` | yes | one RFC or entity name at a time |
| `screen_risks` | `POST risks/screen` | no (batch, not a page) | 1–50 RFCs, one bounded `rfc = ANY($1)` scan |
| `search_permits` | `POST permits/search` | yes | |

### `count_suppliers`

Same bounding rule as `search_suppliers`: at least one of `query`, `state`,
`scian_codes`, `source_slugs` or `rfc` is required, or the call is refused
with `query_too_broad` — an exact count of the whole 6.1M-row directory is not
a narrower question than a search for it. `results` is `{ count: number }`,
computed with `SELECT count(*)`, never sampled or estimated. If the count
itself cannot finish inside the statement timeout, the existing
`market_data_timeout` refusal answers — this operation never substitutes an
approximation for a count it could not finish computing.

### `screen_risks`

A batch of 1–50 RFCs, screened for published adverse marks in **one** bounded
`rfc = ANY($1::text[])` statement instead of one `search_risks` call per RFC.
`results` is one entry per requested RFC, **in the order requested**,
including an RFC with zero marks — that is a valid, coverage-backed answer for
that RFC alone, never evidence about any other RFC in the same batch. A batch
above 50 is refused with `batch_too_large` (`recovery.action: fix_arguments`)
rather than silently truncated at the tail; a truncated batch that drops RFCs
without saying so is exactly the confident-wrong-answer failure this contract
exists to avoid.

### `aggregate_awards` with `compare_period`

`compare_period` runs a period-over-period comparison inside the **same**
grouped statement — never a second query. Give `compare_period` as a second,
closed date range (period A) alongside the request's own `from_date`/`to_date`
(period B, still the only date bound when `compare_period` is omitted). Every
returned group then additionally carries:

```ts
periodA: { awardCount: number; totalAmount: string }
periodB: { awardCount: number; totalAmount: string }   // identical to the top-level awardCount/totalAmount
deltaAmount: string                                     // periodB.totalAmount − periodA.totalAmount
deltaPct: number | null                                 // (periodB − periodA) / periodA, as a fraction; NULL when periodA's total was zero
```

`deltaPct` is computed in Postgres, in `numeric`, and cast to `float8` only
after the exact division already decided whether the denominator was zero —
never recomputed in JS from the `::text` totals, and never `Infinity` or a
fabricated number when period A totalled zero. Ranking and pagination order
are always period B's: `compare_period` compares against the ranking, it
never changes what is being ranked. A cursor issued without `compare_period`
is invalidated (`invalid_cursor`) if resumed with one, and vice versa — the
filters digest a cursor carries includes `comparePeriod`.

## What is out of scope here

Per-operation filter vocabularies, source-registry membership meaning, the
Web Evidence boundary and the ChatGPT-facing submission live in
[`semantic-api.md`](./semantic-api.md) and
[`commercial-intelligence-v1.md`](./commercial-intelligence-v1.md). This
document only fixes the shape every operation shares.
