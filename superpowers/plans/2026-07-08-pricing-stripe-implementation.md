# Pricing & Stripe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a 4-tier pricing model (Free/Pro/Team/Enterprise) as a fresh plans-as-data entitlements engine, gate the right features/counts per tier, and wire Stripe Checkout + webhook so Pro/Team are self-serve.

**Architecture:** `PLANS` catalog (data) + `EntitlementsService.resolve()/can()/assert*()` (the only code that knows the pricing model) + `@RequiresFeature`/`FeatureGuard` for on/off features + per-count asserts (mirroring the existing repo-limit pattern) for numeric ceilings. Stripe is a thin adapter on top: Checkout creates a subscription, the webhook maps price+quantity → `plan`+`overrides` and calls the same `WorkspacesService.setPlan()` seam an admin uses manually today.

**Tech Stack:** NestJS (apps/api), TypeORM migrations, `stripe` npm SDK, React dashboard (apps/dashboard), Next.js landing (apps/web).

## Global Constraints

- **Do NOT touch or merge `feat/entitlements-engine`.** That branch was cut before Projects/Collections/Comments/Areas/Broker/Chat existed on `staging` — its diffs of `workspaces.module.ts`/`workspaces.controller.ts`/`data-source.ts` *delete* all of that from the entity list. It is reference-only for the `EntitlementsService`/`FeatureGuard` pattern, already reproduced correctly in Task 2-3 below against **current** `staging`.
- **Knowledge/Topics are never gated.** No task in this plan touches `apps/api/src/topics/**`.
- **Enforcement stays OFF by default** (`ENTITLEMENTS_ENFORCE` unset/false) through every task in this plan. Flipping it on is a deliberate, separate step after Task 14 (webhook) is verified end-to-end in staging — do not flip it as part of any task here.
- **All work happens directly on `staging`** (no feature branch), per this repo's existing workflow — commit after each task's tests pass.
- **Every new migration file must be registered in `libs/db/src/data-source.ts`** (import + entities array if a new entity + migrations array) in the SAME commit as the migration, or prod breaks on next deploy.
- **New TypeORM entities/columns used at runtime must be registered in `apps/api/src/app.module.ts`'s `forRootAsync` entities list too**, not just `data-source.ts` — that's the runtime wiring; missing it is a silent 500 "No metadata" that tests won't catch since they exercise the compiled path differently. Check `app.module.ts` for a `Workspace` reference — if entities are already imported as a shared list from `@driftless/db`, no new entry is needed for a column-only migration (only new entities need adding).
- **Never commit a real Stripe secret.** `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are read from env only; the repo's `secret-scan.ts` will already block a literal `sk_live_`/`whsec_` value if one is accidentally pasted into a topic — the same discipline applies to code/config committed here.

---

### Task 1: Plans catalog + workspace.plan migration

**Files:**
- Create: `apps/api/src/entitlements/plans.catalog.ts`
- Create: `apps/api/src/entitlements/plans.catalog.spec.ts`
- Create: `libs/db/src/migrations/1715200000102-AddWorkspacePlan.ts`
- Modify: `libs/db/src/entities/workspace.entity.ts`
- Modify: `libs/db/src/data-source.ts`

**Interfaces:**
- Produces: `PlanId = 'free' | 'pro' | 'team' | 'enterprise'`, `FeatureKey = 'byom_chat' | 'broker'`, `PlanDef { seats, workspaces, repos, projects, collections: number | null; features: Record<FeatureKey, boolean> }`, `PLANS: Record<PlanId, PlanDef>`, `isPlanId(value: unknown): value is PlanId`, `planIdOrFree(value: unknown): PlanId`. Task 2 imports all of these from `./plans.catalog`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/entitlements/plans.catalog.spec.ts
import { describe, it, expect } from 'vitest'
import { PLANS, PLAN_IDS, isPlanId, planIdOrFree } from './plans.catalog'

describe('plans.catalog', () => {
  it('defines exactly free/pro/team/enterprise', () => {
    expect(PLAN_IDS.sort()).toEqual(['enterprise', 'free', 'pro', 'team'])
  })

  it('never gates knowledge — projects/collections are the only numeric ceilings besides seats/workspaces/repos', () => {
    for (const plan of PLAN_IDS) {
      const keys = Object.keys(PLANS[plan]).sort()
      expect(keys).toEqual(['collections', 'features', 'projects', 'repos', 'seats', 'workspaces'])
    }
  })

  it('free: 1 seat, 1 workspace, 1 repo, 5 projects, 5 collections, no byom_chat/broker', () => {
    expect(PLANS.free).toEqual({
      seats: 1, workspaces: 1, repos: 1, projects: 5, collections: 5,
      features: { byom_chat: false, broker: false },
    })
  })

  it('pro: 1 seat, 3 workspaces, unlimited projects/collections, byom_chat true, broker false', () => {
    expect(PLANS.pro).toEqual({
      seats: 1, workspaces: 3, repos: 1, projects: null, collections: null,
      features: { byom_chat: true, broker: false },
    })
  })

  it('team: 5 seats, 1 workspace, unlimited repos/projects/collections, byom_chat + broker true', () => {
    expect(PLANS.team).toEqual({
      seats: 5, workspaces: 1, repos: null, projects: null, collections: null,
      features: { byom_chat: true, broker: true },
    })
  })

  it('enterprise: everything unlimited/true', () => {
    expect(PLANS.enterprise).toEqual({
      seats: null, workspaces: null, repos: null, projects: null, collections: null,
      features: { byom_chat: true, broker: true },
    })
  })

  it('isPlanId / planIdOrFree', () => {
    expect(isPlanId('team')).toBe(true)
    expect(isPlanId('bogus')).toBe(false)
    expect(planIdOrFree('team')).toBe('team')
    expect(planIdOrFree(undefined)).toBe('free')
    expect(planIdOrFree('bogus')).toBe('free')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/entitlements/plans.catalog.spec.ts`
Expected: FAIL — `Cannot find module './plans.catalog'`

- [ ] **Step 3: Write the catalog**

```ts
// apps/api/src/entitlements/plans.catalog.ts
// The pricing model as DATA — the single editable source of truth for what each
// tier unlocks. Changing a number or moving a capability between tiers is an edit
// here, never a refactor: features ask EntitlementsService.can()/assert*(), they
// never branch on the plan. Stripe only decides WHO moves workspaces.plan and
// meters Team's per-unit overage; this table is unchanged by it.
//
// Design principles:
//   - Knowledge is NEVER gated: `topics` does not appear here → unlimited on every
//     plan, Free included. Gating knowledge would kill the aha + data gravity.
//   - Projects/Collections are the OPERATIONAL axis — free but capped on Free (5
//     each), unlimited from Pro up. Never an on/off feature flag, always a count.
//   - byom_chat covers BOTH the workspace assistant (Chat) and the BYOM agents
//     (Auditor/Architect) — both run through the same model-gateway, so one flag
//     covers the whole "bring your own model" surface.
//   - broker gates the integrations surface (Notion/Drive/etc connections) —
//     Team+ only. This is separate from DRIFTLESS_BROKER_ENABLED (broker-feature.ts),
//     which is an environment-level kill switch, not a plan gate.
//   - Team is "~$15/seat with a floor of 5": $49 for up to 5 seats + $15/seat extra
//     (+$15/workspace). Phase 1 enforces the INCLUDED quantities as hard caps; the
//     overage is billed via Stripe quantity line items (Task 11+).
//   - `null` = unlimited (skip the check).

export type PlanId = 'free' | 'pro' | 'team' | 'enterprise'

export type FeatureKey = 'byom_chat' | 'broker'

export interface PlanDef {
  /** Members allowed in one workspace. null = unlimited. */
  seats: number | null
  /** Workspaces one account may own (account-level; see EntitlementsService). null = unlimited. */
  workspaces: number | null
  /** Repos connected to one workspace. null = unlimited. */
  repos: number | null
  /** Projects (kanban boards) in one workspace. null = unlimited. */
  projects: number | null
  /** Collections (CRM/pipelines) in one workspace. null = unlimited. */
  collections: number | null
  features: Record<FeatureKey, boolean>
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    seats: 1, workspaces: 1, repos: 1, projects: 5, collections: 5,
    features: { byom_chat: false, broker: false },
  },
  pro: {
    seats: 1, workspaces: 3, repos: 1, projects: null, collections: null,
    features: { byom_chat: true, broker: false },
  },
  team: {
    seats: 5, workspaces: 1, repos: null, projects: null, collections: null,
    features: { byom_chat: true, broker: true },
  },
  enterprise: {
    seats: null, workspaces: null, repos: null, projects: null, collections: null,
    features: { byom_chat: true, broker: true },
  },
}

export const PLAN_IDS = Object.keys(PLANS) as PlanId[]

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_IDS as string[]).includes(value)
}

// The plan a row resolves to, defaulting unknown/empty values to 'free' so a bad
// column value can never silently grant a paid capability.
export function planIdOrFree(value: unknown): PlanId {
  return isPlanId(value) ? value : 'free'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/entitlements/plans.catalog.spec.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Add the `plan` column — migration**

```ts
// libs/db/src/migrations/1715200000102-AddWorkspacePlan.ts
import { MigrationInterface, QueryRunner } from 'typeorm'

// Billing tier column. Source of truth for entitlements (EntitlementsService
// resolves PLANS[plan] merged with settings.billing.overrides). Defaults every
// existing workspace to 'free' — correct, since no plan existed before this.
export class AddWorkspacePlan1715200000102 implements MigrationInterface {
  name = 'AddWorkspacePlan1715200000102'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE workspaces DROP COLUMN IF EXISTS plan`)
  }
}
```

- [ ] **Step 6: Register the migration in data-source.ts**

In `libs/db/src/data-source.ts`, add the import next to the other 102x-range imports:

```ts
import { AddWorkspacePlan1715200000102 } from './migrations/1715200000102-AddWorkspacePlan'
```

Append `AddWorkspacePlan1715200000102` to the end of the `migrations: [...]` array (after `AddProviderCredentialModels1715200000101`).

- [ ] **Step 7: Add the entity column**

In `libs/db/src/entities/workspace.entity.ts`, add after `clerk_org_id`:

```ts
  // Billing tier. Source of truth for entitlements (EntitlementsService resolves
  // PLANS[plan] merged with settings.billing.overrides). Set via the admin setPlan
  // endpoint or the Stripe webhook (same seam).
  @Column({ type: 'text', default: 'free' })
  plan: string
```

- [ ] **Step 8: Run the API build to confirm no type errors**

Run: `cd apps/api && npx tsc --noEmit`
Expected: no errors referencing `workspace.entity.ts` or `data-source.ts`

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/entitlements/plans.catalog.ts apps/api/src/entitlements/plans.catalog.spec.ts \
  libs/db/src/migrations/1715200000102-AddWorkspacePlan.ts libs/db/src/entities/workspace.entity.ts \
  libs/db/src/data-source.ts
git commit -m "feat(entitlements): plans-as-data catalog + workspace.plan column"
```

---

### Task 2: EntitlementsService

**Files:**
- Create: `apps/api/src/entitlements/entitlements.service.ts`
- Create: `apps/api/src/entitlements/entitlements.service.spec.ts`
- Modify: `apps/api/src/ops/error-codes.ts`

**Interfaces:**
- Consumes: `PLANS`, `planIdOrFree`, `FeatureKey`, `PlanDef`, `PlanId` from `./plans.catalog` (Task 1); `Workspace`, `WorkspaceMember`, `Repo`, `Project`, `Collection` from `@driftless/db`; `DomainException`, `ErrorCode` from `../ops/error-codes`.
- Produces: `EntitlementsService` with `resolve(workspaceId)`, `can(workspaceId, feature)`, `assertFeature(workspaceId, feature)`, `assertSeatAvailable(workspaceId)`, `assertRepoAvailable(workspaceId)`, `assertProjectAvailable(workspaceId)`, `assertCollectionAvailable(workspaceId)`, `assertWorkspaceAvailable(ownerClerkUserId)`. Tasks 3-10 inject and call these.

- [ ] **Step 1: Add the two error codes**

In `apps/api/src/ops/error-codes.ts`, add inside the `ErrorCode` object, after `UNKNOWN_TOPIC`:

```ts
  // Billing: a feature/limit the workspace's plan doesn't include, or would
  // exceed the workspace's plan, or would exceed a plan's included quantity. The
  // dashboard/CLI branch on these to surface an upgrade prompt.
  FEATURE_NOT_IN_PLAN: 'FEATURE_NOT_IN_PLAN',
  PLAN_LIMIT_EXCEEDED: 'PLAN_LIMIT_EXCEEDED',
```

- [ ] **Step 2: Write the failing test**

```ts
// apps/api/src/entitlements/entitlements.service.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Workspace, WorkspaceMember, Repo, Project, Collection } from '@driftless/db'
import { EntitlementsService } from './entitlements.service'
import { DomainException } from '../ops/error-codes'

function fakeRepo(rows: any[] = []) {
  return {
    findOne: async ({ where }: any) => rows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null,
    find: async ({ where }: any = {}) =>
      rows.filter((r) => !where || Object.entries(where).every(([k, v]) => (v as any)?.['_type'] === 'In' ? (v as any).values.includes(r[k]) : r[k] === v)),
    count: async ({ where }: any) => rows.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v)).length,
  }
}

describe('EntitlementsService', () => {
  let workspaces: any[]
  let members: any[]
  let repos: any[]
  let projects: any[]
  let collections: any[]
  let enforce = 'false'

  async function build() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        EntitlementsService,
        { provide: getRepositoryToken(Workspace), useValue: fakeRepo(workspaces) },
        { provide: getRepositoryToken(WorkspaceMember), useValue: fakeRepo(members) },
        { provide: getRepositoryToken(Repo), useValue: fakeRepo(repos) },
        { provide: getRepositoryToken(Project), useValue: fakeRepo(projects) },
        { provide: getRepositoryToken(Collection), useValue: fakeRepo(collections) },
        { provide: ConfigService, useValue: { get: (k: string) => (k === 'ENTITLEMENTS_ENFORCE' ? enforce : undefined) } },
      ],
    }).compile()
    return moduleRef.get(EntitlementsService)
  }

  beforeEach(() => {
    workspaces = [{ id: 'ws1', plan: 'free', settings: {} }]
    members = []
    repos = []
    projects = []
    collections = []
    enforce = 'false'
  })

  it('resolve() defaults an unknown plan to free', async () => {
    workspaces[0].plan = 'bogus'
    const svc = await build()
    const { plan, def } = await svc.resolve('ws1')
    expect(plan).toBe('free')
    expect(def.seats).toBe(1)
  })

  it('resolve() merges settings.billing.overrides over the base plan', async () => {
    workspaces[0].settings = { billing: { overrides: { seats: 99 } } }
    const svc = await build()
    const { def } = await svc.resolve('ws1')
    expect(def.seats).toBe(99)
  })

  it('assertFeature does not throw when enforcement is off, even if the plan lacks the feature', async () => {
    const svc = await build()
    await expect(svc.assertFeature('ws1', 'broker')).resolves.toBeUndefined()
  })

  it('assertFeature throws PAYMENT_REQUIRED/FEATURE_NOT_IN_PLAN when enforcement is on and the plan lacks the feature', async () => {
    enforce = 'true'
    const svc = await build()
    await expect(svc.assertFeature('ws1', 'broker')).rejects.toMatchObject({
      response: { code: 'FEATURE_NOT_IN_PLAN' },
    })
  })

  it('assertProjectAvailable blocks at the Free ceiling (5) when enforcing, allows below it', async () => {
    enforce = 'true'
    projects = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, workspace_id: 'ws1' }))
    const svc = await build()
    await expect(svc.assertProjectAvailable('ws1')).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT_EXCEEDED' },
    })
    projects.pop()
    await expect(svc.assertProjectAvailable('ws1')).resolves.toBeUndefined()
  })

  it('assertCollectionAvailable is unlimited on team', async () => {
    enforce = 'true'
    workspaces[0].plan = 'team'
    collections = Array.from({ length: 500 }, (_, i) => ({ id: `c${i}`, workspace_id: 'ws1' }))
    const svc = await build()
    await expect(svc.assertCollectionAvailable('ws1')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/entitlements/entitlements.service.spec.ts`
Expected: FAIL — `Cannot find module './entitlements.service'`

- [ ] **Step 4: Write the service**

```ts
// apps/api/src/entitlements/entitlements.service.ts
import { Injectable, Logger, HttpStatus } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'
import { Repository, In } from 'typeorm'
import { Workspace, WorkspaceMember, Repo, Project, Collection } from '@driftless/db'
import { DomainException, ErrorCode, type ErrorCodeValue } from '../ops/error-codes'
import { PLANS, planIdOrFree, type FeatureKey, type PlanDef, type PlanId } from './plans.catalog'

// The entitlements engine. Resolves the effective plan for a workspace (catalog +
// per-workspace overrides) and answers can()/assert*(). This is the ONLY place that
// knows the pricing model; controllers/services just ask.
//
// ENFORCEMENT IS DECOUPLED FROM DEPLOY. The assert*() limits only BLOCK when
// ENTITLEMENTS_ENFORCE=true. Default OFF: shipping a paywall before Stripe (Task
// 11+) exists would strand active free users with no way to pay — so until the
// webhook is verified end-to-end, the asserts are no-ops that only LOG who they
// WOULD block. resolve()/can() always report the truth; only blocking is gated.
//
// Limits grandfather existing data even when enforcing: an assert blocks only when
// count >= limit, never touching rows already there.
@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name)

  constructor(
    @InjectRepository(Workspace) private readonly workspaceRepo: Repository<Workspace>,
    @InjectRepository(WorkspaceMember) private readonly memberRepo: Repository<WorkspaceMember>,
    @InjectRepository(Repo) private readonly repoRepo: Repository<Repo>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(Collection) private readonly collectionRepo: Repository<Collection>,
    private readonly config: ConfigService,
  ) {}

  // The effective PlanDef = PLANS[plan] merged with workspaces.settings.billing.overrides.
  // Overrides let an Enterprise/custom workspace raise a limit or flip a feature
  // without code. A missing/unknown plan resolves to 'free'.
  async resolve(workspaceId: string): Promise<{ plan: PlanId; def: PlanDef }> {
    const ws = await this.workspaceRepo.findOne({ where: { id: workspaceId } })
    const plan = planIdOrFree(ws?.plan)
    const base = PLANS[plan]
    const overrides = this.readOverrides(ws?.settings)
    const def: PlanDef = {
      seats: pick(overrides.seats, base.seats),
      workspaces: pick(overrides.workspaces, base.workspaces),
      repos: pick(overrides.repos, base.repos),
      projects: pick(overrides.projects, base.projects),
      collections: pick(overrides.collections, base.collections),
      features: { ...base.features, ...(overrides.features ?? {}) },
    }
    return { plan, def }
  }

  async can(workspaceId: string, feature: FeatureKey): Promise<boolean> {
    const { def } = await this.resolve(workspaceId)
    return def.features[feature] === true
  }

  async assertFeature(workspaceId: string, feature: FeatureKey): Promise<void> {
    const { plan, def } = await this.resolve(workspaceId)
    if (def.features[feature] !== true) {
      this.deny(ErrorCode.FEATURE_NOT_IN_PLAN, `'${feature}' is not available on the ${plan} plan. Upgrade to unlock it.`)
    }
  }

  async assertSeatAvailable(workspaceId: string): Promise<void> {
    const { plan, def } = await this.resolve(workspaceId)
    if (def.seats === null) return
    const used = await this.memberRepo.count({ where: { workspace_id: workspaceId } })
    if (used >= def.seats) {
      this.deny(ErrorCode.PLAN_LIMIT_EXCEEDED, `The ${plan} plan includes ${def.seats} seat${def.seats === 1 ? '' : 's'}. Upgrade to add more members.`)
    }
  }

  async assertRepoAvailable(workspaceId: string): Promise<void> {
    const { plan, def } = await this.resolve(workspaceId)
    if (def.repos === null) return
    const used = await this.repoRepo.count({ where: { workspace_id: workspaceId } })
    if (used >= def.repos) {
      this.deny(ErrorCode.PLAN_LIMIT_EXCEEDED, `The ${plan} plan includes ${def.repos} repo${def.repos === 1 ? '' : 's'}. Upgrade to connect more.`)
    }
  }

  async assertProjectAvailable(workspaceId: string): Promise<void> {
    const { plan, def } = await this.resolve(workspaceId)
    if (def.projects === null) return
    const used = await this.projectRepo.count({ where: { workspace_id: workspaceId } })
    if (used >= def.projects) {
      this.deny(ErrorCode.PLAN_LIMIT_EXCEEDED, `The ${plan} plan includes ${def.projects} project${def.projects === 1 ? '' : 's'}. Upgrade to create more.`)
    }
  }

  async assertCollectionAvailable(workspaceId: string): Promise<void> {
    const { plan, def } = await this.resolve(workspaceId)
    if (def.collections === null) return
    const used = await this.collectionRepo.count({ where: { workspace_id: workspaceId } })
    if (used >= def.collections) {
      this.deny(ErrorCode.PLAN_LIMIT_EXCEEDED, `The ${plan} plan includes ${def.collections} collection${def.collections === 1 ? '' : 's'}. Upgrade to create more.`)
    }
  }

  // The workspace-count limit is account-level (how many workspaces a person owns),
  // but plans live on the workspace. Heuristic: count the workspaces this user OWNS
  // and compare against the most generous limit among their owned plans.
  async assertWorkspaceAvailable(ownerClerkUserId: string): Promise<void> {
    const owned = await this.memberRepo.find({ where: { clerk_user_id: ownerClerkUserId, role: 'owner' } })
    if (owned.length === 0) return // first workspace is always allowed
    const workspaces = await this.workspaceRepo.find({ where: { id: In(owned.map((m) => m.workspace_id)) } })
    let limit: number | null = 0
    let bestPlan: PlanId = 'free'
    for (const ws of workspaces) {
      const plan = planIdOrFree(ws.plan)
      const wsLimit = this.readOverrides(ws.settings).workspaces ?? PLANS[plan].workspaces
      if (wsLimit === null) return // an unlimited plan among them → allow
      if (wsLimit > (limit ?? 0)) {
        limit = wsLimit
        bestPlan = plan
      }
    }
    if (limit !== null && owned.length >= limit) {
      this.deny(ErrorCode.PLAN_LIMIT_EXCEEDED, `The ${bestPlan} plan includes ${limit} workspace${limit === 1 ? '' : 's'}. Upgrade to create more.`)
    }
  }

  private enforcing(): boolean {
    return this.config.get<string>('ENTITLEMENTS_ENFORCE') === 'true'
  }

  private deny(code: ErrorCodeValue, message: string): void {
    if (this.enforcing()) {
      throw new DomainException(HttpStatus.PAYMENT_REQUIRED, code, message)
    }
    this.logger.log(`[entitlements] would block (${code}): ${message} — enforcement OFF`)
  }

  private readOverrides(settings: Record<string, unknown> | undefined | null): Partial<PlanDef> {
    const billing = (settings as any)?.billing
    const overrides = billing?.overrides
    return overrides && typeof overrides === 'object' ? (overrides as Partial<PlanDef>) : {}
  }
}

function pick<T>(override: T | null | undefined, base: T): T {
  return override === undefined ? base : (override as T)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/entitlements/entitlements.service.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/entitlements/entitlements.service.ts apps/api/src/entitlements/entitlements.service.spec.ts \
  apps/api/src/ops/error-codes.ts
git commit -m "feat(entitlements): EntitlementsService (resolve/can/assert*)"
```

---

### Task 3: FeatureGuard + decorator + module + setPlan endpoint

**Files:**
- Create: `apps/api/src/entitlements/require-feature.decorator.ts`
- Create: `apps/api/src/entitlements/feature.guard.ts`
- Create: `apps/api/src/entitlements/entitlements.module.ts`
- Modify: `apps/api/src/workspaces/workspaces.module.ts`
- Modify: `apps/api/src/workspaces/workspaces.service.ts`
- Modify: `apps/api/src/workspaces/workspaces.controller.ts`
- Test: `apps/api/src/workspaces/workspaces.service.spec.ts` (extend if it exists, else create)

**Interfaces:**
- Consumes: `EntitlementsService` (Task 2), `FeatureKey` (Task 1).
- Produces: `@RequiresFeature(key)` decorator + `FeatureGuard`, `EntitlementsModule` (exports `EntitlementsService`, `FeatureGuard`), `WorkspacesService.setPlan(workspaceId, plan, overrides?)`. Tasks 4-10 import `EntitlementsModule` into their own module and inject `EntitlementsService`.

- [ ] **Step 1: Decorator + guard (no test — these are declarative wiring, covered by Task 3's endpoint test and Tasks 9-10's feature-gate tests)**

```ts
// apps/api/src/entitlements/require-feature.decorator.ts
import { SetMetadata } from '@nestjs/common'
import type { FeatureKey } from './plans.catalog'

export const REQUIRES_FEATURE_KEY = 'requires_feature'

// Declare that a route needs a plan feature. Pair with @UseGuards(FeatureGuard).
// The route stays billing-agnostic — it states WHAT it needs, never WHICH plan
// grants it (that lives in plans.catalog.ts).
export const RequiresFeature = (feature: FeatureKey) => SetMetadata(REQUIRES_FEATURE_KEY, feature)
```

```ts
// apps/api/src/entitlements/feature.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { EntitlementsService } from './entitlements.service'
import { REQUIRES_FEATURE_KEY } from './require-feature.decorator'
import type { FeatureKey } from './plans.catalog'

// Local guard (use via @UseGuards(FeatureGuard), NOT as an APP_GUARD) so it always
// runs AFTER the global WorkspaceGuard has resolved request.workspaceId. A route
// with no @RequiresFeature is a no-op.
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<FeatureKey | undefined>(REQUIRES_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!feature) return true

    const request = context.switchToHttp().getRequest<Request>() as any
    const workspaceId: string | undefined = request.workspaceId
    if (!workspaceId) return true

    await this.entitlements.assertFeature(workspaceId, feature)
    return true
  }
}
```

```ts
// apps/api/src/entitlements/entitlements.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Workspace, WorkspaceMember, Repo, Project, Collection } from '@driftless/db'
import { EntitlementsService } from './entitlements.service'
import { FeatureGuard } from './feature.guard'

// The billing/access engine. Import this module anywhere a service needs to ask
// the plan (EntitlementsService) or a controller gates a feature (FeatureGuard).
@Module({
  imports: [TypeOrmModule.forFeature([Workspace, WorkspaceMember, Repo, Project, Collection])],
  providers: [EntitlementsService, FeatureGuard],
  exports: [EntitlementsService, FeatureGuard],
})
export class EntitlementsModule {}
```

- [ ] **Step 2: Write the failing test for setPlan**

Add to `apps/api/src/workspaces/workspaces.service.spec.ts` (create the file with this one test + minimal harness if it doesn't already exist — check first with `ls apps/api/src/workspaces/*.spec.ts`; if `workspaces.service.spec.ts` exists, add this `describe` block alongside the existing ones and reuse its repo mocks):

```ts
describe('setPlan', () => {
  it('rejects an invalid plan id', async () => {
    await expect(service.setPlan('ws1', 'bogus')).rejects.toThrow(/Invalid plan/)
  })

  it('sets workspaces.plan and merges overrides under settings.billing.overrides', async () => {
    const updated = await service.setPlan('ws1', 'team', { seats: 8 })
    expect(updated.plan).toBe('team')
    expect((updated.settings as any).billing.overrides).toEqual({ seats: 8 })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/workspaces/workspaces.service.spec.ts -t setPlan`
Expected: FAIL — `service.setPlan is not a function`

- [ ] **Step 4: Add setPlan to WorkspacesService**

In `apps/api/src/workspaces/workspaces.service.ts`, add after `findById`:

```ts
  // Set a workspace's billing tier and (optionally) custom entitlement overrides.
  // Called by the admin endpoint (Task 3) and the Stripe webhook (Task 13) — the
  // SAME seam. `overrides` is merged under settings.billing.overrides (a partial
  // PlanDef) without clobbering other settings — for Enterprise/custom deals and
  // Team's per-unit seat/workspace overage.
  async setPlan(workspaceId: string, plan: string, overrides?: Record<string, unknown>): Promise<Workspace> {
    if (!isPlanId(plan)) throw new BadRequestException(`Invalid plan '${plan}'`)
    await this.workspaceRepo.update(workspaceId, { plan } as any)
    if (overrides !== undefined) {
      const current = await this.findById(workspaceId)
      if (!current) throw new NotFoundException('Workspace not found')
      const settings = { ...(current.settings ?? {}) } as Record<string, unknown>
      settings['billing'] = { ...((settings['billing'] as object) ?? {}), overrides }
      await this.workspaceRepo.update(workspaceId, { settings } as any)
    }
    const updated = await this.findById(workspaceId)
    if (!updated) throw new NotFoundException('Workspace not found')
    return updated
  }
```

Add the import at the top: `import { isPlanId } from '../entitlements/plans.catalog'`. Confirm `BadRequestException`/`NotFoundException` are already imported (they are, per the existing file).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/workspaces/workspaces.service.spec.ts -t setPlan`
Expected: PASS (2 tests)

- [ ] **Step 6: Add the admin endpoint**

In `apps/api/src/workspaces/workspaces.controller.ts`, add after the existing `update` (`PATCH :slug`) method — inject `ConfigService` in the constructor if not already present:

```ts
  // Set the workspace's billing tier (and optional custom overrides). The MANUAL
  // seam the Stripe webhook (Task 13) replaces for self-serve upgrades — this stays
  // as the path for Enterprise deals and support overrides. Gated to a platform
  // super-admin (PLATFORM_ADMIN_USER_IDS), never a workspace owner: a customer must
  // not set their own plan to enterprise.
  @Patch(':slug/plan')
  async setPlan(
    @WorkspaceId() workspaceId: string,
    @Param('slug') _slug: string,
    @CurrentPrincipal() principal: Principal,
    @Body() body: { plan: string; overrides?: Record<string, unknown> },
  ) {
    this.assertPlatformAdmin(principal)
    if (!body?.plan) throw new BadRequestException('plan is required')
    return this.workspacesService.setPlan(workspaceId, body.plan, body.overrides)
  }

  private assertPlatformAdmin(principal: Principal): void {
    if (principal.kind !== 'user' || !principal.clerkUserId) {
      throw new ForbiddenException('Setting a plan requires a human identity')
    }
    const admins = (this.config.get<string>('PLATFORM_ADMIN_USER_IDS') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!admins.includes(principal.clerkUserId)) {
      throw new ForbiddenException('Only a platform admin can set a workspace plan')
    }
  }
```

Add `ConfigService` to the constructor (`private readonly config: ConfigService,`) and `import { ConfigService } from '@nestjs/config'`. Add `BadRequestException` to the existing `@nestjs/common` import if missing.

- [ ] **Step 7: Wire EntitlementsModule into WorkspacesModule**

In `apps/api/src/workspaces/workspaces.module.ts`, add the import and add `EntitlementsModule` to `imports` (keep every existing import/provider — this module still needs `OAuthModule`/`ApiKeyService` for the owner-resolution path, unlike the stale branch):

```ts
import { EntitlementsModule } from '../entitlements/entitlements.module'
```
```ts
    imports: [
      TypeOrmModule.forFeature([...]),
      TopicsModule,
      OAuthModule,
      EntitlementsModule,
    ],
```

- [ ] **Step 8: Run the full workspaces test file + build**

Run: `cd apps/api && npx vitest run src/workspaces/ && npx tsc --noEmit`
Expected: all PASS, no type errors

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/entitlements/require-feature.decorator.ts apps/api/src/entitlements/feature.guard.ts \
  apps/api/src/entitlements/entitlements.module.ts apps/api/src/workspaces/
git commit -m "feat(entitlements): FeatureGuard + setPlan admin seam, wired into WorkspacesModule"
```

---

### Task 4: Gate repo connection (Free = 1 repo)

**Files:**
- Modify: `apps/api/src/repos/repos.service.ts`
- Modify: `apps/api/src/repos/repos.service.spec.ts`

**Interfaces:**
- Consumes: `EntitlementsService.assertRepoAvailable(workspaceId)` (Task 2), already exported via `WorkspacesModule` which owns `ReposService`.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/repos/repos.service.spec.ts` (find its existing DI-mock setup for `ReposService` and add an `EntitlementsService` mock alongside):

```ts
it('create() calls entitlements.assertRepoAvailable before saving', async () => {
  const assertSpy = vi.fn().mockResolvedValue(undefined)
  // wire assertSpy into the EntitlementsService mock already in this file's providers
  await service.create({ workspace_id: 'ws1', github_org: 'acme', github_repo: 'widgets' })
  expect(assertSpy).toHaveBeenCalledWith('ws1')
})
```

(Match this file's existing mocking convention exactly — if it uses `Test.createTestingModule`, add `{ provide: EntitlementsService, useValue: { assertRepoAvailable: assertSpy } }` to the providers array used in this file's `beforeEach`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/repos/repos.service.spec.ts -t assertRepoAvailable`
Expected: FAIL — either a DI error (no `EntitlementsService` provider) or the spy never called

- [ ] **Step 3: Wire the gate**

In `apps/api/src/repos/repos.service.ts`, add the import and constructor param:

```ts
import { EntitlementsService } from '../entitlements/entitlements.service'
```

```ts
  constructor(
    @InjectRepository(Repo) private readonly repoRepository: Repository<Repo>,
    @InjectRepository(Integration) private readonly integrationRepository: Repository<Integration>,
    @InjectRepository(PendingInstallation) private readonly pendingRepository: Repository<PendingInstallation>,
    private readonly entitlements: EntitlementsService,
  ) {}
```

In `create()`, add as the first line of the method body:

```ts
    // Plan repo ceiling (Free = 1 repo — the PR-bot acquisition hook). Grandfathered:
    // existing repos stay; this only blocks connecting beyond the included count.
    await this.entitlements.assertRepoAvailable(data.workspace_id)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/repos/repos.service.spec.ts`
Expected: PASS (all tests, including the new one)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/repos/repos.service.ts apps/api/src/repos/repos.service.spec.ts
git commit -m "feat(entitlements): gate repo connection on the plan's repo ceiling"
```

---

### Task 5: Gate workspace creation (Pro = 3, Free = 1)

**Files:**
- Modify: `apps/api/src/workspaces/workspaces.controller.ts`
- Modify: `apps/api/src/workspaces/workspaces.controller.spec.ts` (or equivalent — check for an existing `workspaces.controller.spec.ts`; if none exists, add this test to `workspaces.service.spec.ts` targeting `create()` instead, since `create()` doesn't move)

**Interfaces:**
- Consumes: `EntitlementsService.assertWorkspaceAvailable(ownerClerkUserId)` (Task 2, already implemented — unused until now).

- [ ] **Step 1: Write the failing test**

```ts
it('POST /workspaces calls entitlements.assertWorkspaceAvailable(ownerClerkId) when a Clerk session is present', async () => {
  const assertSpy = vi.fn().mockResolvedValue(undefined)
  // inject { provide: EntitlementsService, useValue: { assertWorkspaceAvailable: assertSpy } }
  const req = { auth: () => ({ userId: 'user_123' }), headers: {} } as any
  await controller.create({ name: 'Acme', slug: 'acme' }, req)
  expect(assertSpy).toHaveBeenCalledWith('user_123')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/workspaces/ -t assertWorkspaceAvailable`
Expected: FAIL — spy not called

- [ ] **Step 3: Wire the gate**

In `apps/api/src/workspaces/workspaces.controller.ts`, inject `EntitlementsService` in the constructor and call it in `create()` before `this.workspacesService.create(...)`:

```ts
  async create(@Body() body: { name: string; slug: string }, @Req() req: Request) {
    const getAuth = (req as any).auth
    const auth = typeof getAuth === 'function' ? getAuth() : getAuth
    const ownerClerkId: string | null = auth?.userId ?? null
    if (ownerClerkId) await this.entitlements.assertWorkspaceAvailable(ownerClerkId)
    const ws = await this.workspacesService.create(body.name, body.slug, ownerClerkId)
    await this.audit.record({
      action: 'workspace.create',
      actor: ownerClerkId ?? 'anonymous',
      workspaceId: ws.id,
      target: ws.slug,
      detail: { name: ws.name },
    })
    return ws
  }
```

(Keep the rest of the existing `create()` body — the API-key/OAuth owner-resolution fallbacks already there — this only adds the `assertWorkspaceAvailable` call right after `ownerClerkId` is resolved from whichever source found it. Add `private readonly entitlements: EntitlementsService,` to the constructor and import it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/workspaces/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/workspaces/workspaces.controller.ts apps/api/src/workspaces/workspaces.controller.spec.ts
git commit -m "feat(entitlements): gate workspace creation on the owner's plan ceiling"
```

---

### Task 6: Gate seat invitations (Team = 5)

**Files:**
- Modify: `apps/api/src/invitations/invitations.service.ts`
- Modify: `apps/api/src/invitations/invitations.module.ts`
- Modify: `apps/api/src/invitations/invitations.service.spec.ts`

**Interfaces:**
- Consumes: `EntitlementsService.assertSeatAvailable(workspaceId)` (Task 2).

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/invitations/invitations.service.spec.ts`:

```ts
it('invite() calls entitlements.assertSeatAvailable before creating the invite', async () => {
  const assertSpy = vi.fn().mockResolvedValue(undefined)
  // wire into this file's existing providers array as EntitlementsService mock
  await service.invite('ws1', 'new@acme.com', 'member', 'inviter_1')
  expect(assertSpy).toHaveBeenCalledWith('ws1')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/invitations/invitations.service.spec.ts -t assertSeatAvailable`
Expected: FAIL

- [ ] **Step 3: Wire EntitlementsModule + the gate**

In `apps/api/src/invitations/invitations.module.ts`, add the import and add to `imports`:

```ts
import { EntitlementsModule } from '../entitlements/entitlements.module'
```
```ts
  imports: [TypeOrmModule.forFeature([Workspace, WorkspaceMember, WorkspaceInvitation]), EmailModule, EntitlementsModule],
```

In `apps/api/src/invitations/invitations.service.ts`, add `private readonly entitlements: EntitlementsService,` to the constructor (import it), and in `invite()`, add right after the `role` validation (before the `workspace` lookup):

```ts
    await this.entitlements.assertSeatAvailable(workspaceId)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/invitations/invitations.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/invitations/
git commit -m "feat(entitlements): gate seat invitations on the plan's seat ceiling"
```

---

### Task 7: Gate project creation (Free = 5, else unlimited)

**Files:**
- Modify: `apps/api/src/projects/projects.service.ts`
- Modify: `apps/api/src/projects/projects.module.ts`
- Modify: `apps/api/src/projects/projects.service.spec.ts`

**Interfaces:**
- Consumes: `EntitlementsService.assertProjectAvailable(workspaceId)` (Task 2).

- [ ] **Step 1: Write the failing test**

```ts
it('create() calls entitlements.assertProjectAvailable before saving', async () => {
  const assertSpy = vi.fn().mockResolvedValue(undefined)
  // wire into this file's existing providers array as EntitlementsService mock
  await service.create('ws1', { clerkUserId: 'user_1' } as any, { title: 'Q3 launch' } as any)
  expect(assertSpy).toHaveBeenCalledWith('ws1')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/projects/projects.service.spec.ts -t assertProjectAvailable`
Expected: FAIL

- [ ] **Step 3: Wire EntitlementsModule + the gate**

In `apps/api/src/projects/projects.module.ts`:

```ts
import { EntitlementsModule } from '../entitlements/entitlements.module'
```
```ts
  imports: [TypeOrmModule.forFeature([Project, Card, ProjectContextRef, ProjectNotification, Workspace]), TopicsModule, MembersModule, EntitlementsModule],
```

In `apps/api/src/projects/projects.service.ts`, add `private readonly entitlements: EntitlementsService,` to the constructor (import it), and in `create()`, add as the first line of the method body (before `resolveOwner`):

```ts
    await this.entitlements.assertProjectAvailable(workspaceId)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/projects/projects.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/projects/
git commit -m "feat(entitlements): gate project creation on the plan's project ceiling"
```

---

### Task 8: Gate collection creation (Free = 5, else unlimited)

**Files:**
- Modify: `apps/api/src/collections/collections.service.ts`
- Modify: `apps/api/src/collections/collections.module.ts`
- Modify: `apps/api/src/collections/collections.service.spec.ts`

**Interfaces:**
- Consumes: `EntitlementsService.assertCollectionAvailable(workspaceId)` (Task 2).

- [ ] **Step 1: Write the failing test**

```ts
it('create() calls entitlements.assertCollectionAvailable before saving', async () => {
  const assertSpy = vi.fn().mockResolvedValue(undefined)
  // wire into this file's existing providers array as EntitlementsService mock
  await service.create('ws1', { clerkUserId: 'user_1' } as any, { name: 'Hiring', archetype: 'pipeline' } as any)
  expect(assertSpy).toHaveBeenCalledWith('ws1')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/collections/collections.service.spec.ts -t assertCollectionAvailable`
Expected: FAIL

- [ ] **Step 3: Wire EntitlementsModule + the gate**

In `apps/api/src/collections/collections.module.ts`:

```ts
import { EntitlementsModule } from '../entitlements/entitlements.module'
```
```ts
  imports: [TypeOrmModule.forFeature([Collection, RecordEntity, EntityEntity, Topic]), MembersModule, EntitlementsModule],
```

In `apps/api/src/collections/collections.service.ts`, add `private readonly entitlements: EntitlementsService,` to the constructor (import it), and in `create()`, add as the first line of the method body:

```ts
    await this.entitlements.assertCollectionAvailable(workspaceId)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/collections/collections.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/collections/
git commit -m "feat(entitlements): gate collection creation on the plan's collection ceiling"
```

---

### Task 9: Gate byom_chat (Chat threads + Auditor/Architect)

**Files:**
- Modify: `apps/api/src/agent-runs/agent-config.service.ts`
- Modify: `apps/api/src/agent-runs/agent-runs.module.ts`
- Modify: `apps/api/src/agent-runs/agent-config.service.spec.ts`
- Modify: `apps/api/src/chat/chat.controller.ts`
- Modify: `apps/api/src/chat/chat.controller.spec.ts`

**Interfaces:**
- Consumes: `EntitlementsService.assertFeature(workspaceId, 'byom_chat')` (Task 2).

- [ ] **Step 1: Write the failing test — agent config**

Add to `apps/api/src/agent-runs/agent-config.service.spec.ts`:

```ts
it('update() gates enabling auditor/architect behind byom_chat', async () => {
  const assertSpy = vi.fn().mockResolvedValue(undefined)
  // wire into this file's existing providers array as EntitlementsService mock
  await service.update('ws1', { auditor: true })
  expect(assertSpy).toHaveBeenCalledWith('ws1', 'byom_chat')
})

it('update() does NOT gate turning auditor/architect OFF', async () => {
  const assertSpy = vi.fn().mockResolvedValue(undefined)
  await service.update('ws1', { auditor: false })
  expect(assertSpy).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/agent-runs/agent-config.service.spec.ts -t byom_chat`
Expected: FAIL

- [ ] **Step 3: Wire EntitlementsModule + the gate**

In `apps/api/src/agent-runs/agent-runs.module.ts`:

```ts
import { EntitlementsModule } from '../entitlements/entitlements.module'
```
```ts
  imports: [TypeOrmModule.forFeature([...]), TopicsModule, EventsModule, EntitlementsModule],
```

In `apps/api/src/agent-runs/agent-config.service.ts`, add `private readonly entitlements: EntitlementsService,` to the constructor (import it), and in `update()`, add right after the `ws` lookup (before building `next`):

```ts
    // byom_chat gates turning ON auditor/architect (they run through the same
    // model-gateway as Chat) — turning them OFF is never blocked.
    if (patch.auditor === true || patch.architect === true) {
      await this.entitlements.assertFeature(workspaceId, 'byom_chat')
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/agent-runs/agent-config.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test — chat**

Add to `apps/api/src/chat/chat.controller.spec.ts`:

```ts
it('createThread gates on byom_chat', async () => {
  const assertSpy = vi.fn().mockResolvedValue(undefined)
  // wire into this file's existing providers array as EntitlementsService mock
  await controller.createThread('ws1', { clerkUserId: 'user_1' } as any, {})
  expect(assertSpy).toHaveBeenCalledWith('ws1', 'byom_chat')
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/chat/chat.controller.spec.ts -t byom_chat`
Expected: FAIL

- [ ] **Step 7: Wire the gate in chat.controller.ts**

`ChatModule` already imports `AgentRunsModule`, but `EntitlementsService` isn't exported from there — add `EntitlementsModule` directly to `ChatModule`'s imports too:

```ts
import { EntitlementsModule } from '../entitlements/entitlements.module'
```
```ts
  imports: [TypeOrmModule.forFeature([ChatThread, ChatMessage]), AgentRunsModule, TopicsModule, ProjectsModule, CollectionsModule, BrokerModule, EntitlementsModule],
```

In `apps/api/src/chat/chat.controller.ts`, inject `EntitlementsService` in the constructor (import it), and in `createThread`, add right after `assertHasIdentity(principal)`:

```ts
    await this.entitlements.assertFeature(workspaceId, 'byom_chat')
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/chat/chat.controller.spec.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/agent-runs/ apps/api/src/chat/
git commit -m "feat(entitlements): gate byom_chat (Chat threads + Auditor/Architect enable)"
```

---

### Task 10: Gate broker (integrations — Team+)

**Files:**
- Modify: `apps/api/src/broker/broker.controller.ts`
- Modify: `apps/api/src/broker/broker.module.ts`
- Modify: `apps/api/src/broker/broker.controller.spec.ts` (or the closest existing broker controller test file)

**Interfaces:**
- Consumes: `EntitlementsService.assertFeature(workspaceId, 'broker')` (Task 2). Distinct from `assertBrokerEnabled` (env-level kill switch, `broker-feature.ts`) — both checks apply, in either order; this task adds the plan check alongside the existing env check.

- [ ] **Step 1: Write the failing test**

```ts
it('createGrant gates on the broker plan feature', async () => {
  const assertSpy = vi.fn().mockResolvedValue(undefined)
  // wire into this file's existing providers array as EntitlementsService mock
  await controller.createGrant({ clerkUserId: 'user_1' } as any, 'ws1', { provider: 'notion', effect: 'read' })
  expect(assertSpy).toHaveBeenCalledWith('ws1', 'broker')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/broker/ -t 'gates on the broker plan feature'`
Expected: FAIL

- [ ] **Step 3: Wire EntitlementsModule + the gate**

In `apps/api/src/broker/broker.module.ts`:

```ts
import { EntitlementsModule } from '../entitlements/entitlements.module'
```
```ts
  imports: [TypeOrmModule.forFeature([BrokerEvent, ConnectorDocument, Topic]), IntegrationsModule, CollectionsModule, EntitlementsModule],
```

In `apps/api/src/broker/broker.controller.ts`, inject `EntitlementsService` in the constructor (import it), and in `createGrant`, add right after `assertBrokerEnabled(this.config)`:

```ts
    await this.entitlements.assertFeature(workspaceId, 'broker')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/broker/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/broker/
git commit -m "feat(entitlements): gate broker grants on the plan's broker feature (Team+)"
```

---

### Task 11: Stripe SDK, config, and product/price seed script

**Files:**
- Modify: `apps/api/package.json` (add `stripe` dependency)
- Create: `apps/api/src/billing/stripe-client.ts`
- Create: `apps/api/scripts/stripe-seed-products.ts`

**Interfaces:**
- Produces: `getStripeClient(config: ConfigService): Stripe` — Tasks 12-13 use this. `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_TEAM_BASE_MONTHLY`, `STRIPE_PRICE_TEAM_SEAT_EXTRA`, `STRIPE_PRICE_TEAM_WORKSPACE_EXTRA` env vars (populated by the seed script's output) — Task 12 reads these.

- [ ] **Step 1: Add the dependency**

Run: `cd apps/api && npm install stripe`
Expected: `stripe` added to `apps/api/package.json` dependencies

- [ ] **Step 2: Stripe client factory**

```ts
// apps/api/src/billing/stripe-client.ts
import Stripe from 'stripe'
import type { ConfigService } from '@nestjs/config'

// ONE Stripe client, built from STRIPE_SECRET_KEY. Every billing/webhook service
// gets it through this factory — never `new Stripe(...)` inline, so there is one
// place that pins the API version.
export function getStripeClient(config: Pick<ConfigService, 'get'>): Stripe {
  const key = config.get<string>('STRIPE_SECRET_KEY')
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key, { apiVersion: '2025-01-27.acacia' })
}
```

- [ ] **Step 3: Seed script (idempotent — safe to re-run)**

```ts
// apps/api/scripts/stripe-seed-products.ts
// Creates (or finds, if already created) the Stripe Products/Prices this pricing
// model needs, and prints the price IDs to paste into env (STRIPE_PRICE_*). Run
// once per Stripe account (test mode, then live mode before launch):
//   cd apps/api && npx tsx scripts/stripe-seed-products.ts
import Stripe from 'stripe'

const key = process.env['STRIPE_SECRET_KEY']
if (!key) {
  console.error('Set STRIPE_SECRET_KEY before running this script')
  process.exit(1)
}
const stripe = new Stripe(key, { apiVersion: '2025-01-27.acacia' })

async function findOrCreatePrice(
  lookupKey: string,
  productName: string,
  unitAmountCents: number,
): Promise<string> {
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 })
  if (existing.data[0]) return existing.data[0].id

  const product = await stripe.products.create({ name: productName })
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: unitAmountCents,
    recurring: { interval: 'month' },
    lookup_key: lookupKey,
  })
  return price.id
}

async function main() {
  const proMonthly = await findOrCreatePrice('pro_monthly', 'Driftless Pro', 900)
  const teamBaseMonthly = await findOrCreatePrice('team_base_monthly', 'Driftless Team (5 seats)', 4900)
  const teamSeatExtra = await findOrCreatePrice('team_seat_extra', 'Driftless Team — extra seat', 1500)
  const teamWorkspaceExtra = await findOrCreatePrice('team_workspace_extra', 'Driftless Team — extra workspace', 1500)

  console.log('Paste these into apps/api env:')
  console.log(`STRIPE_PRICE_PRO_MONTHLY=${proMonthly}`)
  console.log(`STRIPE_PRICE_TEAM_BASE_MONTHLY=${teamBaseMonthly}`)
  console.log(`STRIPE_PRICE_TEAM_SEAT_EXTRA=${teamSeatExtra}`)
  console.log(`STRIPE_PRICE_TEAM_WORKSPACE_EXTRA=${teamWorkspaceExtra}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 4: Run the build to confirm no type errors**

Run: `cd apps/api && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json apps/api/src/billing/stripe-client.ts apps/api/scripts/stripe-seed-products.ts
git commit -m "feat(billing): add stripe SDK, client factory, and product/price seed script"
```

**Manual step (not code — do after this task, before Task 12):** run the seed script against Stripe **test mode** first (`STRIPE_SECRET_KEY=sk_test_...`), verify the 4 prices appear in the Stripe dashboard, and set the 4 `STRIPE_PRICE_*` env vars in the API's env for local/staging testing. Re-run in **live mode** only once Task 13's webhook is verified end-to-end in staging.

---

### Task 12: Checkout session endpoint

**Files:**
- Create: `apps/api/src/billing/billing.module.ts`
- Create: `apps/api/src/billing/billing.controller.ts`
- Create: `apps/api/src/billing/billing.service.ts`
- Create: `apps/api/src/billing/billing.service.spec.ts`
- Modify: `apps/api/src/app.module.ts` (register `BillingModule`)

**Interfaces:**
- Consumes: `getStripeClient` (Task 11), `WorkspacesService.findById` (existing).
- Produces: `BillingService.createCheckoutSession(workspaceId, tier: 'pro' | 'team', extraSeats?: number, extraWorkspaces?: number): Promise<{ url: string }>`. Task 15 (dashboard) calls `POST /billing/checkout-session`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/billing/billing.service.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { BillingService } from './billing.service'

function fakeConfig(values: Record<string, string>) {
  return { get: (k: string) => values[k] }
}

describe('BillingService.createCheckoutSession', () => {
  it('builds a subscription Checkout Session with the tier base price + overage line items', async () => {
    const sessionsCreate = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/session_abc' })
    const stripeStub = { checkout: { sessions: { create: sessionsCreate } } } as any
    const config = fakeConfig({
      STRIPE_PRICE_TEAM_BASE_MONTHLY: 'price_team_base',
      STRIPE_PRICE_TEAM_SEAT_EXTRA: 'price_team_seat',
      STRIPE_PRICE_TEAM_WORKSPACE_EXTRA: 'price_team_ws',
      APP_URL: 'https://app.driftless.icu',
    })
    const workspacesService = { findById: vi.fn().mockResolvedValue({ id: 'ws1', slug: 'acme' }) }
    const svc = new BillingService(config as any, workspacesService as any)
    ;(svc as any).stripe = stripeStub // override the real client built in the constructor

    const result = await svc.createCheckoutSession('ws1', 'team', 2, 1)

    expect(result).toEqual({ url: 'https://checkout.stripe.com/session_abc' })
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        client_reference_id: 'ws1',
        line_items: [
          { price: 'price_team_base', quantity: 1 },
          { price: 'price_team_seat', quantity: 2 },
          { price: 'price_team_ws', quantity: 1 },
        ],
        success_url: expect.stringContaining('acme'),
      }),
    )
  })

  it('pro tier has no overage line items', async () => {
    const sessionsCreate = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/session_xyz' })
    const stripeStub = { checkout: { sessions: { create: sessionsCreate } } } as any
    const config = fakeConfig({ STRIPE_PRICE_PRO_MONTHLY: 'price_pro', APP_URL: 'https://app.driftless.icu' })
    const workspacesService = { findById: vi.fn().mockResolvedValue({ id: 'ws1', slug: 'acme' }) }
    const svc = new BillingService(config as any, workspacesService as any)
    ;(svc as any).stripe = stripeStub

    await svc.createCheckoutSession('ws1', 'pro')

    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ line_items: [{ price: 'price_pro', quantity: 1 }] }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/billing/billing.service.spec.ts`
Expected: FAIL — `Cannot find module './billing.service'`

- [ ] **Step 3: Write the service**

```ts
// apps/api/src/billing/billing.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type Stripe from 'stripe'
import { getStripeClient } from './stripe-client'
import { WorkspacesService } from '../workspaces/workspaces.service'

export type CheckoutTier = 'pro' | 'team'

// Self-serve Checkout for Pro and Team ONLY — Enterprise stays a manual deal via
// the admin setPlan endpoint (apps/api/src/workspaces/workspaces.controller.ts).
@Injectable()
export class BillingService {
  private readonly stripe: Stripe

  constructor(
    private readonly config: ConfigService,
    private readonly workspacesService: WorkspacesService,
  ) {
    this.stripe = getStripeClient(config)
  }

  async createCheckoutSession(
    workspaceId: string,
    tier: CheckoutTier,
    extraSeats = 0,
    extraWorkspaces = 0,
  ): Promise<{ url: string }> {
    const ws = await this.workspacesService.findById(workspaceId)
    if (!ws) throw new NotFoundException('Workspace not found')

    const lineItems: Array<{ price: string; quantity: number }> =
      tier === 'pro'
        ? [{ price: this.priceId('STRIPE_PRICE_PRO_MONTHLY'), quantity: 1 }]
        : [
            { price: this.priceId('STRIPE_PRICE_TEAM_BASE_MONTHLY'), quantity: 1 },
            ...(extraSeats > 0 ? [{ price: this.priceId('STRIPE_PRICE_TEAM_SEAT_EXTRA'), quantity: extraSeats }] : []),
            ...(extraWorkspaces > 0
              ? [{ price: this.priceId('STRIPE_PRICE_TEAM_WORKSPACE_EXTRA'), quantity: extraWorkspaces }]
              : []),
          ]

    const appUrl = this.config.get<string>('APP_URL') ?? 'https://app.driftless.icu'
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: workspaceId,
      line_items: lineItems,
      success_url: `${appUrl}/w/${ws.slug}/settings?upgraded=1`,
      cancel_url: `${appUrl}/w/${ws.slug}/settings`,
      metadata: { workspace_id: workspaceId, tier },
    })
    if (!session.url) throw new Error('Stripe did not return a Checkout URL')
    return { url: session.url }
  }

  private priceId(envKey: string): string {
    const id = this.config.get<string>(envKey)
    if (!id) throw new Error(`${envKey} is not configured`)
    return id
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/billing/billing.service.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Controller + module**

```ts
// apps/api/src/billing/billing.controller.ts
import { Controller, Post, Body, BadRequestException } from '@nestjs/common'
import { WorkspaceId } from '../auth/workspace-id.decorator'
import { BillingService, type CheckoutTier } from './billing.service'

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('checkout-session')
  async createCheckoutSession(
    @WorkspaceId() workspaceId: string,
    @Body() body: { tier: CheckoutTier; extra_seats?: number; extra_workspaces?: number },
  ) {
    if (body.tier !== 'pro' && body.tier !== 'team') {
      throw new BadRequestException("tier must be 'pro' or 'team'")
    }
    return this.billing.createCheckoutSession(workspaceId, body.tier, body.extra_seats ?? 0, body.extra_workspaces ?? 0)
  }
}
```

```ts
// apps/api/src/billing/billing.module.ts
import { Module } from '@nestjs/common'
import { BillingService } from './billing.service'
import { BillingController } from './billing.controller'
import { WorkspacesModule } from '../workspaces/workspaces.module'

@Module({
  imports: [WorkspacesModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
```

Register in `apps/api/src/app.module.ts`: add `import { BillingModule } from './billing/billing.module'` and add `BillingModule` to the root module's `imports` array (find the array holding `WorkspacesModule`, `ProjectsModule`, etc. and append it there).

- [ ] **Step 6: Run the API build**

Run: `cd apps/api && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/billing/billing.controller.ts apps/api/src/billing/billing.module.ts apps/api/src/app.module.ts
git commit -m "feat(billing): POST /billing/checkout-session (Pro + Team self-serve)"
```

---

### Task 13: Stripe webhook — checkout completed / subscription updated/deleted

**Files:**
- Create: `apps/api/src/billing/billing-webhook.controller.ts`
- Create: `apps/api/src/billing/billing-webhook.service.ts`
- Create: `apps/api/src/billing/billing-webhook.service.spec.ts`
- Modify: `apps/api/src/billing/billing.module.ts` (add the new controller/service)
- Modify: `apps/api/src/main.ts` (raw-body parsing for `/webhooks/stripe`, since Stripe signature verification needs the raw payload — check how `apps/api/src/main.ts` sets up the body parser today; NestJS's default `express.json()` consumes the body before the controller sees it, so this route needs `rawBody: true` on the Nest factory or a route-specific raw parser)

**Interfaces:**
- Consumes: `getStripeClient` (Task 11), `WorkspacesService.setPlan` (Task 3).
- Produces: `POST /webhooks/stripe` — separate from `apps/api/src/webhooks` (GitHub-specific).

- [ ] **Step 1: Write the failing test — event mapping**

```ts
// apps/api/src/billing/billing-webhook.service.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { BillingWebhookService } from './billing-webhook.service'

describe('BillingWebhookService.handleEvent', () => {
  it('checkout.session.completed with tier=pro sets plan=pro', async () => {
    const setPlan = vi.fn().mockResolvedValue({})
    const svc = new BillingWebhookService({ setPlan } as any)
    await svc.handleEvent({
      type: 'checkout.session.completed',
      data: { object: { client_reference_id: 'ws1', metadata: { tier: 'pro' } } },
    } as any)
    expect(setPlan).toHaveBeenCalledWith('ws1', 'pro', undefined)
  })

  it('checkout.session.completed with tier=team and line item quantities sets plan=team with overrides', async () => {
    const setPlan = vi.fn().mockResolvedValue({})
    const svc = new BillingWebhookService({ setPlan } as any)
    await svc.handleEvent({
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: 'ws1',
          metadata: { tier: 'team' },
          line_items: undefined, // Checkout Session webhook payload doesn't include line_items by default
        },
      },
    } as any)
    expect(setPlan).toHaveBeenCalledWith('ws1', 'team', undefined)
  })

  it('customer.subscription.deleted downgrades the workspace to free', async () => {
    const setPlan = vi.fn().mockResolvedValue({})
    const svc = new BillingWebhookService({ setPlan } as any)
    await svc.handleEvent({
      type: 'customer.subscription.deleted',
      data: { object: { metadata: { workspace_id: 'ws1' } } },
    } as any)
    expect(setPlan).toHaveBeenCalledWith('ws1', 'free', undefined)
  })

  it('ignores event types it does not handle', async () => {
    const setPlan = vi.fn()
    const svc = new BillingWebhookService({ setPlan } as any)
    await svc.handleEvent({ type: 'invoice.paid', data: { object: {} } } as any)
    expect(setPlan).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/billing/billing-webhook.service.spec.ts`
Expected: FAIL — `Cannot find module './billing-webhook.service'`

- [ ] **Step 3: Write the service**

```ts
// apps/api/src/billing/billing-webhook.service.ts
import { Injectable, Logger } from '@nestjs/common'
import type Stripe from 'stripe'
import { WorkspacesService } from '../workspaces/workspaces.service'

// Maps Stripe events to WorkspacesService.setPlan — the SAME seam the manual admin
// endpoint uses (apps/api/src/workspaces/workspaces.controller.ts). Called
// service-to-service (never through the HTTP /workspaces/:slug/plan route, which
// requires a human PLATFORM_ADMIN_USER_IDS principal — Stripe isn't one).
@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name)

  constructor(private readonly workspacesService: WorkspacesService) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const workspaceId = session.client_reference_id
        const tier = session.metadata?.['tier']
        if (!workspaceId || (tier !== 'pro' && tier !== 'team')) {
          this.logger.warn(`checkout.session.completed missing workspace_id/tier: ${session.id}`)
          return
        }
        await this.workspacesService.setPlan(workspaceId, tier, undefined)
        return
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const workspaceId = sub.metadata?.['workspace_id']
        if (!workspaceId) return
        // Active/trialing keep the current plan as-is; a past_due/unpaid state is
        // left to Stripe's own dunning/retry — this webhook only reacts to the
        // terminal deleted event by downgrading (below).
        return
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const workspaceId = sub.metadata?.['workspace_id']
        if (!workspaceId) return
        await this.workspacesService.setPlan(workspaceId, 'free', undefined)
        return
      }
      default:
        return
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/billing/billing-webhook.service.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Controller with signature verification**

```ts
// apps/api/src/billing/billing-webhook.controller.ts
import { Controller, Post, Req, Headers, BadRequestException, HttpCode } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import { getStripeClient } from './stripe-client'
import { BillingWebhookService } from './billing-webhook.service'
import { Public } from '../auth/public.decorator'

// Separate from apps/api/src/webhooks (GitHub-specific) — different signature
// scheme (STRIPE_WEBHOOK_SECRET, not a GitHub HMAC) and a different public
// ingress. @Public: Stripe carries no session/API key, only its own signature.
@Controller('webhooks/stripe')
export class BillingWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly webhookService: BillingWebhookService,
  ) {}

  @Public()
  @HttpCode(200)
  @Post()
  async handle(@Req() req: Request, @Headers('stripe-signature') signature: string) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')
    if (!secret) throw new BadRequestException('Stripe webhook not configured')
    const stripe = getStripeClient(this.config)

    let event
    try {
      // req.body must be the RAW buffer here (see main.ts step below) — Stripe's
      // signature check fails on an already-JSON-parsed body.
      event = stripe.webhooks.constructEvent((req as any).rawBody, signature, secret)
    } catch (err) {
      throw new BadRequestException(`Invalid Stripe signature: ${(err as Error).message}`)
    }

    await this.webhookService.handleEvent(event)
    return { received: true }
  }
}
```

- [ ] **Step 6: Enable raw body for this route**

In `apps/api/src/main.ts`, find `NestFactory.create(...)` and add `{ rawBody: true }` to its options if not already present:

```ts
const app = await NestFactory.create(AppModule, { rawBody: true })
```

This makes `req.rawBody` available on every request (Nest's built-in support) without disabling JSON parsing for other routes — no custom body-parser needed.

- [ ] **Step 7: Register in BillingModule**

In `apps/api/src/billing/billing.module.ts`, add `BillingWebhookController` to `controllers` and `BillingWebhookService` to `providers`:

```ts
@Module({
  imports: [WorkspacesModule],
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService, BillingWebhookService],
  exports: [BillingService],
})
export class BillingModule {}
```

- [ ] **Step 8: Run the API build**

Run: `cd apps/api && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/billing/ apps/api/src/main.ts
git commit -m "feat(billing): Stripe webhook — checkout completed / subscription deleted → setPlan"
```

**Manual verification (do before Task 17 flips ENTITLEMENTS_ENFORCE, and before this plan is considered fully done):** in Stripe test mode, run a real Checkout against staging, confirm the webhook fires (`stripe listen --forward-to` or the Stripe dashboard's webhook log), and confirm `workspaces.plan` actually updates in the staging DB.

---

### Task 14: Customer Portal (self-serve upgrade/downgrade/cancel)

**Files:**
- Modify: `apps/api/src/billing/billing.service.ts`
- Modify: `apps/api/src/billing/billing.service.spec.ts`
- Modify: `apps/api/src/billing/billing.controller.ts`

**Interfaces:**
- Produces: `BillingService.createPortalSession(workspaceId): Promise<{ url: string }>`, `POST /billing/portal-session`.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/billing/billing.service.spec.ts`:

```ts
it('createPortalSession creates a Billing Portal session for the workspace stripe customer', async () => {
  const portalCreate = vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/session_abc' })
  const stripeStub = { billingPortal: { sessions: { create: portalCreate } } } as any
  const config = fakeConfig({ APP_URL: 'https://app.driftless.icu' })
  const workspacesService = { findById: vi.fn().mockResolvedValue({ id: 'ws1', slug: 'acme', settings: { billing: { stripe_customer_id: 'cus_123' } } }) }
  const svc = new BillingService(config as any, workspacesService as any)
  ;(svc as any).stripe = stripeStub

  const result = await svc.createPortalSession('ws1')

  expect(result).toEqual({ url: 'https://billing.stripe.com/session_abc' })
  expect(portalCreate).toHaveBeenCalledWith({
    customer: 'cus_123',
    return_url: 'https://app.driftless.icu/w/acme/settings',
  })
})

it('createPortalSession throws when the workspace has no stripe_customer_id yet', async () => {
  const config = fakeConfig({ APP_URL: 'https://app.driftless.icu' })
  const workspacesService = { findById: vi.fn().mockResolvedValue({ id: 'ws1', slug: 'acme', settings: {} }) }
  const svc = new BillingService(config as any, workspacesService as any)
  await expect(svc.createPortalSession('ws1')).rejects.toThrow(/no Stripe customer/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/billing/billing.service.spec.ts -t Portal`
Expected: FAIL — `createPortalSession is not a function`

- [ ] **Step 3: Implement (and persist the customer id on first checkout)**

In `billing.service.ts`'s `createCheckoutSession`, Stripe creates the Customer implicitly on Checkout completion — to have a `stripe_customer_id` for the Portal, read it back in the webhook instead. Add this to `createPortalSession`:

```ts
  async createPortalSession(workspaceId: string): Promise<{ url: string }> {
    const ws = await this.workspacesService.findById(workspaceId)
    if (!ws) throw new NotFoundException('Workspace not found')
    const customerId = (ws.settings as any)?.billing?.stripe_customer_id
    if (!customerId) throw new Error('This workspace has no Stripe customer yet — upgrade first')

    const appUrl = this.config.get<string>('APP_URL') ?? 'https://app.driftless.icu'
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/w/${ws.slug}/settings`,
    })
    return { url: session.url }
  }
```

Then in `apps/api/src/billing/billing-webhook.service.ts`, persist the customer id on `checkout.session.completed` — replace the `await this.workspacesService.setPlan(workspaceId, tier, undefined)` line with:

```ts
        await this.workspacesService.setPlan(workspaceId, tier, undefined)
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        if (customerId) {
          const ws = await this.workspacesService.findById(workspaceId)
          const settings = { ...(ws?.settings ?? {}) } as Record<string, unknown>
          settings['billing'] = { ...((settings['billing'] as object) ?? {}), stripe_customer_id: customerId }
          await this.workspacesService.update(workspaceId, { settings })
        }
```

(This duplicates a small merge that `setPlan` already does for `overrides` — acceptable here since the two writes target different sub-keys of the same `billing` object and happen sequentially, not concurrently.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/billing/`
Expected: PASS (all billing tests)

- [ ] **Step 5: Controller endpoint**

In `apps/api/src/billing/billing.controller.ts`, add:

```ts
  @Post('portal-session')
  async createPortalSession(@WorkspaceId() workspaceId: string) {
    return this.billing.createPortalSession(workspaceId)
  }
```

- [ ] **Step 6: Run the API build**

Run: `cd apps/api && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/billing/
git commit -m "feat(billing): Stripe Customer Portal — self-serve upgrade/downgrade/cancel"
```

---

### Task 15: Dashboard — Upgrade / Manage billing button

**Files:**
- Modify: `apps/dashboard/src/redesign/Settings.tsx`

**Interfaces:**
- Consumes: `api.post` (existing, `apps/dashboard/src/api.ts`), `POST /billing/checkout-session` and `POST /billing/portal-session` (Task 12/14).

- [ ] **Step 1: Add a `'billing'` section**

In `apps/dashboard/src/redesign/Settings.tsx`:
- Add `'billing'` to the `Section` union type.
- Add `billing: 'Billing'` to `SET_LABEL`.
- Add `'billing'` to the `{ items: ['workspace', 'members'] }` group in `SET_GROUPS` (or its own group — match whichever grouping reads better next to `workspace`).

- [ ] **Step 2: Render the section**

Find where other sections render their panel content (look for the existing `section === 'workspace'` conditional block) and add a sibling block:

```tsx
{section === 'billing' && (
  <SettingsSection title="Billing">
    <SettingsCard>
      <p style={{ marginBottom: 12 }}>
        Manage your plan, seats, and payment method.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          onClick={async () => {
            const { url } = await api.post<{ url: string }>('/billing/checkout-session', { tier: 'pro' })
            window.location.href = url
          }}
        >
          Upgrade to Pro ($9/mo)
        </Button>
        <Button
          onClick={async () => {
            const { url } = await api.post<{ url: string }>('/billing/checkout-session', { tier: 'team' })
            window.location.href = url
          }}
        >
          Upgrade to Team ($49/mo)
        </Button>
        <Button
          onClick={async () => {
            const { url } = await api.post<{ url: string }>('/billing/portal-session', {})
            window.location.href = url
          }}
        >
          Manage billing
        </Button>
      </div>
    </SettingsCard>
  </SettingsSection>
)}
```

(Match the exact prop names `SettingsSection`/`SettingsCard`/`Button` already take elsewhere in this file — copy the pattern from the nearest existing section rather than inventing new props.)

- [ ] **Step 3: Manual verification**

Run: `cd apps/dashboard && npm run dev`, open Settings → Billing, click "Upgrade to Pro" with `STRIPE_SECRET_KEY` pointed at Stripe test mode — confirm it redirects to a real Stripe Checkout page for the $9 price.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/redesign/Settings.tsx
git commit -m "feat(dashboard): Billing settings section — upgrade + manage billing"
```

---

### Task 16: Rewrite landing pricing-section.tsx

**Files:**
- Modify: `apps/web/src/components/landing/pricing-section.tsx`

**Interfaces:** none (presentation only).

- [ ] **Step 1: Replace the `tiers` array**

```tsx
const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "",
    bestFor: "For trying Driftless",
    line: "Everything you need to get going.",
    features: [
      "1 workspace, 1 repo",
      "Up to 5 projects, 5 collections",
      "Your team's knowledge, always current, unlimited",
      "Works inside your AI tools",
      "Connect your GitHub",
    ],
    cta: "Start free",
    href: SIGN_UP_URL,
    target: "signup",
    featured: false,
  },
  {
    name: "Pro",
    price: "$9",
    cadence: "/mo",
    bestFor: "For solo builders",
    line: "More space, your own models.",
    features: [
      "Everything in Free",
      "3 workspaces",
      "Unlimited projects & collections",
      "Chat + agents on your own model (BYOM)",
    ],
    cta: "Start free",
    href: SIGN_UP_URL,
    target: "signup",
    featured: false,
  },
  {
    name: "Team",
    price: "$49",
    cadence: "/mo for 5 seats",
    bestFor: "+$15/seat, +$15/workspace beyond that",
    line: "One shared workspace, governed.",
    features: [
      "Everything in Pro",
      "5 seats included (add more anytime)",
      "Members, roles & approvals",
      "Integrations: Notion, Google Drive, and more",
    ],
    cta: "Start free",
    href: SIGN_UP_URL,
    target: "signup",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    bestFor: "Org as system of record",
    line: "Your systems of record, governed.",
    features: [
      "Everything in Team",
      "Unlimited seats & workspaces",
      "SSO & audit log",
      "Custom integrations, dedicated support",
    ],
    cta: "Talk to sales",
    href: CALENDLY_URL,
    target: "demo",
    featured: false,
  },
]
```

Keep the rest of the component (the `<section>` JSX, the grid, the card rendering) untouched — only the data array changes, and the grid is already `md:grid-cols-2 lg:grid-cols-4`, which fits 4 tiers without layout changes.

- [ ] **Step 2: Manual verification**

Run: `cd apps/web && npm run dev`, open the landing page, confirm all 4 tiers render with correct copy and the "Most popular" badge now sits on Team (already driven by `featured: true`, moved from Builder to Team in the array above).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/pricing-section.tsx
git commit -m "feat(landing): update pricing section to the real Free/Pro/Team/Enterprise model"
```

---

## Self-Review Notes

- **Spec coverage:** all 3 brainstorming blocks covered — tiers/catalog (Tasks 1-2), gating call-sites for every axis discussed (seats T6, workspaces T5, repos T4, projects T7, collections T8, byom_chat T9, broker T10), Stripe (Tasks 11-14), landing copy (Task 16), dashboard upgrade UI (Task 15).
- **Branch decision resolved:** Task 1's Global Constraints explicitly rules out merging `feat/entitlements-engine` — it predates Projects/Collections/Comments/Broker/Chat and its diffs would delete them from `data-source.ts`. Tasks 1-3 re-derive the same `EntitlementsService`/`FeatureGuard` pattern fresh against current `staging`, extended with `projects`/`collections`/`byom_chat`/`broker`.
- **Enforcement flag:** left OFF through every task (per Global Constraints); flipping `ENTITLEMENTS_ENFORCE=true` is called out as a deliberate post-Task-13 step, not part of any task's commit.
- **Type consistency:** `EntitlementsService` method names (`assertRepoAvailable`, `assertProjectAvailable`, `assertCollectionAvailable`, `assertSeatAvailable`, `assertWorkspaceAvailable`, `assertFeature`, `can`, `resolve`) are identical between Task 2's definition and every call site in Tasks 4-10. `FeatureKey` is `'byom_chat' | 'broker'` consistently from Task 1 through Task 10.
