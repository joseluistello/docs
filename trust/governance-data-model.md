# Governance data model

This is the minimum metadata model. Names are logical contracts; the
implementing model may adapt naming to existing TypeORM conventions.

## `data_authorizations`

One row per user-approved high-impact action.

- `id`
- `workspace_id`
- `actor_id`
- `action`: `enrich | export | send | google_access`
- `purpose`
- `record_ids` or a bounded audience reference
- `provider_id` nullable
- `policy_version`
- `authorized_at`
- `expires_at` nullable
- `revoked_at` nullable
- `metadata` with non-sensitive action context

An enrichment authorization cannot satisfy an export or send authorization.

## `contact_endpoint_provenance`

One row per endpoint or a versioned embedded object where the existing record
shape requires it.

- `record_id`
- `endpoint_hash` or stable endpoint reference
- `provider`
- `source_urls` or source identifiers
- `source_type`: `public | licensed_provider | user_supplied | google | inferred`
- `observed_at`
- `verification`
- `confidence`
- `attribution`
- `rights_status`: `approved | restricted | unknown | blocked`
- `may_display`
- `may_export`
- `may_contact`
- `retention_until`
- `deletion_handle`
- `policy_version`

The email value must not be duplicated into audit logs. Audit records should
use a stable reference or keyed hash where possible.

## `suppression_entries`

- `workspace_id` nullable for global suppression
- `match_type`: `email | domain | person | account | campaign`
- `match_value_hash`
- `reason`: `manual | unsubscribe | bounce | arco | complaint | policy`
- `source`
- `created_at`
- `expires_at` nullable
- `active`

Matching must be normalized and case-insensitive. A suppression decision must
be explainable without returning the suppressed value to the UI.

## `provider_policies`

- `provider`
- `status`: `evaluating | pilot | approved | suspended | rejected`
- `data_classes`
- `allowed_purposes`
- `may_display`
- `may_export`
- `may_contact`
- `retention_days`
- `deletion_supported`
- `dpa_reference`
- `subprocessor_reviewed_at`
- `policy_version`
- `reviewed_at`

Unknown or expired policy rows must disable the affected action.
