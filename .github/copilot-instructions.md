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

### Strict Night Flow (NightFlowController as Authority)

**NightFlowController is the single source of truth for night-phase progression.**  
GameStateService acts only as a bridge (audio + broadcast + local caches) and must not “advance the game” outside the controller’s legal transitions.

**Strict invariant (Host night):**
- When `isHost === true` and `state.status === ongoing`, `nightFlow` MUST be non-null.
- If `nightFlow` is null during ongoing night, this is a bug: fail-fast (throw) or enter an explicit rescue protocol. Do **not** silently fall back to “legacy mode”.

**No overreach rules:**
- Never manually advance `currentActionerIndex` (no fallback `++`).
- Phase mismatch events must be treated as idempotent no-ops (debug only). No side effects.
- `endNight()` must not perform death calculation, status change, or broadcasts unless the controller is in the proper phase.

### Sync Protocol Requirements (Transport-only, but reliable)

- Host broadcasts `STATE_UPDATE` with a monotonically increasing `revision`.
- Players support snapshot recovery via request/response (toUid) with timeout/rollback.
- Seat actions use requestId+ACK (toUid), and clients must filter ACK by requestId.

### E2E Gate & Stability Rules

- Core e2e runs with workers=1 and must collect evidence on failure (logs/screenshot).
- Room readiness must use the shared `waitForRoomScreenReady` helper (joiner must reach `🟢 已连接` or complete the “强制同步” recovery loop). Do not rely on header-only waits.
