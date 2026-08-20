# Commercial Intelligence v1 — live stability evaluation

Date: 2026-08-13  
Model: `deepseek-v4-flash`  
Runs: 15 (five each for Supplier, Opportunity and History)  
Configuration: frozen per question — same model, skill 2.5.0, report and
market-data contracts, 32-call safety fuse, Driftless runtime commit
`84a7010b`, GTM commit `974065e` and domain corpus basis.

This is a live staging trajectory measurement, not a quality score and not a
gold evaluation. Public/licensed rows were sent to the configured model under
the user's explicit authorization. Raw artifacts remain local.

## Result

All 15 runs returned a ResearchReport. No warehouse tool call failed.

| Domain | Status agreement | Stable status | Candidate Jaccard | Identity coverage | Mean calls | Mean report latency |
|---|---:|---|---:|---:|---:|---:|
| Supplier | 0.60 | 2 complete / 3 partial | 0.489 | 0.80 | 8.0 | 47.9 s |
| Opportunity | 0.60 | 2 complete / 3 partial | 1.000 | 0.80 | 5.6 | 47.5 s |
| History | 1.00 | 5 partial | 0.500 | 0.80 | 2.0 | 32.5 s |

Candidate Jaccard is computed only for pairs where both reports expose a
platform-stable row/entity reference. Report-local IDs such as `e1` and `op1`
are explicitly ineligible. Six of ten pairs per domain were comparable; the
identity coverage column makes that limitation visible rather than treating two
missing sets as perfect agreement.

## Substantive findings

### Opportunity

All five answers converged on the same two actionable Sinaloa pump procedures
and consistently stated that opening dates are scheduled acts, not proposal
deadlines. The stable-ID Jaccard was 1.0. Status still varied between complete
and partial because some syntheses treated bounded lexical coverage and current
participation verification as terminal gaps while others treated them as
follow-up cautions. This is synthesis/achievement-policy variance, not a
retrieval miss in this question.

### Supplier

The runs repeatedly surfaced a common core of industrial manufacturers with
published contacts, but the shortlist varied: stable-ID Jaccard 0.489. One run
reversed the commercial role and judged manufacturers by whether they sold the
user's CMMS offering, even though they were prospects. This is a demonstrated
strategy/synthesis defect. The protocol and skill now state the target role
explicitly and preserve an explicitly requested shortlist size as a completion
criterion. The fix was then exercised in one additional live run. The first
attempt exposed a separate protocol defect: a planner put municipality
`Apodaca` in the `state` field, three searches were correctly refused as
`unknown_state`, and the protocol incorrectly treated those refusals as
zero-result searches and ran three doomed fallbacks. The CLI timed out at 180
seconds, although the platform persisted an honest partial artifact.

The protocol now normalizes state names to ISO before warehouse access, gives
one bounded plan repair when a municipality is placed in `state`, abstains if
geography remains invalid, and runs a lexical fallback only after a
**successful zero**, never after a refusal. The exact question then completed
live in 80.8 seconds with five detailed Dirind observations and no tool failure.
It preserved the buyer/prospect role. The answer was still partial and the five
selected observations all came from Apodaca; one food manufacturer was only a
literal manufacturing match. This is remaining ranking/relevance work, not a
retrieval or contract failure, and no second N=5 is claimed.

### History

All five runs resolved Microsoft México to RFC `MME910620Q85`, kept USD and MXN
separate, used `supplier_contract`, and said an award is not a payment. The USD
history total was consistent. Buyer narrative and cited row selection varied,
and every run correctly remained partial because name resolution and the MXN
slice were not fully closed. Stable-ID Jaccard was 0.5.

## Harness defect found and repaired

An arm containing all three physical domains legitimately carries three corpus
bases. The old stability command compared the collapsed arm fingerprint and
therefore rejected a valid cross-domain N=5 as an intra-arm corpus conflict.
Stability now compares fingerprints for the same question across arms. The
original arm summary remains fail-closed for A/B experiments that truly require
one corpus.

The stability metric also used report-local evidence IDs when no row reference
was present. That could create false overlap. It now accepts only stable row,
publisher-key, RFC or UUID identity and reports identity coverage and comparable
pair count.

## What this does and does not establish

Established:

- deterministic protocols can complete live staging runs without SQL repair;
- Opportunity retrieval for this question is substantively stable;
- procurement date, currency/scope and award-not-payment boundaries survive all
  five repeats;
- status and Supplier shortlist stability still need work;
- platform-stable candidate identity is absent in one of five reports per
  domain, limiting evaluation observability.

Not established:

- recall, precision, nDCG or commercial correctness — retrieval cases remain
  unsigned until human review;
- general stability outside these three questions;
- general Web Evidence value beyond the bounded experiment below;
- frontend parity against a deployed backend.

## Completion trajectories beyond N=5

Four additional live questions were run once each with no automatic retry. Raw
artifacts remain local.

| Case | Outcome | What it proved | Remaining defect |
|---|---|---|---|
| Mixed demand + supply + history | valid `partial`, 112.0 s | one shared run kept tenders, national buyer aggregates and directory candidates separate; it did not join directory to awards by name | History cannot yet aggregate buyer spend inside the requested product category |
| Insufficient coverage / forced zero | valid `partial`, 136.7 s | explicitly refused to conclude that the market is zero; distinguished one successful empty query from timeouts | two broad Supplier probes consumed the 90-second statement timeout and should be rejected or narrowed earlier |
| Microsoft currency/scope | valid `partial`, 63.3 s | RFC resolution, USD/MXN and `supplier_contract`/`award_group_published_total` remained separate; award was not called payment | MXN amount and one CFE currency remain unpublished/unrecovered |
| Supplier target-role (before repair) | CLI timeout at 182.3 s; artifact persisted | exposed invalid-state → refusal → false-fallback fan-out and a malformed model severity | repaired and rerun as described above |

The arm utility reported its combined cross-domain fingerprint as incomplete
because each physical domain legitimately exposes a different corpus basis.
The individual Supplier rerun fingerprint was complete. This combined arm is a
trajectory record, not an A/B arm; cross-domain arms must not be presented as a
single-corpus comparison.

## Targeted Web Evidence gate

Two live controls were run after the specialized protocols, with no automatic
retry. DeepSeek received the user question, non-sensitive counts and a closed
projection of organization names. Parallel received only `objective`,
`entities`, `claims_to_verify`, `freshness_days` and `max_results`. No row
payload, contact coordinate, SQL, credential, enrichment, FindAll or people
search crossed the boundary.

| Control | Warehouse | Web | Result |
|---|---:|---:|---|
| Grupo Brisas private expansion | 8 successful calls | 1 successful call, 4 sources | valid partial in 64.6 s; three web claims resolved to platform-owned evidence and clickable citations |
| Microsoft México award history | 4 successful calls | 0 calls | valid partial in 59.2 s; MXN/USD and amount scope remained separate |

The positive control retrieved Forbes México, Expreso and REPORTUR evidence for
90 Nizuc residences, the Las Brisas Mérida opening and two announced CDMX hotel
openings. The report separates these publisher statements from the warehouse
and does not promote an announcement into demonstrated execution.

The first live attempt exposed two integration defects rather than provider
failures. The managed gateway coerced `toolChoice: required` to `auto`, allowing
the model to skip an explicit request; the gate now asks DeepSeek for a strict
`search|skip` decision and the platform executes only its validated closed
request. Separately, DeepSeek put a platform web-evidence id in `rowRef` while
inventing a display id; reconciliation now resolves that alias against the web
ledger and rewrites fact references. Chat's citation vocabulary also admits the
governed `web` kind. Replay of the final artifact yields four citations, three
web and zero unavailable.

This proves bounded verification control flow and citation lineage for one
positive and one negative case. It does not establish web recall, truth of the
publishers' claims or the value of web search for discovery; discovery remains
outside this capability by construction.
