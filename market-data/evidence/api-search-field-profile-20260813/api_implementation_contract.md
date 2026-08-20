# API implementation contract notes

Created at UTC: 2026-08-13T00:25:32.476670+00:00

## Facet style

Use exact-match filters for low-cardinality values. Use normalized exact plus fuzzy/trigram matching for high-cardinality entity names.

## Tenders

Exact facets:
- source_slug
- status
- is_open
- contracting_type
- procedure_type
- announcement_character
- state_name
- actionability

Date filters:
- published_date
- clarification_date
- opening_date
- award_date
- actionable_as_of

Text search:
- title
- description
- buyer_name

## Awards

Exact facets:
- source_slug
- currency
- amount_scope
- contracting_type
- contract_status
- supplier_country
- supplier_size
- is_mipyme
- procedure_type

Range filters:
- amount, but require/strongly encourage currency and amount_scope companion filters.

Entity search:
- supplier_rfc exact normalized.
- supplier_name and buyer_name exact normalized plus fuzzy/trigram.

## Directory

Exact/source-level facets:
- source_slug
- observed_kind
- state_code
- state_name
- municipality
- has_website

JSONB metadata:
- business_contacts supports safe metadata facets: kind, classification, source_field.
- raw business contact values should not be exposed in profile artifacts.
- DENUE is coverage-only in this package.
