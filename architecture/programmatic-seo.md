# Programmatic SEO — architecture

The public, indexable surface built from Brein's normalized market corpus. Four
route families in v0:

```
/mercado/{industry}/{geography}
/licitaciones/{category}
/contratos/{category}
/compradores/{buyer}/{category}
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
| `apps/web/src/app/(seo)` | The four route families, their hubs, and the shared route helpers. |
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
`no_provenance`, `trivial_list_only`, `fixture_data`, `indexing_disabled`.

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

Scheduled, in the API (`seo.job.ts`): procurement families daily at 04:30 UTC,
market pages weekly on Mondays. Manually:

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

### Enable / disable indexation

```
SEO_INDEXING_ENABLED=false   # DEFAULT. Whole surface is noindex.
SEO_ELIGIBILITY_THRESHOLD=70
SEO_ALLOW_FIXTURE_INDEX=false
SEO_MIN_ENTITIES=3
SEO_MIN_STATS=3
SEO_FRESHNESS_HORIZON_DAYS=540
SEO_SOURCE_MODE=live         # 'fixture' for local development
SEO_ALLOW_TRAINING_CRAWLERS=true
```

Indexation is **opted into**, never inherited: the surface ships `noindex` until
someone sets `SEO_INDEXING_ENABLED=true` and re-materializes. Re-materializing
to flip the flag does **not** move `lastmod`, because the content did not change.

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
SEO_REVALIDATE_URL=https://driftless.icu/api/seo-revalidate
SEO_REVALIDATE_SECRET=<shared secret>   # also set on the web app
```

Best effort by design — the routes also revalidate hourly, so a missed ping
delays a refresh rather than serving a wrong page forever. The hook compares the
secret in constant time, is a no-op when unset, and only accepts paths under the
four families.

## Robots, sitemaps, structured data

- `robots.txt` states **search** and **training** crawler policy in separate
  lists. Training is allowed by default (unchanged behaviour) and reversible via
  `SEO_ALLOW_TRAINING_CRAWLERS` — the point is that the choice is now explicit.
- `/sitemaps/index.xml` indexes `markets.xml`, `tenders.xml`, `contracts.xml`,
  `buyers.xml`. Only `indexable = true` pages appear; a family that outgrows
  45,000 URLs splits into `markets-2.xml` etc. with no new route.
- JSON-LD is `WebPage` + `BreadcrumbList` only. `Dataset` is deliberately **not**
  emitted: these pages summarize a corpus, they do not publish one.
- Family hubs (`/contratos`, `/mercado`, …) are always `noindex, follow`: they
  exist as crawl paths, not as ranking pages.

## Analytics

The programmatic pages reuse the shared taxonomy rather than adding parallel
events: `content_viewed` with `content_type: 'seo_page'` plus `page_type`,
`slug`, `indexable`, `category`, `industry`, `geography`, `buyer`; and
`cta_clicked` with `page_type` and `slug`. The session's `referrer_channel` /
`is_ai_referral` super properties separate Google from ChatGPT and Claude.

## Known gaps

- **No live corpus has been materialized yet.** Everything shipped here has been
  exercised against `FixtureMarketDataSource`. A live run needs
  `GTM_VAULT_DATABASE_URL`; fixture pages carry `generator.mode = 'fixture'`,
  which is a hard `noindex` condition.
- **Candidate query values are unverified against the corpus.** The catalog's
  `query.text`, `query.state` and `query.buyer` values are editorial guesses at
  what the warehouse publishes. Run `--dry-run` first (see *Calibrate before
  publishing*) — it names the candidates whose reads came back empty without
  storing anything.
- **No indexation monitoring yet.** Indexation rate is the primary health metric
  for a programmatic surface, and no analytics tool can produce it: a page that
  was never indexed emits zero events, which is indistinguishable from an indexed
  page nobody clicked. It needs Search Console's URL Inspection API (2,000
  queries/day per property — ample at this size). Not built.
- **Sample-derived distributions.** Market and tender distributions are computed
  over a bounded sample and labelled as such. Exact totals exist only for awards
  (via `award_year` aggregation).
- **No incremental invalidation.** The whole family re-materializes on schedule.
  At 50 pages that is cheaper than a change-tracking queue.
- **`amount_scope` coverage.** Only `supplier_contract` is totalled today, in MXN
  and USD (`AMOUNT_PROBES`). Add pairs there when a family needs them.
