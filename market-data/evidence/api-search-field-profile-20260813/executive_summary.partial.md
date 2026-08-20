# API search field profile — partial checkpoint

Created at UTC: 2026-08-13T00:16:04.602482+00:00

Folder: `api_search_field_profile_20260813_partial`

Current estimate: 82-86% complete.

What is now saved:
- Raw live dataframe exports under `dataframes/` as CSV and JSON.
- `MANIFEST.partial.json` with dataframe inventory.
- `complete_profile.partial.json` combining all live checkpoint evidence.
- `capabilities_facets_contracts.partial.json` with draft API filter/search contracts.
- `exact_small_value_catalog.partial.json` with scalar summaries and safe metadata catalogs.
- `observed_aliases.partial.json` with normalization and alias notes.
- `query_log.partial.json` with live variables and known timeout blockers.

Main conclusions so far:
- Tenders are usable for exact facets on status/open/procedure/contracting/state/actionability and for date/text search fields.
- Awards are usable for exact facets on source/currency/amount_scope/contracting/status/supplier metadata/procedure, plus amount ranges scoped by currency and amount_scope.
- Directory small sources have usable scalar and JSONB metadata evidence.
- Business contact profiling is safe and metadata-only; raw values are intentionally not exported.
- DENUE direct profiling remains the main blocker; dataset coverage is available but direct scans time out.

Remaining work:
1. Decide DENUE fallback: accept dataset_coverage-only for this package or create a lower-level sampled/physical-layout strategy.
2. Optionally retry categories top values with an even smaller split or sample.
3. Promote partial files to final filenames once DENUE/category decision is made.
