# Programmatic SEO — architecture

The public, indexable surface built from Brein's normalized market corpus. Five
route families:

```
/mercado/{industry}/{geography}
/licitaciones/{category}
/contratos/{category}
/compradores/{buyer}/{category}
/proveedores/{industry}[/{state}[/{municipality}]]
```

## The one invariant

A public page request reads **one materialized document** and nothing else. No
market-data query, no aggregation, no LLM call is on the request path — a
crawler must never reach the GTM warehouse.

```
GTM warehouse
     │  typed domain services (SupplierService / OpportunityService / AwardService)
     ▼
SEO materializer  ──────────────► seo_pages (Postgres, JSONB document)
  (cron in the API, or the CLI)          │
                                         │  GET /api/v1/seo/pages[/document]  (@Public)
                                         ▼
                              apps/web — App Router, ISR
                                         │
                                         ▼
                                        CDN
```

### Publishing and deploying are separate

| | changes | mechanism |
|---|---|---|
| **App deploy** | templates, routes, rendering | Vercel build of `apps/web` |
| **SEO publish** | page data, eligibility, sitemaps | materializer writes `seo_pages`, then pings the revalidate hook |

Routes use `generateStaticParams` (prerender what exists at build) **plus**
`dynamicParams = true` (a page published later renders on first request and is
then cached). Publishing a page never requires a deploy.

## Where the code lives

| Path | Role |
|---|---|
| `libs/seo` | Framework-free core: model, slug, canonical, eligibility, fingerprint, semantics, public DTOs, catalog, materializer, sitemap builders. All tests live here. |
| `libs/db` | `seo_pages` + `seo_page_candidates` entities and the forward migration. |
| `apps/api/src/seo` | Postgres store, live market-data adapter, service, `@Public()` read controller, refresh cron. |
| `apps/api/scripts/seo-materialize.ts` | The CLI. |
| `apps/web/src/app/(seo)` | The five route families, their hubs, and the shared route helpers. |
| `apps/web/src/app/sitemaps` | Sitemap index and family files. |
| `apps/web/src/app/api/seo-revalidate` | The publish → serve cache hook. |

## How materialization works

`materialize(candidate)` is pure with respect to its inputs: a candidate, a
`MarketDataSource`, and a config. It

1. reads the corpus through **typed business operations only** (never SQL);
2. projects rows through explicit **public DTOs** (`toPublicObservation`,
   `toPublicAward`, `toPublicOpportunity`) — allowlists, never `spread`-and-delete;
3. folds each envelope's coverage, corpus basis and semantic warnings into the
   page's sources, "datos actualizados" and disclaimers;
4. computes a **content fingerprint** over the semantic content only;
5. runs **eligibility**;
6. runs a **contact-leak scan** and refuses the page if anything
   coordinate-shaped reached rendered text;
7. writes the document.

### Idempotency

The fingerprint deliberately excludes `generatedAt`, `dataUpdatedAt`,
`corpusCapturedAt` and `lastContentChangeAt`. Re-running against an unchanged
corpus therefore produces an unchanged fingerprint, and `lastContentChangeAt` —
the sitemap `lastmod` — is carried forward from the previous run. Two runs in a
row report `0 changed`.

`dataUpdatedAt` and `generatedAt` *do* move, so a reader is told truthfully when
the corpus was last read; the crawler is simply not told the answer changed when
it did not.

## How eligibility works

Two independent mechanisms, in order (`libs/seo/src/eligibility.ts`).

**1. Hard conditions — fail closed.** Any one of these forces `noindex`
regardless of score: `materialization_failed`, `required_data_missing`,
`no_answer`, `validation_failed`, `semantic_ambiguity`, `duplicate_canonical`,
`no_provenance`, `trivial_list_only`, `fixture_data`, `indexing_disabled`,
`candidate_indexing_not_approved`.

Supplier candidates have a second, per-URL operator gate:
`seo_page_candidates.indexing_approved`. The catalog seeds all supplier URLs
with it off, and future catalog syncs do not overwrite an operator decision.
This lets a small reviewed cohort launch without turning every generated URL
into an indexation experiment.

**2. A 0–100 score**, threshold configurable (default 70):

| Feature | Max |
|---|---|
| data depth | 25 |
| entity density | 20 |
| provenance | 15 |
| freshness | 15 |
| commercial intent | 15 |
| uniqueness | 10 |

A `noindex` page still **renders** — a reader gets the answer — it is just
absent from every sitemap and carries `robots: noindex, follow`.

## Semantic safety

The spec's semantic rules are code, not editorial guidance, and are enforced
twice: by the only constructors that can produce a monetary label, a count
phrase or a deadline, and by a linter that reads the finished document back
(`lintSemantics`, `lintAmountGroups`). A violation is a hard `noindex`.

- **Award ≠ payment.** Every total reads "adjudicados/publicados". Spending
  verbs are refused.
- **Currency and scope.** There is no field in the model a combined total could
  occupy: an amount exists only inside a `(currency, amountScope)` group.
  MXN and USD are never summed, nor are two scopes.
- **`proposal_deadline` only.** No other date is ever rendered under a
  deadline-flavoured label; `opening_date`, `clarification_date`, `award_date`
  and `published_date` are not published as deadlines at all.
- **Unknown stays unknown.** `is_open` never becomes actionability.
- **Observation ≠ company.** Directory counts are "observaciones de directorio".
- **Approximate identity.** Suppliers group by RFC; a name is a display label.
- **Provider page ≠ verified provider.** `/proveedores` v1 counts published
  `establishment` observations selected by reviewed six-digit SCIAN codes. A
  directory observation does not establish legal identity, capability,
  certification, capacity or willingness to quote.

The linter is negation-aware and skips `methodology.doesNotMeasure` /
`limitations`, so a page can still *state* the distinction it refuses to blur.

## Contact privacy

Public pages may show **aggregate contact availability** ("N observaciones
publican al menos un canal"). They may never show a value. Two defences:
the DTOs enumerate published fields (presence flags only), and
`scanForContactLeak` re-reads the finished document's rendered text for
email-, phone- and WhatsApp-shaped strings. A hit refuses the page.

## Runbook

### Add a candidate

Edit `libs/seo/src/catalog.ts` — add a seed to `MARKETS`,
`CONTRACT_CATEGORIES`, `TENDER_CATEGORY_SLUGS` or `BUYERS`. `buildCatalog()`
derives the id, slug and dimensions deterministically. Then run the
materializer; it upserts catalog rows into `seo_page_candidates`.

Supplier seeds live in `libs/seo/src/supplier-catalog.ts`. A supplier URL must
declare reviewed six-digit `scianCodes`, `observedKind: 'establishment'`, an
explicit public `sourceSlugs` allowlist and `indexingApproved: false`. Do not
create separate synonym URLs for one intent; synonyms can improve the bounded
example search without becoming duplicate canonicals.

`commercial_intent_score` is hand-set from category clarity and buying intent.
**It is not search volume** — no keyword volume is estimated anywhere.

To disable a URL without a deploy, set its row's status in the database:

```sql
UPDATE seo_page_candidates SET status = 'disabled' WHERE id = 'contracts_category:uniformes';
```

The seed never overwrites `status`, so an operator decision survives deploys.

### Add a template (a fifth family)

1. Add the type to `SEO_PAGE_TYPES` and its prefix to `SEO_ROUTE_PREFIXES`,
   then extend `seoPathFor`.
2. Write `libs/seo/src/materialize/<family>.ts` returning a `DraftPage`. Use
   `stat`, `breinCta`, `collectSources`, `collectNotices` — do not hand-roll
   provenance or disclaimers.
3. Register it in the `drafter` switch in `materialize/index.ts`.
4. Add the family to `SITEMAP_FAMILY_BY_PAGE_TYPE` and its cadence in
   `sitemap.ts`.
5. Add seeds to the catalog and a route under `apps/web/src/app/(seo)/` — the
   route is ~25 lines; `renderSeoRoute` and `seoMetadata` do the rest.
6. Add the migration's `chk_*_page_type` values.

The renderer is shared: a template contributes *data*, never a second layout.

### Calibrate before publishing (first contact with the live warehouse)

Every query term in the catalog is an editorial guess at what the warehouse
publishes. A guess the publisher spells differently returns nothing, and the
page it produces is correctly refused — but the run log says only "thin", which
is indistinguishable from "this category genuinely has no contracts". Those need
opposite fixes.

So the FIRST live run should be read-only:

```bash
pnpm --filter @driftless/api seo:materialize -- --dry-run
```

It materializes and evaluates every candidate, writes **nothing** (no pages, no
candidate rows, no revalidation ping), and prints a calibration report sorting
candidates into what a human has to do about each:

| Verdict | Meaning |
|---|---|
| `ready` | The corpus answered; would index once indexation is on. |
| `thin` | The corpus answered but the page is below the bar. Judgement call. |
| `no_match` | **Every** read came back empty. Almost always a wrong query term. |
| `partial_match` | Below the bar **and** some read was empty — check that filter first. |
| `blocked` | Materialization failed. A defect, not a data question. |

For each actionable candidate it prints the failing operations, the eligibility
blockers, and what the layer silently normalized (`state "Nuevo León" → "MX-NLE"`)
— which is usually enough to fix the catalog entry directly.

Two deliberate choices in that report:

- `fixture_data` and `indexing_disabled` are **not** listed as blockers. They are
  deployment posture, true of every page before launch by design, and listing
  them would bury the one real blocker under fifty copies of "indexing is off".
- An empty read alone does **not** make a candidate actionable. Several reads are
  probes expected to come back empty — the amount probes ask for USD contracts in
  a category that may only have peso ones, and finding none is the correct
  answer. Emptiness only decides a verdict when the page also fell short.

On a database that has never been seeded, a dry run falls back to the compiled
catalog, so calibration works on a fresh environment — which is the situation a
first live calibration actually runs in.

### Refresh pages

Scheduled, in the API (`seo.job.ts`): procurement families daily at 04:30 UTC;
market and supplier pages weekly on Mondays. Manually:

```bash
pnpm --filter @driftless/api seo:materialize
pnpm --filter @driftless/api seo:materialize -- --type=contracts_category
pnpm --filter @driftless/api seo:materialize -- --candidate=contracts_category:software
pnpm --filter @driftless/api seo:materialize -- --fixtures   # no warehouse needed
pnpm --filter @driftless/api seo:materialize -- --dry-run    # read-only calibration
```

The CLI boots a minimal Nest context on purpose — importing `AppModule` would
arm every `@Cron` in the server, including the retention purge.

Each run logs one line per candidate (`candidate_id`, `page_type`, `status`,
`records_examined`, `duration_ms`, `eligibility_score`, `indexable`,
`content_changed`, `error_code`) and a summary.

### Measure indexation (the primary health metric)

```bash
pnpm --filter @driftless/api seo:indexation
pnpm --filter @driftless/api seo:indexation -- --limit=200
```

Also runs daily at 06:00 UTC, an hour after the materialization crons — the
order matters, because materialization decides which pages are indexable and
this only asks Google about those.

**Why it cannot come from analytics.** A page Google never indexed emits zero
page views, which is indistinguishable from an indexed page nobody clicked.
Every traffic metric reports those two identically. Only Search Console's URL
Inspection API separates them, and only per URL.

Each run writes one row per URL per day into `seo_page_indexation` — a row per
day rather than a mutable latest-state row, because the question is "did
indexation improve over six weeks", which a table that overwrites yesterday can
never answer. Re-running the same day upserts.

What it records, and the judgement calls behind it:

- **`is_indexed` is `verdict === 'PASS'` only.** `NEUTRAL` covers "Crawled –
  currently not indexed" and "Discovered – currently not indexed", which are
  exactly where a thin programmatic surface lands. Counting them as indexed
  would report health for a surface Google decided to skip.
- **Google's strings are stored verbatim.** "Crawled – currently not indexed"
  and "Discovered – currently not indexed" are different diagnoses with
  different fixes; mapping them into our own vocabulary would flatten both into
  "not indexed".
- **A failed CALL is excluded from the rate, not counted as not-indexed.** An
  outage or a spent quota would otherwise read as a collapse in indexation, and
  the two call for opposite responses — "fix the credential" versus "prune the
  surface".
- **`google_canonical` is kept beside `user_canonical`.** When they disagree,
  Google chose a different canonical than the page declared. That is a top
  programmatic-SEO failure and it is invisible in every traffic metric.

Quotas are part of the design: 2,000 queries/day and 600/minute **per
property**. At 50 pages a run costs 50 calls. At 5,000 it needs three days or
several verified properties — the run bounds the batch and reports
`stoppedEarly` rather than silently truncating, which would look like a
collapse in indexation.

Auth is a service-account JWT signed with `node:crypto` — no Google SDK. The
whole flow is one signed assertion exchanged for a bearer token, and the scope
is `webmasters.readonly`, so the integration cannot submit or delete a URL.

### Reading the thermometer in PostHog

The behavioural half already lives in PostHog: `content_viewed` and
`cta_clicked` carry `page_type` and `slug`, and `referrer_channel` /
`is_ai_referral` separate Google from ChatGPT and Claude.

The other two halves are **state, not events**, and are deliberately not emitted
as PostHog events — the taxonomy's rule is that an event answers a decision a
person made, and the registry is capped at 45 names for exactly this reason.
Both reach PostHog as data-warehouse sources instead:

| Data | Where it lives | How PostHog reads it |
|---|---|---|
| Impressions, clicks, CTR, position | Search Console | PostHog's native Google Search Console source |
| Indexation rate, canonical mismatches | `seo_page_indexation` | PostHog's Postgres data-warehouse source |
| Page views, CTA clicks, AI referral channel | PostHog | already emitted as events |

Joining those three by `page_type` is the whole thermometer: which template gets
indexed, which gets impressions, and which converts.

### Enable / disable indexation

```
SEO_INDEXING_ENABLED=false   # DEFAULT. Whole surface is noindex.
SEO_SUPPLIER_PREVIEW_ENABLED=false # Vercel preview only; held supplier pages may appear in the hub.
SEO_SUPPLIER_MATERIALIZATION_ENABLED=false # DEFAULT. No live supplier refresh.
SEO_SUPPLIER_CALIBRATION_DIGEST= # Exact full-cohort SHA-256 from staging.
SEO_ELIGIBILITY_THRESHOLD=70
SEO_MIN_ENTITIES=3
SEO_MIN_STATS=3
SEO_FRESHNESS_HORIZON_DAYS=540
SEO_SOURCE_MODE=live         # 'fixture' for local development
SEO_ALLOW_TRAINING_CRAWLERS=false # DEFAULT. Search crawlers remain allowed.
```

Indexation is **opted into**, never inherited: both the API deployment and the
public web deployment must set `SEO_INDEXING_ENABLED=true`. The API enforces
the gate while materializing and again while serving stored documents and
sitemaps; the web deployment independently enforces it in metadata, build seeds,
robots and programmatic sitemaps. An unset or false value on either plane is a
deny. Re-materializing to flip the flag does **not** move `lastmod`, because the
content did not change.

`SEO_SUPPLIER_PREVIEW_ENABLED=true` is a staging review aid, not an indexing
gate. The web app honors it only when `VERCEL_ENV=preview`; production ignores
it even if it is accidentally set. It allows materialized supplier pages that
remain `noindex` to appear in `/proveedores`, while build seeds and sitemaps
continue to require the independent indexing gate.

Supplier materialization is a separate cost gate. `noindex` does not make a
warehouse query cheaper, so the weekly supplier cron refuses live work until
`SEO_SUPPLIER_MATERIALIZATION_ENABLED=true` **and**
`SEO_SUPPLIER_CALIBRATION_DIGEST` matches the full active supplier registry.
The digest binds ids, status/index approval, text, SCIAN, geography,
observation kind and source allowlist. A DB-only candidate or any query change
closes the gate again. Fixture runs and read-only `--dry-run` calibration
remain available while the gate is off.

### Switch domains

Set `NEXT_PUBLIC_SITE_URL` (or `PUBLIC_SITE_URL` / `BASE_URL` for jobs) and
redeploy the site. No document changes: a stored page contains **no absolute
URL at all** — not in its path, its CTA, or its internal links — so canonicals,
OpenGraph URLs, JSON-LD and sitemap entries all move with configuration.
`materialize.spec.ts` asserts this.

The one legitimate absolute URL in a document is an entity's `sourceUrl`, which
is the *publisher's* page — a citation a reader can verify.

### Cache invalidation

The materializer POSTs changed paths to the site:

```
SEO_REVALIDATE_URL=https://trybrein.com/api/seo-revalidate
SEO_REVALIDATE_SECRET=<shared secret>   # also set on the web app
```

Ordinary content refresh is best effort — the routes also revalidate hourly, so
a missed ping delays freshness rather than serving a wrong page forever.
Supplier indexability transitions and removals use a durable state machine in
`seo_pages`: `noindex`, `pending_cache_purge`, `published`,
`rollback_pending`, and `delete_pending`. Only `published` is effective
indexable. A materializer stores desired supplier content with the column still
noindex and a monotonic revision, confirms two family purges, then publishes
the exact revision with a CAS transaction. A crash leaves durable pending work,
not an indexable row; the daily reconciler or the guarded
`seo:supplier-reconcile-publication` CLI resumes it without warehouse reads.
Withdrawals commit noindex/delete-pending before their purge, and approval plus
materialization are blocked until acknowledgement. Family invalidation is one
bounded target regardless of whether 1 or 20,000 rows are pending; the 200-ID
operator limit never constrains internal recovery.

Indexability transitions and removals remain failed until the web app confirms
a global tag, family/route and path purge. The hook
compares the secret in constant time, fails closed when unset, and only accepts
paths under the five families. Supplier paths are constrained to one, two or
three slug segments; arbitrary descendants are refused.

Source revocation is stricter: its audit is not successful until the web app
confirms a supplier-family tag and dynamic-route purge. The audit repeats that
family purge even when the database tombstone already happened, so a transient
Vercel failure cannot strand a licensed-out document in ISR indefinitely.

## Robots, sitemaps, structured data

- `robots.txt` states **search** and **training** crawler policy in separate
  lists. Training is blocked by default and reversible via
  `SEO_ALLOW_TRAINING_CRAWLERS`; search crawlers remain allowed.
- `/sitemaps/index.xml` indexes `markets.xml`, `tenders.xml`, `contracts.xml`,
  `buyers.xml`, `suppliers.xml`. Only `indexable = true` pages appear; a family
  that outgrows 45,000 URLs splits into `suppliers-2.xml` etc. with no new
  route, leaving headroom below the protocol's 50,000-URL limit.
- JSON-LD is `WebPage` + `BreadcrumbList` only. `Dataset` is deliberately **not**
  emitted: these pages summarize a corpus, they do not publish one.
- Family hubs (`/contratos`, `/mercado`, …) are always `noindex, follow`: they
  exist as crawl paths, not as ranking pages.

## Supplier universe v1

The first reviewed catalog contains 58 URLs across 12 industrial capabilities:
machining, laser cutting, stamping, molds and dies, plastic injection,
corrugated packaging, industrial automation, electrical panels, pumps, valves,
water treatment and medical devices. Each vertical has a national page and
three state pages; ten high-value corridors also have a municipality page.

This is deliberately a cohort, not a combinatorial generator. New URLs require
an approved intent, reviewed SCIAN mapping, distinct provider population,
enough public evidence and a canonical that does not duplicate an existing
page. The intended expansion order is 58 → 200–300 only after Search Console
shows that Google indexes and users engage with the first cohort.

### Data and cost model

The exact headline counts are structured: SCIAN overlap, normalized exact
geography, `observed_kind = 'establishment'`, and an explicit source allowlist.
They do not depend on full-text search. Free text is used only to rank a bounded
sample of names and evidence, and the page says so.

Materialization batches at most 50 structured cells into one typed warehouse
read. The statement turns one bound JSON document into a tiny cell relation and
runs one narrowed aggregate per cell; this is one round trip, not proof of one
physical scan. Before enabling the live gate, capture `EXPLAIN (ANALYZE,
BUFFERS, WAL, SETTINGS)` for the real 50-cell and 8-cell batches in staging and
verify timeouts, buffers and blocking. Do not add an index without that plan.
The example sample remains capped at 80
rows per page. A public request never performs either operation because it reads
the finished JSON document from `seo_pages`.

The v1 supplier catalog permits only `denue`. `dirind` and `mexicoindustry` are
excluded while their public-display licenses remain unresolved. A source must
not be added merely because its rows exist in the warehouse. The machine-readable
DENUE evidence record lives at `docs/architecture/source-rights/denue.v1.json`.
Official terms supporting reuse are evidence, not self-authorization: indexing
approval remains impossible while that record is pending, expired, blocked or
unsigned. An approval artifact binds the exact reviewed rights-record digest.

Every supplier taxonomy declares `taxonomyPrecision`: `exact_class`,
`reviewed_proxy`, or `broad_unresolved`. The last value is a hard noindex
condition. A reviewed proxy stays visibly qualified as “clases relacionadas”;
its lexical term only orders examples and never narrows the exact count or
proves capability. The query-contract digest hashes the aggregate SQL and a
version covering geography/population semantics, so a query change invalidates
all prior calibration digests.

### Source revocation fails closed

The supplier projection's corpus basis does not currently change when a
source's `enabled` or `licensed_for_display` flag changes. Live reads honor
those flags, but an already materialized document could otherwise survive a
later revocation. A daily metadata-only audit therefore reads the warehouse's
live public-source gate and moves any supplier document whose persisted
`document.sources` are no longer wholly visible to `delete_pending`. Public
reads treat that retained retry row as absent immediately; a confirmed family
purge deletes it. The document, not the current
candidate query, is authoritative about what evidence was published. The
materializer also refuses any source outside the hard v1 allowlist or absent
from the current public coverage gate. The candidate remains, so a later safe
materialization can restore it; the stale public document and sitemap entry do
not survive the revocation. Cache invalidation is required and retried as a
family purge. A metadata read failure deletes nothing and alerts, because an
outage is not evidence that every license was revoked.

The global index switch is also a serving-plane emergency brake: the API
overrides an already-stored indexable document to `noindex` and returns no
programmatic sitemap rows without waiting for the warehouse or a successful
materialization. The web plane has the same independent deny gate. Turning a
gate off still requires a web redeploy/purge to evict any pre-existing rendered
ISR entries immediately; the hourly fallback is not considered a completed
rollback.

### Activation checklist

1. Confirm every staging writer completed, wait a quiet cooldown, and confirm
   the supplier publication is current (`stale = false`) with safe storage,
   memory, CPU, queue and write-I/O headroom. Never benchmark against an active
   ingest/projection build.
2. Verify every allowed source is enabled and licensed for public display, and
   exercise the daily revocation audit against a staging candidate.
3. Run `seo:supplier-explain` first in its default plan-only mode. It accepts
   only `gtm_vault_staging`, the `market_intelligence_consumer` role, verified
   TLS, `NODE_ENV=staging`, the fixed staging-secret marker and a read-only
   transaction. For the 58-candidate launch cohort it validates two aggregate
   batches of 50 and 8 candidates **plus 58 separate bounded sample plans**;
   for the 46-candidate expansion wave it validates one aggregate batch of 46
   plus 46 sample plans. It also checks index definitions and actual index use.
   The batch sizes are execution shape, not a shortlist. Plan-only reports
   `gateDigest: null`; only a passing, explicitly
   enabled bounded `--analyze` with every aggregate and sample plan present can
   emit the digest used by the materialization gate. The command now emits a
   content-addressed `supplier_calibration_evidence` document: the full staging
   complete read-only database/role/TLS/privilege posture, projection basis, DENUE coverage, required index
   definitions, exact registry/query/cohort/batches, every executed aggregate
   and sample plan, gate result, commit and calibration time are covered by one
   digest. Save the JSON output; a copied boolean or cohort digest is not an
   indexing approval. Then run
   `seo:materialize --dry-run --type=supplier_geo`; inspect zero, thin,
   ambiguous and failed candidates without writing pages. The CLI emits a
   separate supplier launch gate for the exact active registry (the 58-page
   base plus any content-addressed promoted subset): zero failures,
   zero indexables, zero contact-leak refusals, total wall time at most 180 s,
   p95 candidate time at most 2 s and maximum candidate time at most 5 s. It
   also flags thin evidence and sample overlap for editorial exclusion; a PASS
   never changes `indexingApproved`.
4. Copy the accepted full-cohort digest into
   `SEO_SUPPLIER_CALIBRATION_DIGEST`, set
   `SEO_SUPPLIER_MATERIALIZATION_ENABLED=true` only in staging, and
   materialize with global indexing off. Review responsive layout,
   canonicals, OG/JSON-LD, contact-leak scanning, 404s and the supplier sitemap.
5. Record the responsible human review in the DENUE rights artifact and
   regenerate its digest. Until `status=approved`, `publicDisplayDecision=allow`,
   a responsible opaque reviewer, review time and zero blockers are present,
   the builder refuses to produce an artifact.

   Capture the exact selected staging rows through
   `seo:supplier-build-index-approval --capture-staging --read-staging
   --confirm-staging-read`. This is the sole networked builder mode. It accepts
   only `NODE_ENV=staging`, a dedicated
   `SEO_SUPPLIER_INDEX_APPROVAL_READ_URL`, its byte-for-byte
   `SEO_SUPPLIER_INDEX_APPROVAL_READ_TARGET_URL` confirmation and
   `SEO_SUPPLIER_INDEX_APPROVAL_READ_ENABLED=true`; inside PostgreSQL it starts
   `REPEATABLE READ`, sets the transaction `READ ONLY`, verifies TLS and refuses
   any role that can insert, update, delete or truncate either SEO table. It
   rolls back and prints a content-addressed staging evidence document.

   Run the same command without `--capture-staging` to build the v2 approval
   offline from `--staging-evidence`, `--calibration`, `--source-rights`, the
   exact `--candidate` list, opaque `--reviewer` and canonical `--decided-at`.
   The staging capture must be at most 30 minutes old and the executed
   calibration at most six hours old; both must match the current full commit.
   The builder recomputes the active launch registry, rejects unknown or
   already-indexable candidates, verifies each stored document is live/noindex,
   fingerprint-consistent, eligible apart from launch-posture blockers,
   DENUE-provenanced and contact-leak-free, and binds the complete calibration
   evidence digest into the approval.

   Human review then records the approval artifact digest and exact launch
   registry artifact digest out of band. Validate
   `seo:supplier-approve-indexing` offline first with the approval, staging,
   calibration and rights artifacts plus those two independently confirmed
   digests. The apply CLI rebuilds the approval from the evidence before it can
   open PostgreSQL, and the writer parses the complete calibration evidence
   again against the live registry; there is no bare-digest bypass. The guarded
   `--apply` path persists candidate approval provenance only and deliberately
   leaves the stored page `noindex`.
6. Re-run the exact bounded calibration because candidate approval changes the
   registry digest. Materialize only the approved small, diverse cohort. The
   supplier store serializes with emergency revocation, re-reads the current
   candidate gate and first persists `pending_cache_purge`. Only the exact
   revision acknowledged by the family purge can become `published`; stale
   acknowledgements are no-ops. Verify live headers/HTML,
   canonical, robots and the supplier sitemap before turning both global
   serving-plane gates on.
7. Keep `seo:supplier-revoke-indexing` ready. It defaults to an offline dry-run;
   a guarded exact-target apply commits `rollback_pending`/database `noindex`
   before requiring the supplier-family cache purge and completing `noindex`.
   Replaying the revoked approval artifact is
   refused; a later approval needs a new exact reviewed artifact.
8. Watch discovered/indexed/canonical state in Search Console for several
   weeks. Expand, improve or prune based on evidence; do not publish a Cartesian
   product of industries and places.

## Analytics

The programmatic pages reuse the shared taxonomy rather than adding parallel
events: `content_viewed` with `content_type: 'seo_page'` plus `page_type`,
`slug`, `indexable`, `category`, `industry`, `geography`, `buyer`; and
`cta_clicked` with `page_type` and `slug`. The session's `referrer_channel` /
`is_ai_referral` super properties separate Google from ChatGPT and Claude.

## Known gaps

- **The new supplier cohort has not been calibrated against a stable live
  projection.** It has been exercised against `FixtureMarketDataSource`; a live
  run needs `GTM_VAULT_DATABASE_URL`. Fixture pages carry
  `generator.mode = 'fixture'`, which is a hard `noindex` condition.
- **Candidate query values are unverified against the corpus.** The catalog's
  `query.text`, `query.state` and `query.buyer` values are editorial guesses at
  what the warehouse publishes. Run `--dry-run` first (see *Calibrate before
  publishing*) — it names the candidates whose reads came back empty without
  storing anything.
- **The indexation monitor reads zero until indexation is enabled.** It is the
  instrument that has to be in place before the six-week measurement window
  opens, not a source of signal today: every page is `noindex` until
  `SEO_INDEXING_ENABLED=true`, so there is nothing for Google to have indexed.
- **Search Console impressions/clicks are not ingested here.** They come in
  through PostHog's native Search Console source (configuration, no code). If
  that connector turns out not to carry a per-page dimension, a small
  Search Analytics fallback would be needed — verify before relying on it.
- **No authenticated keyword volume.** The supplier catalog combines current
  competitor/intent research with reviewed SCIAN mappings and hand-set
  commercial-intent scores. Exact Google Ads volume was not available, so it is
  not fabricated or represented by the score.
- **Sample-derived distributions.** Market and tender distributions are computed
  over a bounded sample and labelled as such. Exact totals exist only for awards
  (via `award_year` aggregation).
- **No incremental invalidation.** The whole family re-materializes on schedule.
  The structured supplier counts are batched, but per-page samples remain
  bounded reads. Before thousands of URLs, add change tracking and shared sample
  reuse instead of multiplying those reads linearly.
- **`amount_scope` coverage.** Only `supplier_contract` is totalled today, in MXN
  and USD (`AMOUNT_PROBES`). Add pairs there when a family needs them.
