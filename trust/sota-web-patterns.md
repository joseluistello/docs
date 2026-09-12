# SOTA web pattern: Trust & Data Control Center

This is the revised web direction after comparing current enterprise patterns
from Salesforce, Google Cloud, Microsoft, OpenAI, and Atlassian.

## What the large providers actually do

The common pattern is layered, not legalistic:

1. A public Trust Center with security, privacy, subprocessors, compliance
   documents, product scope, and change history.
2. In-product controls that let users disconnect integrations, inspect data,
   clear or delete it, and understand what an action will do.
3. Admin controls for access, retention, connected sources, approvals, and
   audit history.
4. Downloadable evidence for procurement: DPA, subprocessors, architecture,
   security answers, deletion commitments, and certifications only where real.
5. Clear shared-responsibility language: the provider explains what it
   controls and what the customer controls.

Salesforce exposes product-specific trust/compliance documents, subprocessors,
terms, AI transparency, privacy requests, consent, retention jobs, and audit
history. Google Cloud emphasizes customer ownership, access controls, deletion,
third-party risk, data residency, and audited access. Microsoft provides a
privacy dashboard to view, clear, and manage activity. OpenAI exposes admin
controls, retention options, connected-source controls, and ownership/data-use
commitments. Atlassian's Trust Center combines certifications, subprocessors,
DPA availability, deletion on request, audit/security controls, and shared
responsibility.

## Brein's product output

### Public `/trust`

Not a long policy page. It should have five entry points:

- **How Brein handles data** — plain-language data lifecycle.
- **Security** — encryption, access, backups, incidents, and limitations.
- **Providers and sources** — active, pilot, evaluated, and not enabled.
- **Privacy controls** — ARCO, opt-out, deletion, Google disconnect.
- **Customer evidence pack** — downloadable documents and last-updated dates.

Every claim needs a status and date: `active`, `pilot`, `conditioned`, or
`not enabled`. Never display a certification, residency promise, or provider
as active without evidence.

### In-product `Datos y privacidad`

This is the high-value surface, modeled after privacy dashboards rather than
consent banners. It should show:

- connected accounts and scopes;
- sources and providers used by the workspace;
- retention settings and upcoming expirations;
- export history;
- suppression and opt-out state;
- deletion requests and their status;
- workspace audit history;
- controls to disconnect, delete, download, or request help.

### Contextual action explanations

The user sees a short explanation at the action boundary. The full provenance
and policy decision is one click away. Enrichment, export, and send each have a
separate explanation and authorization; none becomes a general-purpose
consent.

### Admin and government view

Admins need a downloadable `Trust Report` for a selected period with:

- providers and policy versions;
- source categories;
- authorizations;
- exports and external actions;
- suppression/deletion outcomes;
- unresolved exceptions;
- incident or change log.

This is more useful for procurement and government review than exposing every
technical column in the normal table.

## What not to copy from the big providers

- Do not claim SOC 2, ISO, FedRAMP, data residency, or zero retention without
  the actual scope and evidence.
- Do not create a giant compliance portal before the underlying controls work.
- Do not ask every user to make legal decisions.
- Do not hide material provider or data-use changes behind an undated policy.

## Design decision

Build one coherent **Trust & Data Control Center** with progressive disclosure:

```text
public trust center
        ↓
workspace data & privacy
        ↓
record provenance / action explanation
        ↓
downloadable audit and procurement evidence
```

The product should feel calm for an operator and rigorous for an auditor.
