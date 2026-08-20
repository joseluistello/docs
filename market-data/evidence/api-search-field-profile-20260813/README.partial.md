# Partial live API search field profile checkpoint

Created at UTC: 2026-08-13T00:23:57.266890+00:00

Status estimate: 88-92% complete.

Saved dataframe count from persisted files: 12

New DENUE fallback evidence:
- `live_denue_coverage_detail`
- `live_denue_coverage_datasets`
- `denue_coverage_fallback.partial.json`

DENUE decision in this checkpoint:
Direct DENUE table profiling is treated as blocked by statement timeouts. The package now uses `market_data.dataset_coverage` as a coverage-only fallback: visible rows, dataset partition count, and per-dataset loaded/published/rejected rows.

Generated top-level files:
- MANIFEST.partial.json
- README.partial.md
- capabilities_facets_contracts.partial.json
- complete_profile.partial.json
- denue_coverage_fallback.partial.json
- exact_small_value_catalog.partial.json
- executive_summary.partial.md
- observed_aliases.partial.json
- query_log.partial.json

Remaining blockers:
- categories top-value JSONB expansion timed out; row-level fallback is saved.
- final promotion from `.partial.*` filenames is pending acceptance of DENUE coverage-only fallback.
