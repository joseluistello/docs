# Branch integration review

Status: read-only review, September 8, 2026.

## Repository state

The local `main` checkout does not contain the reviewed provider/email work.
However, `origin/staging` does contain the relevant merges. The earlier review
looked at the local checkout and a stale local `staging` ref; that was not the
deployed staging state.

## Email/outbound branch

Reviewed branch: `codex/email-outbound-trust-controls`; active beta provider: Nylas.

Useful controls present in the branch:

- separate `EmailSendAuthorization` entity;
- audience and content fingerprints;
- explicit human send authorization;
- suppression snapshot before activation;
- re-check immediately before provider start;
- workspace-scoped provider client resolution;
- provider campaign activation idempotency;
- tests and the outbound send-authorization controls; Smartlead references are legacy-only.

Remaining governance boundary:

- this is a send-specific authorization, not the general authorization ledger;
- contact provenance and provider field rights are not supplied by this branch;
- export authorization and contact deletion propagation still need the shared
  governance layer;
- production approval remains blocked on provider/OEM/DPA/retention/deletion
  evidence and a real sender E2E.

Decision: the Nylas send-only path is verified for beta in `origin/staging`.
Do not present Smartlead as active and do not broaden Nylas into inbox or reply
management without a new review.

## Tomba/Hunter/enrichment branch

Reviewed branches: `codex/tomba-hunter-explorer-phase1` and
`codex/contact-enrichment-e2e`.

Useful controls present:

- provider-neutral company/people explorer boundary;
- one-person selected-email lookup;
- server-side API key use;
- bounded provider calls and provider-specific adapters;
- Tomba and Hunter fixtures;
- explicit separation between company resolution and selected-person email
  reveal;
- campaign-draft handoff in the later enrichment branch.

Remaining governance boundary:

- `SelectedEmailResult` carries provider and verification but not source URLs,
  rights status, display/export/contact permissions, retention, or deletion
  handle;
- adapters can return a usable email before the shared rights decision exists;
- suppression is not yet the common pre-provider gate for enrichment;
- provider approval and source licensing remain external conditions.

Decision: staging already contains provider-lineage governance and a restricted
Tomba pilot. Hunter remains evaluating/blocked. The next review is validation
of the integrated staging behavior, not another merge of these branches.

## Safe integration order

1. Preserve the dirty working tree and create a clean review/integration base.
2. Integrate the email branch's send authorization and suppression behavior,
   resolving only known conflicts.
3. Integrate Tomba/Hunter behind the shared provenance/rights port.
4. Add the general authorization ledger and deletion behavior.
5. Run the acceptance tests and full harness; classify baseline failures
   separately.
6. Update public Trust/provider status only after code and staging E2E evidence
   agree. That condition is satisfied for the Nylas send-only beta; the
   remaining work is to merge the reconciled Trust documentation and web copy.

The governance agent should continue from `origin/staging`, not from the dirty
local `main` checkout. It must first reuse the existing data authorization,
data suppression, provider-lineage, and email-send-authorization models instead
of creating duplicates.
