# Supplier SEO expansion — Mexico

This is the research backlog behind `/proveedores`, not a URL generator. It
contains 79 capability intents and 28 industrial corridors, but the launch
catalog remains a reviewed cohort of 58 URLs. A backlog item becomes a URL only
after demand, taxonomy, source rights, distinctness and live evidence pass.

No exact search volume is asserted here. Reorder this backlog with authenticated
Keyword Planner, Trends, Search Console and the warehouse calibration report.

## Live Search Console checkpoint

Read-only check on 2026-08-30 for the verified `sc-domain:trybrein.com`
property:

- the performance and page-indexing reports both said that data was still being
  processed and to check again the following day;
- `https://trybrein.com/sitemaps/index.xml` was submitted and read on
  2026-08-30 with status `Correcto` and 32 discovered pages;
- `https://trybrein.com/sitemap.xml` was submitted and read on 2026-08-30 with
  status `Correcto` and 26 discovered pages.

This proves property access, sitemap ingestion and URL discovery. It does not
prove that any URL is indexed, ranking, or receiving supplier-intent demand.
No supplier expansion decision should use Search Console until the reports
finish processing and expose page/query data.

The corresponding read-only PostHog baseline for project 425107 over the last
30 days, excluding test accounts and events classified as bots, was 21 public
`trybrein.com` pageviews from 6 unique visitors: 18 direct and 3 referral. The
largest non-home path was `/compradores/imss/equipo-medico` with 4 views; there
were no recorded `cta_click` or `cta_clicked` events on the public host. No
organic channel or crawler category was recorded. Because many crawlers do not
execute client analytics, that absence is not proof that Google did not crawl.
These numbers are the pre-indexation measurement baseline, not supplier demand
evidence and not a reason to expand the catalog.

## Source strategy

The defensible advantage is not copying private industrial directories. It is
joining public evidence without collapsing its meaning:

| Source                   | Public role                                            | Promotion decision                                                                                            |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| DENUE                    | Establishment + exact SCIAN + geography                | V1 population backbone; keep the only public allowlisted source.                                              |
| SIEM                     | Annual business registration and self-declared profile | Build as corroboration; do not add its rows to DENUE counts until identity/deduplication exists.              |
| IMMEX / PROSEC           | Official program and plant participation               | High-priority differentiating badge/cohort; participation is not proof of a specific capability.              |
| COFEPRIS licences / CBPF | Official regulated-manufacturing evidence              | High-priority vertical evidence for medical, pharmaceutical and other regulated cohorts.                      |
| SAT sector registers     | Import/export registration                             | Block public use until natural-person/RFC retention and redistribution are resolved.                          |
| Dirind / MexicoIndustry  | Rich private category vocabulary                       | Internal query/category discovery only; no public rows or copied descriptions without written reuse rights.   |
| Procurement awards       | Buyer–awardee evidence                                 | Separate evidence block after strong identity resolution; award is not payment, delivery or current capacity. |
| Data México              | Aggregated market context                              | Context only; never a supplier population.                                                                    |

Every new source needs a dated rights snapshot, public-field allowlist,
publisher timestamp, grain/identity contract, natural-person policy, national
quality audit, deduplication plan, explicit SCIAN or publisher-category label,
human `licensed_for_display` approval and a tested revocation/tombstone path.

## Positioning

Brein should not try to beat Cosmos, QuimiNet, Proveedor Industrial,
MexicoIndustry, Dirind or Kompass by publishing more interchangeable directory
pages. The differentiator is an evidence-rich sourcing answer:

- exact structured population and explicit observation kind;
- why each named establishment appears;
- source, capture, geography and classification visible to the reader;
- contact _availability_ without publishing contact coordinates;
- clear separation between observation, company, capability and verified
  supplier;
- a direct path from discovery to a research shortlist in Brein.

### Current competitive evidence

Observed on 2026-08-30:

- [Cosmos](https://www.cosmos.com.mx/producto/maquinados-4yn1/maquinados-de-plastico-gnxr/)
  competes on product-level supplier lists, named companies, direct contact and
  RFQ distribution. Its vocabulary confirms strong transactional modifiers
  such as `proveedores`, `fabricantes`, `maquila`, `cotización`, material and
  process.
- [MexicoIndustry](https://mexicoindustry.com/directorio.php) competes on a
  searchable company directory with sector and state filters plus supplier
  challenges and business meetings. Its current discovery surface explicitly
  asks what the buyer is looking for and gives examples such as valves.
- [Dirind](https://www.dirind.com/) exposes buyer-oriented category language
  across automation, control, machinery, tooling, engineering, maintenance,
  metalworking, food and packaging.

These sources validate vocabulary and buying jobs, not a right to republish
their companies, descriptions or contact data. Brein's winning surface must
answer questions the directories do not answer cleanly: what the structured
population is, what each source actually proves, where observations
concentrate, why an example matched, how identity was approximated, and how to
continue the analysis without pretending that a directory row proves live
capacity.

Google's current guidance reinforces the same product decision. The
[spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
classify substantially similar geographic/query pages that only funnel users
elsewhere as doorway abuse, while the
[AI-search guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
warns against making a page for every possible query variation. Therefore a
keyword variant is not a URL. Only an explicit cell with a distinct sourcing
answer, current evidence and useful internal navigation can be promoted.

### Demand programme

Demand is evaluated in four separate intent families instead of one blended
keyword score:

1. discovery: `proveedores`, `fabricantes`, `directorio`, `empresas`;
2. transaction: `cotización`, `RFQ`, `maquila`, `sobre diseño`, `mayoreo`;
3. regional fulfilment: state, municipality, corridor, delivery, installation
   and local stock;
4. capability: a reviewed product, process or service variant. Qualification
   terms such as certifications, tolerances or regulated claims are admitted
   only when a taxonomy-specific lexicon and page evidence can support them.

The first authenticated keyword pull should prioritize maquinado CNC, corte
láser, inyección de plástico, automatización industrial, cartón corrugado and
tratamiento de agua, each at national, state and selected municipality scope.
Keyword Planner establishes demand; Search Console and internal search capture
Brein's observed demand; Trends checks regional/seasonal shape; current SERPs
and competitors establish language and result format. None of these substitutes
for the warehouse evidence gate.

Separately, `supplier-expansion-wave-zero.ts` records 46 explicit next-cohort
cells across six taxonomies whose Mexican classes have already been reviewed:
plastic flexible packaging, industrial-machinery maintenance, metal coatings,
metal structures, medical disposables and automotive components. This registry
is intentionally inert: it is not part of `SEO_CATALOG`, materialization, routes
or sitemaps. With no demand or live snapshots, all 46 proposals deterministically
remain `hold`, `candidate` and `indexingApproved=false`.

`seo:supplier-demand-plan --as-of=<canonical-ISO> --output=<new.json>`
compiles 217 explicit Spanish demand probes for those 46 cells. Plan v3 keeps
the four comparable probes per cell and adds 33 controlled research probes:
one process, product and qualification probe per vertical plus natural
geographic language for 15 explicitly selected cells. Every added probe owns
one existing `canonicalCellId`; it is never multiplied across the geography
registry and cannot create a route. `cotización` remains an optional measurable
probe and is never a prerequisite. Each probe has
a content-addressed identity, one canonical cell, an explicit national/state/
municipality scope and five tool-specific measurement roles: Keyword Planner,
Search Console, exact internal search, Trends where geographically supported,
and competitive SERP review. Query variants never create URLs. The semantic
`planDigest` remains stable across audit timestamps; the outer artifact digest
binds the timestamp. Creating this plan admits no evidence and cannot create a
page.

The same artifact records a research-only measurement order for 15 cells and
five reserves. Priority means "measure first" while every candidate remains
`indexingApproved=false`; it is not an indexation or publication decision.

Internal demand does not send free-form supplier searches to PostHog. The
semantic supplier-search boundary recognizes only an exact phrase already
owned by this reviewed plan, only on an unfiltered first page, and emits a
privacy-safe operational record containing the plan `queryId`, canonical cell
and a bounded result-count bucket. Unknown text, people/contact-shaped text,
pagination and searches with extra filters emit nothing. The record contains no
query text, actor, workspace, filters or result rows; a retained log export can
therefore be aggregated and bound into an `internal_search` demand artifact
without turning customer searches into an analytics payload.

### Auditable demand artifacts

An operator does not assign a demand score or a target cell. The v2 demand
builder accepts only `queryId`, measured kind (`keyword_planner`,
`search_console`, `internal_search`, `google_trends` or `competitive_serp`),
metric/unit, date window, a canonical source URL and SHA-256 digests for both
the retained source run and its exact retained row. It derives the cell, exact query, geography and all cohort/
contract/plan bindings from the reviewed query plan. Each row receives a
domain-separated `rowDigest`; the complete artifact receives another digest.
The parser requires both the plan digest and demand artifact digest out of band,
rejects v1, extra fields, cross-cell or cross-geography replay, duplicate
`queryId + kind`, reused retained source rows or artifact row digests, unsupported source hosts, credentialed or
parameterized URLs and contact/secret-shaped query data.

The offline assembly sequence is:

1. Create the plan with `seo:supplier-demand-plan` and retain its printed
   artifact digest separately.
2. Export bounded observations privately and run
   `seo:supplier-demand-artifact --demand-plan=<plan.json>
--demand-plan-artifact-digest=<sha256> --observations=<rows.json>
--as-of=<canonical-ISO> --output=<new.json>`.
3. Give `seo:supplier-manifest` both files and both out-of-band digests together
   with at least two privacy-safe snapshots. The manifest is format v3 and
   carries the plan semantic digest, plan artifact digest and demand artifact
   digest transitively.
4. Give `seo:supplier-promote` the same plan, demand artifact and digests. It
   also requires the separately approved manifest artifact digest and a complete
   human decision artifact whose digest is supplied separately with
   `--expected-decision-artifact-digest`. Every output remains
   `indexingApproved=false`.

All four commands are offline, use no database or network client, create files
with no-overwrite semantics and mode `0600`, and cannot materialize or index a
page. The expansion engine normalizes admitted metrics deterministically. Current
bands are intentionally coarse: Keyword Planner average monthly searches and
Search Console impressions reach the top band at 1,000; internal searches at 20. Trends is relative shape only and never counts as quantified promotion
demand. Competitive presence contributes only a ten-point corroboration bonus
and can never replace measured demand.

Competitive pages validate language and result shape, but are not quantitative
demand. Every promotable cell therefore needs at least one positive Keyword
Planner, Search Console or internal-search measurement plus two signals from
two distinct signal families. Zero measured volume, Trends plus SERP, or SERP
alone always remains held. An authenticated export can be
retained privately while the manifest carries only its digest and the bounded
metric needed for review.

`seo:supplier-activate` is the separate persistence boundary. By default it
revalidates the complete plan → demand → manifest → human decision → promotion
chain and opens no database connection. A write additionally requires
`NODE_ENV=staging`, `--apply`, `--confirm-staging` and the dedicated
`SEO_SUPPLIER_PROMOTION_ENABLED=true` gate. It also requires
`SEO_SUPPLIER_PROMOTION_TARGET_URL` to repeat the exact `SUPABASE_URL`; a stale
or accidentally production-pointing environment therefore refuses before a
connection opens. The serializable transaction records
the promotion digest and first application time on every admitted candidate,
refuses conflicting or previously decided rows, and is idempotent for the same
artifact. It always persists `status=approved` with
`indexingApproved=false`. There is intentionally no index-approval mode in this
command; indexing needs the later materialization, crawl and human-QA gate.

Snapshot artifacts partition the exact 46-cell cohort into succeeded snapshots
and failed candidate ids, bind the query and cohort digests, and identify the
HMAC key without exposing it. `seo:supplier-manifest` refuses missing/extra
cells, mixed query contracts, rotated HMAC keys, duplicate timestamps, future
evidence, fewer than two snapshots, a redigested subset, a changed candidate or
an evidence row absent from the reviewed demand artifact. A manifest
recommendation is still not publication approval and can never enable indexing.

## Promotion score

Score each candidate before it enters the catalog:

| Dimension                  | Weight |
| -------------------------- | -----: |
| demonstrated search demand |     25 |
| commercial / RFQ intent    |     15 |
| public-source depth        |     25 |
| Brein evidence advantage   |     20 |
| technical SEO viability    |     15 |

Apply penalties for duplicate provider sets, thin evidence, identity ambiguity,
replicated copy, unresolved display rights and a taxonomy too broad to sustain
the query.

## Capability backlog

Codes below are SCIAN México 2023, not US NAICS. Precision means whether the
official class itself proves the commercial intent: `exact_class`,
`reviewed_proxy`, or `broad_unresolved`. A proxy can support discovery and a
qualified sample, but it must not be presented as proof that every
establishment offers the named capability. Broad unresolved cells are held.

Primary references: INEGI's [SCIAN México 2023 structure](https://www.inegi.org.mx/contenidos/app/scian/estructura2023.pdf)
and [complete class definitions](https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/nueva_estruc/889463909675.pdf).

### Wave 0 — first offensive

| Capability intent                               | Reviewed SCIAN México                                                 | Precision          | Primary buying job       | Doorway risk |
| ----------------------------------------------- | --------------------------------------------------------------------- | ------------------ | ------------------------ | ------------ |
| Maquinado CNC                                   | 332710                                                                | reviewed_proxy     | outsourcing / RFQ        | medium       |
| Corte láser de metal                            | 332710                                                                | reviewed_proxy     | outsourcing              | medium       |
| Troquelado y estampado metálico                 | 332110 / 336370                                                       | reviewed_proxy     | outsourcing              | medium       |
| Moldes y troqueles                              | 333510                                                                | reviewed_proxy     | outsourcing              | medium       |
| Inyección de plástico                           | 326191 / 326192 / 326193 / 326194 / 326198 / 326199                   | reviewed_proxy     | outsourcing              | medium       |
| Empaque de cartón corrugado                     | 322210                                                                | reviewed_proxy     | purchase / fabrication   | medium       |
| Empaque flexible plástico                       | 326110                                                                | reviewed_proxy     | purchase / fabrication   | medium       |
| Automatización industrial                       | 334519 / 335312 / 541330                                              | broad_unresolved   | service / project        | medium       |
| Tableros eléctricos y de control                | 335312                                                                | reviewed_proxy     | purchase / project       | medium       |
| PLC, HMI y SCADA                                | 334519 / 335312 / 541330 / 541510                                     | broad_unresolved   | integration              | medium       |
| Bombas industriales                             | 333910                                                                | reviewed_proxy     | purchase / RFQ           | low          |
| Válvulas industriales                           | 332910                                                                | reviewed_proxy     | purchase / RFQ           | low          |
| Mantenimiento de maquinaria y equipo industrial | 811312                                                                | exact_class        | urgent service           | high         |
| Recubrimientos y acabados metálicos             | 332810                                                                | exact_class        | outsourcing              | medium       |
| Fundición de aluminio / die casting             | 331520                                                                | reviewed_proxy     | outsourcing              | medium       |
| Estructuras metálicas                           | 332310                                                                | exact_class        | fabrication / project    | medium       |
| Pailería industrial                             | 332310 / 332410 / 332420 / 332430                                     | broad_unresolved   | outsourcing / project    | high         |
| Instrumentación y control                       | 334519                                                                | reviewed_proxy     | purchase / integration   | medium       |
| Instalaciones eléctricas industriales           | 238210                                                                | reviewed_proxy     | project                  | high         |
| Refrigeración industrial — fabricante           | 333412                                                                | reviewed_proxy     | purchase                 | medium       |
| Refrigeración industrial — instalación          | 238222                                                                | reviewed_proxy     | project                  | medium       |
| Compresores y aire comprimido                   | 333910                                                                | reviewed_proxy     | purchase / service       | low          |
| Tratamiento de agua industrial                  | 237111 / 541330                                                       | broad_unresolved   | project / operations     | medium       |
| Dispositivos y equipo médico                    | 339111 / 334519                                                       | reviewed_proxy     | purchase / qualification | medium       |
| Material de curación y desechables médicos      | 339112                                                                | exact_class        | purchase / qualification | medium       |
| Componentes automotrices                        | 336310 / 336320 / 336330 / 336340 / 336350 / 336360 / 336370 / 336390 | exact_class family | sourcing / qualification | medium       |
| 3PL y almacenaje industrial                     | 488519 / 493111 / 493119 / 493120 / 493130 / 493190                   | reviewed_proxy     | contracting              | medium       |

The current executable cohort is deliberately more conservative than this
backlog: it contains zero `exact_class` claims, 10 `reviewed_proxy` verticals
and 2 `broad_unresolved` verticals. The latter are structurally blocked from
promotion. Expansion work must preserve this distinction instead of upgrading
a commercial phrase based on lexical matching.

Common US NAICS substitutions are not valid SCIAN México six-digit classes.
For example: use 335312, not 335313/335314; 322210, not 322211; 333510, not
333511/333514; 331520, not 331523/331524; 333910, not 333912/333913/333914;
332910, not 332911/332912/332919; 493111/493119, not 493110; and
488511/488519, not 488510.

### Wave 1 — adjacent expansion

| Capability intent                   | Suggested SCIAN  | Primary buying job      | Doorway risk |
| ----------------------------------- | ---------------- | ----------------------- | ------------ |
| Fundición de hierro y acero         | 331510           | outsourcing             | medium       |
| Tratamientos térmicos               | 332810           | outsourcing             | medium       |
| Galvanizado                         | 332810           | outsourcing             | medium       |
| Anodizado de aluminio               | 332810           | outsourcing             | medium       |
| Soldadura industrial                | needs mapping    | service / fabrication   | high         |
| Extrusión de plástico               | 3261*            | outsourcing             | medium       |
| Soplado de plástico                 | 3261*            | outsourcing             | medium       |
| Botellas y envases PET              | 326160           | purchase / fabrication  | medium       |
| Etiquetas industriales              | 3231*            | purchase                | medium       |
| Tarimas y embalaje de madera        | 321920           | purchase                | medium       |
| Neumática industrial                | 333999           | purchase / integration  | low          |
| Hidráulica industrial               | 333999           | purchase / integration  | low          |
| Rodamientos y chumaceras            | 332991           | purchase                | low          |
| Bandas transportadoras              | 333920           | purchase / project      | medium       |
| Manejo de materiales                | 333920           | purchase / project      | medium       |
| Racks y estantería industrial       | 3372*            | purchase / project      | medium       |
| Metrología y calibración            | 541380           | service / qualification | medium       |
| Ensayos no destructivos             | 541380           | service / qualification | medium       |
| Limpieza industrial                 | 5617*            | service                 | high         |
| Químicos industriales               | 3251* / 3259*    | purchase                | medium       |
| Lubricantes industriales            | 3241* / 3259*    | purchase                | medium       |
| Adhesivos y selladores industriales | 325520           | purchase                | medium       |
| Pinturas y recubrimientos           | 325510           | purchase                | medium       |
| Equipo de protección personal       | needs mapping    | purchase                | high         |
| Gases industriales                  | 325120           | purchase                | medium       |
| Componentes y equipo eléctrico      | 3353* / 3359*    | purchase                | medium       |
| Arneses y ensambles de cable        | 336320 / 3359*   | sourcing                | medium       |
| Ensamble electrónico por contrato   | 3344*            | outsourcing             | medium       |
| Equipo de laboratorio               | 339111 / 334519  | purchase                | medium       |
| Transporte industrial y aduanas     | 4885*            | contracting             | high         |
| Maquila / fabricación por contrato  | product-specific | outsourcing             | high         |
| Maquinaria de empaque               | 333992           | purchase                | low          |

### Wave 2 — specialist opportunities

| Capability intent                           | Suggested SCIAN  | Primary buying job       | Doorway risk |
| ------------------------------------------- | ---------------- | ------------------------ | ------------ |
| Ingredientes y materias primas alimentarias | 3119* / 4311*    | purchase                 | high         |
| Maquinaria para alimentos                   | 3332*            | purchase / project       | medium       |
| Tanques industriales                        | 332420           | fabrication              | medium       |
| Calderas industriales                       | 332410           | purchase / project       | medium       |
| Fabricación en acero inoxidable             | 3323* / 3324*    | outsourcing              | high         |
| Tornillería y sujetadores                   | 332720           | purchase                 | low          |
| Resortes y productos de alambre             | 332610           | fabrication              | medium       |
| Impresión 3D / manufactura aditiva          | 332710           | prototype / outsourcing  | high         |
| Maquinado aeroespacial                      | 332710 / 3364*   | sourcing / qualification | high         |
| Manufactura en cuarto limpio                | product-specific | qualification            | high         |
| Pruebas electrónicas                        | 3344* / 541380   | service                  | high         |
| Componentes electrónicos                    | 3344*            | sourcing                 | medium       |
| Componentes para baterías                   | 3359*            | sourcing                 | high         |
| Carga para vehículos eléctricos             | 3359*            | purchase / installation  | high         |
| Ciberseguridad OT                           | 5415*            | service                  | high         |
| MES, OEE y trazabilidad                     | 5415*            | software / integration   | high         |
| Robótica y cobots                           | 333999 / 541330  | purchase / integration   | high         |
| Visión artificial industrial                | 334519 / 541330  | purchase / integration   | high         |
| Ingeniería inversa                          | 541330 / 332710  | service                  | high         |
| Laboratorios de certificación               | 541380           | service / qualification  | medium       |
| Manejo y reciclaje de residuos industriales | 5621*            | service / compliance     | high         |

## Deterministic expansion manifest

Expansion is driven by explicit editorial cells, never by a taxonomy ×
geography loop. `supplier-expansion.ts` requires a reviewed taxonomy, a reviewed
geography, an explicit parent, dated demand evidence and at least two dry-run
snapshots. Snapshot example identities are non-reversible hashes; raw names do
not enter the manifest.

The default promotion policy requires at least 8 observations, 5 named
examples, 2 evidence dimensions, two snapshots spanning 7 days with the latest
no older than 30 days, demand corroborated by at least two distinct signal
families including one positive directly measured demand kind,
stable required sources, count movement no greater than 50%, sibling sample
overlap no greater than 80%, no substantive hard failures and a score of at
least 70. Fixture data is a hard failure, not a tolerated noindex posture.
`broad_unresolved` taxonomies are always held. A manifest is bound to the
query-contract, policy and complete input digests. A human decision must be
made after and reference that exact manifest; promotion can change a candidate
to `approved` but always emits `indexingApproved=false`.

`seo:supplier-promote` is the only assembler for that review step. It is an
offline command with no Nest or database imports. The supplied decision file
must cover every `recommend_approval` proposal exactly once, record an operator
identifier, rationale and canonical timestamp, and reference the exact manifest
digest. Held proposals are never exposed as approvable decisions. The command
rejects cohort or query-contract drift, unknown or private candidate fields,
modified manifest content, incomplete/duplicate decisions and any attempt to
set `indexingApproved=true`. It writes a new `0600` JSON file with no-overwrite
semantics and an exact approved/rejected/held partition of all 46 cells. This
artifact is review input for a later persistence step; creating it writes no
candidate and publishes no URL.

The v3 manifest artifact carries the evaluator version, full cohort and query
contract digests, policy digest, HMAC key identity, every snapshot-artifact
digest, the demand-artifact digest and the observed corpus identities. Its own
digest covers that complete evidence chain. Promotion requires the reviewer to
pass that digest out of band as
`--expected-manifest-artifact-digest=<sha256>`; a self-hash alone is integrity,
not authorization. The decision artifact binds both the complete manifest
artifact and its inner deterministic manifest, must use an opaque reviewer ID
instead of an email, and expires seven days after manifest creation. The final
promotion artifact repeats the evidence-chain identities and has its own
content digest, so later persistence can refuse replay, policy drift or input
substitution without reopening the warehouse.

## Geographic backlog

### Wave 0 corridors

1. Monterrey–Apodaca; Santa Catarina–García; and Saltillo–Ramos Arizpe.
2. Querétaro–El Marqués–Colón and San Juan del Río–Pedro Escobedo.
3. León–Silao and Celaya–Apaseo.
4. Aguascalientes–Jesús María–San Francisco de los Romo.
5. San Luis Potosí–Villa de Reyes.
6. Guadalajara–Zapopan–El Salto.
7. Tijuana–Tecate and Ciudad Juárez.
8. Toluca–Lerma and Cuautitlán Izcalli–Tultitlán–Tepotzotlán.

### Wave 1 corridors

1. Escobedo–Ciénega de Flores–Salinas Victoria.
2. Torreón–Gómez Palacio.
3. Irapuato–Salamanca.
4. Mexicali and Chihuahua capital as separate markets.
5. Hermosillo–Nogales only if evidence supports one combined intent.
6. Reynosa–Matamoros.
7. Tlalnepantla–Naucalpan.
8. Puebla–San José Chiapa–Huejotzingo.

### Wave 2 corridors

1. Nuevo Laredo for logistics and customs, not generic manufacturing.
2. Tampico–Altamira for port, petrochemical and MRO demand.
3. Veracruz and Coatzacoalcos only as separate populations unless overlap data
   proves a useful combined corridor.
4. Mérida–Progreso.
5. Culiacán–Mazatlán for food packaging, cold chain and logistics.

## Promotion and exclusion rules

Promote a geography only when it has at least eight eligible observations, at
least five useful named examples, a materially different result set from its
parent, and two differentiating evidence dimensions beyond address/SCIAN.

Do not publish when:

- only the place name changes;
- more than 80% of named entities duplicate a sibling page;
- manufacturer, distributor, service and establishment cannot be distinguished;
- capability depends only on weak full-text coincidence;
- the SCIAN population is too broad to sustain the headline;
- certification, Tier, export status or capacity would have to be inferred;
- public-display rights or identity semantics are unresolved.

## Research references

- INEGI, SCIAN México 2023:
  <https://www.inegi.org.mx/contenidos/app/scian/estructura2023.pdf>
- Google Search spam policies:
  <https://developers.google.com/search/docs/essentials/spam-policies>
- Google people-first content guidance:
  <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>
- Google faceted navigation guidance:
  <https://developers.google.com/crawling/docs/faceted-navigation>
