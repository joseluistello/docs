# Phase 6 — Source Expansion Without Vendor Leakage

## Goal

Increase discovery and enrichment coverage using providers such as Bright Data and structured
company datasets without multiplying model-visible tools or coupling product behavior to a vendor.

## Capability model

Separate three capabilities:

1. **Open-web discovery** — find public documents/signals.
2. **Directed verification** — test a concrete claim against independent evidence.
3. **Structured company enrichment** — add firmographics to an already resolved organization.

Providers implement these capabilities behind ports. The model sees product verbs, never providers.

## Bright Data

If selected, implement it as an adapter behind the existing evidence-web provider port. Preserve the
same normalized document/evidence contract, breaker, egress rules, sanitization and audit. Provider
selection belongs to configuration/policy, not the prompt.

Do not add a Bright Data-specific tool to Chat or Investigation.

## Crunchbase-like structured data

Structured firmographics do not belong in the web-document port. Add a semantic enrichment port
used only after identity resolution. Input is a resolved organization/domain; output is typed fields
with provenance, observed time, licensing/retention metadata and confidence.

It must never be used for unconstrained cold discovery in the first slice.

## LinkedIn and social sources

Treat public indexed pages, licensed provider data and direct authenticated access as different legal
and technical surfaces. Before implementation, record:

- contractual right to collect and retain each field;
- whether the source permits derived commercial profiles;
- personal-data minimization and retention;
- deletion/export obligations;
- geography-specific restrictions;
- whether data can be shown, exported or promoted to a Collection.

The first source expansion should favor company-level facts and public announcements, not personal
profiles or contact scraping.

## Provider-neutral tests

Contract-test every adapter with the same cases:

- normalized documents/firmographics;
- provenance present;
- timeout and partial results;
- rate limit and breaker behavior;
- duplicate collapse;
- credential absence;
- secret/log redaction;
- disallowed egress;
- provider response containing prompt-injection text;
- licensing/retention flags preserved.

Add an architecture guard that rejects provider names and wire types outside adapter/config/tests.

## Observability and cost

Reuse OTEL/Latitude and existing per-call audit. Record capability, adapter id as internal metadata,
duration, result count, error class and estimated cost. Do not expose provider id or internal cost in
the user-facing activity stream.

## Acceptance

- Switching configured adapters changes no model-visible schema or UI component.
- A provider outage yields a bounded partial Investigation with prior rows preserved.
- Structured enrichment runs only on resolved candidates.
- Credentials use the encrypted provider-credential path and never enter model context.
- A data-rights review exists before any personal LinkedIn data is stored.

## Rollback

Disable the adapter in configuration. Existing normalized evidence remains readable with its
provenance and retention policy.

