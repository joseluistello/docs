# Suppression, retention, and deletion implementation

## Decision order

Every contact action follows this order:

1. normalize the candidate;
2. check active suppression;
3. check provider and field rights;
4. check authorization for the specific action;
5. execute;
6. write the minimum audit event.

No later step can override a suppression match.

## Deletion behavior

Deletion must cover the contact record, serialized `contact_path`, indexes,
exports, drafts, campaign audiences, provider copies where supported, and
derived search material. If a provider cannot delete a field, the provider
must remain unapproved for that field or the field must be blocked.

Retention jobs must be idempotent and safe to retry. A deletion request should
leave only a minimal proof record: request reference, scope, timestamps,
result, and unresolved provider exception if any.

## ARCO and opt-out

An opposition or opt-out creates an active suppression entry immediately. It
must not wait for a manual legal review before blocking new enrichment,
export, or contact actions. The substantive request can continue through the
ARCO workflow separately.
