# Source expansion — data rights, and which providers are selected

Phase 6 requires that source expansion happen behind capability ports and that
LinkedIn/social sources get a recorded data-rights review **before**
implementation. This is that record. It also states which providers are selected
today, which is: **none beyond the web-document executor already wired**.

Nothing here is a legal opinion. It records (a) what this codebase does and
refuses to do, which is verifiable from the code and enforced by tests, and
(b) which questions a provider must answer before it can be selected, with the
answers marked **NOT DETERMINED** where no contract has been read in this
repository. A NOT DETERMINED row is a decision waiting for a human, not a gap to
be filled in by guessing.

## The three capabilities, and why they are separate

| Capability | Contract | Input | Output |
|---|---|---|---|
| Open-web discovery | `EvidenceWebProviderPort` | queries | documents with locatable excerpts |
| Directed verification | `EvidenceWebProviderPort` | a claim + queries | documents with locatable excerpts |
| Structured enrichment | `InvestigationEnrichmentPort` | a **resolved** organization | typed fields with licence, observation time, confidence |

The first two share the web-document port because their contract is "what a page
said". Firmographics are not documents — they are typed assertions carrying a
licence — so routing them through the document port would store a vendor's
structured claim as if a page had published it, and lose the licensing metadata
that decides whether the value may be displayed at all.

Enrichment runs **only after identity resolution**. The port has no name-only
input shape: `ResolvedOrganization` requires an entity id or a stated domain, and
`resolvedOnly()` drops anything else at the seam. Cold discovery through a
firmographics provider is unbounded spend against an unbounded set, and it is not
in this slice.

## What the platform stores today

Verifiable from `libs/db/src/entities/investigation-candidate.entity.ts` and the
migration that created it:

- organization name, domain, geography;
- a signal type and summary, an announcement date, a commercial-relevance note;
- evidence ids and an independent-source count;
- a score and its ranking reasons.

**No personal data.** There is no person, contact, email, phone or job-title
column, and the discovery contract refuses a brief that asks for one:
`PEOPLE_VOCABULARY` in `apps/api/src/research-providers/web-market-discovery.contract.ts`
rejects contact and role vocabulary — including the word *linkedin* — as query
material in both capabilities. `research-providers.architecture.spec.ts` pins
that this is the only place in the layer that knows the word.

That is the current answer to "personal-data minimization": the schema cannot
hold personal data, so minimization is structural rather than a policy somebody
has to remember.

## The questions every source must answer before selection

Per Phase 6, and to be answered **per field**, not per vendor:

1. **Contractual right to collect and retain each field.** Which fields does the
   agreement cover, and for how long?
2. **Derived commercial profiles.** Do the terms permit building and selling a
   derived profile from the data, or only internal use?
3. **Personal-data minimization and retention.** Is any field personal data? If
   so, what is the lawful basis, and what is the retention limit?
4. **Deletion and export obligations.** On a subject request or contract
   termination, what must be deleted, and within what window? Can we satisfy it
   for values already copied into a Collection?
5. **Geography-specific restrictions.** Where may the data be processed and
   stored, and which jurisdictions restrict this category of data?
6. **Show / export / promote.** May a value be displayed in the product?
   Exported to CSV? Written into a Collection record, which leaves the
   investigation's lifecycle behind?

The port carries the answer to question 6 on **every value**, not on the adapter:

```ts
interface FieldLicensing { mayDisplay: boolean; mayExport: boolean; retentionDays: number | null }
```

`displayableFields()`, `exportableFields()` and `withinRetention()` apply it at
the seam, so every consumer inherits the rule instead of re-deciding it.
`licensingViolations()` refuses a field claiming rights broader than the adapter
declared: a per-field licence may **narrow** the contract, never widen it, and a
retention limit with no observation time is a contract breach rather than a
degraded field — there would be no clock to measure the window from.

## Decisions

### D1 — LinkedIn and social sources: not implemented, and not storable

**Decision: no LinkedIn or social personal data is collected, stored, displayed,
exported or promoted.** The first source expansion favours company-level facts
and public announcements, per Phase 6.

This is a *deny*, so it needs no external answer: refusing to store a category of
data requires no contract. The corresponding *allow* would need every question
above answered, and would additionally trip the queue's global stop condition —
"exposing raw LinkedIn personal data or implementing scraping without a
documented legal/data-rights decision" — so it cannot be taken without an
explicit human decision recorded here first.

| Question | Answer |
|---|---|
| Right to collect/retain | N/A — nothing is collected |
| Derived commercial profiles | Not built |
| Personal data | None stored; the schema has no column for it |
| Deletion/export obligations | N/A |
| Geography | N/A |
| Show / export / promote | No, on all three |

### D2 — Bright Data (and unlocker/scraping networks): NOT SELECTED

Phase 6 says "if selected, implement it as an adapter behind the existing
evidence-web provider port". It is **not** selected, for a reason that is
architectural before it is legal: the seam it would sit behind already exists and
is proven by the shared conformance suite, so selecting a provider is a
configuration act — and it is the wrong week to spend the review budget on it.

The blocking facts, stated as they are:

| Question | Answer |
|---|---|
| Commercial agreement | **NOT DETERMINED** — no contract has been read in this repository |
| Right to collect/retain per field | **NOT DETERMINED** |
| Derived commercial profiles | **NOT DETERMINED** |
| Geography restrictions | **NOT DETERMINED** |
| Robots/ToS posture for the target sites | **NOT DETERMINED** |

A scraping-network adapter is *implementing scraping*, which the queue's global
stop conditions place behind a documented legal decision. That decision has not
been made, so the adapter is not written. **This is a documented stop, not an
omission**, and it does not block the rest of Phase 6: the point of the phase is
the seam, and the seam is complete and tested without a second vendor.

**What is ready for the day it is selected**, so that day is small:

- `EvidenceWebProviderPort` is provider-neutral and already carries a per-vendor
  `WebContentLicense` (`mayStoreArtifact` / `mayDisplayExcerpt` / `mayRedistribute`
  plus a note written for a lawyer). A vendor whose terms have not been read
  answers `false, false, false` and the router will not persist from it.
- The shared conformance suite
  (`apps/api/src/research-providers/ports/web-provider.conformance.ts`) gives a
  new adapter its ten cases: normalized documents, provenance, timeout/partial,
  rate limit and breaker, duplicate collapse, credential absence, secret
  redaction, disallowed egress, prompt-injection text, and a capability
  declaration that matches what actually comes back.
- The composition root binds one token to one adapter instance, so a second
  executor is a binding change and nothing else.

### D3 — Structured firmographics (Crunchbase-like): NOT SELECTED, port shipped

`InvestigationEnrichmentPort` is defined, the licensing/retention/confidence
metadata travels with every value, and the enrichment step runs only on resolved
organizations. **No vendor is configured**, and that is bound explicitly:
`NullEnrichmentAdapter` declares zero field keys and a licence that grants
nothing, so the runner skips the step with `capability_unavailable` and the
investigation lands `partial` — a declared hole rather than a silent one.

| Question | Answer |
|---|---|
| Commercial agreement | **NOT DETERMINED** |
| Fields covered, and retention per field | **NOT DETERMINED** |
| Derived commercial profiles | **NOT DETERMINED** |
| Personal data | Out of scope by design — the port is for firmographics; no person fields are declared |
| Deletion/export obligations | **NOT DETERMINED** |
| Geography | `dataRegions` is declared per adapter; `null` means undisclosed, which is a finding |
| Show / export / promote | Decided per field at runtime by `FieldLicensing`, never by the adapter |

## Provider neutrality, enforced

- `research-providers.architecture.spec.ts` — vendor names and wire vocabulary
  appear nowhere outside `adapters/`; the source-expansion vendor set
  (unlocker networks, firmographics providers) is in the token list *before* any
  of them is wired, which is when a name is cheapest to keep out.
- `investigations.architecture.spec.ts` — the same rule for the investigation
  surface, where the quarantine is `*.adapter.ts`; this layer may not import
  `research-providers/adapters/`; and an adapter id may not name a vendor either,
  because it is read in logs and copied into dashboards.
- `sanitizeEventDetail` drops adapter ids and internal cost from the curated
  activity stream by key, whatever their type. Provider choice is not a
  product-visible fact, and an internal cost is not a price.

## Rollback

Disable the adapter in configuration. Existing normalized evidence remains
readable with its provenance, and every enriched value keeps the licence and
retention window it arrived with — those live on the value, not on the adapter,
so removing the adapter does not widen or void them.
