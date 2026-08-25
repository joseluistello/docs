# Platform Billing Admin

## Implementation design for workspace-bound assisted sales

**Status:** approved design for implementation on `staging`

**Scope:** internal billing operations for Pilot, Scale, and Enterprise

**Audience:** the implementation agent and the Driftless reviewers

**Risk:** P1 — financial entitlements and cross-workspace administration

---

## 1. Outcome

Driftless needs a small internal billing surface where authorized platform operators can:

- find and inspect customer workspaces;
- generate a single workspace-bound Stripe Checkout for Pilot or Scale;
- copy, cancel, or reissue the pending payment link;
- see whether an offer is creating, pending, activated, expired, canceled, or failed;
- activate or remove Enterprise access after a separately verified contract or invoice;
- audit who performed every sensitive action.

The customer never selects Pilot, Scale, or Enterprise from the ordinary workspace Settings page.
Founder remains the only self-serve plan.

The invariant is:

```text
Driftless authorizes workspace + plan
  -> Stripe collects payment
  -> signed subscription event confirms an allowed Price
  -> Driftless activates exactly that workspace
```

An email address, coupon, URL parameter, hidden frontend control, or
`checkout.session.completed` event is never sufficient authority to grant a plan.

---

## 2. Current implementation to preserve

The implementation must start from the effective code on `main`/`staging`, not from the older
Free/Pro/Team billing topic.

Current facts:

- `WorkspaceGuard` is the global `APP_GUARD`.
- Workspace membership roles are `owner`, `admin`, and `member`.
- `PLATFORM_ADMIN_USER_IDS` already gates the manual workspace-plan seam.
- `assertHumanSession()` rejects agent, API-key, and OAuth principals for human-only operations.
- `@AccountLevel()` authenticates a human without requiring membership in a selected workspace.
- Founder, Pilot, and Scale Price IDs are server configuration; arbitrary Price IDs are rejected.
- Checkout metadata is written by the server and includes the workspace and plan.
- Only `customer.subscription.created` and `customer.subscription.updated` with an allowlisted
  Price and an `active` or `trialing` status may grant access.
- `checkout.session.completed` is non-mutating and does not grant access.
- Enterprise is rejected by Checkout and uses the manual plan seam.
- Stripe subscription events are already ordered defensively so an old subscription cannot revoke
  a newer active subscription.
- The Stripe client is constructed lazily. Do not move it into a module/provider constructor.

Important current gap:

- `POST /workspaces/:slug/billing/checkout-session` currently accepts `pilot` and `scale` from any
  owner/admin of that workspace when their Price IDs are configured. Hiding the buttons is not a
  security boundary. The assisted-sales implementation must close this route before Pilot or Scale
  Price IDs are enabled in Stripe Live.

---

## 3. Authorization model

### 3.1 Do not create a workspace super-admin role

Do not add `platform_admin`, `billing_admin`, `staff`, or similar values to
`workspace_members.role`.

`workspace_members` describes authority inside one customer's workspace. Platform authority spans
workspaces and is a separate security domain. Mixing them would create confusing inheritance and
make accidental customer privilege escalation more likely.

### 3.2 Initial source of truth

For this version, platform billing authority remains the typed environment allowlist:

```text
PLATFORM_ADMIN_USER_IDS=<Ada Clerk user id>,<Mia Clerk user id>
```

The code must centralize this check in one reusable guard/service rather than duplicate string
parsing in controllers.

Required predicate:

```text
human Clerk session
AND clerk_user_id is in PLATFORM_ADMIN_USER_IDS
AND PLATFORM_BILLING_ADMIN_ENABLED is true
```

No display name, email address, frontend flag, workspace role, Clerk organization role, API key,
OAuth token, MCP principal, or agent-owned credential can satisfy the predicate.

### 3.3 Capability discovery

Add an authenticated account-level endpoint:

```http
GET /me/platform-capabilities
```

Response for Ada or Mia:

```json
{
  "platform_billing_admin": true
}
```

Response for every other authenticated human:

```json
{
  "platform_billing_admin": false
}
```

The capability controls whether the Settings rail renders the internal section. It is not the
authorization boundary; every internal endpoint repeats the server-side platform-admin check.

### 3.4 Future role management

A `platform_staff` table and owner-managed staff UI are explicitly out of scope. Introduce them only
when the team needs delegated platform roles beyond the small server-owned allowlist. Do not expand
this implementation preemptively.

---

## 4. Data model and migration

Create one entity and one forward migration:

```text
libs/db/src/entities/billing-offer.entity.ts
libs/db/src/migrations/1715200000156-AddBillingOffers.ts
```

Use the next free migration number if another migration lands first. Never reuse a number.

### 4.1 `billing_offers`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | Primary key, generated by the application before the Stripe call |
| `workspace_id` | `uuid` | FK to `workspaces.id`; nullable only after `ON DELETE SET NULL` |
| `workspace_slug_snapshot` | `text` | Required; preserves reconciliation after deletion |
| `workspace_name_snapshot` | `text` | Required; preserves human context after deletion |
| `plan` | `text` | Check: `pilot` or `scale` only |
| `status` | `text` | Check: `creating`, `pending`, `activated`, `expired`, `canceled`, `failed` |
| `stripe_price_id` | `text` | Required server-selected Price ID snapshot |
| `amount_cents` | `bigint` | Required, non-negative, server-derived from Stripe Price |
| `currency` | `text` | Required lowercase three-letter currency |
| `stripe_checkout_session_id` | `text` | Nullable, unique when present |
| `stripe_subscription_id` | `text` | Nullable, unique when present |
| `stripe_customer_id` | `text` | Nullable |
| `created_by_clerk_user_id` | `text` | Required platform operator identity |
| `expires_at` | `timestamptz` | Required |
| `activated_at` | `timestamptz` | Nullable |
| `canceled_at` | `timestamptz` | Nullable |
| `failure_code` | `text` | Nullable bounded internal code; never raw Stripe error text |
| `created_at` | `timestamptz` | Required/default now |
| `updated_at` | `timestamptz` | Required/default now |

Do not persist:

- Stripe secret keys;
- webhook secrets;
- full card/customer payment details;
- the raw Checkout URL;
- unbounded error payloads;
- coupons or promotion codes supplied by customers.

### 4.2 Constraints and indexes

Required constraints/indexes:

```text
PRIMARY KEY (id)
FK (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
CHECK plan IN ('pilot', 'scale')
CHECK status IN ('creating', 'pending', 'activated', 'expired', 'canceled', 'failed')
CHECK amount_cents >= 0
CHECK currency ~ '^[a-z]{3}$'
UNIQUE stripe_checkout_session_id WHERE stripe_checkout_session_id IS NOT NULL
UNIQUE stripe_subscription_id WHERE stripe_subscription_id IS NOT NULL
INDEX (workspace_id, created_at DESC)
INDEX (status, created_at DESC)
INDEX (created_by_clerk_user_id, created_at DESC)
```

Only one open assisted offer may exist per live workspace:

```sql
create unique index billing_offers_one_open_per_workspace
  on billing_offers (workspace_id)
  where workspace_id is not null
    and status in ('creating', 'pending');
```

Postgres does not automatically index foreign keys; keep the explicit workspace index.

### 4.3 TypeORM registration

Register `BillingOffer` everywhere the repository requires:

- `libs/db/src/index.ts` export;
- `libs/db/src/data-source.ts` entity and migration arrays;
- `apps/api/src/app.module.ts` runtime entity array;
- `apps/api/test/test-datasource.ts` test entity array;
- the billing module's `TypeOrmModule.forFeature(...)` list.

Missing the runtime `app.module.ts` registration is a release-blocking failure even if unit tests
pass.

### 4.4 RLS and exposure

The table is server-internal. It must not be queried from the browser through the Supabase Data API.
Do not grant `anon` or `authenticated` direct table access. Enable RLS as defense in depth with no
customer policies, or keep the table in the server-only access pattern already used by the API.

---

## 5. Backend module boundary

Keep business logic in the existing billing service layer. Do not add a new library or business
logic to the dashboard.

Suggested files:

```text
apps/api/src/billing/
  platform-billing.controller.ts
  platform-billing.service.ts
  platform-billing-authority.ts
  dto/
    create-billing-offer.dto.ts
    list-billing-offers.dto.ts
    enterprise-plan.dto.ts
```

`PlatformBillingController` orchestrates only. `PlatformBillingService` owns offer state transitions,
Stripe session creation/expiration, workspace lookup, and audit calls.

Do not add an `@Public()` route.

---

## 6. Internal API contract

All routes are account-level and require a human platform billing administrator.

### 6.1 List workspaces

```http
GET /platform/billing/workspaces?q=&cursor=&limit=25&plan=&offer_status=
```

Rules:

- `limit` defaults to 25 and is capped at 50.
- cursor pagination is required; no offset pagination.
- default ordering is `created_at DESC, id DESC`.
- search matches normalized workspace name or slug.
- soft-deleted workspaces are excluded by default.
- return only the fields needed by the UI.
- do not return private workspace settings, API keys, model keys, or encrypted fields.

Response item:

```json
{
  "workspace_id": "uuid",
  "name": "Acme",
  "slug": "acme",
  "plan": "free",
  "commercial_band": null,
  "created_at": "ISO-8601",
  "open_offer": null,
  "latest_offer": null
}
```

Search must be parameterized and escape LIKE metacharacters. Start with indexed normalized prefix
search on `lower(name)` and `lower(slug)`. Do not add trigram search until measurement shows it is
necessary.

Owner email is not a search requirement in this version because Driftless has no local user
directory containing verified Clerk emails. Do not introduce N+1 Clerk calls or a new directory
table merely to support the first version.

### 6.2 Create Pilot/Scale offer

```http
POST /platform/billing/offers
```

```json
{
  "workspace_id": "uuid",
  "plan": "pilot"
}
```

Allowed plan values are only `pilot` and `scale`. The client never submits a Price ID, amount,
currency, workspace slug, Stripe customer ID, metadata, success URL, or trial/coupon value.

Response:

```json
{
  "offer": {
    "id": "uuid",
    "workspace_id": "uuid",
    "plan": "pilot",
    "status": "pending",
    "expires_at": "ISO-8601"
  },
  "checkout_url": "https://checkout.stripe.com/..."
}
```

`checkout_url` is returned only after creation or reissue. It is not stored in Postgres and should
not be logged.

### 6.3 List offers

```http
GET /platform/billing/offers?workspace_id=&status=&cursor=&limit=25
```

Use cursor pagination and return a bounded operational view. Never retrieve all offers into the
dashboard.

### 6.4 Cancel pending offer

```http
POST /platform/billing/offers/:id/cancel
```

Only `creating` or `pending` offers may be canceled. Expire an open Stripe Checkout Session where
possible, then atomically transition the local offer to `canceled`. Canceling an offer must never
cancel an already active subscription.

### 6.5 Reissue offer

```http
POST /platform/billing/offers/:id/reissue
```

Reissue is allowed only for `expired`, `canceled`, or `failed` offers. It creates a new offer ID and
new Stripe Checkout Session; it never mutates an old terminal offer back to pending.

### 6.6 Enterprise activation

```http
POST /platform/billing/workspaces/:workspaceId/enterprise
```

```json
{
  "action": "activate",
  "reason": "Signed annual contract",
  "contract_reference": "internal non-secret reference"
}
```

Rules:

- `action` is `activate` or `deactivate`.
- `reason` is required and bounded.
- `contract_reference` is optional, bounded, and must not contain a contract body or secret URL.
- activation calls the existing typed `setPlan(..., 'commercial', ..., 'enterprise')` seam.
- deactivation must refuse if there is an active Stripe subscription that the billing portal should
  manage instead.
- every action writes an append-only audit record.

There is no Enterprise Checkout endpoint and no arbitrary plan-update endpoint in this controller.

---

## 7. Stripe lifecycle

### 7.1 Offer creation

1. Authenticate and assert human platform-billing authority.
2. Load the workspace by server-side `workspace_id`; reject missing or soft-deleted workspaces.
3. Reject workspaces already on Founder or Commercial unless the approved upgrade policy explicitly
   supports the transition. The first version supports Free -> Pilot/Scale only.
4. Resolve the plan's Price ID from typed server configuration.
5. Retrieve the Stripe Price server-side and verify it is active, recurring monthly, in the expected
   currency, and attached to the expected product.
6. Generate the offer UUID in the application.
7. Insert `billing_offers(status='creating')` in a short transaction.
8. Outside the transaction, create a Stripe Checkout Session using the idempotency key
   `billing-offer:<offerId>`.
9. Put immutable server-owned metadata on both Checkout and Subscription:

```json
{
  "billing_offer_id": "offer uuid",
  "workspace_id": "workspace uuid",
  "plan": "commercial",
  "commercial_band": "pilot",
  "price_id": "allowlisted Price ID"
}
```

10. Update the offer to `pending` with the Stripe session ID and expiration.
11. If Stripe creation fails, mark the offer `failed` with a bounded failure code. Never leave a DB
    transaction open during the network request.

The Checkout Session is bound to one workspace. Anyone who obtains the URL can pay for that
workspace, but cannot change the workspace or plan and cannot obtain access for another workspace.
The UI should still treat the URL as sensitive and show it only to Ada or Mia.

### 7.2 Entitlement grant

Keep `checkout.session.completed` non-authoritative.

On `customer.subscription.created` or `customer.subscription.updated`:

1. Verify the Stripe webhook signature using the raw request body.
2. Require subscription status `active` or `trialing`.
3. Resolve the actual subscription item Price ID and require an allowlisted Pilot/Scale Price.
4. Require `billing_offer_id`, `workspace_id`, plan, and commercial band metadata.
5. Load the offer by ID and require:
   - matching workspace;
   - matching plan;
   - matching Price ID;
   - status `pending` or an idempotent replay of `activated`;
   - matching Stripe Checkout/subscription relationship where available.
6. In one short transaction:
   - transition offer to `activated` exactly once;
   - record Stripe customer/subscription IDs;
   - call the same workspace billing transition used by the existing webhook;
   - preserve existing event-order protections;
   - record the audit event.

Missing, mismatched, expired, canceled, or failed offers must not grant Pilot/Scale. The webhook must
log a safe structured reason and follow the existing retry policy for transient database failures.

### 7.3 Subscription cancellation and replacement

Existing subscription event ordering remains authoritative:

- canceling the current active subscription revokes the commercial plan;
- a stale cancellation for an older subscription cannot revoke a newer active subscription;
- an offer is historical after activation and is never reopened by later subscription events.

---

## 8. Close the customer bypass

Before Pilot or Scale Price IDs are configured in Live Mode:

- change the existing workspace checkout route so a customer owner/admin can request only
  `founder`;
- reject `pilot`, `scale`, `enterprise`, arbitrary strings, and Price IDs on that route;
- create Pilot/Scale Checkout only through `PlatformBillingService` with a persisted offer;
- keep Founder promotion-code and 15-day trial behavior unchanged;
- keep the customer billing portal available for existing Stripe customers.

Required regression test:

```text
workspace owner/admin + POST plan=pilot -> 403/400 and Stripe is not called
platform billing admin + POST internal offer plan=pilot -> one bound Checkout Session
```

Enabling Live Price IDs before this test passes is a release blocker.

---

## 9. Audit contract

Reuse the existing append-only `audit_log` table.

Actions:

```text
billing.offer.create
billing.offer.cancel
billing.offer.reissue
billing.offer.activate
billing.enterprise.activate
billing.enterprise.deactivate
```

Each event records:

- human actor Clerk user ID;
- affected workspace ID;
- offer ID or workspace slug as target;
- plan and previous/new status;
- Stripe object IDs where useful;
- bounded reason/contract reference for Enterprise.

Never record Checkout URLs, promotion codes, Stripe secrets, card details, raw webhook bodies, or raw
Stripe error payloads.

Webhook-originated `billing.offer.activate` uses a fixed platform actor such as `stripe_webhook` only if
the existing audit contract permits it; otherwise store the initiating offer creator in detail and
keep webhook provenance explicit. Do not pretend the webhook is a human.

---

## 10. Dashboard design

### 10.1 Placement

Reuse the existing Settings surface and primitives.

- URL: `/w/:activeSlug/settings?section=platform-billing`
- Rail label: `Administración`
- Page title: `Billing de clientes`
- Visibility: only when `GET /me/platform-capabilities` returns
  `platform_billing_admin: true`.

The route may live under the active workspace shell for UI consistency, but all data/actions on the
page use account-level internal endpoints. The active workspace does not scope the customer list.
Ada and Mia do not need membership in every customer workspace.

Do not build a separate admin application, a new design system, or an extravagant dashboard.

### 10.2 Page structure

```text
Billing de clientes
Gestiona ofertas asistidas y acceso Enterprise.

[ Buscar workspace... ] [ Plan ] [ Estado ]

Workspace        Plan actual   Oferta       Creado        Acción
Acme             Free          Sin oferta   12 ago        Generar enlace
Beta             Pilot         Pagada       10 ago        Ver

                                         Anterior  1  Siguiente
```

Use the existing `SettingsPageHeader`, `SettingsSection`, `SettingsCard`, `SettingsRow`, buttons,
inputs, dialogs, badges, skeletons, empty states, and pager. Preserve the dashboard's current visual
language.

### 10.3 Interaction rules

- Search is debounced 300 ms.
- Results are server-paginated at 25 rows.
- Search, plan, status, and cursor live in the URL query string.
- Loading preserves table dimensions; no full-page flashing.
- Empty state explains how to search or generate the first offer.
- Errors appear inline and remain actionable.
- Copy button confirms `Enlace copiado` without exposing the URL elsewhere.
- Generating a link requires a confirmation dialog showing workspace and exact monthly price.
- Enterprise activation requires typing/confirming the workspace slug plus a reason.
- Cancel/reissue actions require confirmation.
- Activated and terminal offers cannot show destructive actions that no longer apply.
- Keyboard navigation, focus return, labels, and status announcements are required.
- Mobile may stack each row into a compact card; no horizontal overflow that hides actions.

### 10.4 Offer detail drawer/dialog

Show:

- workspace name and slug;
- selected plan and amount;
- status and expiration;
- created by and created time;
- Stripe session/subscription identifiers in copyable monospace text;
- audit timeline;
- copy, cancel, or reissue actions when allowed.

Do not show Stripe secrets, raw customer payment details, or private workspace settings.

---

## 11. Performance contract

- Cursor pagination only; maximum 50 rows.
- Query only selected workspace columns plus a bounded latest/open-offer projection.
- Avoid N+1 offer or Clerk queries.
- Use one set-based query or a bounded two-query composition for the page.
- Index foreign keys and the exact status/order filters used by the list.
- Exclude soft-deleted workspaces in the query and index strategy.
- Search must remain responsive for at least 100,000 workspaces and 1,000,000 historical offers.
- Add an integration test for stable cursor ordering when multiple rows share `created_at`.

Do not add Redis or an in-memory cache.

---

## 12. Security test matrix

The implementation is incomplete unless automated tests cover every row:

| Principal/action | Expected |
| --- | --- |
| Unauthenticated request | 401 |
| Ordinary workspace member | 403 |
| Customer workspace owner/admin | 403 on every platform route |
| Human not in platform allowlist | 403 |
| Ada/Mia human session in allowlist | allowed |
| API key created by Ada/Mia | 403 |
| OAuth/MCP token authorized by Ada/Mia | 403 |
| Agent-owned key | 403 |
| Client submits Price ID/amount/workspace slug metadata | DTO rejects unknown fields |
| Client changes workspace ID after confirmation | server uses persisted offer and rejects mismatch |
| Duplicate create in two tabs | one open offer; one Stripe session via idempotency |
| Stripe checkout completion without active subscription | no access |
| Active subscription with unknown Price | no access |
| Active subscription with missing offer | no Pilot/Scale access |
| Active subscription with mismatched offer/workspace | no access and safe security log |
| Replayed Stripe event | idempotent; no duplicate transition |
| Old subscription cancellation after replacement | new plan remains active |
| Canceled/expired offer later reports completion | no access; operator-visible exception state |
| Enterprise activation without reason | rejected |
| Enterprise activation by customer owner | rejected |
| Platform section manually forced in frontend | API remains 403 |

Also run the architecture specs that enforce `WorkspaceGuard`, OAuth default-deny, TypeORM entity
registration, and controller/service separation.

---

## 13. Error and state behavior

Use typed NestJS exceptions. Never throw raw `Error` from services and never swallow a paid-event
database failure that Stripe should retry.

Suggested UI-safe errors:

```text
workspace_not_found
workspace_deleted
workspace_already_paid
open_offer_exists
price_not_configured
stripe_unavailable
offer_not_cancelable
offer_not_reissuable
subscription_managed_in_portal
platform_billing_disabled
```

Do not return raw Stripe messages to the browser.

State transitions are closed:

```text
creating -> pending | failed
pending  -> activated | expired | canceled | failed
expired  -> terminal
canceled -> terminal
failed   -> terminal
activated -> terminal
```

Reissue always creates a new offer.

---

## 14. Configuration

Typed and startup-validated configuration:

```text
PLATFORM_ADMIN_USER_IDS
PLATFORM_BILLING_ADMIN_ENABLED
STRIPE_PRICE_COMMERCIAL_PILOT_MONTHLY
STRIPE_PRICE_COMMERCIAL_SCALE_MONTHLY
```

Rules:

- staging uses Stripe Sandbox Price IDs;
- production uses Stripe Live Price IDs only;
- never mix test and live Price IDs/keys;
- absence of platform billing configuration must not crash the entire API;
- internal endpoints return a typed unavailable response when disabled;
- do not log any secret or the full allowlist.

Founder configuration remains independent.

---

## 15. Rollout order

### Phase A — staging implementation

1. Add entity and migration.
2. Register entity/migration in every runtime and test data source.
3. Centralize platform billing authority.
4. Add account-level capability and internal endpoints.
5. Close the Pilot/Scale customer checkout bypass.
6. Extend webhook validation to require a matching pending offer before Pilot/Scale activation.
7. Add audit events.
8. Add Settings UI and translations.
9. Configure Ada/Mia Clerk IDs and Sandbox Price IDs in staging.
10. Run migration and full harness.

### Phase B — staging acceptance

1. Non-admin cannot see the section and receives 403 when calling it directly.
2. Ada/Mia can search/paginate workspaces.
3. Generate a Sandbox Pilot offer for a disposable workspace.
4. Pay with a Stripe test card.
5. Confirm the exact workspace becomes Commercial/Pilot.
6. Confirm another workspace remains unchanged.
7. Cancel and reissue a Scale offer.
8. Exercise Enterprise activation/deactivation with audit readback.
9. Verify mobile and desktop UI.
10. Verify no Checkout URL, promotion code, or secret appears in logs.

### Phase C — production activation

Production activation is a separate explicit release:

1. Create/copy Pilot and Scale products/prices in Stripe Live.
2. Configure Live Price IDs in Render production.
3. Configure the production Stripe webhook events/secrets.
4. Enable platform billing for the approved operator IDs.
5. Deploy the already-reviewed code.
6. Generate one controlled Live offer.
7. Complete, refund/cancel if appropriate, and reconcile it end to end.

Do not enable Live Pilot/Scale Price IDs before the bypass is closed and staging acceptance passes.

---

## 16. Rollback

Code rollback:

- set `PLATFORM_BILLING_ADMIN_ENABLED=false` to disable the internal surface;
- keep Founder self-serve unaffected;
- revert the application change if needed.

Operational rollback:

- expire pending Checkout Sessions;
- mark corresponding local offers canceled;
- archive/deactivate Pilot and Scale Live Prices only after verifying no active subscriptions depend
  on them;
- manage paid subscriptions through Stripe Billing Portal/Stripe Dashboard, not by deleting rows.

Migration rollback may drop `billing_offers` only before any real offer exists. Once financial
activity exists, preserve the table and disable the feature instead of destroying history.

---

## 17. Definition of done

The cloud agent may report completion only when all are true:

- one forward migration creates the constrained/indexed `billing_offers` table;
- runtime and test TypeORM registrations are complete;
- no workspace membership role was expanded;
- only human allowlisted platform admins reach the internal routes;
- customers cannot request Pilot/Scale Checkout directly;
- every Pilot/Scale Checkout has a persisted workspace-bound offer;
- only an active/trialing allowlisted subscription with a matching pending offer grants access;
- Enterprise is manual, human-only, reasoned, and audited;
- Settings shows the section only for the server-returned capability;
- list/search/filter/pagination are server-side and responsive;
- all negative security cases are tested;
- focused billing/auth/dashboard tests pass;
- API and dashboard builds/typechecks pass;
- `bash scripts/harness/check.sh` passes with zero failures;
- staging migration and an end-to-end Sandbox Checkout are verified;
- `driftless context get --diff` is reviewed and durable context is updated/proposed correctly.

---

## 18. Expected implementation handoff

The cloud agent should deliver:

1. a PR to `staging` with narrow commits;
2. migration and rollback notes;
3. API and UI screenshots/evidence;
4. test and harness output;
5. a security matrix with pass/fail evidence;
6. the staging Checkout session/subscription/workspace IDs used for verification, excluding secrets;
7. explicit confirmation that Stripe Live and production were not touched.

The morning review should focus on authorization, webhook authority, cross-workspace isolation,
idempotency, migration registration, and real staging behavior—not visual polish alone.
