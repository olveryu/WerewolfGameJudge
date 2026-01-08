# Werewolf Game Judge - React Native

## Project Overview

A React Native/Expo app for moderating Werewolf (狼人杀) party games with:
- Supabase for authentication and room discovery only
- Host device as Single Source of Truth for game state
- Supabase Realtime Broadcast for state synchronization
- Audio announcements for night phases
- 20+ game roles support
- First night implementation only (daytime voting/discussion handled in person)

## Core Architecture: Host as Authority

**CRITICAL PRINCIPLE: The Host client (房主客户端) manages ALL game state locally. Supabase only stores minimal room info.**

### Database Schema (Supabase)

Only one table - `rooms`:

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid | 房间唯一 ID，主键 |
| `code` | text | 4 位房间加入码 |
| `host_id` | text | 创建者用户 ID |
| `created_at` | timestamptz | 房间创建时间 |
| `updated_at` | timestamptz | 房间更新时间 |

**User info (display_name, avatar_url) is stored in Supabase Auth's `user_metadata`, no separate profiles table needed.**

**All game state (players, roles, actions, votes) is stored in-memory on the Host client and synchronized via Supabase Realtime Broadcast.**

### Why This Architecture?
1. **Simplicity**: No complex RPC functions or database triggers
2. **Performance**: No round-trip to database for every action
3. **Reliability**: No race conditions from concurrent database updates
4. **Offline-capable**: Game can continue even with intermittent connectivity

### Data Flow
```
Host Device                          Player Devices
    │                                      │
    │  ┌─────────────────────────┐         │
    ├──│ GameStateService        │         │
    │  │ (Local State Manager)   │         │
    │  └──────────┬──────────────┘         │
    │             │                        │
    │  ┌──────────▼──────────────┐         │
    │  │ BroadcastService        │◄────────┤
    │  │ (Supabase Realtime)     │─────────►
    │  └─────────────────────────┘         │
    │                                      │
```

## Core Game Flow

### First Night Flow (Sequential)

1. **Host clicks "开始游戏"**
   - Plays `night.mp3` (night begins audio)
   - Waits 5 seconds
   - Updates local status to `ongoing`
   - Broadcasts state to all players

2. **Night Phase Loop** (for each role in `actionOrder`):
   ```
   Host plays role audio → isAudioPlaying = true
   Audio ends → isAudioPlaying = false
   Host broadcasts ROLE_TURN to players
   Player(s) see action dialog
   Player submits action → sent to Host via broadcast
   Host records action locally
   Host advances currentActionerIndex
   Host broadcasts STATE_UPDATE
   Repeat for next role...
   ```

3. **Night Ends**
   - When all actions complete (`currentActionerIndex >= actionOrder.length`)
   - Host calculates deaths locally
   - Host plays `night_end.mp3`
   - Host broadcasts NIGHT_END with death list
   - Host can click "查看昨晚信息" to see deaths

### Action Order

Determined by each role's `actionOrder` property (lower = earlier):
```typescript
// From roles/index.ts ACTION_ORDER
['slacker', 'wolfRobot', 'magician', 'celebrity', 'gargoyle', 
 'nightmare', 'guard', 'wolf', 'wolfQueen', 'witch', 'seer', 
 'psychic', 'hunter', 'darkWolfKing']
```

Only roles present in the template are included in the action sequence.

## Architecture

### Directory Structure

```
src/
├── models/           # Pure TypeScript interfaces and logic
│   ├── Player.ts     # Player state (uid, role, status, etc.)
│   ├── Room.ts       # Room state interface
│   ├── Template.ts   # GameTemplate interface and presets
│   └── roles/        # Role models with Strategy pattern
│       ├── BaseRole.ts      # Abstract base class
│       ├── WolfBaseRole.ts  # Wolf faction base
│       ├── GodBaseRole.ts   # God faction base
│       └── [RoleName]Role.ts # Individual role implementations
├── services/         # Singleton services
│   ├── AudioService.ts       # Audio playback (expo-audio)
│   ├── AuthService.ts        # Supabase auth (anonymous + email)
│   ├── BroadcastService.ts   # Supabase Realtime Broadcast
│   ├── GameStateService.ts   # Local game state (Host authority)
│   └── SimplifiedRoomService.ts  # Minimal room DB operations
├── screens/          # Full-screen views
│   ├── HomeScreen/       # Landing page
│   ├── RoomScreen/       # Main game screen
│   ├── ConfigScreen/     # Template configuration
│   └── SettingsScreen/   # User settings (name, avatar)
├── hooks/            # Custom React hooks
│   └── useGameRoom.ts    # Main game room hook
├── components/       # Reusable UI components
├── contexts/         # React contexts (Network error handling)
└── navigation/       # React Navigation configuration
```

## Services Overview

### SimplifiedRoomService (Supabase)
Only stores minimal room info:
```typescript
interface RoomRecord {
  roomNumber: string;
  hostUid: string;
  createdAt: Date;
}
```
Methods: `generateRoomNumber()`, `createRoom()`, `getRoom()`, `deleteRoom()`

### BroadcastService (Supabase Realtime)
Handles real-time communication between Host and Players:

**Host → Players (HostBroadcast):**
- `STATE_UPDATE`: Full game state sync
- `ROLE_TURN`: Current role's turn to act
- `NIGHT_END`: Night finished with death list
- `GAME_RESTARTED`: Game reset for new round

**Players → Host (PlayerMessage):**
- `JOIN`: Player wants to take a seat
- `LEAVE`: Player leaving seat
- `ACTION`: Player submitting night action
- `WOLF_VOTE`: Wolf voting for kill target
- `VIEWED_ROLE`: Player has viewed their role card

### GameStateService (Local State)
Manages all game state on Host device:
- Players map (seat → player info)
- Actions map (role → target)
- Wolf votes
- Current action index
- Game status

### AudioService
Plays audio files for night phases:
- `playNightBeginAudio()` - night.mp3
- `playRoleBeginningAudio(role)` - [role].mp3
- `playRoleEndingAudio(role)` - audio_end/[role].mp3
- `playNightEndAudio()` - night_end.mp3

## Room Status Flow

```
unseated → seated → assigned → ready → ongoing → ended
    ↑                                              │
    └──────────────── restart_game() ──────────────┘
```

- **unseated**: Waiting for players to join
- **seated**: All seats filled, waiting for host to assign roles
- **assigned**: Roles assigned, players viewing their cards
- **ready**: All players have viewed cards, ready to start
- **ongoing**: Night phase in progress
- **ended**: First night complete

## Night Phase State

The night phase is controlled by:
- `currentActionerIndex`: Which role's turn it is (index into `actionOrder`)
- `isAudioPlaying`: Whether host is currently playing audio
- `actions`: Map of RoleName → target seat (records each role's action)
- `wolfVotes`: Map of wolf seat → target (for wolf team voting)

### Night Phase Sequence

```
currentActionerIndex = 0
│
├─ Host plays audio for actionOrder[0]
│  └─ isAudioPlaying = true → false
│
├─ Host broadcasts ROLE_TURN to players
│  └─ Player(s) with that role select target
│
├─ Player sends ACTION to Host via broadcast
│  └─ Host records action in local state
│
├─ Host advances currentActionerIndex
│  └─ Host broadcasts STATE_UPDATE
│
├─ currentActionerIndex = 1
│  └─ Repeat for next role...
│
└─ currentActionerIndex >= actionOrder.length
   └─ Night ends, play night_end.mp3
```

## Role Models Architecture

Each role has its own model class in `/src/models/roles/`:

```typescript
abstract class BaseRole {
  abstract readonly id: string;           // Unique identifier
  abstract readonly displayName: string;  // Chinese display name
  abstract readonly faction: Faction;     // 'wolf' | 'god' | 'villager' | 'special'
  abstract readonly description: string;  // Role description
  abstract readonly hasNightAction: boolean;
  abstract readonly actionOrder: number;  // Priority (lower = earlier)
  
  readonly canSaveSelf: boolean = true;         // Witch: false
  readonly participatesInWolfVote: boolean = false;
  readonly canSeeWolves: boolean = false;
  readonly immuneToWolfKill: boolean = false;
  readonly immuneToPoison: boolean = false;
  
  getActionDialogConfig(context): ActionDialogConfig | null;
  validateAction(target, context): ActionResult;
}
```

### Inheritance Hierarchy

```
BaseRole (abstract)
├── WolfBaseRole (abstract)
│   ├── WolfRole, WolfQueenRole, WolfKingRole...
│   └── Defaults: participatesInWolfVote=true, canSeeWolves=true
├── GodBaseRole (abstract)
│   ├── SeerRole, WitchRole, HunterRole...
│   └── Defaults: faction='god'
├── VillagerRole
└── SlackerRole (special faction)
```

## Host vs Player Responsibilities

### Host (房主)
- Creates room and selects template
- Plays audio through their device
- Controls game flow (start, restart)
- Can view "昨晚信息" (death announcements)
- Can modify template before game starts
- Handles bot actions if any bots are present

### Players (玩家)
- Join room and take a seat
- View their role card
- Perform night actions when their turn comes
- Cannot see other players' roles (except wolves seeing wolves)

## Authentication

Two login methods supported:

### Anonymous Login
- Auto-signs in on app start
- Random avatar assigned
- Display name: "玩家XXXX"

### Email Registration
- Optional email/password signup
- Can customize display name and avatar
- Persisted across sessions

## Template Configuration

### Preset Templates
Defined in `Template.ts`:
- 标准板12人
- 狼美守卫12人
- 狼王守卫12人
- etc.

### Custom Templates
- Host selects roles in ConfigScreen
- Dynamic player count based on roles selected
- Template can be modified before game starts (in room settings)
- Changes take effect when host clicks "准备看牌"

### Dynamic Template Modification
Templates can be modified at runtime before game starts:
```typescript
const modifiedTemplate = createCustomTemplate(newRoleSelection);
await gameStateService.updateTemplate(modifiedTemplate);
```

## Audio System

### Audio Files (in `/assets/audio/`)
- `night.mp3` - Night begins
- `night_end.mp3` - Night ends
- `[role].mp3` - Role's turn begins (e.g., `wolf.mp3`, `seer.mp3`)

### Audio End Files (in `/assets/audio_end/`)
- `[role].mp3` - Role's turn ends (optional, for immersion)

### AudioService (Singleton)
```typescript
await audioService.playNightBeginAudio();        // night.mp3
await audioService.playRoleBeginningAudio(role); // [role].mp3
await audioService.playRoleEndingAudio(role);    // audio_end/[role].mp3
await audioService.playNightEndAudio();          // night_end.mp3
```

## "查看昨晚信息" (Last Night Info)

Shows ONLY death announcements:
- "昨天晚上是平安夜。" (No deaths)
- "昨天晚上 X号 玩家死亡。" (Deaths)

Does NOT reveal:
- Who did what
- Who was saved
- Who was protected

Calculated by `getLastNightInfo()` in `GameStateService.ts`.

---

## Design Patterns

### State Pattern
Room status manages game state transitions:
```typescript
enum GameStatus {
  unseated = 'unseated',
  seated = 'seated',
  assigned = 'assigned',
  ready = 'ready',
  ongoing = 'ongoing',
  ended = 'ended',
}
```

### Strategy Pattern
Each role encapsulates its own action logic:
```typescript
const role = ROLE_MODELS[roleId];
const dialogConfig = role.getActionDialogConfig(context);
const result = role.validateAction(target, context);
```

### Factory Pattern
Role registry for getting role instances:
```typescript
const role = getRoleModel('seer'); // Returns SeerRole instance
```

### Builder Pattern (Templates)
Templates are built dynamically from role selections:
```typescript
const template = createCustomTemplate(selectedRoles);
// Template includes: roles, numberOfPlayers, actionOrder
```

### Singleton Pattern
Services are accessed via `getInstance()`:
```typescript
const audioService = AudioService.getInstance();
const gameStateService = GameStateService.getInstance();
const broadcastService = BroadcastService.getInstance();
```

---

## Technical Constraints

### 11. No Hardcoding
- **Never hardcode** any roles, templates, or audio paths
- All configurable items must be **extensible** through registries or configuration files
- Role-specific rules belong in role model definitions
- UI strings should be derived from data or centralized constants

### 12. Preserve UI/Layout
- **Keep existing UI, Layout, and user interaction logic intact**
- Do not modify interface appearance to implement features
- Refactor only internal logic, not visual presentation
- User experience must remain consistent

### 13. Minimal Feature Addition
- Code can be **refactored structurally** and use design patterns
- Do **NOT add unnecessary features**
- Only implement what is required to make code functional
- Remove dead code and unused functionality

### 14. Use Appropriate Design Patterns
- **State Pattern**: Manage night phases and flow sequence
- **Strategy Pattern**: Manage different role action logic
- **Factory/Builder Pattern**: Manage templates/scenarios with dynamic modification support
- **Singleton Pattern**: Services accessed via `getInstance()`

### 15. React Native / TypeScript Best Practices
- **Type Safety**: Use TypeScript types/interfaces everywhere
- **Component Separation**: Modular, focused components
- **Clear State Management**: React Context or hooks (avoid prop drilling)
- **Minimize Side Effects**: Easy to maintain and extend
- **No `any` types**: Unless absolutely necessary

---

## Development Guidelines

1. **Keep components small and focused**
2. **Use TypeScript strictly** - no `any` unless absolutely necessary
3. **Services should be accessed via `getInstance()`**
4. **Use custom hooks for shared logic**
5. **Keep screens thin** - delegate to hooks and services
6. **Host is authority** - all game state changes happen on Host, then broadcast
7. **Role definitions only in `roles/`** - never hardcode elsewhere
8. **Avoid hardcoding**: Use constants, configurations, or model properties
9. **Preserve UI/Layout** - only refactor logic, not appearance
10. **Delete unnecessary functionality** - keep codebase clean

## Anti-Patterns to Avoid

### ❌ Don't Hardcode
- Role names or actions in UI code
- Player counts or seat numbers
- Audio file paths (use registry)

### ❌ Don't Store Game Results in Backend
- Night actions are temporary (cleared on restart)
- Death calculations are client-side only
- No persistent game history

### ❌ Don't Modify Tests First
When tests fail, prioritize fixing application logic over modifying tests.

### ❌ Don't Add Unnecessary Features
- Only implement what's required for functionality
- No speculative features "just in case"
- Remove unused code

### ❌ Don't Change UI for Logic
- Keep visual design intact
- Refactor internal logic only
- User interaction patterns must stay the same

---

## Extensibility

### Adding New Roles

1. Create `src/models/roles/NewRole.ts`:
```typescript
import { GodBaseRole } from './GodBaseRole';

export class NewRole extends GodBaseRole {
  readonly id = 'newRole';
  readonly displayName = '新角色';
  readonly description = '角色描述';
  readonly hasNightAction = true;
  readonly actionOrder = 15;
  readonly actionMessage = '请选择目标';
  readonly actionConfirmMessage = '选择';
}

export const newRole = new NewRole();
```

2. Register in `roles/index.ts`:
```typescript
import { newRole } from './NewRole';
// Add to ROLE_MODELS
// Add to RoleName type
// Add to ACTION_ORDER if has night action
```

3. Add audio files (if any):
   - `assets/audio/new_role.mp3`
   - `assets/audio_end/new_role.mp3`

4. Register audio in `AudioService.ts` audio registry

### Adding New Templates

Add to `PRESET_TEMPLATES` in `Template.ts`:
```typescript
{
  name: '新模板名称',
  roles: ['villager', 'wolf', 'seer', ...],
}
```

---

## Debugging Guidelines

**CRITICAL: When tests fail, prioritize fixing application logic over modifying tests.**

1. **Logic First**: When E2E tests fail, first analyze if the application logic has bugs
2. **Root Cause**: Look for race conditions, async issues, or state management problems
3. **Test Changes Last**: Only modify test code if the application logic is confirmed correct
4. **Common Issues**:
   - Broadcast messages can be delivered out-of-order
   - Async operations without proper await can cause timing issues
   - State not being properly reset between game rounds

## Running the Project

```bash
npm start       # Start Expo dev server
npm run ios     # Run on iOS simulator
npm run android # Run on Android emulator
npm run web     # Run in web browser
```

## Running E2E Tests (Playwright)

**IMPORTANT**: E2E tests require the Expo web server running on port 8081.

### Step 1: Check if server is already running
```bash
lsof -i :8081 | head -3
```

### Step 2: Start Expo server (if not running)
```bash
nohup npx expo start --web --port 8081 > /tmp/expo.log 2>&1 &
sleep 5
lsof -i :8081 | head -3
```

### Step 3: Run Playwright tests
```bash
npx playwright test template-scenarios --reporter=line 2>&1 | tee /tmp/test.log
```

**IMPORTANT: Do NOT use `head` or `tail` to truncate test output!**

---

## Summary of Key Constraints

1. ✅ **First Night Only** - No multi-night loops
2. ✅ **Host Plays Audio** - Sequential role-by-role
3. ✅ **Client-Side Calculations** - Death/save logic not stored in DB
4. ✅ **Death Announcements Only** - "昨晚信息" shows deaths, not actions
5. ✅ **Dynamic Templates** - Host can modify before game starts
6. ✅ **Anonymous + Email Auth** - Both supported
7. ✅ **No Hardcoding** - All roles, templates, audio configurable
8. ✅ **Preserve UI/Layout** - Only refactor logic, not appearance
9. ✅ **Extensible** - Easy to add new roles and templates
10. ✅ **Design Patterns** - State, Strategy, Factory, Builder, Singleton
11. ✅ **TypeScript Best Practices** - Type safety, modularity
12. ✅ **Minimal Features** - No unnecessary additions
