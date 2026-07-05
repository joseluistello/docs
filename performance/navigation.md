# Cross-surface navigation plan (MCP)

The product contract for **how an agent moves across the four planes** — Knowledge
(topics), Projects (the loop), Collections (records), and Broker (connections) —
**without ever listing everything.** The [`surface-matrix.md`](./surface-matrix.md)
says *which* call exists on each surface; this page says *in what order to make
them* and *when to stop drilling down*.

The rule it encodes: **retrieve, don't enumerate.** At large-workspace scale a
`list-all` of any plane is a non-starter (a 50k-card project, a 50k-record
collection, dozens of connections × hundreds of operations). Every step below is
bounded by default and names the next bounded step via `next_action`.

## The bounded path

For a task like *"triage the failed GitHub issue sync"* the agent walks the planes
in order, stopping as soon as it has what it needs:

```
1. KNOWLEDGE   driftless_context_retrieve { task, files? }
                 → the governing topics/notes (why the sync exists, its gotchas)
                 → next_action: read the top result, or move to the work plane

2. PROJECTS    driftless_project_card { action:"next" | "list", project_id }
                 → is this tracked work? get the actionable card + its bundle
                 → next_action: work the card, then mark done

3. COLLECTIONS driftless_collection { action:"retrieve", id }
                 → operational records (the failed sync rows) + the criterion to read FIRST
                 → next_action: work a record with driftless_collection_record

4. BROKER      driftless_broker { action:"operations", provider }
                 → the bounded operation list for the connection (materialized)
                 → next_action: invoke ONE operation

5. ACT         driftless_broker { action:"invoke", … } · …_collection_record { action:"update" }
                 → the external/operational write — only AFTER the drill-down
```

A task rarely needs all five. The agent enters at the plane that matches what it
has (a slug → step 1 `context_get`; a known card → step 2; a known connection →
step 4) and stops at the shallowest step that answers the question.

## The four navigation invariants

1. **Bounded by default.** Every retrieval call returns a bounded page (`limit`
   default + `has_more`/`nextCursor`), a `brief`/`summary` view (never a full body
   unless asked), and structured output. No tool returns an unbounded set.
2. **`next_action` is the rail.** Every read names the next *bounded* call. The
   chain of `next_action`s **is** this navigation plan, surfaced inline so the
   agent never has to invent a traversal — or a script — to cross a plane seam.
3. **Drill down before you act.** A write (`broker invoke`, `record update`) is
   reached only after the read path that justifies it. The `next_action` on an
   operations/records list points at the single write, not a batch.
4. **Don't enumerate to find one thing.** Searching for a card / record /
   operation is a *filter* call (keyset + query), never a client-side scan of a
   full `list`. If a surface can't filter server-side yet, that is the bug to fix,
   not a reason to list-all.

## Why not one mega-tool

A single `driftless_navigate` that auto-walks all four planes is tempting but
wrong *until each plane is individually precise*: it would hide which plane
answered, make bounding opaque, and re-introduce list-all inside one tool. The
plan is the opposite — **keep each surface sharp and bounded, and let the
`next_action` chain compose them.** A unified primitive is only earned once every
plane passes the retrieval-scale gate ([`gates.md`](./gates.md)).

## Where this is encoded

- **MCP tool descriptions** — `driftless_context_retrieve` is marked START-HERE and
  names the downstream planes; `driftless_broker` operations/invoke is marked the
  terminal drill-down.
- **MCP outputs** — the `next_action` field on every read (see
  `apps/mcp/src/tools/tool-registry.ts`).
- **Docs** — this file + [`surface-matrix.md`](./surface-matrix.md).
- **Skill** — `skills/driftless/references/navigation.md` (agent-facing) and the
  routing table in `skills/driftless/SKILL.md`.
