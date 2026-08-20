# Chat regression bank

Version 1 — 2026-08-19. Written against `chat.skill.ts` (CORE hash
`416d984a…`, MARKET_PLAYBOOK hash `bf9a7e67…` — see the pins in
`apps/api/src/cognitive/skills/chat.skill.spec.ts`) and
`market-investigation.skill.ts` v2.9.0.

## What this is, and what it is not

Fifteen regression questions for Chat, each with a **behavior assertion** —
which tool(s) the answer must be grounded in, what it must say, and what it
must never say — instead of a literal expected answer. A literal expected
answer (a company name, an amount) is a fixture pretending to be a live
corpus, and the first honest run invalidates it; a behavior assertion stays
true as the corpus grows. This is the same discipline
`discovery-validation.cases.ts` uses for the web-discovery engine, applied to
Chat's own turn.

This is **a bank, not a runner**. Nothing here executes these questions
against a live model. A future harness — following the shape of
`chat-live-evals.ts` / `harness:chat-evals` — can send each `question` to a
real Chat turn and grade the transcript against `must_use`, `must_say` and
`must_not_say`; until then, this file is the frozen reference a human or an
agent reads before changing `chat.skill.ts` or the market-data tool
descriptions, to check nothing here regressed.

**Versioning discipline.** A case's `id` never changes once written. If a
question turns out to be badly posed, or the corpus moves under it, retire
it (mark `status: retired` and say why) and add a new id — never edit an
existing id's `question` or assertions to make a later run look right. The
version number at the top bumps only when the SET of cases changes (added,
retired, or an assertion corrected); it is not a changelog of every re-read.

## Format

Each case: `id`, `category`, `question` (as a teammate would type it, in the
language they would use), `must_use` (the tool(s) grounding a correct
answer), `must_say` (behavior the answer must exhibit), `must_not_say`
(the specific failure this case exists to catch), and `anchors` (where the
rule lives in code, for whoever investigates a failure).

---

### Contract statistics (aggregate, amount vs. volume, adjudicado ≠ pagado, cutoff)

**stats-01 — most contracts by count**
> "¿Qué proveedor ganó más contratos con Pemex el año pasado?"
- must_use: `aggregate_awards` with `order_by: award_count` (or the default aggregate ranked by count), `group_by` including the supplier
- must_say: the ranking is by number of contracts, not by money; states the currency/amount_scope context even though the question is about count; states the corpus cutoff (`as_of`) if a specific year's totality is implied
- must_not_say: reports a peso/dollar total as if it were the same ranking as "most contracts"; blends a count-ranking answer with an amount-ranking claim
- anchors: `chat.skill.ts` MARKET_PLAYBOOK — `rank by contract COUNT`

**stats-02 — most money received**
> "¿Quién recibió más dinero en contratos de obra pública en 2025?"
- must_use: `aggregate_awards` with `order_by: total_amount`, one `currency` and one `amount_scope`
- must_say: states currency and amount_scope explicitly beside any total; an RFC-grouped result leads with the supplier NAME label already returned, not a second name-resolution call
- must_not_say: sums two different currencies or amount_scopes into one figure; treats this ranking as interchangeable with "most contracts"
- anchors: MARKET_PLAYBOOK — `rank by TOTAL AWARDED AMOUNT`, `"amount_scope"`

**stats-03 — awarded is not paid**
> "¿Cuánto le han pagado a [proveedor] este año?"
- must_use: `search_awards` or `get_supplier_history` with the resolved RFC
- must_say: reframes the answer around what was AWARDED and published, and states plainly that an award is not a record of payment, delivery or completion
- must_not_say: "le pagaron $X" or any phrasing that reports an awarded amount as money received
- anchors: `search_awards` tool description — "never that it was paid, delivered or completed"; CORE — "an award is not proof of payment"

**stats-04 — cutoff date on a totality claim**
> "¿Cuál es el total de contratos adjudicados en Jalisco este año?"
- must_use: `aggregate_awards` or `search_awards` with a `state` filter
- must_say: states the corpus's `as_of` / cutoff date alongside the total, and that the total is scoped to what is published as of that date — never "el total" unqualified
- must_not_say: presents a figure as the complete real-world total for the year without naming the corpus cutoff it was read against
- anchors: MARKET_PLAYBOOK — `"coverage"` bullet, `"as_of"` (the corpus cutoff)

---

### Due diligence by RFC (risks + history, never an absolute "clean" verdict)

**dd-01 — risk screening by RFC**
> "¿[RFC] tiene algún antecedente de riesgo o sanción?"
- must_use: `search_risks` with `rfc`
- must_say: reports a mark as a published listing (EFOS / sanción), never a judicial conviction; if zero rows, states that against the coverage read, not as a bare "no risk marks"
- must_not_say: "está limpio" / "es confiable" / any absolute clean/trustworthy verdict
- anchors: MARKET_PLAYBOOK — "A mark is a listing, not a conviction"; `due-diligence-screening.md` — "Claims that are always wrong"

**dd-02 — due diligence by name only**
> "¿La empresa 'Grupo Constructor del Norte' tiene mala fama con el gobierno?"
- must_use: `search_risks` with `entity_name` (no RFC given)
- must_say: names the resolution method (`match.matchMethod` / approximate identity) and presents results as CANDIDATES, offering the RFC(s) found
- must_not_say: asserts identity from the name match alone; merges a risk-mark search with a permits search into one verdict
- anchors: `due-diligence-screening.md` — "Name-approximate second, with the caveat stated"

**dd-03 — permit + risk combined, no single verdict**
> "Antes de contratar a [proveedor], ¿está autorizado y sin sanciones?"
- must_use: both `search_permits` and `search_risks`, keyed on the same resolved RFC
- must_say: reports the permit finding and the risk finding SEPARATELY; a permit is a granted right recorded at load time, not a live operational check
- must_not_say: "está autorizado y limpio" as one merged verdict; treats an absent permit row as proof of no authorization
- anchors: `due-diligence-screening.md` — "A permit and a risk mark answer different questions... do not merge"

---

### A year (or scope) with no published coverage

**cov-01 — a year the corpus may not publish**
> "¿Cuántos contratos se adjudicaron en 2019?"
- must_use: `search_awards` or `aggregate_awards` with a date range on 2019
- must_say: if the result is empty or thin, reads `coverage` and states what the corpus covers (which years/sources are actually published) before concluding anything about 2019 itself
- must_not_say: "no hubo contratos en 2019" or "no existen datos" stated as a fact about the world, without having read and reported the coverage the empty result was checked against
- anchors: MARKET_PLAYBOOK — `"coverage"` bullet; CORE — "an empty search is not proof of absence"

**cov-02 — a state/segment combination that may be empty**
> "¿Qué oportunidades de obra pública hay en Baja California Sur ahora mismo?"
- must_use: `search_opportunities` with `state` and, if used, `actionability`
- must_say: on a zero or thin result, states the search against its coverage (source, as_of, corpus size) rather than declaring the segment empty
- must_not_say: "no hay oportunidades en BCS" as an unqualified market claim
- anchors: MARKET_PLAYBOOK — visibility/coverage rules; `sources-and-use-cases.md` — "Coverage... is the only thing that can tell an empty result apart from an empty market"

---

### Registry / padrón membership — the motivating bug

**reg-01 — the exact reported bug**
> "¿Puedes ver el padrón de exportadores?"
- must_use: `search_suppliers`, either with `source_slugs` set to a plausible registry slug or with a plain `query` (e.g. "exportador", "padrón de exportadores") — an actual tool call, not a workspace/topic search
- must_say: if rows come back, names them and states they come from the exporter/importer registry; if the first attempt is empty, tries the other approach (slug vs. query) before concluding anything
- must_not_say: "no tengo acceso al padrón de exportadores" or "no está en ninguno de los mundos a los que llego" without ever having called a market-data search tool with that registry in mind — this is the exact failure this bank exists to catch
- anchors: `market-data.tool-defs.ts` — `SOURCE_SLUGS_TEACHES`; MARKET_PLAYBOOK — "membership question... filter by source_slugs before saying one is unavailable"

**reg-02 — a license/authorization framed as a registry question**
> "¿Esta farmacia tiene licencia sanitaria vigente ante COFEPRIS?"
- must_use: `search_permits` with `holder_name` (or `holder_rfc` if known)
- must_say: reports a found permit as a granted right recorded at load time, never as proof the pharmacy is operating today; if empty, reads coverage before saying anything about the license's existence
- must_not_say: "no tenemos esa información" without having called `search_permits`; "no tiene licencia" from an empty result whose coverage was never checked
- anchors: `search_permits` tool description; `registry-membership-screening.md`

**reg-03 — a registry named in words the model has never seen**
> "¿Esta empresa aparece en el RENIECYT?"
- must_use: `search_suppliers` (query or source_slugs) as the first attempt, even though "RENIECYT" is not a slug the model was given verbatim
- must_say: attempts a search before answering; if nothing matches, states what was searched and its coverage, and invites the teammate to confirm the registry's exact name if unsure
- must_not_say: declares the registry "not supported" or "not something I can check" purely because the exact slug was not recognized ahead of time
- anchors: `registry-membership-screening.md` — "Never answer from memory alone"; `SOURCE_SLUGS_TEACHES` — "or run a plain query and read the source_slug each matching row already carries"

---

### General regression (surface routing, item-naming, delegation)

**gen-01 — market question must not be answered from workspace topics**
> "¿Manejamos información de aduanas o comercio exterior?"
- must_use: `search_suppliers` / `search_awards` etc. (market surface) once the question is clearly about the external market catalogue, not `search_topics` alone
- must_say: if the question is ambiguous between "does OUR workspace track this" and "does the public catalogue cover this", answers the market-catalogue reading when that is the more useful one, or asks the one clarifying question
- must_not_say: concludes "no tenemos eso" from a workspace/topics search alone when the actual capability lives on the market surface
- anchors: CORE — "Pick the surface from the question"; "Never survey one surface as a generic fallback for another"

**gen-02 — results before limits**
> "Dame 5 fabricantes de válvulas industriales en Nuevo León."
- must_use: `search_suppliers` with `state` and a product `query`
- must_say: names the five (or however many are visible) suppliers by name/identifier BEFORE any caveat about coverage or method
- must_not_say: "Encontré cinco fabricantes con contacto publicado" as the whole answer, with the names withheld or deferred
- anchors: CORE — "Deliver the things before you describe the limits"; "A count is not an answer"

**gen-03 — cursor continuation, not a bigger limit**
> "Necesito 30 proveedores de empaque en CDMX, no solo los primeros que salgan."
- must_use: `search_suppliers` called repeatedly with the returned `cursor`, accumulating distinct rows
- must_say: keeps requesting with the cursor until 30 distinct rows are reached or the corpus is genuinely exhausted
- must_not_say: re-issues the same search with a larger `limit` instead of paging with the cursor
- anchors: MARKET_PLAYBOOK — "continue with the returned cursor... Do not restart the same search with a larger limit"
