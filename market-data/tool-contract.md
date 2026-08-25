# Market data — the tool contract

This is the contract every market-data operation follows, across all four
surfaces that expose it (HTTP, typed MCP tools, the CLI `market`
command, and the agent tool belt). It does not restate what each operation
searches for — that lives in [`semantic-api.md`](./semantic-api.md) and
[`commercial-intelligence-v1.md`](./commercial-intelligence-v1.md). This
document is the shape every one of them shares: what a success response
carries, what a refusal carries, and how pagination works — so a caller
learns the contract once and every operation follows it, rather than
re-discovering the same shape eleven times.

## Two projections of one envelope

Everything below describes the canonical envelope used by the internal belt,
audit record, licence enforcement and support. HTTP, OAuth, MCP and CLI always
receive the abstracted projection; they never opt into canonical provenance.

A surface a **model** reads (Chat, Research, every MCP tool) reads the same
envelope through the *abstracted* projection instead
(`apps/api/src/market-data/services/model-exposure.ts`). Publisher identity —
`sourceSlug`, `sourceRecordId`, `publisher`, `sourceUrl`, the per-publisher
`membershipMeaning` — is replaced by an evidence CATEGORY derived from the
warehouse relation, an opaque `record_ref` for the detail follow-up, a
`record_fingerprint` that recognizes a repeated row (keyed, one-way, 128 bits;
it reveals equality by design and never identity, and it survives a primary-key
rotation for as long as references minted before it still resolve), and a
per-category
membership meaning that keeps every caveat the publisher-specific wording
carried. Coverage regroups by category and counts only licensed rows; the page
cursor is sealed, because a base64url cursor whose sort key carries the
publisher row key is opacity by convention only.

Everything else in this document is IDENTICAL under both: the same operations,
the same refusals, the same pagination contract, the same semantic warnings and
the same coverage semantics. The projection changes who a row says published
it, never what the row means.

### The source filter, and what would bring it back

`source_slugs` is accepted on the canonical route and is absent from every
model-facing surface. There is deliberately no abstract replacement for it.

A "kind of record" filter is the natural one — screening for membership in an
export register, a licence register or an R&D register is a real commercial
question — but the distinction that makes it useful is a property of each
SOURCE, and this layer has no per-source metadata to read it from. Deriving it
from a list of slugs frozen inside Driftless would be a source-dependent value
invented outside the corpus (R3b), which is why the filter is absent here rather
than simulated.

**The requirement:** a column on `market_data.sources` classifying each source
into a small, stable set of record kinds — the same table `dataset_coverage`
already references, and the same place the per-source membership meanings in
`services/source-registry.ts` want to live. With that column, coverage carries
the kind per source and the filter becomes an ordinary exact filter over corpus
values. Until then, membership screening is a search rather than a filter, and
the runtime skill says so.

Which projection a response uses is decided by the server boundary and is not a
request parameter. HTTP always applies the abstracted projection. The
`X-Driftless-Model-Exposure: abstracted` header remains a harmless compatibility
marker for MCP and CLI clients; no header value can request canonical provenance.

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
snake_case the rest of the platform (Knowledge and Collections) uses.
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

## The fourteen operations

| Operation | Route | Paginates | Notes |
|---|---|---|---|
| `market_capabilities` | `GET capabilities` | no | corpus-observed values, read fresh every call |
| `search_suppliers` | `POST suppliers/search` | yes | needs ≥1 narrowing dimension |
| `get_supplier` | `GET suppliers/:sourceSlug/:sourceRecordId` | no | strong key, no search |
| `count_suppliers` | `POST suppliers/count` | no (`page: null`) | same narrowing rule as `search_suppliers`; returns one exact integer, never an approximation |
| `compare_segments` | `POST suppliers/compare-segments` | no (bounded matrix) | at most 5 segments × 10 states and 50 cells; one observed kind |
| `search_opportunities` | `POST opportunities/search` | yes | hybrid or lexical strategy |
| `get_opportunity` | `GET opportunities/:id` | no | |
| `search_awards` | `POST awards/search` | yes | one currency + one amount scope; `cog_partidas` filters by SHCP object-of-expense code overlap |
| `get_supplier_history` | `POST awards/history` | yes | one RFC's awards |
| `aggregate_awards` | `POST awards/aggregate` | yes (groups) | optional `compare_period` — see below; `group_by: cog_partida`/`cog_capitulo` can overcount — see below |
| `search_risks` | `POST risks/search` | yes | one RFC or entity name at a time |
| `screen_risks` | `POST risks/screen` | no (batch, not a page) | 1–50 RFCs, one bounded `rfc = ANY($1)` scan |
| `search_permits` | `POST permits/search` | yes | |

### `count_suppliers`

Same bounding rule as `search_suppliers`: at least one of `query`, `state`,
`scian_codes` or `rfc` is required (the canonical route also accepts
`source_slugs`), or the call is refused
with `query_too_broad` — an exact count of the whole 6.1M-row directory is not
a narrower question than a search for it. `results` is `{ count: number }`,
computed with `SELECT count(*)`, never sampled or estimated. If the count
itself cannot finish inside the statement timeout, the existing
`market_data_timeout` refusal answers — this operation never substitutes an
approximation for a count it could not finish computing.

### Internal supplier synthesis

The internal belt accepts 1–50 opaque references returned by supplier search, resolves and
deduplicates them server-side, and reads canonical detail in one set-based
statement. Output preserves first-seen order. Missing, forged and unavailable
references deliberately share `invalid_or_unavailable`; the operation never
reveals which condition applied. Contact values remain subject to the same live
licence boundary as `get_supplier`.

### `compare_segments`

Accepts 1–5 text-defined segments, 1–10 Mexican states, one required
`observed_kind`, and at most 50 cells. One parameterized statement returns the
ordered matrix, optionally including observations with a published contact
channel. Every number is an observation count, never unique-company count, TAM
or purchase intent.

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

Each RFC result carries its own `warnings` code array. A zero-mark RFC has
`warnings: ["zero_results_with_coverage"]` only when the envelope declares
effective risks coverage (at least one source with `licensedForDisplay: true`
and `visibleRows > 0`); an RFC with marks has `warnings: []`. With no declared
effective coverage, the RFC warning stays empty and the `coverage` declaration
is the explicit limitation. The envelope repeats `zero_results_with_coverage`
only when **every** requested RFC had zero marks **and** coverage is effective.

### RFC dossier protocol (composition, not an operation)

There is no `get_party_dossier` route or tool. An RFC dossier is a reproducible
caller-side composition over existing operations:

```text
RFC
→ get_supplier_history(supplier_rfc: rfc, currency, amount_scope) when a comparison basis is known
→ search_awards(supplier_rfc) when contract rows are needed
→ screen_risks(rfcs: [rfc])
→ search_suppliers(rfc) as a directory observation probe
→ do not call search_permits from this RFC alone: the current covered permit
  sources publish no holder RFCs
→ search_permits(holder_name) only after a verified published name exists
```

`holder_rfc` remains an accepted strong-identity filter for a future permit
source that publishes it; it is not a current award-RFC-to-permit bridge.

The caller keeps results separate and reports identity coverage explicitly:

```json
{
  "identityCoverage": {
    "awards": "strong_rfc",
    "risks": "strong_rfc",
    "directory": "not_observed",
    "permits": "not_attempted_without_verified_name"
  }
}
```

`not_observed` and `not_attempted` are coverage states, not negative claims
about the party. Directory rows remain observations; permits found by name are
candidates, not silently consolidated identities.

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

### `search_awards` and `aggregate_awards` on `cog_partida`

`cog_partidas` on `search_awards` is 1–20 five-digit SHCP "partida específica"
(Clasificador por Objeto del Gasto) codes — the object-of-expense code the
buyer assigned at award time. A code not shaped like five digits is refused
as `invalid_field_value` before the corpus is read; a well-formed code is
never further validated against a label catalogue, because none exists to
check it against. The match is `cog_partidas && $1::text[]` — overlap, not
containment — so a contract carrying several codes matches on any one of
them. Every returned award row carries `cogPartidas` (`[]` when the publisher
recorded none). There is no `cog_capitulo` filter on `search_awards`: an
unindexed capítulo scan (the code's leading digit) over the ~500K rows this
relation serves was judged too slow to offer as a filter — `aggregate_awards`
is the way to ask a capítulo-shaped question.

`aggregate_awards` accepts `group_by: cog_partida` (the raw code) and
`group_by: cog_capitulo` (its first digit), both by unnesting `cog_partidas`
before grouping. A contract carrying several codes is not split across
them — it counts **in full** under every code it carries, so a group's
`totalAmount`/`awardCount` can double-count relative to the corpus, and the
sum across groups can exceed the corpus total. This is never resolved by
prorating: the publisher never declared how to divide one contract across
its codes, and inventing a split would be a number this layer never read
anywhere. Grouping by either dimension always attaches the
`cog_partida_totals_may_exceed_corpus` semantic warning, and both dimensions
compose with `compare_period` the same way every other `group_by` does.

## What is out of scope here

Per-operation filter vocabularies, source-registry membership meaning, the
Web Evidence boundary and the ChatGPT-facing submission live in
[`semantic-api.md`](./semantic-api.md) and
[`commercial-intelligence-v1.md`](./commercial-intelligence-v1.md). This
document only fixes the shape every operation shares.
