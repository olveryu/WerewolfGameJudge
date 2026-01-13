## Core Architecture: Host as Authority

### CRITICAL PRINCIPLE（最高优先级）

The Host client (房主客户端) is the **authority for all game LOGIC and runtime decisions**, including:
- Night flow control (phase order, timing)
- Role action execution and validation
- Audio sequencing and progression
- Death calculation and first-night resolution

Supabase is still responsible for **system-level responsibilities**, including:
- Room existence and discovery (4-digit room code)
- User identity (anonymous login & registered users)
- Player joining and leaving a room
- Realtime message transport via Supabase Realtime Broadcast
- Automatic cleanup of inactive rooms

Supabase does **NOT**:
- Execute any game logic
- Validate night actions
- Determine game outcomes
- Store game state, actions, votes, or results

IMPORTANT:
“Host as authority” refers strictly to **game logic authority**, NOT system authority.
Room lifecycle, user presence, and room validity are always managed and validated through Supabase.

---

### Database Schema (Supabase)

Only one table - `rooms`:

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid | 房间唯一 ID，主键 |
| `code` | text | 4 位房间加入码 |
| `host_id` | text | 创建者用户 ID |
| `created_at` | timestamptz | 房间创建时间 |
| `updated_at` | timestamptz | 房间最后活跃时间 |

Room records are ephemeral:
- Rooms exist only for short-lived sessions
- Inactive rooms may be deleted automatically based on `updated_at`
- No historical game data is persisted

User display information (display_name, avatar_url) is stored in Supabase Auth `user_metadata`.
No separate profiles table is required.

---

### Game State Ownership

All **game state** exists only in memory on the Host client, including:
- Player seating and roles
- Night actions and votes
- Current phase and action index
- Temporary results (e.g. deaths of the first night)

This state is:
- Authored by the Host client
- Broadcast to players via Supabase Realtime
- Cleared on game restart or room destruction
- Never written to the database

Supabase is used strictly as:
- A discovery layer (room code → room exists)
- A communication layer (realtime broadcast)
- An identity layer (who is connected)

---

### Why This Architecture?

1. **Clear Authority Boundary**
   - Host controls game logic
   - Supabase controls room and user lifecycle

2. **Minimal Backend Complexity**
   - No RPC
   - No triggers
   - No game tables

3. **Low Latency & Predictable Flow**
   - No database round-trips during night actions
   - Sequential, host-driven night flow

4. **Failure Tolerance**
   - Temporary network issues do not corrupt game state
   - Game state can be reset locally by the Host at any time

5. **Designed for In-Person Play**
   - All players are physically present
   - Backend is not a referee, only an infrastructure provider

---

## Project Quality Gates (mandatory)

### E2E Gate & Stability Rules

- Core e2e runs with workers=1 and must collect evidence on failure (logs/screenshot).
- Room readiness must use the shared `waitForRoomScreenReady` helper (joiner must reach `🟢 已连接` or complete the “强制同步” recovery loop). Do not rely on header-only waits.
- **Never run multiple e2e processes in parallel.** Do not start a new `npm run e2e:core` (or any Playwright command) while another is still running. Doing so causes port/server conflicts (`ECONNREFUSED`, `HTTP 409`) and invalidates test results.

### Strict Night Flow (NightFlowController as Authority)

**NightFlowController is the single source of truth for night-phase progression.**  
GameStateService acts only as a bridge (audio + broadcast + local caches) and must not “advance the game” outside the controller’s legal transitions.

**Strict invariant (Host night):**
- When `isHost === true` and `state.status === ongoing`, `nightFlow` MUST be non-null.
- If `nightFlow` is null during ongoing night, this is a bug: fail-fast (throw) or enter an explicit rescue protocol. Do **not** silently fall back to “legacy mode”.

**No overreach rules:**
- Never manually advance `currentActionerIndex` (no fallback `++`).
- Phase mismatch events must be treated as idempotent no-ops (debug only). No side effects.
- Night bridge functions (e.g., `advanceToNextAction()`, `playCurrentRoleAudio()`, `endNight()`) must not perform side effects (death calculation, status change, broadcasts, index changes) unless the controller is in the proper phase.

**NightPlan (table-driven) requirement:**
- Night-1 role progression MUST be derived from a single table-driven `NightPlan`.
- Do NOT maintain a separate `ACTION_ORDER` array (or per-role ordering maps) across UI/services/tests.
- Any "action order" exposed for UI is a derived view of `NightPlan`.

**Contract (target end-state):**
- Input: `Template.roles`
- Output: `NightPlanStep[]` (includes `roleId`, `schemaId`, visibility, optional audio keys)
- `NightFlowController` is responsible only for legal phase/step transitions.
- `GameStateService` is a bridge only (audio + broadcast + apply patches). It must not advance flow outside controller transitions.

### Sync Protocol Requirements (Transport-only, but reliable)

- Host broadcasts `STATE_UPDATE` with a monotonically increasing `revision`.
- Players support snapshot recovery via request/response (toUid) with timeout/rollback.
- Seat actions use requestId+ACK (toUid), and clients must filter ACK by requestId.

### E2E stability rules (target selection + stable assertions)

- **Target selection must be fail-safe and must never self-target.** Any “click a seat to choose a target” fallback must:
   - Exclude the current player’s own seat when it can be determined.
   - If the current player’s seat cannot be determined reliably, **return false** (fail-safe) instead of guessing.
   - Only run when the UI is in a confirmed “choose target” state. Do **not** trigger merely because an action message is visible.
- **Assertions and counts must use stable selectors/structure.** Do not use viewport `isVisible()` loops as a proxy for counts (e.g., seat count). Prefer stable selectors (`data-testid`/role) or a deterministic structural locator.
- When choosing a target (seat tap), tests must respect the **current step constraints** (schema/host view-model) and must not guess.

### Test layering rules (mandatory)

- **E2E (Playwright) is smoke-only.** It verifies end-to-end wiring (UI → host runtime → realtime transport) and that flows complete, but must avoid fragile “rule referee” assertions.
- **“谁死谁活 / 平安夜 / 昨夜信息内容” belongs to Jest integration/contract tests**, not E2E.
   - Put death resolution / night outcome assertions in Jest tests that drive the in-memory host logic (e.g., `NightFlowController` + `GameStateService` + resolvers), so results are deterministic and not UI/timing dependent.
   - E2E may only assert coarse outcomes (e.g., night completed, result dialog opened) unless a specific UI contract is being validated.
- When expanding night E2E coverage (e.g., 6-player, restart), focus on **progression invariants** (no stuck phases, restart resets state, settings visibly applied) rather than exact kill lists.

### Jest UI test stability rules (mandatory)

These rules apply to Jest + `@testing-library/react-native` UI tests.

**Goal:** UI tests must use stable selectors and must not be fragile to copy/layout refactors.

#### Stable selector requirement

- Prefer `getByTestId` / `findByTestId` / `queryByTestId`.
- Avoid `UNSAFE_*` queries, `.parent` traversal, and text-only gates (unless the UI copy itself is the contract being validated).
- Do not add new `UNSAFE_*` usages. Existing ones should be migrated when touched.

#### High-ROI elements must have `testID`

UI components must provide stable `testID`s for:

- Clickable elements: `Button` / `Pressable` / `TouchableOpacity` (especially loading/disabled states)
- Inputs: `TextInput`
- State nodes: loading spinner, error message, connection status
- List items: seat/player card containers (each item must have a deterministic `testID`)

#### Single source of truth: `src/testids.ts`

- Maintain a single testID registry at `src/testids.ts`.
- Components and tests should import `TESTIDS` from the registry instead of hard-coded strings.
- If legacy testIDs already exist, consolidate them into `src/testids.ts` and keep a compatibility mapping during migration.

#### testID migration compatibility rule (mandatory)

- Do **not** silently rename or delete legacy `testID`s.
   - If a rename is needed, keep the old `testID` working via compatibility mapping, until all Jest/e2e selectors are migrated.

---

## RoomScreen refactor guardrails (mandatory)

These rules exist to keep `src/screens/RoomScreen/**` refactors safe and prevent accidental architecture violations.

### UI components must not import services

- Sub-components under `src/screens/RoomScreen/components/**` MUST be UI-only.
   - ❌ Do not import `GameStateService`, `BroadcastService`, Supabase clients, or other singleton services.
   - ✅ Receive data and callbacks via props; orchestration stays in hooks / `RoomScreen.tsx`.

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

- All role metadata MUST come from the shared roles registry: `src/models/roles/registry.ts`.
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
- Before starting a large-scope refactor, ask the user for confirmation: **"这个改动涉及多个模块，需要大范围重构，可以吗？"** Wait for confirmation before proceeding.
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

---

## Night-1-only scope rules (MANDATORY)

This app acts as an **electronic judge for the first night only**.

### Rule: “No Night-1 action” ⇒ “No night action”

If a role **cannot act on the first night** (e.g. “从第二晚开始才行动”), it MUST be modeled as:

- `hasNightAction = false`

Do **NOT** special-case such roles in:

- `Template.ts` action order generation
- `NightFlowController` progression
- UI conditional logic

Rationale: With night-1-only scope, a role that never acts on night 1 must never appear in `template.actionOrder`, otherwise the Host flow will incorrectly prompt it to wake up.

### Roles behavior contract (MANDATORY)

- **Authority**: Role behavior rules (description, night-1 capability, resolver logic) MUST be based on the current `*Role.ts` files (or future `*.spec.ts`).
- **No guessing**: When writing/refactoring RoleSpec or Resolver, you MUST read the corresponding role file first. Do NOT write from memory.
- **Night-1-only**: If a role cannot act on Night 1 (e.g., `witcher` starts from Night 2), it MUST have `hasNightAction: false`.
- **Special rules**: Resolver validation MUST match the declared constraints (e.g., `witch.canSaveSelf=false` → resolver rejects self-save; seer cannot check self).
