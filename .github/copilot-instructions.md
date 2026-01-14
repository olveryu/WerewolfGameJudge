## WerewolfGameJudge Copilot Instructions (short)

### 0) Non-negotiables (read first)

- **Host is the ONLY authority for game logic.** Supabase is transport/discovery/identity only.
- **Night-1-only scope.** Do NOT add cross-night state/rules.
- **Anti-cheat.** Sensitive info goes via toUid private messages; keep `BroadcastGameState` as room-public view-model only.
- **Single source of truth.** No parallel ordering maps/arrays/dual-write drift.

If something is unclear, ask before coding. Don’t invent repo facts.

---

## Architecture boundaries

### Host vs Supabase

- Host controls: night flow, validation, resolver execution, death calculation, audio sequencing.
- Supabase controls: room lifecycle (4-digit code), presence, auth metadata, realtime transport.
- Supabase must NOT store/validate any game state, actions, votes, results.

### Code ownership boundaries

- `src/models/roles/**`: declarative only (spec/schema/types). No services, no side effects.
- `src/services/night/resolvers/**`: host-only pure resolution + validation.
- `src/screens/RoomScreen/components/**`: UI-only, no service imports.

---

## Night flow & NightPlan (host authority)

### NightFlowController invariants

- `NightFlowController` is the single source of truth for night progression.
- When `isHost === true` and `state.status === ongoing`, `nightFlow` MUST be non-null (fail-fast if violated).
- Do NOT advance indices manually (`++` fallback is banned).
- Phase mismatch events are idempotent no-ops (debug only).

### Table-driven NightPlan single-source-of-truth

- Night-1 progression MUST come from a single table-driven plan.
- **Authoritative table (Night-1):** `NIGHT_STEPS` in `src/models/roles/spec/nightSteps.ts`.
   - Array order is the authority order.
   - Step id MUST be a stable `SchemaId`.
   - Do NOT reintroduce `night1.order` or any parallel `ACTION_ORDER`.
- Plan builder MUST fail-fast on invalid `roleId` / `schemaId`.
- Do NOT use UI copy as logic keys; tests must assert stable identifiers.

### Audio sequencing single source of truth

- Night-1 `audioKey` / optional `audioEndKey` MUST come from `NIGHT_STEPS`.
- Do NOT dual-write audio keys across specs/steps. If a temporary compat is needed: `@deprecated` + removal date + contract test enforcing equality.

### StepSpec id/schemaId de-dupe (migration rule)

- If `StepSpec` has both `id` and `schemaId`, it’s migration-only.
   - `schemaId` must be `@deprecated` + `TODO(remove by YYYY-MM-DD)`.
   - Keep a contract test enforcing `step.id === step.schemaId`.
- End-state: only `id: SchemaId`.

---

## Constraints, validation, and Night-1-only red lines

### Schema-first constraints

- Input legality belongs in `SCHEMAS[*].constraints` (schema-first).
- Host resolvers MUST align with schema constraints.
   - If schema says `notSelf`, resolver must reject self-target.
   - If schema allows self-target, resolver must not reject it unless documented + tested.

### Night-1-only bans

- Ban cross-night memory: no `previousActions`, `lastNightTarget`, “连续两晚/第二晚开始” constraints, etc.
- Resolver contexts/types must not carry cross-night fields.

### Neutral judge rule (wolves)

- Wolf kill is neutral in this app: can target ANY seat (including self/wolf teammates).
- Don’t add `notSelf`/`notWolf` constraints for wolf kill.

---

## Anti-cheat & broadcast rules

- `BroadcastGameState` is room-public view-model only.
- Sensitive results (seer/psychic reveals, per-player prompts/results) MUST be toUid private messages.
- Any step visibility helpers (e.g. `actsSolo`) must NOT leak into public broadcasts.

---

## Tests & quality gates

### Jest contract tests (required for table-driven night)

Maintain/update contract tests to guarantee:

- `NIGHT_STEPS` reference validity (`roleId` exists; `SchemaId` exists)
- deterministic order (snapshot of step ids)
- uniqueness (step ids)
- Night-1-only red lines
- audioKey non-empty
- anti-cheat boundary (no sensitive fields in public broadcasts)

### E2E rules (Playwright)

- E2E is smoke-only. Never use it as the rule referee.
- Run core e2e with workers=1. Never run multiple e2e processes in parallel.
- Room readiness must use `waitForRoomScreenReady()` (joiner must reach `🟢 已连接` or finish “强制同步”).

### UI test stability (Jest + RNTL)

- Prefer `getByTestId`/`findByTestId`. Don’t add new `UNSAFE_*`.
- Keep testIDs centralized in `src/testids.ts` and preserve legacy IDs via compatibility mapping.

---

## Checklists

### Adding a new role / schema / step

- Add role to `ROLE_SPECS` (`src/models/roles/spec/specs.ts`) and keep `RoleId` derived from registry keys.
- If it acts on Night-1:
   - add/extend `SCHEMAS` (`src/models/roles/spec/schemas.ts`) with schema-first constraints
   - add a step to `NIGHT_STEPS` (`src/models/roles/spec/nightSteps.ts`) with `id: SchemaId`, `audioKey`, `visibility`
   - implement/update resolver under `src/services/night/resolvers/**` (schema-aligned)
   - update contract tests (order snapshot + validity + red lines)
   - add/extend `SCHEMAS` (`src/models/roles/spec/schemas.ts`) with schema-first constraints
   - add a step to `NIGHT_STEPS` (`src/models/roles/spec/nightSteps.ts`) with `id: SchemaId`, `audioKey`, `visibility`
   - implement/update resolver under `src/services/night/resolvers/**` (schema-aligned)
   - update contract tests (order snapshot + validity + red lines)

---

## Reporting discipline

- Don’t claim changes without evidence.
- For non-trivial work, report:
   - commit hash (or “not committed yet”)
   - files changed
   - key symbols changed
   - logical behavior changes
   - verification run (typecheck/Jest/e2e) + outcome
   - commit hash (or “not committed yet”)
   - files changed
   - key symbols changed
   - logical behavior changes
   - verification run (typecheck/Jest/e2e) + outcome

### UI/hooks must not encode gameplay rules

- ❌ Do NOT implement gameplay rules via role-specific branches in `RoomScreen.tsx` or hooks under `src/screens/RoomScreen/**`.
   - UI should render from **schema + broadcast view-model**.
- ✅ Temporary migration branches are allowed only if:
   - they are clearly marked as migration-only (comment + TODO), and
   - a follow-up removes them once the schema/view-model path is in place.

**Broadcast ViewModel contract (future-friendly):**
- UI should prefer consuming `BroadcastGameState` view-model fields (step/schema/constraints) over deriving rules from local `actions`.
- Do NOT add new UI logic that depends on raw `actions` payloads.

#### Button testability contract

- Custom `Button` must accept `testID` and apply it to the interactive container.
- Loading indicators (e.g., `ActivityIndicator`) must have a dedicated `testID` (or a derivation from `Button` testID).
- Disabled/loading state must be reflected via `accessibilityState.disabled` for reliable assertions.

### Host-side enforcement & state truth rules (mandatory)

These rules apply to Host-authoritative runtime + broadcasted UI state.

#### Host must enforce invalid actions (no UI-only enforcement)

- If a player is blocked/invalid (e.g., Nightmare block), the **Host** must treat incoming action messages as idempotent no-ops and must not record them.
- UI-only prevention (disabling seat taps / showing dialogs) is not sufficient for correctness.

#### Single source of truth (avoid dual-write drift)

- For any gameplay fact, keep **one** source of truth.
   - Either derive it from structured `actions` (recommended for purely UI-facing facts),
   - or store it as an explicit state field.
- Avoid maintaining the same fact in both `actions` and a separate state field unless there is a documented cache strategy and deterministic clearing rules.

#### Broadcast is view-model only (minimal derived fields)

- Players should not receive the full `actions` payload.
- If the UI needs extra information, broadcast a minimal derived field in `BroadcastGameState` (view-model style), e.g. `nightmareBlockedSeat`.

#### Visibility is not a Host privilege (anti-cheat, mandatory)

- Host is authority for computation and routing, **NOT** privilege for visibility.
- Any sensitive action result MUST be delivered via **toUid private messages** and MUST **NOT** appear in `BroadcastGameState`.
   - Examples (sensitive): seer/psychic reveal results, any per-player-only prompts/results.
   - `BroadcastGameState` must contain only room-public view-model fields.

**Flake reporting rule (mandatory)**
- “Re-run and it passed” is **not** evidence. If a test fails during validation (even if a re-run passes), you must:
   - record the **exact failure signature** (error type/message, e.g., `HTTP 409`, `ERR_CONNECTION_REFUSED`, timeout)
   - state whether it’s **mitigated** by code in this PR (and where), or explicitly mark it as **unmitigated external flake**
   - keep `e2e:core` green at the end, but do not hide intermediate failures

**Evidence-backed change report (mandatory)**
- Never claim “Made changes” (or similar) without citing verifiable evidence from the repo.
- For any non-trivial change request (bugfix, refactor, new test, stability mitigation), the final response MUST include:
   - **Commit evidence**: the commit hash(es) you produced/validated (or explicitly say “not committed yet”).
   - **Files changed**: a bullet list of file paths with 1-line purpose per file.
   - **Key symbols touched**: function/class names edited (e.g., `probeServerHealth`, `runNightFlowLoop`, `createRoom`).
   - **What changed logically**: 3–6 bullets describing behavior changes (not implementation narration).
   - **How it was verified**: which gates were run (typecheck/Jest/e2e) and the outcome.
- If you cannot provide the above (e.g., no repo access / no tools), you must say so and limit the response to a **proposal** (prompts/spec), not a claim of completion.

**E2E helper reuse (mandatory)**
- Do not hand-roll “home/login readiness” waits inside specs. Use shared helpers only.
- Helpers must be layered and reusable:
   - `e2e/helpers/ui.ts`: generic primitives (retry, clickIfVisible, waitForEitherVisible, etc.)
   - `e2e/helpers/home.ts`: `ensureHomeReady()` / `ensureInRoomOrHomeReady()`
   - `e2e/helpers/waits.ts`: `waitForRoomScreenReady()` (joiner live gate + 强制同步 loop)
- Avoid single-text gates (UI copy changes). Prefer stable selectors (role/testid) and composite conditions.
- Avoid `waitForTimeout` as synchronization (only allowed with explicit justification).

### Engineering Best Practices (avoid hardcoding)

- Avoid hard-coded strings and one-off logic. Prefer shared helpers/utilities and stable selectors.
- Exception: protocol/contract UI strings that are part of stability gates (e.g., connection status bar text) may be matched exactly, but must be centralized in helpers/constants (not scattered in specs/components).
- When a pattern appears twice (especially waits/retries/guards/log formatting), extract it into a reusable helper (`src/utils/*`, `src/services/*`, `e2e/helpers/*`).
- Keep helpers layered (generic primitives → domain helpers) and keep specs/components thin.

## Roles Architecture (MANDATORY)

We standardize on a **declarative** roles system so that Host remains the only authority and UI stays thin.

### Single source of truth: registry

- All role metadata MUST come from the shared roles registry: `src/models/roles/spec/specs.ts` (the `ROLE_SPECS` registry).
- Do NOT introduce new ad-hoc mappings like `Record<RoleId, string>`, `isWolf` arrays, or duplicated `ACTION_ORDER` in UI/services/tests.
- Wrapper helpers (e.g. `getRoleDisplayName(role)`, `isWolfRole(role)`) are allowed, but they MUST be thin pass-throughs to the registry.

### RoleId typing requirement (future-proof)

- Role IDs MUST be derived from registry keys (e.g., `export type RoleId = keyof typeof ROLE_SPECS`).
- Do NOT maintain a hand-written `RoleName` union long-term.
- Avoid long-lived legacy/compat aliases. If one is unavoidable, it MUST be handled via a single alias layer at the registry boundary and deleted promptly.

### Spec + Schema + Resolver + NightPlan (target end-state)

- **RoleSpec (models)**: static metadata + UX copy + night-1 capability declaration.
- **ActionSchema (models)**: declarative description of required input (targets/steps/constraints). Pure data.
- **Resolver (host)**: pure function that validates + computes results/patches + reject reasons.
- **NightPlan (host/controller)**: table-driven ordered steps derived from roles/template for Night-1.

### Hard prohibitions (avoid “role-script UI engine”)

- ❌ Do NOT implement role-driven UI behavior scripts such as `RoleBehavior.getInitialPhase()` / `ActionPhase.nextPhase()` callbacks.
   - No function-valued fields inside schemas/phases.
   - No embedded flow control in role models.
- ❌ UI must not contain role-specific switch/case for gameplay logic.
   - UI should render from **schema + broadcast view-model**.

### Tests (roles)

- Add/maintain Jest contract tests to enforce:
   - every role has a RoleSpec
   - displayName/description/actionTitle are non-empty
   - referenced schemas exist and are valid
   - NightPlan excludes roles with `night1.hasAction=false`

### Engineering Best Practices (keep complexity & file size under control)

- Large files are a **smell**: they often mix responsibilities and make reviews/tests fragile.
- Prefer small, composable helpers and “orchestrator” functions that delegate to focused sub-functions.
- If a file grows beyond ~300 LOC or a function trips `Cognitive Complexity`, do a minimal refactor:
   - extract constants/specs into `*.constants.ts`
   - extract reusable loops/guards into helpers (table-driven style)
   - keep the public API stable (re-export from the domain entry file is OK **only for domain helpers**, not generic primitives)
- Exception: e2e helpers may need loops/retries, but complexity must be contained via extraction (no monolithic mega-functions).

**Recommended refactor shape (directory + facade)**
- When splitting a large file, prefer `folder/` modules + a stable facade entry (`index.ts` or the original file) that re-exports **domain helpers only**.
- Keep spec imports stable when possible (avoid churn). Example: keep `import { ensureHomeReady } from './helpers/home'` working while moving internals into `home/*.ts`.
- Do **not** use the facade to re-export generic primitives (e.g., `getVisibleText`, `gotoWithRetry`). Specs must import primitives from `e2e/helpers/ui.ts`.

### Engineering Best Practices (use design patterns)

- Prefer clear, proven design patterns over ad-hoc branching (e.g., state machine for phases, strategy for role behaviors, adapter for transport/services, layered helpers for e2e).
- Keep responsibilities separated: domain logic in controllers/services, UI thin, transport as a dumb pipe.
- Prefer idempotent handlers and explicit invariants for concurrency/timing-sensitive flows.

### Bugfix + small refactor (preferred)

- When fixing a bug, it’s encouraged to do a small, low-risk refactor in the same area (extract helpers, remove duplication, clarify invariants), **but keep the diff minimal**.
- Do not mix in broad rewrites. Scope should be limited to the bug’s module/flow.
- Must keep quality gates green (typecheck/Jest/e2e as applicable) and provide evidence in the commit message or task notes.

### Large-scope refactor (when justified)

- When the task inherently requires broad changes (e.g., replacing a cross-cutting pattern, removing legacy encoding, restructuring a core type), do NOT artificially keep the diff small.
- Before starting a large-scope refactor, ask the user for confirmation **only if the user has not already explicitly authorized a large-scope refactor in this conversation**:
   - **"这个改动涉及多个模块，需要大范围重构，可以吗？"**
   - If the user already said it's OK to do a large-scope refactor, proceed without re-asking.
- In such cases:
   - Make **all** necessary changes across the codebase in one pass (UI, host runtime, tests, types).
   - Completely remove deprecated patterns/fields/files rather than leaving "兼容层" or dual-write logic.
   - Prioritize a clean end-state over incremental migration.
- Verification requirement is unchanged: quality gates must be green (typecheck/Jest/e2e as applicable) and evidence must be provided.

---

## Collaboration stance (Architect-level)

- Treat the assistant as a **senior architect + staff-level engineer** by default (this is about the *working style and review bar*, not personal identity).
- Prioritize: clear boundaries, explicit invariants, smallest stable diff, and evidence-backed verification.
- When presenting a solution, prefer:
   - a small contract (inputs/outputs, error modes)
   - key edge cases
   - a minimal test that enforces the behavior
- If a request conflicts with the architecture boundary (Host-authority / Supabase transport-only), call it out and propose a compliant alternative.

### Default collaboration mode (prompt-first)

- Prefer **forwardable prompts/specs** by default.
- Only directly edit files / run repo commands when the user explicitly authorizes it.

### Facts & uncertainty rule (mandatory)

- Do NOT invent project facts (file paths, symbols, APIs, behavior, requirements) that are not verified in the repo or explicitly stated by the user.
- If a detail is uncertain or multiple interpretations exist, you MUST ask the user to confirm before proceeding.
- Any assumptions must be stated explicitly as assumptions (and kept minimal) before acting.

### Roles model hard constraint (MANDATORY)


- Role models under `src/models/roles/**` MUST NOT depend on `GameStateService`, `BroadcastService`, Supabase Realtime, or any transport/service layer.
- Role models MUST NOT write/mutate state (no direct changes to game state, actions, votes, deaths, phase/index, broadcasts).
- Role models may ONLY provide:
   - declarative specs/schemas (e.g., `RoleSpec`, `ActionSchema`, constraints)
   - light validation and structured validation errors

> Host-side resolution MUST live in host resolvers (pure functions). Role models must not embed flow control or side effects.

---

## Deprecation policy (MANDATORY)

- If a module/symbol is being replaced:
   - mark it with `@deprecated` and point to the replacement path
   - add a `TODO(remove by YYYY-MM-DD)`
   - do not add new usages
- Prefer deleting deprecated code once all call-sites migrate (avoid long-lived compatibility layers).

### Incremental migration guardrail (MANDATORY)

Incremental / transitional refactors are allowed, but **must not become permanent**.

If you introduce or keep any temporary compatibility behavior (e.g. “use legacy for now”, dual-write, fallback mode, adapter shims), you MUST:

- **Add an explicit exit plan** near the code *and* in the PR description/task notes:
   - what is temporary (exact symbol/file/behavior)
   - what the replacement is
   - the concrete removal criteria (what call-sites/tests must be migrated)
   - a hard deadline: `TODO(remove by YYYY-MM-DD)`
- **Block new usages** of the legacy path (prefer an ESLint rule, no-export, or a `/** @deprecated */` annotation).
- **Add a minimal test** that fails if the temporary fallback is still present past the intended migration (or if new usages appear).
- **Add/maintain a migration tracking doc** under `docs/migrations/` and link it from PR/task notes:
   - use a deterministic file name (e.g. `docs/migrations/roles-spec-schema-phase4.md`)
   - keep a checklist of remaining call-sites and tests to migrate
   - list every temporary symbol/behavior that still exists (single source of truth)
   - include removal criteria + deadline for each item

Do NOT leave “temporary” code without a removal date + test coverage. If the safe end-state requires a broad refactor, ask for confirmation before proceeding.

---

## Night-1-only scope rules (MANDATORY)

This app acts as an **electronic judge for the first night only**.

### Hard ban: cross-night state / constraints (Night-2+ is out of scope)

- Do **NOT** introduce or use any cross-night state in Host logic or resolvers.
   - Examples (ban): `previousActions`, `lastNightTarget`, `notSameAsLastNight`, “连续两晚/第二晚开始/每晚/下一晚” constraints.
   - Resolver context/types MUST NOT carry cross-night fields.
- If a rule depends on Night-2+ memory, it is **out of scope** and must be deleted/ignored.
- Prefer enforcing this with Jest contract tests in `src/services/night/resolvers/__tests__/*`.

### Neutral judge rule: wolf kill can target ANYONE

- **Project rule**: Wolf kill/vote is neutral in this app.
   - Wolves can target **any seat**, including **self** and **wolf teammates**.
- Do NOT add schema/resolver constraints like `notSelf` / `notWolf` for `wolfKill`.

### Self-target constraints must be schema-first and resolver-aligned

- `SCHEMAS[*].constraints` is the first-class source of truth for UI restrictions (e.g. `notSelf`).
- Host resolvers MUST align with schema constraints:
   - If schema says `notSelf`, resolver MUST reject self-target.
   - If schema allows self-target, resolver MUST NOT reject it unless there is a documented exception + contract test.

---

## Refactor plan guardrails (mandatory)

These are repo-level refactor constraints to keep the migration safe and reviewable.

- **Small, evidence-backed steps**: each migration phase must land with:
   - contract tests (Jest) for the new behavior,
   - typecheck green,
   - minimal blast radius (avoid broad rewrites).
- **File boundaries**:
   - Role models under `src/models/roles/**` are declarative only (spec/schema/types). No services, no side effects.
   - Host-only resolution lives under `src/services/night/resolvers/**` (pure functions), and must not be imported by UI.
   - UI under `src/screens/RoomScreen/components/**` must be UI-only (no services imports).
- **Single source of truth**:
   - Night order must come from `NightPlan` (no parallel `ACTION_ORDER`).
   - UI should render from `schemaId` + local schemas (or broadcast view-model), not from role-specific branches.

### Night-1-only enforcement (NO cross-night state)

- Follow **"Night-1-only scope rules (MANDATORY)"** above. Do not duplicate or re-encode those rules here.

### Rule: “No Night-1 action” ⇒ “No night action”

If a role **cannot act on the first night** (e.g. “从第二晚开始才行动”), it MUST be modeled as:

- `night1.hasAction = false`

Do **NOT** special-case such roles in:

- `Template.ts` action order generation
- `NightFlowController` progression
- UI conditional logic

Rationale: With night-1-only scope, a role that never acts on night 1 must never appear in `template.actionOrder`, otherwise the Host flow will incorrectly prompt it to wake up.

### Roles behavior contract (MANDATORY)

- **Authority**: Role behavior rules (description, night-1 capability, resolver logic) MUST be based on the current `*Role.ts` files (or future `*.spec.ts`).
- **No guessing**: When writing/refactoring RoleSpec or Resolver, you MUST read the corresponding role file first. Do NOT write from memory.
- **Night-1-only**: If a role cannot act on Night 1 (e.g., `witcher` starts from Night 2), it MUST have `night1.hasAction: false`.
- **Special rules**: Resolver validation MUST match the declared constraints (e.g., `witch.canSaveSelf=false` → resolver rejects self-save; seer cannot check self).
