# Market research skill, loop and harness hardening

Status: implementation plan grounded in the semantic API and the staged failure
ledger. It does not authorize a new agent, domain, transport or warehouse model.

## Current finding

The semantic API crossed the first reliability threshold: the model now chooses
seven typed business operations instead of authoring SQL. The remaining quality
failures are concentrated after retrieval — method selection, synthesis and
claim strength — plus incomplete evaluation infrastructure.

The current skill already has useful progressive disclosure: a core `SKILL.md`,
shared references, method-specific references and a finalization reference. The
current Mastra workflow does much less than its name suggests: it compiles a
brief, branches between clarification and investigation, then delegates all
iteration, budget, repair and finalization to `MarketResearchRunner`. The runner
compiles the same brief again. Workflow schemas are permissive objects rather
than typed state contracts.

## Non-negotiable design

- Keep one universal workflow with composable methods. No workflow per vertical.
- Keep the three semantic data domains and seven tools. No return to model SQL.
- Deterministic truth rules live in code. The skill explains method and examples;
  it is not the sole enforcement layer.
- The Work Session and ResearchReport remain the durable product record. Mastra
  state may coordinate a run but never becomes a second source of truth.
- A second agent is admitted only after a controlled mixed-domain eval proves a
  single agent still tunnels after deterministic budget/state improvements.

## P0 — claim honesty (implemented in the 2.1.0 treatment)

1. Reject a deadline-like action attached to a tender date. The corpus publishes
   dated acts, not a proposal deadline.
2. Reject unscoped exclusivity such as “the only opportunity” after a typed text
   search. Permit “the only direct match among the searches executed”.
3. Give the model paired positive/negative examples for both rules.

Gate: deterministic validator tests plus a live replay of the staged pumps and
water-treatment question. Zero invented act-by dates and zero unscoped market
exclusivity claims.

## P1 — skill 2.2: less memory, better recipes

1. Keep the critical invariants at the top of `SKILL.md`; move catalogue-like
   detail and refusal lists to references. Add a character/token budget test for
   every method bundle so progressive disclosure remains real as domains grow.
2. Maintain one worked success and one paired failure per failure family:
   temporality, coverage-conditioned zero, weak identity, amount grain, lexical
   relevance, pagination and explicit deliverables such as contacts.
3. Test routing as the skill's trigger layer: obvious requests, paraphrases,
   mixed-domain requests and negative/unanswerable requests. The current keyword
   table must not silently route “where should I sell pumps?” to a generic method
   merely because it lacks the noun “supplier” or “tender”.
4. Remove duplicated or contradictory instructions mechanically. Every critical
   rule has one canonical sentence and an executable gate where possible.

Gate: a versioned prompt snapshot per method, routing fixtures, and an A/B where
only `skillVersion` and `driftlessCommit` may differ. At least three repetitions
per question; no silent retry.

## P2 — make the Mastra workflow earn its dependency

Use Mastra for deterministic orchestration, not for replacing domain logic:

1. Compile the brief once in a typed `route` step and pass it into the runner.
2. Replace permissive object schemas with Zod input/output/state schemas.
3. Put only compact platform state in workflow state: frozen brief, capability
   basis/hash, remaining call budget, positive query ids, unresolved objectives
   and maximum claim scope. Store observation payloads in the existing artifact
   path and carry ids, not large rows, in workflow state.
4. Expose deterministic steps in the trace: route → load capabilities → investigate
   → assemble → validate → at most one targeted repair → terminal/fallback.
5. Use branching for clarification and repair eligibility. Do not use dynamic
   workflows or a model-authored execution graph. Do not add suspend/resume until
   the product actually supports a user clarification round through the chat.
6. Keep the adaptive tool loop bounded inside the investigation step initially.
   Move it to a Mastra `doWhile` only if trajectory evidence shows step-level
   retry/state/observability materially improves recovery.

Gate: exact golden parity between the old runner entrypoint and the typed workflow
for scripted trajectories, then a live A/B. Mastra adoption is rejected if it
only adds spans or latency without changing a measured failure mode.

## P3 — finish the harness before optimizing another prompt

1. Repair `gold/materialize.mjs`: it still targets the deleted Query API. Gold
   materialization must call the same workspace-scoped semantic endpoints/tools
   used by the product, never a DSN and never an operator SQL surface.
2. Human-review and sign the ten existing gold cases. Unsigned cases continue to
   refuse scoring.
3. Expand to at least 30 questions, stratified across supplier discovery,
   opportunity discovery, market history, cross-domain composition and honest
   unsupported answers. Include paraphrases and user personas, not query templates.
4. Grade four layers separately:
   - contract gates: parse, provenance, citations, deadline, identity, money;
   - tool trajectory: correct operation/arguments, refusals, pagination, budget;
   - retrieval: expected entities/aggregates against materialized gold;
   - customer outcome: objective completion, usefulness and calibrated claims.
5. Add an after-action review sampled after the customer result. Ask the model
   which operation, observation or instruction caused pain and what single change
   would have helped. Store it separately; it never changes the same run and is
   never treated as ground truth.
6. Add an LLM judge only for the undecidable layer. Require structured findings
   and convert them to scores deterministically. Use a model different from the
   model under evaluation and human-review a seeded sample.

Release gates for the first 30-question suite, three runs each:

- at least 95% successful semantic operations;
- zero unsupported deadline/act-by claims;
- zero unscoped market-exclusivity claims;
- zero false-empty summaries when a positive query exists;
- 100% resolvable citations for material facts;
- at least 90% deterministic property accuracy;
- human objective-completion median at least 8/10, with no domain below 7.5.

## P4 — decisions explicitly deferred

- **DeepSeek Pro:** compare only after the harness is stable. DeepSeek documents
  that JSON mode can return empty content; keep the bounded no-tools retry and
  platform fallback regardless of model.
- **Mastra scorers:** useful as an adapter for asynchronous live sampling and
  experiment comparison, not as a replacement for the existing deterministic
  gold properties.
- **Multi-agent:** trigger only if at least 20 mixed-domain runs show the secondary
  objective is missed in more than 20% of runs after P1–P2. Then A/B one supervisor
  plus one research worker against the single-agent baseline. No agent council.
- **Workflow memory:** no semantic recall or conversational memory inside a single
  research run. Persist durable user context in Driftless; pass only the relevant
  frozen context into the run.

## Primary references

- Anthropic, *The Complete Guide to Building Skills for Claude* (progressive
  disclosure, paired examples, deterministic validation, trigger/functional/
  baseline testing).
- Anthropic Engineering, *Building effective agents* (simple composable patterns,
  workflows for predictable paths, bounded evaluator-optimizer loops).
- Anthropic Engineering, *Demystifying evals for AI agents* (stable environments,
  layered graders and task-level outcomes).
- Mastra documentation: workflow control flow, workflow state, snapshots,
  agent tools and scorers/gates.
- DeepSeek API documentation: JSON Output and tool-call argument validation.
