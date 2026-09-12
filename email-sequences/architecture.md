# Email sequences architecture

Brein owns campaign state, rendered content, schedules, authorization, local
suppression, unsubscribe, and the user experience. Nylas is a send-only
transport behind `EmailProviderAdapter`.

```text
human review -> step authorization -> dispatcher -> local suppression check
             -> workspace sender grant -> Nylas send API -> provider accepted

recipient reply ------------------------------------------------> Gmail/Outlook
```

## Boundaries

- Mailbox connection proves connectivity; it never authorizes a send.
- The initial message and every follow-up have separate immutable human
  authorizations tied to sender, provider, audience fingerprint, content
  fingerprint, policy version, workspace, and step number.
- The dispatcher uses the stored Nylas grant only for
  `POST /v3/grants/{grant_id}/messages/send` and uses the recipient-message id as
  the stable provider idempotency key.
- Suppression is checked locally immediately before each network send.
- Every message carries a visible, signed unsubscribe URL. Google additionally
  receives one-click unsubscribe headers. Microsoft receives the visible URL
  because its transport does not support those custom headers consistently.
- A successful send API response means accepted by the provider, not delivered.
- There is no Nylas message list/search, thread, contacts, calendar, reply
  webhook, or tracking operation in the active adapter.
- Replies and delayed non-delivery reports are not read in strict send-only
  mode. Brein does not claim automatic reply stop or delayed-bounce detection.

## OAuth and secrets

The browser receives a provider authorization URL and a one-use PKCE verifier,
never a provider token. Nylas hosts OAuth. The callback is bound to workspace,
human principal, provider, state, expiry, and PKCE. During server-side exchange,
Brein discards any returned access/refresh token and persists only the opaque
Nylas grant id plus mailbox metadata. The Nylas application key is environment
configuration and never enters Postgres, logs, the frontend, or campaign rows.

Google uses `gmail.send`. Microsoft may display broader technical mail
permissions required by Nylas; the product discloses that Brein exposes no
inbox-read behavior.

## Real files

- Provider seam: `apps/api/src/email-campaigns/provider/email-provider.port.ts`
- Active adapter: `apps/api/src/email-campaigns/provider/nylas.provider.ts`
- OAuth lifecycle: `apps/api/src/email-campaigns/email-mailboxes.service.ts`
- Campaign authorization: `apps/api/src/email-campaigns/email-campaigns.service.ts`
- Due-send enforcement: `apps/api/src/email-campaigns/email-campaign-dispatcher.ts`
- Local unsubscribe: `apps/api/src/email-campaigns/email-campaign-unsubscribe.service.ts`
- Provider migration: `libs/db/src/migrations/1715200000183-AddNylasSendOnly.ts`
- Consent/status UI: `apps/dashboard/src/email-campaigns/`
- Security and contractual gates: `docs/trust/nylas-send-only.md`

Smartlead source remains only as legacy rollback/audit material and is not
registered by the active module or factory. Its webhook controller is not
registered. Legacy sender rows are marked `needs_reconnect`; nonterminal legacy
campaigns are paused by migration.

## Product contract

`GET /workspaces/:slug/email-capabilities` is an authenticated, workspace-scoped
discovery route. It reports semantic actions (`create`, `edit`, `preview`,
`authorize`, `activate`, `pause`, and `cancel`), readiness counts for real
connected senders, and explicit unsupported operations. `test` means no test
send exists in this beta; provider acceptance is not delivery, and Brein does
not report open/click tracking, delayed-bounce detection, or inbox replies.

The internal `EmailCampaignTools` adapter exposes only list, detail, draft
creation, draft editing, and preview. It is intentionally not registered as a
send-capable model tool: authorization and activation remain dashboard-human
operations. The adapter is the integration point for a future tool runtime
without reviving the retired cognitive platform. Its methods enforce the same
feature/workspace gate as HTTP and return allowlisted projections without
provider campaign, client, lead, mailbox, or grant identifiers.

Campaigns remain bounded drafts until the user selects a ready sender, reviews
the rendered per-recipient content and schedule, confirms the campaign, and
authorizes step 1 with matching audience/content/policy fingerprints. Each
later step needs its own authorization. The local dispatcher checks suppression
and terminal recipient status immediately before every provider request, then
records only accepted/failed/skipped state. A future `start_at` becomes the
local sequence clock, so activating a reviewed campaign cannot send step 1
before the selected time.
