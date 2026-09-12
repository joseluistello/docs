# Enrichment provider field matrix

Status: Tomba and Hunter contact reveal are restricted pilots. A selected result
may be displayed and contacted in-product, never exported. Each vendor has its
own emergency-brake flag (Tomba's `TOMBA_PILOT_ENABLED`, Hunter's
`HUNTER_CONTACT_ENRICHMENT_ENABLED`); API keys alone do not activate either.
Hunter's masked company/person directory remains approved only for evaluation in
staging: display is restricted, while export and contact remain blocked.

This matrix describes what the adapters can parse, not what Brein is currently
authorized to display, export, retain or use for contact.

## Provider fields

| Provider operation | Request fields sent by Brein | Provider fields parsed | Brein normalized fields | Current rights |
| --- | --- | --- | --- | --- |
| Hunter Email Finder | `domain`, `full_name`, server-held API key | `email`, `score`, `verification.status`, `verification.date`, `linkedin_url`, `sources[].uri`, `sources[].extracted_on`, `sources[].last_seen_on`, `sources[].still_on_page` | `provider`, `email`, `profileUrl`, `verification`, `confidence`, `attribution`, `sources`, `fetchedAt`, `observedAt`, `rights` | pilot: display and contact allowed; export blocked |
| Hunter Multi-Domain Reveal | one server-owned opaque `handle`, server-held API key | matching `reveal_handle`, `email`, `linkedin_url`, `outcome`, `score`, `verification.date`, `sources[]`, `meta.credits_charged` | same provenance fields plus reported provider credits | pilot: display and contact allowed; export blocked |
| Tomba Email Finder | `domain`, `full_name`, server-held key and secret | `email`, `linkedin` or `linkedin_url`, `score`, `verification.status`, `verification.date`, `sources[].uri`, `sources[].extracted_on`, `sources[].last_seen_on`, `sources[].still_on_page` | `provider`, `email`, `profileUrl`, `verification`, `confidence`, `attribution`, `sources`, `fetchedAt`, `observedAt`, `rights` | pilot: display and contact allowed; export blocked |
| Hunter Discover | `query`, exact company name, country, industry, headcount, company type, keywords, open-jobs flag and a bounded provider offset for subsequent pages; server-held API key | company name, domain, aggregate personal/generic/total email counts and pagination metadata; no email coordinate | response-level `provider`, empty `sources`, `fetchedAt`, null `observedAt`, unverified `verification`, null `confidence`, `attribution`, restricted `rights` | staging evaluation: directory display allowed; export and contact blocked; pagination depends on the Hunter plan |
| Hunter Multi-Domain Search | optional company name plus location, industry, headcount, company type, department, seniority, decision-maker, verification status, required field, minimum confidence, cursor and bounded result limit; server-held API key | masked name, role, company, department, seniority, channel-availability flags and opaque reveal handle; no email, phone or profile coordinate | response-level `provider`, empty `sources`, `fetchedAt`, null `observedAt`, unverified `verification`, null `confidence`, `attribution`, per-company claim and restricted `rights` | staging evaluation: masked display allowed; export and contact blocked |

An empty `sources` array means the provider supplied no source. It is preserved
as absent evidence and is never rewritten as “public”. `fetchedAt` records when
Brein received the response; `observedAt` is derived only from provider-returned
source or verification dates.

Generic mailboxes such as `info@`, `ventas@` or `contacto@` are stored only as a
company fallback. They never become the selected person's work email and never
settle a personal-contact purchase.

## Evidence still required

| Evidence | Hunter | Tomba | Consequence while missing |
| --- | --- | --- | --- |
| Executed DPA applicable to Brein | pending | pending | provider remains evaluating |
| Data-subject opt-out/suppression contract | pending | pending | Hunter blocked; Tomba limited to local pre-call and post-response suppression in the pilot |
| Retention limits | pending | pending | retention right unknown |
| Deletion workflow and durable deletion reference | pending | pending | deletion right unknown |
| Display, export, contact and redistribution rights | pending | OEM display/contact confirmed; export and broader redistribution pending | Tomba pilot can display/use a selected result in-product, but cannot export it |
| Subprocessor list and change mechanism | pending | pending | provider remains evaluating |
| Processing and storage regions | pending | pending | provider remains evaluating |

Public availability of a source, policy page or email is evidence of origin,
not evidence that Brein may redistribute it. A governance policy must explicitly
approve the provider and the requested rights before the adapter can be called.

## Runtime sequence

1. The caller confirms a server-issued quote and an exact record selection.
2. Brein persists a short-lived enrichment authorization tied to the actor,
   workspace, records, purpose, provider policy and idempotency key.
3. The governance port checks authorization, provider policy and domain/person suppression.
4. A denied or suppressed decision stops before customer debit and provider I/O.
5. The provider response is normalized with provenance, then exact-email suppression runs before persistence.
6. Governance attaches display/export/contact rights to the result.
7. Only the governance-owned contact-path write stores the result and its authorization ID.

The pilot requires `TOMBA_PILOT_ENABLED=true`. There is no workspace allowlist:
the provider's license already covers production, and every plan publishes a
contact-credit allowance, so scope is enforced by that credit balance (debited
before the provider is called), not by a manually maintained list of
workspace IDs. The flag itself is the emergency brake, not a scope control.

There is no end-user OAuth, provider token passthrough or customer-owned API key.
The adapters use Brein-managed server credentials only.

Hunter directory evaluation requires
`HUNTER_DIRECTORY_EVALUATION_ENABLED=true` and the exact staging deployment
branch. The config validator and runtime adapter both refuse it in production.

The dashboard may load a bounded first directory page automatically. Its
initial company view is scoped to Mexico; its initial people view is scoped to
Mexico and decision-makers, with a 25-row limit. These calls only browse the
masked directory and never invoke Finder or Reveal. Public-market explorers may
also load their first bounded page automatically. Supplier discovery remains
explicitly narrowed because the market-data API refuses an unbounded supplier
scan.

Provider response references: [Hunter API documentation](https://hunter.io/api-documentation)
and [Tomba Email Finder documentation](https://docs.tomba.io/api/finder).
