# Surface build parity

**The failure class:** Driftless has three client surfaces (API, MCP adapter,
CLI) built from one repo but deployed independently — the MCP adapter can run
mounted inside the API process or as its own service. After a deploy, one
surface can silently keep serving an **older build** than the others. It
happened: the production MCP served a stale broker tool for days, undetected
until an agent hit the old behavior. Schema-level drift between surfaces is
caught at CI time by the cross-surface drift guard; a *deployed-build* skew is
invisible to CI by definition — it only exists at runtime.

**The mechanism (exposure, not enforcement):**

- **API** — `GET /version` (public) returns the deployed `commit`
  (`RENDER_GIT_COMMIT` → `COMMIT_SHA` → `unknown`, 7-char).
- **MCP** — `GET /mcp/health` returns the same `commit`, and
  `serverInfo.version` carries it as semver build metadata
  (`0.4.0+abc1234`), so any MCP client sees which build it is talking to at
  `initialize` — no extra call.
- **Doctor** — `driftless doctor` fetches both and reports one line:
  `ok api abc1234 · mcp abc1234` when they match, a loud
  `BUILD SKEW — api serves X, mcp serves Y` warning when they diverge. A
  standalone MCP deployment is reached via `DRIFTLESS_MCP_URL`; without build
  metadata (local dev) the check reports itself skipped.

Both surfaces read the **same env chain** — that is the invariant. If a new
deploy platform sets a different commit variable, extend the chain in BOTH
`apps/api/src/ops/ops.controller.ts` and `apps/mcp/src/build-info.ts`, or the
comparison lies.

Together with the CI schema guard this closes the whole "works on my surface"
class: schema parity before merge, build parity after deploy.
