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

### Test layering rules (mandatory)

- **E2E (Playwright) is smoke-only.** It verifies end-to-end wiring (UI → host runtime → realtime transport) and that flows complete, but must avoid fragile “rule referee” assertions.
- **“谁死谁活 / 平安夜 / 昨夜信息内容” belongs to Jest integration/contract tests**, not E2E.
   - Put death resolution / night outcome assertions in Jest tests that drive the in-memory host logic (e.g., `NightFlowController` + `GameStateService` + resolvers), so results are deterministic and not UI/timing dependent.
   - E2E may only assert coarse outcomes (e.g., night completed, result dialog opened) unless a specific UI contract is being validated.
- When expanding night E2E coverage (e.g., 6-player, restart), focus on **progression invariants** (no stuck phases, restart resets state, settings visibly applied) rather than exact kill lists.

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

### Roles registry: single source of truth (mandatory)

- All role metadata MUST come from the shared roles registry (e.g. `src/models/roles/registry.ts`) as the single source of truth, including:
   - display name (中文名/英文名)
   - camp/team classification
   - night action capability + order
   - UI labels/messages related to roles
- Do NOT introduce new ad-hoc mappings like `Record<RoleName, string>`, `isWolf` arrays, or duplicated `ACTION_ORDER` in UI/services/tests.
- Wrapper helpers (e.g. `getRoleDisplayName(role)`, `isWolfRole(role)`, `getNightActionOrderForRoles(roles)`) are allowed, but they MUST be thin pass-throughs to the registry.
- Any change that adds/removes/renames a `RoleName` MUST update:
   - the registry definition (exhaustive)
   - Jest coverage ensuring all roles are defined and display names are non-empty

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
