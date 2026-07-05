# Performance program — MCP & CLI

This directory is the source of truth for the **Performance program: MCP and CLI** —
making Driftless fast, searchable, well-explained, and production-ready across Topics,
Projects, Collections, Integrations/Broker, and retrieval.

It is written *before* implementation so every optimization card has a contract to meet
and a measurable way to prove it met it.

| Doc | Card | What it pins down |
|---|---|---|
| [`budgets.md`](./budgets.md) | F0.1 | Target p50/p95 latency, payload ceilings, and retrieval-quality bars for every hot workflow. |
| [`charter.md`](./charter.md) | F0.5 | The non-negotiable standards (MCP spec, structured outputs, SQL/EXPLAIN, pagination, rollout) and which cards each governs. |
| [`contracts.md`](./contracts.md) | F0.6 | Snapshot strategy + test plan that protects CLI/MCP/API surface contracts from accidental drift. |
| [`gates.md`](./gates.md) | F0.7 | How a performance claim is *accepted* — the evidence (query plan, query count, payload size, timing) each optimization card must produce. |
| [`views.md`](./views.md) | F2.1 | The summary/brief/full payload-view vocabulary and the pagination/error contract shared across the API. |
| [`surface-matrix.md`](./surface-matrix.md) | F8.1 | How every hot workflow maps across CLI / MCP / API, each read's default view + full-view opt-in, and what is fast by default. |
| [`navigation.md`](./navigation.md) | — | The cross-surface bounded path (Knowledge→Projects→Collections→Broker) — retrieve, don't enumerate. |
| [`retrieve-contract.md`](./retrieve-contract.md) | — | One retrieve vocabulary + output shape + invariants shared by every read on every surface. |
| [`explain-audit.md`](./explain-audit.md) | — | EXPLAIN evidence for the large read paths: filters + privacy before LIMIT, index usage, no Seq Scan. |

## How to use this in the loop

1. Before working an optimization card, read `charter.md` for the standard it must hold
   and `gates.md` for the evidence it must produce.
2. Capture before/after numbers against the large fixture (F0.4) using the harness (F9.1).
3. A card is **not** done on code change alone — it is done when its gate evidence is in
   the card's write-back (see `gates.md`).

## Surface under measurement

- **MCP** — 28 tools in `apps/mcp/src/tools/tool-registry.ts` (e.g. `driftless_context_search`,
  `driftless_context_get_for_files`, `driftless_project_card`, `driftless_collection`,
  `driftless_broker`).
- **CLI** — `apps/cli/src/commands/*` (e.g. `context`, `project`, `collection`, `broker`).
- **API** — `apps/api/src/*` (e.g. `topics`, `projects`, `collections`, `broker`, `integrations`).
