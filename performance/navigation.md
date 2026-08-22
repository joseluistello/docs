# Cross-surface navigation plan (MCP)

The product contract for how an agent moves across Knowledge (Topics),
Collections (Records), and Broker (Connections) without listing everything.

The rule is **retrieve, don't enumerate**. Every step is bounded and names the
next bounded step through `next_action`.

## The bounded path

```text
1. KNOWLEDGE   driftless_context_retrieve { task, files? }
                 → the governing Topics and Notes
                 → next_action: read the top result or move to operational records

2. COLLECTIONS driftless_collection { action:"retrieve", id }
                 → bounded Records plus the criterion to read first
                 → next_action: act on one Record

3. BROKER      driftless_broker { action:"operations", provider }
                 → the bounded operation list for a connected provider
                 → next_action: invoke one operation

4. ACT         driftless_broker { action:"invoke", … }
                 or driftless_collection_record { action:"update", … }
```

An agent enters at the shallowest known point and stops as soon as it has what
it needs.

## Navigation invariants

1. Every retrieval is bounded and structured; full bodies are opt-in.
2. `next_action` names the next bounded call.
3. A write is reached only after the read path that justifies it.
4. Search and filters happen server-side; clients never scan a full list.

## Where this is encoded

- MCP tool descriptions and structured outputs.
- [`surface-matrix.md`](./surface-matrix.md).
- `skills/driftless/references/navigation.md` and the routing table in
  `skills/driftless/SKILL.md`.
