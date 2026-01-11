# Assistant Working Contract (Repo Backup)

This file is a **durable backup**## 5) E2E stability contract (non-negotiable)

- Core e2e runs with **workers=1**.
- Failures must collect evidence (logs/screenshot).
- Room readiness must use the shared `waitForRoomScreenReady()` helper:
  - Joiner must reach `🟢 已连接` OR complete the "强制同步" recovery loop.
  - Do not rely on header-only waits.
- **Never run multiple e2e processes in parallel.** Do not start a new `npm run e2e:core` (or any Playwright command) while another is still running. Doing so causes port/server conflicts (`ECONNREFUSED`, `HTTP 409`) and invalidates test results.

### E2E stability rules (target selection + stable assertions)how we work with the assistant” rules, so we don’t lose them when chat history is gone.

If this file conflicts with `.github/copilot-instructions.md`, treat **`.github/copilot-instructions.md` as the primary source of truth** and update this backup accordingly.

---

## 1) Product scope (keep it small)

- This project is an **in-person, same-table Werewolf game**.
- Target experience: **“Night 1 electronic judge”**.
- The Host device can be used by a player, and during the night the Host is effectively “eyes closed” (audio-driven flow).
- We only need to output **day summary** like:
  - “平安夜 / 有人死亡”
  - “昨夜信息” (as defined by the rules)
- Join flow:
  - Anonymous login is supported (registered users optional)
  - Join by **4-digit room code**

---

## 2) Architecture boundary (highest priority)

### Host as authority (game logic)

- The **Host client is authoritative for all game logic and runtime decisions**:
  - Night flow control (phase order / timing)
  - Role action execution + validation
  - Audio sequencing
  - Death calculation (especially first night)

### Supabase is transport + lifecycle only

Supabase is responsible for:
- Room existence/discovery by code
- Identity (Auth)
- Presence (join/leave)
- Realtime broadcast transport
- Cleanup of inactive rooms

Supabase must **NOT**:
- Execute game logic
- Validate night actions
- Determine outcomes
- Store game state/actions/votes/results

Database schema: only `rooms` table (ephemeral rooms).

---

## 3) Night flow strictness (state machine authority)

- `NightFlowController` is the **single source of truth** for night progression.
- `GameStateService` is a **bridge** only (audio + broadcast + local caches). It must not “advance the game” outside legal controller transitions.

### Strict invariant (Host night)

- When `isHost === true` and `state.status === ongoing`, `nightFlow` **must be non-null**.
- If `nightFlow` is null during ongoing night, this is a bug: **fail-fast (throw)** or enter an explicit rescue protocol. Do not silently fall back.

### No-overreach rules

- Never manually advance `currentActionerIndex` (no fallback `++`).
- Phase mismatch events must be **idempotent no-ops** (debug-only). No side effects.
- Night bridge functions must not do side effects unless the controller is in the proper phase.

---

## 4) Sync protocol requirements (reliable transport)

- Host broadcasts `STATE_UPDATE` with a **monotonically increasing `revision`**.
- Players support **snapshot recovery** via request/response (toUid), with timeout/rollback.
- Seat actions use **requestId + ACK** (toUid), and clients must filter ACK by requestId.

---

## 5) E2E stability contract (non-negotiable)

- Core e2e runs with **workers=1**.
- Failures must collect evidence (logs/screenshot).
- Room readiness must use the shared `waitForRoomScreenReady()` helper:
  - Joiner must reach `🟢 已连接` OR complete the “强制同步” recovery loop.
  - Do not rely on header-only waits.

### E2E stability rules (target selection + stable assertions)

- **Target selection must be fail-safe and must never self-target.** Any “click a seat to choose a target” fallback must:
  - Exclude the current player’s own seat when it can be determined.
  - If the current player’s seat cannot be determined reliably, **return false** (fail-safe) instead of guessing.
  - Only run when the UI is in a confirmed “choose target” state. Do **not** trigger merely because an action message is visible.
- **Assertions and counts must use stable selectors/structure.** Do not use viewport `isVisible()` loops as a proxy for counts (e.g., seat count). Prefer stable selectors (`data-testid`/role) or a deterministic structural locator.

### Test layering rules (mandatory)

- **E2E (Playwright) is smoke-only.** It verifies end-to-end wiring (UI → host runtime → realtime transport) and that flows complete, but should avoid fragile “rule referee” assertions.
- **“谁死谁活 / 平安夜 / 昨夜信息内容” belongs to Jest integration/contract tests**, not E2E.
  - Put death resolution / night outcome assertions in Jest tests that drive the in-memory host logic (e.g., `NightFlowController` + `GameStateService` + resolvers), so results are deterministic and not UI/timing dependent.
  - E2E may only assert coarse outcomes (e.g., night completed, result dialog opened) unless a specific UI contract is being validated.
- When expanding night E2E coverage (e.g., 6-player, restart), focus on **progression invariants** (no stuck phases, restart resets state, settings visibly applied) rather than exact kill lists.

### Flake reporting rule (mandatory)

- “Re-run and it passed” is **not** evidence. If a test fails during validation (even if a re-run passes), you must:
  - record the **exact failure signature** (error type/message, e.g., `HTTP 409`, `ERR_CONNECTION_REFUSED`, timeout)
  - state whether it’s **mitigated** by code in this PR (and where), or explicitly mark it as **unmitigated external flake**
  - keep `e2e:core` green at the end, but do not hide intermediate failures

### Evidence-backed change report (mandatory)

- Never claim “Made changes” (or similar) without citing verifiable evidence from the repo.
- For any non-trivial change request (bugfix, refactor, new test, stability mitigation), the final response MUST include:
  - **Commit evidence**: the commit hash(es) you produced/validated (or explicitly say “not committed yet”).
  - **Files changed**: a bullet list of file paths with 1-line purpose per file.
  - **Key symbols touched**: function/class names edited (e.g., `probeServerHealth`, `runNightFlowLoop`, `createRoom`).
  - **What changed logically**: 3–6 bullets describing behavior changes (not implementation narration).
  - **How it was verified**: which gates were run (typecheck/Jest/e2e) and the outcome.
- If you cannot provide the above (e.g., no repo access / no tools), you must say so and limit the response to a **proposal** (prompts/spec), not a claim of completion.

### Helper layering (mandatory)

Specs should be thin.

- `e2e/helpers/ui.ts`: generic primitives (retry, clickIfVisible, waitForEitherVisible, gotoWithRetry, etc.)
- `e2e/helpers/home.ts`: home/login/create/join flows (`ensureHomeReady`, etc.)
- `e2e/helpers/waits.ts`: room ready gate (`waitForRoomScreenReady`)

Do not hand-roll home/login waits in specs.

---

## 6) Engineering practices

- Prefer minimal diffs.
- Keep quality gates green: typecheck / unit tests / e2e as applicable.
- Avoid hardcoding strings and one-off logic.
  - Exception: protocol/contract UI strings allowed if centralized in helpers/constants.
- Prefer proven patterns:
  - State machine (phases)
  - Strategy (roles)
  - Adapter (transport)
  - Layered helpers (e2e)
- Bugfix may include a small, low-risk refactor nearby (extract helper / remove duplication / clarify invariant), but keep the diff minimal.

### Keep complexity & file size under control

- Large files are a **smell**: they often mix responsibilities and make reviews/tests fragile.
- If a file grows beyond ~300 LOC or a function trips `Cognitive Complexity`, do a minimal refactor instead of piling more logic in:
  - extract constants/specs into `*.constants.ts`
  - extract loops/guards into small helpers (table-driven style)
  - keep the public API stable (domain files can re-export **domain helpers**, but must not re-export generic primitives)
- Exception: e2e helpers may need loops/retries, but complexity must be contained via extraction (no mega-functions).

### Recommended refactor shape (directory + facade)

- When splitting a large file, prefer `folder/` modules + a stable facade entry (`index.ts` or the original file) that re-exports **domain helpers only**.
- Keep imports stable when possible (avoid churn). Example: keep `import { ensureHomeReady } from './helpers/home'` working while moving internals into `home/*.ts`.
- Do **not** use the facade to re-export generic primitives (e.g., `getVisibleText`, `gotoWithRetry`). Specs must import primitives from `e2e/helpers/ui.ts`.

---

## 7) Collaboration mode

- Prefer concrete code edits + tests + evidence.
- If instructions appear ambiguous, **choose the stricter interpretation** (especially for authority boundaries and state machine invariants).

### Collaboration stance (Architect-level)

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
