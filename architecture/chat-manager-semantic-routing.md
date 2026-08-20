# The chat manager

One semantic decision per turn, then deterministic execution.

This supersedes the routing half of
[the commercial chat cutover](./chat-market-intelligence-cutover.md). The
execution half of that document — the Work Session, the activity trail, the
report artifact, the customer-safe projection — is unchanged and still current.

## What failed

Staging routed a chat turn with `classifyChatRoute()`: seven ordered ladders of
regexes over the raw message, first match wins, evaluated before any model saw
the text. Inside the destination it selected, a *second* decision — a real model
router — chose the market domains.

Two levels, and the first one could veto the second.

| message | routed to |
|---|---|
| `Busca proveedores de bombas hidráulicas` | market research |
| `Busco proveedores de bombas hidráulicas` | general chat |

One letter apart. The second was answered — inside the market-research product —
with *"You're asking about the supply side … this question is about the outside
market, which isn't something I can answer from our workspace."*

**The missing conjugation was not the defect.** The defect was that a regex held
the *authority* over meaning, and could therefore stop the intelligent router
downstream from ever seeing the question. Adding `busco` would have fixed one
sentence and left the architecture that produced it intact.

## What it is now

```
free-form user message
  → deterministic structural gates
  → compact context projection
  → ONE structured manager decision   (no tools, no execution)
  → ONE specialized destination
  → typed execution
  → one final response / report
```

The manager **comprehends, classifies and delegates**. It never researches,
never answers, never synthesizes, never calls a tool, never writes a
`ResearchReport`, never decides a permission, and cannot execute anything.

It is not a multi-agent network. No supervisor, no worker pool, no second
provider, no second runtime.

### The contract

`apps/api/src/chat/chat-manager.contract.ts`

```ts
type ChatManagerDecision = {
  destination:
    | 'workspace_knowledge' | 'market_research' | 'pipeline'
    | 'contact_action' | 'general' | 'clarification'

  marketObjectives: Array<{
    id: string
    domain: 'supplier_discovery' | 'opportunity_discovery'
          | 'market_history' | 'web_market_discovery'
    goal: string
    dependsOn: string[]
  }>

  clarification: { question: string; whyItMatters: string } | null
}
```

Versioned as `chat-manager-decision/1`. The version is **stamped by the
platform after parsing** and is not on the model's schema at all, so it can
never be a value a model chose.

Invariants, all fail-closed:

- unknown destination or unknown market domain → rejected;
- objectives on any destination but `market_research` → rejected;
- `market_research` with no objective → rejected (nothing to execute);
- `clarification` without a question, or any other destination *with* one → rejected;
- duplicate ids, self-dependency, a dependency on an id not in the plan, or any
  dependency **cycle** → rejected;
- `additionalProperties: false` at every level; every string and array bounded.

**There is no confidence score anywhere.** A threshold is a way of shipping an
unexecutable decision and hoping. Either the manager can name what to do, or it
asks one question.

### There is no `monitor` destination

A recurring watch ("avísame cada lunes si aparece una licitación") is a real
product idea, and `RadarMonitorService` + `DiscoveryProviderPort.createMonitor`
exist — but nothing wires them to Chat. A `monitor` destination would therefore
have had exactly one behaviour: route to the general belt so a second model
could say it cannot do it. **A published capability that does not exist is worse
than no capability**: it invites the manager to classify confidently into a
hole.

So it is not in the enum. The parser rejects it, the platform never offers it,
and the manager is told in its `RESTRICTIONS` that recurring watches are
unavailable and such a request belongs in `general`, where it can be answered
plainly.

To bring it back, all four of these must be true at once: the member returns to
`CHAT_DESTINATIONS`, its description returns to the prompt, the restriction is
dropped, and the turn pipeline gains a real execution branch.

### The call

`apps/api/src/chat/chat-manager.ts` — one model call: `toolChoice: 'none'`,
empty tool set, `maxSteps: 1`, bounded completion, **exactly one repair** if the
output does not parse or names a destination this deployment does not offer.

#### Typed, but NOT via native structured outputs

The manager first shipped asking the spec for `structuredOutputSchema`. That
makes the gateway request the `structured_outputs` capability, and a model that
does not **declare** it is refused before the call — correctly, since an
undeclared capability is treated as absent rather than optimistically tried.

Chat runs on whatever a workspace configured, including an OpenAI-compatible
endpoint that declares nothing. Routing every turn through that gate made the
whole product unavailable on those deployments: the hermetic Postgres suite went
from green to 14 failures, every one a turn that never reached its answer.

So the shape is stated verbatim in the prompt — all three keys, both enums, the
rules, and a complete worked response — and the platform parses the text:
`extractJsonBlock` → `parseChatManagerDecision` → the invariants. **The typing
did not weaken**: it is the same fail-closed parser, running on the model's
output either way. Native structured output would only have made a malformed
first attempt rarer, and the single repair already covers that.

`CHAT_MANAGER_DECISION_JSON_SCHEMA` stays in the contract as the **shape
oracle** — a test asserts the prompt and the parser agree with it, because two
hand-maintained descriptions of one contract drift.

#### `availableDestinations` is enforced, not requested

The projection tells the manager which destinations exist on this deployment. A
prompt instruction is a request, and a request is not a control — so after
parsing, the platform checks the decision's destination against the offered set.
A decision naming one that is absent is refused and repaired once, then fails
typed. It is **never** silently redirected to a neighbour, which would execute a
turn nobody decided on.

The failure carries a code: `unavailable_destination` (with the destination it
kept asking for) is distinguished from `unparseable_or_invalid` and `runtime`,
so the answer can say "market research is not available here" instead of "I
could not understand you" — which would be false, since it understood.

It is **not its own `agent.run` root**. A turn is one run — pinned in
`chat-observability.spec.ts` — and the manager is a step inside it, so its
tokens are merged into that run's ledger row. One question, one cost.

## What the manager sees, and what it does not

The projection is built by one function (`projectManagerContext`), which is what
makes the exclusions testable: there is exactly one string.

| included | bound |
|---|---|
| the current message | 2 000 chars |
| recent conversation | last 6 turns, 400 chars each, 2 000 total, trimmed from the **old** end |
| workspace/commercial profile summary | 600 chars |
| pending workflow or checkpoint | 300 chars |
| available destinations | — |
| authorization restrictions, stated | — |

**Excluded, structurally:** warehouse rows, SQL, warehouse schemas, the
capability catalog, the query audit, contacts, provider payloads, credentials,
and any tool definition. A classifier that can see rows starts answering from
them; a classifier that can see tools starts planning calls.

A destination this deployment cannot serve is **not offered**, and the reason is
stated rather than hidden — a silently missing destination gets routed around
and nobody learns why.

## The fast paths that skip the manager

Only an unambiguous **structural** signal:

- authentication / authorization;
- the per-thread turn lock;
- the cancellation signal;
- a validated typed action;
- a structured research decision (a signed approval envelope);
- a checkpoint / resume token;
- an explicit `mode: "research"` on the request;
- credential, model, budget and permission gates.

Not fast paths, and never again: keywords, conjugations, regexes over
`proveedor` / `licitación` / `pipeline` / `contacto`, or any inference drawn
from free text.

`lexical-routing.candado.spec.ts` reads the source and fails the build if the
`structuralPath` decision ever touches the message text.

## One semantic decision, not two

When the destination is `market_research`, the manager's objectives are passed
to `MarketResearchRunner` as a `ResearchPlan` — the **existing** contract, not a
parallel type. `ResearchPlanObjective.id` widened from a domain to a string and
gained an optional `goal`; the domain vocabulary was already identical on both
sides, and a test asserts it stays that way.

`market-research.workflow.ts` short-circuits its own routing step when
`input.plan` is present: the routing shape the four protocols read is *derived*
from the plan, deterministically, with no model call.

### The internal router's retirement condition, stated mechanically

`classifyResearchRequest` still runs for a caller that arrives with a question
and **no plan** — today the CLI/MCP entry points and the eval harness. It cannot
run on Chat's path.

> When every caller passes a plan — i.e. when `classifyResearchRequest` has no
> reachable call site outside its own spec — delete `classifyResearchRequest`,
> `parseRoutingDecision`, `buildResearchPlan` and `ROUTING_SYSTEM`, and make
> `plan` required.

## Failure behaviour

| situation | behaviour |
|---|---|
| JSON does not parse | one bounded repair, naming the parse failure |
| destination not offered on this deployment | one bounded repair, naming the offered set |
| second failure | honest typed error; **zero** workflows execute |
| decision valid but materially ambiguous | `clarification` — one question, nothing spent |
| manager unavailable (provider outage) | honest typed error, no repair attempt |
| `market_research` where the surface is unconfigured | honest refusal |

**Forbidden: `manager failed → general chat`.** That degradation is how a
commercial question reached the librarian, and an answer that looks like an
answer is worse than a refusal. A market question never opens Topics,
Collections, the CRM or the legacy catalog as a substitute — `runMarketResearchTurn`
builds no chat tool belt at all.

## Deletion ledger

| what | where | lines | why it went |
|---|---|---|---|
| `classifyChatRoute`, `ChatRouteKind`, `ChatRouteResult`, `ROUTES` (7 ladders, ~20 regexes) | `apps/api/src/chat/intent-preflight.ts` | 229 (whole file) | held the authority over meaning; failed by a conjugation |
| `classifyIntent`, `isCommercialIntent`, `toCompilerIntentKind`, `LADDERS`, `PreflightIntentKind`, `IntentPreflightResult` | same file | — | same defect in a smaller frame: four ladders gating the commercial-profile compile |
| the ladder's own tests | `apps/api/src/chat/intent-preflight.spec.ts` | 105 | tested the retired paradigm against itself |
| the legacy Opportunity Flow — capability catalog, `selectRelevantCapabilities`, work-contract compile, director/coordinator dispatch, opportunity artifact | `chat.service.ts`, the `market_opportunity` arm of the paid-research chain | 474 | unreachable since PR #309 narrowed that condition; a second commercial path a reader could mistake for a live one |
| the duplicated gateway-context build | `chat.service.ts` | 39 | the turn now builds it once, above the manager |
| `report.answer` rendering | `apps/dashboard/src/research/ReportView.tsx` + `.rs-answer` | 13 | the answer is the assistant's turn; printing it again made one answer two |
| `.rs-chat-report` (the second scroll container below the composer) | `apps/dashboard/src/research/research.css` + `ResearchChat.tsx` | 19 | produced the reading order answer → composer → answer → report |
| four `classifyChatRoute(...)` routing assertions | `commercial-isolation.spec.ts` | 30 | tested the regex with the regex; replaced by an isolation property that does not depend on classification being right |
| the `monitor` destination, its prompt description and its belt directive | `chat-manager.contract.ts`, `chat-manager.ts`, `chat.service.ts` | 12 | no execution behind it — its only behaviour was to route somewhere that says it cannot execute |
| `structuredOutputSchema` on the manager spec | `chat-manager.ts` | 1 | gated every chat turn behind a capability an OpenAI-compatible endpoint need not declare |

**No second router is kept warm for rollback.** The rollback is reverting this
PR's merge commit.

Replaced rather than deleted: the commercial-profile compile is now gated by
`COMMERCIAL_DESTINATIONS` and `compilerIntentFor(destination, structuralPath)`.

## Locks

- `chat/lexical-routing.candado.spec.ts` — the module is gone, none of its
  functions survives anywhere in `chat/`, no product module declares a
  destination ladder, exactly one `decideChatTurn` call site, the structural
  fast paths never read the message.
- `experience-v2/director-candado.spec.ts` — no module of the director's
  decision path may hold a keyword classifier. It outlives the module it was
  written against, because it forbids the *shape*.
- `cognitive/pr-hardening.guard.spec.ts` — the ratified `chat/` surface.

## Measurement

`evals/chat-routing/` — a routing gold set deliberately **separate** from
`evals/market-research/gold`, which measures retrieval. Mixing them hides the
failure that matters: a commercial question routed to general chat produces a
fluent, confident, wrong answer and scores zero retrieval error, because no
retrieval was attempted.

Headline metric: **`commercialFalseNegativeRate`** — the fraction of real market
errands answered from somewhere other than market research. It is the only
number `run.mjs` exits non-zero on.

```bash
pnpm evals:chat-routing:selftest   # hermetic — no model, no network, no DB
pnpm evals:chat-routing -- --api … --workspace …
```
