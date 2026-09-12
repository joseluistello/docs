# Authorization contracts

## Enrichment

The current request contains only `record_ids`. The governed contract must
also resolve or create an authorization with:

- `purpose`: a bounded product purpose, not free-form legal language;
- selected records;
- actor and workspace;
- provider policy version;
- confirmation timestamp;
- disclosure that external providers may be used;
- explicit statement that no message will be sent.

The service must reject the operation when the provider policy does not allow
the purpose, the records contain active suppression, or rights are unknown.

The staging MCP lifecycle has separate narrow actions. Company search is a
bounded display-only discovery request that requires one explicit criterion;
save and person selection accept only server-issued opaque claims/ranks; person
discovery is capped at three candidates and must complete its provider-policy
and domain/person suppression preflight before an attempt is recorded or a
provider is called. The MCP acquired-contact read is a redacted projection:
coordinates and export hints are omitted while provider, sources, fetched and
observed times, verification, confidence, attribution and rights remain.

Preparation is a separate reversible action. It rechecks suppression and
conditioned-provider rights, returns one `not_sent` draft, and cannot create a
sequence, schedule, send, or expose a recipient coordinate. `commercial:discover`
covers company search/save and person discovery, `commercial:read` covers the
safe acquired-contacts read and the quote, and `commercial:activate` remains
limited to reveal, file and status. Reveal, file and status still require an
accountable human identity; no customer OAuth or provider token passthrough is
used.

## Export

Export requires a separate authorization containing:

- selected fields;
- destination type;
- actor;
- purpose;
- provider/source rights check;
- suppression check;
- timestamp and policy version.

The export job must re-evaluate rights at execution time, not only when the
user opens the export dialog.

## Send

Sending requires a separate authorization containing:

- audience reference;
- sender/provider;
- message or campaign reference;
- actor;
- suppression and bounce snapshot;
- confirmation timestamp;
- policy version.

Enrichment, export, or a connected Nylas account must never implicitly
create this authorization.
