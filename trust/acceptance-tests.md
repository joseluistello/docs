# Acceptance tests

## Enrichment

- A request without a valid purpose or authorization is rejected.
- A suppressed email or domain is not enriched.
- A successful endpoint stores provider, source, observed time, verification,
  rights, retention, and deletion metadata.
- A general mailbox cannot become a personal endpoint.
- A provider with unknown export rights can be shown only where its policy
  permits display; export remains blocked.
- The staging MCP company search requires one criterion, returns at most 25
  companies, preserves per-company provenance/rights, and exposes no offset,
  cursor or automatic pagination.
- MCP acquired contacts never contain email, phone, LinkedIn/profile URL,
  endpoint `value`, or export-hint fields; availability plus provenance and
  rights are retained.
- Person discovery performs domain/person suppression and provider-policy
  authorization before recording an attempt or calling an adapter, and passes
  no more than three candidates to the provider.
- MCP prepare returns one reversible `not_sent` draft and no sequence,
  scheduler, sender, or recipient coordinate.

## Export

- Export requires its own authorization.
- Export re-checks suppression and rights at execution time.
- Restricted fields are omitted or the export fails closed with an actionable
  reason.
- The audit event does not contain raw email addresses or message content.

## Send

- Send cannot start from enrichment authorization alone.
- Suppressed, unsubscribed, and bounced contacts are excluded.
- A provider failure cannot silently mark the audience as sent.
- Unsubscribe and bounce events create or update suppression entries.

## Deletion

- Deleting a contact removes its record fields and derived indexes.
- Expiration prevents future export or send.
- Disconnecting Google revokes or deletes tokens and removes permitted cached
  data.
- A provider deletion failure remains visible as an unresolved control result.

## UX

- Normal enrichment requires one short confirmation, not a legal form.
- Export and send use separate confirmations.
- Blocked actions explain the operational reason in plain language.
