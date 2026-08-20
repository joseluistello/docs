# Frozen market-data evidence

Files below this directory are empirical design inputs, not runtime assets.
Production code in `apps/` and `libs/` must never import them or derive hard-coded
answers from their measured values. Runtime capabilities and facets must come
from the semantic market-data services and the live, licensed corpus.

## API search field profile — 2026-08-13

`api-search-field-profile-20260813/` contains the canonical live profile used to
choose exact filters, governed facets, full-text search, and trigram fallbacks
for supplier discovery, opportunity discovery, and market history.

Start with:

1. `executive_summary.md`
2. `api_implementation_contract.md`
3. `capabilities_facets_contracts.json`
4. `exact_small_value_catalog.json`
5. `literal_sql_execution_log.json`
6. `readiness_matrix.json`

Known boundary: DENUE field distributions are sampled rather than full-table
exact. Do not claim national facet completeness from that sample.
