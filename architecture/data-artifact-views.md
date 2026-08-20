# Data artifact views — the spec, and the assistant-ui decision

## The authoritative chain

```
persisted dataset  →  validated Driftless view spec  →  React renderer  →  user interaction
```

Never:

```
model-authored HTML/JS  →  iframe  →  authoritative result
```

Driftless owns `DataArtifactSpec` (`apps/api/src/investigations/data-artifact.contract.ts`),
a versioned discriminated union. A view names FIELDS and an allowlisted
aggregation; it never embeds a second copy of the dataset, and it never carries
markup. The server validates every spec before it leaves: the dataset belongs to
the workspace, referenced fields exist with compatible types, the aggregation is
one of `count | sum | avg | min | max`, and grouping cardinality and row limits
are bounded. An invalid spec fails closed with a typed error rather than
rendering partially.

## The assistant-ui compatibility spike

### What was evaluated, and when

`@assistant-ui/react-generative-ui`, against the repository's pinned
`@assistant-ui/react@0.15.8`, on 2026-08-16.

| Fact | Value |
|---|---|
| Releases published | 14, from `0.0.2` (2026-06-04) to `0.0.14` (2026-08-12) |
| Release cadence | ~1.4 per week over ten weeks |
| Newest release | `0.0.14` — **4 days old, blocked by our 7-day `minimumReleaseAge`** |
| Newest eligible release | `0.0.13` (2026-08-08), 8 days old — no exclusion needed |
| Peer requirements (`0.0.13`) | `@assistant-ui/react ^0.15.0`, `react ^18 \|\| ^19`, `zod ^4.0.0` |
| Our versions | `@assistant-ui/react@0.15.8`, `react ^19.1.0`, `zod 4.4.3` |
| Runtime dependency | `assistant-stream ^0.3.36` — already in our tree |

**No version conflict blocks adoption.** Every peer is satisfied and the age
guard admits `0.0.13` without an exclusion. The decision below is not about
versions.

### What its API actually is

Read from the published package (`package.json` exports, `README.md`,
`dist/index.d.ts`, `src/`), the library's shape is:

- `new JSONGenerativeUI({ library })` declares the components a MODEL may render;
- `generativeUI.present()` returns a **tool** the model calls, whose parameters
  are the UI tree;
- the model emits `{ $type, ...props }` and the tree is rendered against the
  library, mounted as `<Tools toolkit={…}>` inside `<Thread>`;
- `streamProperties` renders from PARTIAL props as they stream in, via
  `assistant-stream`.

There is a lower-level pair — `renderGenerativeUI` / `generativeUIToJSX` — that
renders a node tree without the tool, which is the only shape an adapter could
use.

Its vocabulary (`ALERT_TONES`, `ALIGNS`, `BUTTON_STYLES`, `COLORS`, `ICON_NAMES`,
`IMAGE_SIZE_TOKENS`, `TEXT_SIZES`, `WEIGHTS`, `JUSTIFIES`) is **presentational**.
It contains no table, metric, chart or evidence primitive.

### The decision

**Implement a local `DataArtifactRenderer` over Driftless components. Do not add
the dependency.** The spec stays Driftless-owned and versioned, so the renderer
remains replaceable if this changes.

The gate asks whether it "adds less maintenance than it removes". It does not:

1. **The six views would still be ours.** Its vocabulary has no data-display
   primitive, so `DataTableView`, `MetricGridView`, `BarChartView`,
   `LineChartView`, `EvidenceListView` and `ComparisonView` are components we
   write either way — and then additionally register in its library.
2. **It would add a second representation of the same thing.** Adopting it means
   translating a validated `DataArtifactSpec` into its IR node tree at render
   time. The program's rule is that assistant-ui's experimental format must not
   become the domain contract; a runtime translation layer is that coupling
   arriving through the renderer instead of through storage.
3. **Its transport assumption is the opposite of ours.** It exists to render UI a
   model is streaming, from partial props, inside a conversation. Our chain
   renders a server-validated spec over rows that are already persisted. Nothing
   in our path is partial, and nothing in it is model-authored.
4. **Its lifecycle would become ours.** A `0.0.x` package at ~1.4 releases per
   week, whose newest release is permanently ~7 days out of reach under our own
   supply-chain guard, makes every upgrade a review — for components we wrote.

### What this spike did NOT verify

Steps 3–5 of the phase's spike (install `0.0.13`, render a static
`MetricGrid + BarChart + Table` from fixtures inside the existing
`ExternalStoreRuntime` path, and prove build, SSR assumptions, CSS isolation,
accessibility, lazy-chunk impact and that no request reaches Assistant Cloud)
were **NOT RUN**. The package was inspected as published, not installed.

That is enough for the decision recorded here, because the decision rests on API
shape and dependency lifecycle rather than on integration mechanics — but it is
not enough to reverse it. Adopting the adapter later requires actually running
those steps.

## Truthful visualization rules the renderer enforces

- Every chart carries a textual/table alternative and an accessible name.
- A value exists somewhere other than a tooltip.
- A truncated category list states how many of the total are shown.
- A missing value stays missing. It is never coerced to zero — a bar of height
  zero and a bar that does not exist are different claims.
- Mixed currencies or amount scopes never share a series.
- A chart title states the metric, the scope and the period.
- Colour never carries status alone.
