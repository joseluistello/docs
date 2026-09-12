# Nylas send-only security contract

## Status

Nylas is the conditioned provider for the closed outbound-email beta. It is not
an active production subprocessor until the commercial and privacy questions
below are answered in writing and an authorized-account staging E2E passes.
Smartlead is legacy-only: existing senders must reconnect and existing active
campaigns stop locally during migration.

## Data path

1. A workspace owner or admin chooses Google or Microsoft.
2. Brein creates a one-use, workspace- and principal-bound OAuth session with
   state and PKCE.
3. Nylas hosts provider authorization and exchanges the provider credentials.
4. Brein exchanges the returned one-use code server-side. If the response
   contains provider access or refresh tokens, Brein discards them immediately.
5. Brein stores only the Nylas grant id, sender address, provider type, consent
   version, health state, workspace id, and audit timestamps.
6. The first message and each later follow-up require a separate human send
   authorization bound to the current sender, provider, audience fingerprint,
   content fingerprint, policy version, and sequence step.
7. Immediately before every send, Brein checks workspace ownership, ready
   sender state, the unconsumed step authorization, and local suppression.
8. Nylas receives the recipient, reviewed content, opaque grant id, signed
   unsubscribe URL, and a stable idempotency key. Provider acceptance is not
   represented as delivery.
9. Replies remain in Gmail or Outlook. Brein does not read them and cannot stop
   a follow-up automatically from a reply in this mode.

## Permission disclosure

- Google: request `gmail.send`; do not request inbox-read scopes.
- Microsoft: Nylas requires technical Microsoft mail permissions broader than
  strict send-only. Brein's adapter has no read, list, search, thread, contact,
  or calendar operation. The consent screen must say both facts plainly.
- Nylas manages provider credentials. Brein does not persist OAuth access or
  refresh tokens and never exposes them to the browser.

## Suppression and unsubscribe

Every message includes a visible signed unsubscribe URL. Where the provider
supports the headers, the same URL is sent in `List-Unsubscribe` and
`List-Unsubscribe-Post`. The token contains an expiring message id, not an email
or workspace id. Successful unsubscribe creates or updates workspace-local
suppression, marks the recipient unsubscribed, and skips all pending messages.
The dispatcher repeats the local suppression check immediately before sending.

Strict send-only access cannot reliably observe delayed non-delivery reports in
the inbox. The beta therefore suppresses explicit local unsubscribe and known
synchronous provider rejection, but must not claim automatic delayed-bounce
detection. Broader read access for bounce automation requires a future, separate
product and privacy decision.

## Provider questions required before production

- OEM, resale, embedded-connect, and white-label rights for Brein customers.
- DPA, controller/processor roles, data regions, subprocessors, and breach terms.
- Ownership, encryption, rotation, revocation, export, and deletion of grants
  and underlying provider tokens.
- Message-body, recipient, metadata, log, backup, and support-access retention.
- Confirmed deletion SLA after grant deletion and customer/workspace deletion.
- Tracking defaults and proof that open/click tracking remains disabled.
- Rate limits, idempotency behavior, ambiguous-send handling, and support SLA.

## Release gates

- No client activation and no production designation from code completion alone.
- Migration and rollback verified on an isolated database.
- Controlled Google and Microsoft connections, sends, unsubscribe, pause,
  disconnect, deletion, cross-workspace denial, and duplicate-dispatch tests.
- E2E uses only accounts controlled by Brein and explicitly authorized
  recipients. Evidence distinguishes API acceptance from mailbox delivery.
