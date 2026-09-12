# Email sequences: Nylas staging setup

This is a closed-beta, send-only integration. Staging is not a production
approval and API acceptance is not proof of delivery.

## Required configuration

| Variable | Purpose |
| --- | --- |
| `EMAIL_CAMPAIGNS_ENABLED=true` | Explicit feature kill switch. |
| `NYLAS_API_KEY` | Brein-owned Nylas application credential. |
| `NYLAS_CLIENT_ID` | Brein-owned Nylas application id. |
| `EMAIL_OAUTH_REDIRECT_URI` | Exact HTTPS dashboard callback registered in Nylas. |
| `PUBLIC_API_URL` | API origin used for signed unsubscribe links. |
| `EMAIL_CAMPAIGN_SINGLE_TENANT_WORKSPACE_ID` | The one workspace admitted to the beta. |

`NYLAS_API_URI` is optional and defaults to the US API. For local automated
tests, set `EMAIL_PROVIDER_MOCK_MODE=true`; this bypasses real credentials.
`SMARTLEAD_MOCK_MODE` remains only as a temporary compatibility alias.

Do not configure Google or Microsoft OAuth secrets in Brein. Nylas hosts OAuth
and manages provider tokens. Brein stores only the returned grant id.

## Controlled staging run

1. Configure a Nylas application and exact redirect URI.
2. Enable one controlled Brein workspace only.
3. Connect a Brein-controlled Google sender and verify the consent screen asks
   for `gmail.send`, not inbox-read scope.
4. Create a campaign with one controlled, explicitly authorized recipient.
5. Review the rendered recipient message, confirm, authorize step 1, activate,
   and capture the Nylas accepted response separately from mailbox delivery.
6. Verify the visible unsubscribe URL creates local suppression and that later
   pending messages become skipped.
7. When the next step becomes due, verify no send occurs before a new human
   authorization, then authorize it and observe one send.
8. Pause, disconnect, and delete the grant. Verify the sender is unusable and
   no campaign resumes automatically.
9. Repeat with Microsoft, explicitly checking the broader permission copy.
10. Attempt every operation from a second workspace and verify denial.

## Rollback

Set `EMAIL_CAMPAIGNS_ENABLED=false` first. Pause any active Brein campaigns,
revoke controlled Nylas grants, and keep the local audit rows. Do not remap a
Nylas grant to a legacy provider or another workspace. The provider migration is not a
reason to activate or modify real customer campaigns.

The complete privacy and provider release gates are in
`docs/trust/nylas-send-only.md`.
