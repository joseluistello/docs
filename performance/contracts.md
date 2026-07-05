# F0.6 — Surface contract snapshots

Machine-checkable contracts for the CLI, MCP, and API surfaces, captured **before**
implementation changes, so accidental command/tool/route drift fails a test instead of reaching
a consumer. This is the safety net that lets the optimization cards refactor aggressively while
moving staging → main.

## What is a contract here

| Surface | Contract captured | Source of truth |
|---|---|---|
| CLI | command names, subcommands, flags (name + takes-value), help section titles | the command builders in `apps/cli/src/commands/*` |
| MCP | tool `name`, `action` enums, `inputSchema`, `outputSchema`, `annotations` | `apps/mcp/src/tools/tool-registry.ts` |
| API | route method+path, query params, `view` enums, success JSON shape (keys, not values) | the Nest controllers in `apps/api/src/*` |

Contracts capture **shape, not data**: key sets and enum members, never row values or counts
(those belong to the budgets/quality evals, not the contract).

## Snapshot strategy

1. **Generate, don't hand-write.** A small script walks each surface's source of truth and emits
   a normalized JSON descriptor:
   - CLI: introspect the registered commander program → `{command, subcommands[], flags[]}`.
   - MCP: read the tool registry → `{name, actions[], inputSchema, outputSchema, annotations}`.
   - API: a contract test hits each list/read route and snapshots the response key-shape under
     a fixed fixture.
2. **Commit the snapshot** under `apps/<surface>/src/**/__contracts__/*.snap.json`.
3. **Assert in CI** that the freshly generated descriptor equals the committed snapshot.
   A diff is either an intended change (update the snapshot in the same PR, which makes the
   contract change reviewable) or a regression (fix the code).
4. **Backward-compat rule.** Removing or renaming a command/flag/tool/action/route, or dropping
   a response key, is a **breaking** diff: it must be called out in the PR and gated by F10.1's
   backward-compatible-defaults rule.

## Test plan (at least one per surface)

- **CLI** — `apps/cli/src/commands/install-skill.spec.ts` style: a `*.contract.spec.ts` that
  builds the program, serializes the command tree, and `toMatchSnapshot()`s it.
  Run: `pnpm --filter @driftless-sh/cli test`.
- **MCP** — extend `apps/mcp/src/tools/tool-registry.spec.ts` with a snapshot of every tool's
  `{name, actions, inputSchema keys, outputSchema keys, annotations}`.
  Run: `pnpm --filter <mcp-package> test`.
- **API** — a contract integration spec (alongside the existing
  `apps/api/src/*.integration.spec.ts`) that snapshots the key-shape of each in-scope list/read
  route against a fixed fixture.

> Validate-command note: the cards were authored with `npm test --workspace @driftless/cli`.
> This repo is **pnpm** and the package is **`@driftless-sh/cli`**; the MCP package name must be
> read from its `package.json`. Use `pnpm --filter <pkg> test`. See `gates.md`.
