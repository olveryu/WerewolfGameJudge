# Server-Driven Architecture - Design Document

## 问题背景

原有架构存在的问题：
1. **Stale Closure Bug**: async 函数捕获 stale state，导致 `playAudioAndHandleAction` 在 await 后执行时使用过时的 `currentRole`
2. **Race Conditions**: 多个 useEffect 竞争 state 更新
3. **Refs Everywhere**: `lastPlayedActionIndex`, `lastShownDialogIndex` 等 refs 难以维护
4. **Complex Flow**: Audio → Dialog → Action 的流程分散在多个 effects 中

## 新架构核心原则

### 1. Server Owns All State
所有游戏状态存储在 Supabase：
- `night_phase`: 当前夜晚进度
- `night_actions`: 已提交的行动

Client 只是 "dumb" renderer，从 server state 计算 UI。

### 2. No Local Refs for Game Logic
移除:
- ❌ `lastPlayedActionIndex`
- ❌ `lastShownDialogIndex` 
- ❌ `roomRef`

改用纯函数:
- ✅ `shouldShowActionDialog(nightPhase, mySeat)`
- ✅ `shouldPlayAudio(nightPhase, lastAudioRole)`

### 3. Pure Functions for UI Logic
```typescript
// 是否显示 action dialog
function shouldShowActionDialog(nightPhase: NightPhase | null, mySeat: number): boolean {
  if (!nightPhase) return false;
  return (
    nightPhase.audioStatus === 'finished' &&
    nightPhase.pendingSeats.includes(mySeat) &&
    !nightPhase.completedSeats.includes(mySeat)
  );
}
```

## Database Schema

```sql
-- rooms table (simplified)
CREATE TABLE rooms (
  room_number TEXT PRIMARY KEY,
  host_uid TEXT NOT NULL,
  roles TEXT[] NOT NULL,
  players JSONB DEFAULT '{}',
  game_status INTEGER DEFAULT 0,
  night_phase JSONB,      -- Current night action state
  night_actions JSONB DEFAULT '{}'  -- Actions submitted by roles
);
```

### night_phase Structure
```json
{
  "actionIndex": 0,
  "currentRole": "wolf",
  "audioStatus": "playing",  // "playing" | "finished"
  "pendingSeats": [0, 2, 5],
  "completedSeats": [0]
}
```

### night_actions Structure
```json
{
  "wolf": { "target": 3 },
  "witch": { "save": true },
  "seer": { "target": 2 }
}
```

## RPC Functions

### `start_night(room_number, host_uid, first_role, pending_seats)`
初始化 night_phase，设置第一个角色

### `mark_audio_finished(room_number)`
Host 播放完音频后调用，设置 `audioStatus = 'finished'`

### `submit_action(room_number, seat, action, next_role, next_pending_seats)`
玩家提交行动:
1. 添加 seat 到 completedSeats
2. 如果所有人完成，记录 action 并推进到下一角色
3. 如果没有下一角色，结束夜晚

### `restart_game(room_number, host_uid)`
重置所有状态

## Client Components

### 1. useNightPhase Hook
```typescript
function useNightPhase(room: Room | null) {
  return useMemo(() => {
    if (!room?.nightPhase) return null;
    return parseNightPhase(room.nightPhase);
  }, [room?.nightPhase]);
}
```

### 2. useHostAudio Hook (Host Only)
```typescript
function useHostAudio(
  nightPhase: NightPhase | null,
  isHost: boolean,
  roomNumber: string
) {
  const [lastAudioRole, setLastAudioRole] = useState<string | null>(null);
  
  useEffect(() => {
    // 只有当 audioStatus === 'playing' 且 role 改变时才播放
    if (!isHost || !nightPhase) return;
    if (nightPhase.audioStatus !== 'playing') return;
    if (nightPhase.currentRole === lastAudioRole) return;
    
    const playAudio = async () => {
      setLastAudioRole(nightPhase.currentRole);
      await audioService.playRoleBeginningAudio(nightPhase.currentRole);
      await nightService.markAudioFinished(roomNumber);
    };
    
    playAudio();
  }, [nightPhase?.audioStatus, nightPhase?.currentRole, lastAudioRole]);
}
```

### 3. useActionDialog Hook (All Players)
```typescript
function useActionDialog(
  nightPhase: NightPhase | null,
  mySeat: number | null
) {
  return useMemo(() => {
    return shouldShowActionDialog(nightPhase, mySeat);
  }, [nightPhase, mySeat]);
}
```

### 4. RoomScreen Flow
```typescript
function RoomScreen() {
  const { room } = useRoom(roomNumber);
  const nightPhase = useNightPhase(room);
  const showDialog = useActionDialog(nightPhase, mySeat);
  
  useHostAudio(nightPhase, isHost, roomNumber);
  
  // Dialog is shown purely based on server state
  // No local tracking needed!
  return (
    <>
      {showDialog && (
        <ActionDialog
          role={nightPhase!.currentRole}
          onSubmit={handleSubmitAction}
        />
      )}
    </>
  );
}
```

## Game Flow Timeline

```
Host clicks "开始游戏"
    |
    v
+---[start_night RPC]---+
|                       |
| night_phase = {       |
|   actionIndex: 0,     |
|   currentRole: 'wolf',|
|   audioStatus: 'playing',
|   pendingSeats: [0,2],|
|   completedSeats: []  |
| }                     |
+-----------+-----------+
            |
            v
    Host plays audio
            |
            v
+---[mark_audio_finished]---+
|                           |
| audioStatus = 'finished'  |
+-------------+-------------+
              |
              v
    Wolves see dialog
    (pure function: pendingSeats.includes(mySeat) && !completedSeats.includes(mySeat))
              |
              v
    Wolf 0 submits action
              |
              v
+---[submit_action]---+
|                     |
| completedSeats = [0]|
+----------+----------+
           |
           v
    Wolf 2 submits action
           |
           v
+---[submit_action]---+
|                     |
| All complete:       |
| - Record action     |
| - Advance to next   |
| night_phase = {     |
|   currentRole:'seer'|
|   audioStatus:'playing'
|   ...               |
| }                   |
+---------------------+
```

## Why This Solves the Bug

### Original Bug
```
async function playAudioAndHandleAction() {
  // currentRole = 'wolf' (captured)
  await playAudio();
  // ... game restarted ...
  // currentRole still = 'wolf' (stale!)
  showActionDialog(currentRole); // Shows wrong dialog!
}
```

### New Solution
```typescript
// Client just renders based on current server state
// No async captures, no stale closures
const showDialog = shouldShowActionDialog(nightPhase, mySeat);
// nightPhase comes from subscription - always fresh
// If game restarts, nightPhase becomes null → dialog hidden
```

## Migration Plan

1. ✅ Create new schema (001_schema.sql)
2. ✅ Create RPC functions (002_rpc_functions.sql)
3. ✅ Create NightPhase types
4. ✅ Create NightService
5. ✅ Update Room model to include nightPhase
6. ✅ Create useHostAudio hook
7. ✅ Create useActionDialog hook
8. ✅ Create useNightPhase hook
9. ✅ Update RoomService with V2 methods
10. ⏳ Update RoomScreen to use new flow (partial)
11. ⏳ Remove old refs and effects
12. ⏳ E2E tests

## Files to Modify

### Keep (with updates)
- ✅ `src/models/Room.ts` - Added nightPhase field
- ✅ `src/services/RoomService.ts` - Added V2 methods
- ⏳ `src/screens/RoomScreen/RoomScreen.tsx` - Simplify with new hooks (partial)

### Create
- ✅ `supabase/migrations/20260107000024_add_night_phase.sql`
- ✅ `supabase/migrations/20260107000025_rpc_start_night.sql`
- ✅ `supabase/migrations/20260107000026_rpc_mark_audio_finished.sql`
- ✅ `supabase/migrations/20260107000027_rpc_submit_action.sql`
- ✅ `supabase/migrations/20260107000028_rpc_submit_wolf_vote.sql`
- ✅ `supabase/migrations/20260107000029_rpc_restart_game.sql`
- ✅ `supabase/migrations/20260107000030_grant_night_phase.sql`
- ✅ `src/models/NightPhase.ts`
- ✅ `src/services/NightService.ts`
- ✅ `src/hooks/useHostAudio.ts`
- ✅ `src/hooks/useActionDialog.ts`
- ✅ `src/hooks/useNightPhase.ts`

### Delete
- Old RPC functions in migration files (if any)
- `src/models/GamePhase.ts` (if exists)
- `src/hooks/useGamePhase.ts` (if exists)
