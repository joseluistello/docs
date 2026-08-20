# Phase 4 — Typed Data Artifact Views

## Goal

Let an answer or Investigation dataset appear as a trustworthy table, metric set or chart without
allowing the model to generate arbitrary executable UI or redefine the underlying data.

## Architectural decision

Driftless owns a stable, versioned `DataArtifactSpec`. assistant-ui may render it through an adapter,
but its experimental Generative UI schema is not persisted as the domain contract.

The authoritative chain is:

`persisted dataset -> validated Driftless view spec -> React renderer -> user interaction`

Never:

`model-authored HTML/JS -> iframe -> authoritative result`

## First vocabulary

Keep the first vocabulary deliberately small:

- `DataTableView`
- `MetricGridView`
- `BarChartView`
- `LineChartView` only when the x field is temporal
- `EvidenceListView`
- `ComparisonView`

No pie chart, map, diagram, dashboard builder or arbitrary Markdown component in the first slice.

## Stable spec

Define a discriminated union resembling:

```ts
type DataArtifactSpec = {
  schemaVersion: 'data-artifact/1'
  artifactId: string
  datasetRef: { kind: 'investigation'; id: string; revision: number }
  title: string
  description?: string
  views: DataArtifactView[]
  defaultViewId: string
}
```

Views reference validated field ids and aggregation operations; they do not embed a second copy of
the entire dataset. The server validates:

- artifact/dataset belongs to the workspace;
- referenced fields exist and have compatible types;
- aggregation is allowlisted (`count`, `sum`, `avg`, `min`, `max`);
- grouping cardinality and row limits are bounded;
- URLs and evidence references come from persisted provenance;
- actions are allowlisted and permission-checked.

## assistant-ui compatibility spike

Before adding production behavior, run a small isolated spike:

1. Keep `@assistant-ui/react@0.15.8` pinned.
2. Evaluate the oldest compatible `@assistant-ui/react-generative-ui` release that satisfies the
   repository's seven-day `minimumReleaseAge`; do not add an exclusion.
3. Render a static `MetricGrid + BarChart + Table` from fixtures inside the existing
   `ExternalStoreRuntime` path.
4. Prove build, SSR assumptions, React 19, Zod version, CSS isolation, accessibility and lazy chunk
   impact.
5. Prove no request reaches Assistant Cloud.

Decision gate:

- If it integrates cleanly and adds less maintenance than it removes, create a thin adapter from
  `DataArtifactSpec` to its component registry.
- If its `0.0.x` API, dependencies or transport assumptions fight the External Store, implement a
  small local `DataArtifactRenderer` over Driftless components. Preserve the spec so the renderer
  remains replaceable.

Do not upgrade `@assistant-ui/react` merely to unlock this phase unless a separate dependency review
proves the migration and package-age guard.

## Chat integration

The current assistant message reserves a slot between prose and sources. A Chat response may link a
persisted artifact id in message metadata; the UI fetches and renders it there. It must not infer an
artifact by parsing prose.

For large Investigation artifacts, the message shows a compact preview and an explicit `Open
Investigation` action. The full table/chart surface remains the Investigation route.

## Actions

UI actions dispatch typed intents such as:

- switch view;
- filter/group locally through the server-supported query contract;
- inspect evidence;
- export CSV/JSON;
- select rows for Collection promotion.

An assistant-ui `$action` or component callback is only the frontend dispatch mechanism. The server
still authenticates, authorizes and validates every mutation.

## Accessibility and truthful visualization

- Every chart has a textual/table alternative and an accessible name.
- Tooltips are not the only place values exist.
- Truncated categories say how many are shown of the total.
- Missing values remain missing; they are never coerced to zero.
- Mixed currencies/scopes never share an aggregate series.
- A chart title states the metric, scope and period.
- Color never carries status alone.

## Acceptance

- The same persisted dataset can render as table and chart without regenerating data.
- Invalid fields/aggregations fail closed with a typed error.
- A saved artifact renders identically after refresh.
- Every visible value can be traced to a persisted row or deterministic aggregate.
- Assistant UI/renderer failure degrades to the canonical table, not to an empty answer.
- Ordinary text-only messages remain unchanged and do not pay the artifact chunk.

## Rollback

Disable rich rendering and show the canonical `DataTableView`. Persisted artifact specs and datasets
remain valid because they are Driftless-owned.

