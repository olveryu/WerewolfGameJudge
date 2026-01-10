# Assistant Working Contract (Repo Backup)

This file is a **durable backup** of the “how we work with the assistant” rules, so we don’t lose them when chat history is gone.

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

---

## 7) Collaboration mode

- Prefer concrete code edits + tests + evidence.
- If instructions appear ambiguous, **choose the stricter interpretation** (especially for authority boundaries and state machine invariants).
