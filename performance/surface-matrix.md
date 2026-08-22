# F8.1 — CLI / MCP / API surface matrix

The single reference for how every hot workflow maps across the three surfaces —
**CLI** (`@driftless-sh/cli`), **MCP** (`@driftless/mcp`), and the **API**
(`@driftless/api`) — plus what each read returns by default and how to opt into a
heavier payload.

Read it to answer: *"which command/tool/route do these three things share, what
shape comes back, and what is fast by default?"*

Conventions:

- **Default view** is the payload tier a read returns when no `view` is passed
  (`summary` / `brief` / `full` — see [`views.md`](./views.md)). `full` is never a
  default; a caller opts in.
- **Full-view opt-in** is how you ask for the heavy body when you actually need it.
- The MCP names are the literal tool names in
  `apps/mcp/src/tools/tool-registry.ts`; the CLI names are the literal subcommands
  in `apps/cli/src/commands/*`; the API rows are the Nest routes under
  `apps/api/src/*` (all under `/workspaces/:slug`).

---

## Topics — read

| Workflow | CLI | MCP tool | API endpoint | Default view | Full-view opt-in | Payload shape |
|---|---|---|---|---|---|---|
| Search by keyword | `context search <q>` | `driftless_context_search` | `GET /topics/search?q=` | summary (top 5 CLI/MCP) | n/a — search is index-only; `context_get` the hit | `{ shown, has_more, hint?, next_action, topics[] }` |
| List a domain | `context list [--area\|--tag\|--stale]` | `driftless_context_list` | `GET /topics` | summary (top 40) | `view=full` | `{ shown, has_more, hint?, next_action, topics[] }` |
| Get one topic | `context get <slug>` | `driftless_context_get` | `GET /topics/:slug` | **full** (you named it) | default | one `CanonicalContext` |
| Topics for files | `context get --files "a.ts,b.ts"` | `driftless_context_get_for_files` | `GET /topics/match-files` | brief (top 10, drifted first) | `view:"full"` | `{ shown, has_more, hint?, matches[] }` |
| Topics for local diff | `context get --diff [--mark]` | `driftless_context_get_for_files` (pass the diff file list) | `GET /topics/match-files` | brief | `view:"full"` | match-files shape |
| **Unified retrieve** (task and/or files) | `context retrieve "<task>" [--explain]` (+ `context get --files`/`--diff` for the file-shaped reads) | `driftless_context_retrieve` | `POST /topics/retrieve` | brief | `view:"full"` | `{ view, total_candidates, signals, shown, results[] }` |

**Retrieve is the START-HERE primitive when you have a task but no slug.** It
composes search + match-files + list filters, ranks them drifted-first, and
annotates each hit with `match_type` / `why_matched` / `confidence` /
`next_action`. The unified ranker is exposed on all three surfaces: **CLI**
(`context retrieve "<task>"`, `--explain` for why_matched), **API** (`POST
/topics/retrieve`), and **MCP** (`driftless_context_retrieve`); `context get
--files`/`--diff` remain the file/diff-shaped reads.

## Topics — write & govern

| Workflow | CLI | MCP tool | API endpoint |
|---|---|---|---|
| Create a topic / note | `context add <slug> --area --pattern` · `note add` | `driftless_context_create` · `driftless_note_add` | `POST /topics` |
| Update (append-safe) | `context update <slug> --gotcha/--decision/--add-pattern` | `driftless_context_update` | `PATCH /topics/:slug` |
| Propose → Knowledge | `context propose <slug>` · `context approve <slug>` | `driftless_context_propose` · `driftless_context_approve` | `POST /topics/:slug/propose` · `…/approve` |
| Suggested edit | `context pr <slug> --open` | `driftless_context_create_proposal` · `driftless_context_proposals` | `POST /topics/:slug/proposals` |
| Relations / graph | `context relations` · `context graph` | `driftless_context_relations` · `driftless_context_graph` | `GET /topics/:slug/relations` · `…/graph` |
| Share | `context share <slug>` | `driftless_context_share` | `POST /topics/:slug/share` |
| Delete | `context delete <slug>` | `driftless_context_delete` | `DELETE /topics/:slug` |
| Merge duplicates | `context merge <src> --into <dst>` | `driftless_context_merge` | `POST /topics/:slug/merge` |
| Doctor / events | `context doctor` | `driftless_context_doctor` · `driftless_context_events` | `GET …/doctor` · `…/events` |

## Tags & Areas

| Workflow | CLI | MCP tool | API endpoint |
|---|---|---|---|
| Tags (list / create / delete) | `tags [add\|rename\|rm]` | `driftless_tags` (`action`) | `GET\|POST\|DELETE /tags` |
| Areas (list / create / update / delete) | `area [list\|add\|rename\|rm]` | `driftless_areas` (`action`) | `GET\|POST\|PATCH\|DELETE /areas` |

## Collections — the operational substrate

| Workflow | CLI | MCP tool | API endpoint | Default view |
|---|---|---|---|---|
| Collections (list / get / add / update) | `collection [list\|get\|add\|update]` | `driftless_collection` (`action`) | `GET\|POST\|PATCH /collections` | summary |
| Collection criterion (the seam) | — | `driftless_collection` action:`context` | `GET /collections/:id/context` | criterion topics |
| **Collection retrieve** (records + criterion, one call) | — | `driftless_collection` action:`retrieve` | `GET /collections/:id/retrieve` | bounded records page + criterion |
| Records (list / get / add / update) | `collection record [list\|get\|add\|update]` · `collection records` | `driftless_collection_record` (`action`) | `…/collections/:id/records` | keyset page |
| Entities (list / get / upsert) | — | `driftless_entity` (`action`) | `GET\|POST /entities` | — |

`collection retrieve` is the operational analogue of topic `retrieve`: relevant
records **plus** the criterion Knowledge to read **before** acting, in one GET.
Records paginate by keyset (`{ records, nextCursor }`).

## Integrations (SETUP) vs Broker (EXECUTION)

These are deliberately **two separate concerns**. Setup connects/configures a
provider (the privileged connect flow); the broker only operates a connection that
already exists. Authoring/deploying a Nango action is a **third, human-only lane**
that neither surface touches (the no-agent-scripting rule).

| Workflow | CLI | MCP tool | API endpoint |
|---|---|---|---|
| **SETUP** — catalog | `integration catalog` | — (setup is human-led) | `GET /integrations/nango/catalog` |
| **SETUP** — connect | `integration connect <provider>` | — | `POST /integrations/nango/:provider/connect-session` |
| **SETUP** — confirm | `integration confirm <provider>` | — | `POST /integrations/nango/:provider/confirm` |
| **SETUP** — list / disconnect | `integration list` · `integration rm <id>` | — | `GET /integrations` · `DELETE /integrations/:id` |
| **SETUP** — guidance | `broker setup` | — | (prose; no call) |
| **EXEC** — connections | `broker connections` | `driftless_broker` action:`connections` | `GET …/broker/connections` |
| **EXEC** — capabilities | `broker capabilities <provider>` | `driftless_broker` action:`capabilities` | `GET …/broker/connections/:provider/capabilities` |
| **EXEC** — operations | `broker operations <provider> [--refresh]` | `driftless_broker` action:`operations` | `GET …/broker/connections/:provider/operations` |
| **EXEC** — invoke | `broker invoke <provider> <op> --input` | `driftless_broker` action:`invoke` | `POST …/broker/connections/:provider/invoke` |
| **EXEC** — records (synced model) | `broker records <provider> --model` | `driftless_broker` action:`records` | `GET …/broker/connections/:provider/records` |
| **EXEC** — page/document content | `broker page <id>` | `driftless_broker` action:`page-content` | `GET …/broker/connections/notion/pages/:id/content` |
| **INDEX** — connector document preview | `broker index <provider> --dry-run` | `driftless_broker` action:`index-preview` | `POST …/broker/connections/:provider/index/preview` |
| **INDEX** — connector document execute | `broker index <provider>` | `driftless_broker` action:`index` | `POST …/broker/connections/:provider/index` |
| **EXEC** — events | `broker events [provider]` | `driftless_broker` action:`events` | `GET …/broker/events` |
| **EXEC** — criterion | `broker criterion <provider> [--add\|--rm]` | `driftless_broker` action:`criterion` | `GET\|POST\|DELETE …/criterion` |

Operations are served from **materialized metadata**; `--refresh` (CLI) /
`refresh:true` re-pulls the live list from Nango. Records mirror a synced model and
are **delta-aware** (`--modified-after` / `cursor`). Broker reads and writes both
run **inline + audited** — Driftless is a tooling proxy; the human-in-the-loop is
your own agent harness.

Connector document indexing is the explicit bridge from external source data to
Driftless-owned retrieve substrate. Preview first; execute writes only
`connector_documents`. Default `context retrieve` stays Topics-only. Connector
retrieve is opt-in (`sources:["connectors"]` / `include_external`) and returns
`trust:"external"` with citations and freshness.

**STOP rule:** if an agent needs a broker operation that
`broker operations <provider>` does **not** list, it must **report the missing
capability** — never author or deploy an integration script to fill the gap.

## Comments — annotate either plane

| Workflow | CLI | MCP tool | API endpoint |
|---|---|---|---|
| Comment (add / list / resolve) | `context comment [add\|list\|resolve]` | `driftless_context_comment` (`action`) | `POST\|GET\|PATCH /comments` |

A comment points **at** a topic / record — it carries no governance and
resolves into an edit (`open → resolved → wont_fix`).

---

## What is fast by default

The matrix encodes one rule: **the interactive default never ships a heavy body.**

- Lists and search default to `summary` (an index row) and are **bounded** (top
  5 search, top 40 list).
- Match-files and `retrieve` default to `brief` — the durable *why*, not the full
  `content` — and are bounded drifted-first (top 10).
- A single `context get <slug>` defaults to `full`, because you named the one
  topic you want.
- `full` everywhere else is an explicit opt-in (`--full` is never the default);
  pair it with a small `limit`.
- Records (collection + broker) paginate by keyset; broker output is hard-capped.

Latency and payload targets per workflow live in [`budgets.md`](./budgets.md);
the view/pagination vocabulary in [`views.md`](./views.md); how a perf claim is
accepted in [`gates.md`](./gates.md).
