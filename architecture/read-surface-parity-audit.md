# Read-surface parity audit (Vault R1)

Scope check of the original (June 18) "notes first-class on the read half"
card against the retrieve stack that shipped after it (F1.5). Verdict per
item, with the code that settles it.

## Already shipped — do NOT rebuild

- **Explicit trust on every result** — `apps/api/src/topics/retrieve.service.ts`
  (`trustOf`: reviewed → `knowledge`, proposed → `proposed`, else `note`);
  every retrieve result carries a flat `trust` field.
- **Trust-weighted ranking** — same file (`score`): reviewed +1.2 /
  proposed +0.5 over the ~0.5–1.0 signal base, so trust is the dominant axis
  and text-rank orders within a tier.
- **Own-drafts visible in retrieve** — `topic-query.service.ts#search`
  (draft-visibility clause): with a principal, `status <> 'draft' OR
  created_by = :__pu`. Another user's private draft is never leaked
  (`is_private` clause + `TopicAccessPolicy.filterVisible`).
- **`include_notes` opt-in** for surfacing beyond own drafts, on retrieve,
  search and list.

## Gaps found → closed by this change

1. **Search route dropped the principal.** `GET /topics/search` called
   `search()` without `principalUserId`, so the caller's own fresh note was
   invisible in search while retrieve returned it — the write→read cycle
   broke on one of the two read surfaces. Fixed in
   `topics.controller.ts#search` (passes `principal.clerkUserId`); pinned by
   `write-read-cycle.integration.spec.ts`.
2. **No CI gate on the write→read cycle.** Now
   `write-read-cycle.integration.spec.ts`: a note written today is
   retrievable by its author with the obvious query on BOTH surfaces, no
   opt-in; a stranger never sees it. (Placed as an integration spec, not in
   `evals/run-retrieval-scale.mjs` — that harness enforces `assertReadOnly`
   on every call and a live WRITE would break its invariant.)
3. **Loop bundle had no trust labels.** `card next`'s `context_bundle`
   returned bare `{type, ref}` pointers, so the loop agent couldn't weigh a
   hint against team truth without hydrating each topic. Fixed in
   `cards.service.ts` (additive `trust` on topic/note pointers, same
   vocabulary as retrieve; best-effort, never fails `next`).

## Deliberately NOT changed

- **`include_notes` default stays opt-in.** Flipping a retrieval default
  without a before/after measurement over ≥10 real-corpus queries is how
  agents break silently; the measurement needs the live workspace corpus.
  If the delta ever proves material, the change is scoped to the CALLER'S
  OWN notes only — never others' private notes.
- **Search stays lexically ranked** (ts_rank), without retrieve's trust
  boost. Search is the literal-lookup surface; retrieve is the
  intent-ranked surface. Reordering search results would change a
  long-standing contract for no demonstrated gain — trust badges are
  already on every summary.
