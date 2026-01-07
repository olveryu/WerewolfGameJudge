# Werewolf Game Judge - React Native

## Project Overview

A React Native/Expo app for moderating Werewolf (狼人杀) party games with:
- Supabase backend (authentication and real-time database)
- Audio announcements for night phases
- 20+ game roles support

## Architecture

This project uses a modular architecture:

- **models/**: Pure TypeScript interfaces (Player, Room, Template)
- **services/**: Singleton services for Supabase, Auth, Audio, Storage
- **hooks/**: Custom React hooks for state management
- **components/**: Reusable UI components
- **screens/**: Full-screen views
- **navigation/**: React Navigation configuration
- **constants/**: App constants and role definitions

## Critical Architecture Principle: RPC-Only State Changes

**IMPORTANT: The client should NEVER store or calculate game state locally. All state changes MUST go through Supabase RPC functions.**

This prevents race conditions in multiplayer scenarios where multiple clients may try to update state simultaneously.

### State Management Rules:
1. **Client is Read-Only**: Client only reads state from Supabase real-time subscriptions
2. **RPC for All Writes**: All state changes must use atomic RPC functions with `FOR UPDATE` row locks
3. **Business Logic in Client**: Role definitions, action order, wolf identification - all in `roles.ts`
4. **Database is "Dumb"**: RPC functions don't know business rules, client passes necessary data
5. **Idempotent Operations**: RPC functions should handle duplicate calls gracefully

### Available RPC Functions (V2 Architecture):
All functions take `p_room_number` and use `FOR UPDATE` row locks for atomic operations.

- `atomic_field_update(p_room_number, p_path, p_value)` - Atomically update any JSONB field by path (e.g., `players.0.status`)
- `remove_field_key(p_room_number, p_path)` - Remove a key from JSONB field (e.g., for clearing wolf votes)
- `update_room_status(p_room_number, p_status)` - Update room status field
- `update_room_scalar(p_room_number, p_field, p_value)` - Update scalar fields (action_index, audio_playing, has_poison, has_antidote, etc.)
- `advance_action_index(p_room_number)` - Atomically increment action_index
- `batch_update_players(p_room_number, p_players)` - Batch update multiple player fields
- `update_roles_array(p_room_number, p_roles)` - Update the entire roles array

## Development Guidelines

1. Keep components small and focused
2. Use TypeScript strictly
3. Services should be accessed via getInstance()
4. Use custom hooks for shared logic
5. Keep screens thin - delegate to hooks and services
6. **Always use RPC functions for state changes - never update Supabase directly**
7. **Role definitions only in `roles.ts` - never hardcode in database**
8. **Avoid hardcoding**: Use constants, configurations, or model properties instead of hardcoded values
   - Role-specific rules (e.g., `canSaveSelf: false` for witch) should be in role definitions
   - UI strings should be centralized or derived from data
   - Magic numbers should be named constants

## Design Patterns & Best Practices

### Use Inheritance to Reduce Duplication
When multiple classes share common properties, use inheritance:

```
BaseRole (abstract)
├── WolfBaseRole (abstract) - Common wolf properties
│   ├── WolfRole, WolfQueenRole, NightmareRole...
│   └── Default: participatesInWolfVote=true, canSeeWolves=true
├── GodBaseRole (abstract) - Common god properties  
│   ├── SeerRole, WitchRole, HunterRole...
│   └── Default: faction='god'
└── VillagerRole, SlackerRole - Direct inheritance
```

Benefits:
- **DRY Principle**: Common properties defined once in base class
- **Override Only Exceptions**: Subclasses only override when different from default
- **Type Safety**: Base class guarantees faction type

### Singleton Pattern for Services
Services like `RoomService`, `AudioService` should use singleton pattern:
```typescript
class MyService {
  private static instance: MyService;
  static getInstance(): MyService {
    if (!MyService.instance) {
      MyService.instance = new MyService();
    }
    return MyService.instance;
  }
}
```

### Strategy Pattern for Role Actions
Each role encapsulates its own action logic:
- `getActionDialog()`: Returns dialog configuration
- `validateAction()`: Validates if action is allowed
- `canSaveSelf`, `immuneToPoison`: Role-specific rules as properties

### Factory Pattern for Role Registry
Use a registry to get role instances by ID:
```typescript
const role = ROLE_MODELS[roleId]; // or getRoleModel(roleId)
```

## Role Models Architecture

Each role has its own model class in `/src/models/roles/`:
- `id`: Role identifier
- `name`: Display name
- `faction`: Team (wolf/villager/god)
- `actionOrder`: Priority in night phase
- `canSaveSelf`: Whether the role can save itself (e.g., witch = false)
- `getActionDialog()`: Dialog configuration for this role
- `validateAction()`: Action validation logic
- `executeAction()`: Action execution logic

This design ensures:
- **Single Responsibility**: Each role's logic in one file
- **Easy Extension**: Add new roles by creating new files
- **Easy Testing**: Test each role independently
- **Configuration-Driven**: Rules become config, not hardcoded logic

## Debugging Guidelines

**CRITICAL: When tests fail, prioritize fixing application logic over modifying tests.**

1. **Logic First**: When E2E tests fail, first analyze if the application logic has bugs
2. **Root Cause**: Look for race conditions, async issues, or state management problems in the app code
3. **Test Changes Last**: Only modify test code if the application logic is confirmed correct
4. **Common Issues**:
   - Supabase real-time subscriptions can deliver updates out-of-order
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
# Use nohup to avoid "tty output" suspension issue
nohup npx expo start --web --port 8081 > /tmp/expo.log 2>&1 &

# Wait for server to start
sleep 5

# Verify server is running
lsof -i :8081 | head -3
```

**If you see `suspended (tty output)` error:**
```
[1]  + 58041 suspended (tty output)  npx expo start --web --port 8081
```
This means the Expo process was suspended because it tried to write to terminal. Solution:
```bash
# Kill the suspended process
pkill -f "expo start"

# Start with nohup to redirect output to file
nohup npx expo start --web --port 8081 > /tmp/expo.log 2>&1 &
```

### Step 3: Run Playwright tests
```bash
npx playwright test template-scenarios --reporter=line 2>&1 | tee /tmp/test.log
```

**IMPORTANT: Do NOT use `head` or `tail` to truncate test output!** Always show the full output so all logs are visible for debugging.

### Debugging
```bash
# Run headed mode for visual debugging
npx playwright test template-scenarios --reporter=line --headed

# Check Expo server logs
tail -100 /tmp/expo.log
```

**Do NOT use these approaches** (they will fail):
- `npm run test:e2e` - Doesn't ensure server is running
- Running `npx expo start --web --port 8081` directly without nohup (causes tty suspension)
- Running tests without checking if port 8081 is active
- Using `head` or `tail` on test output (hides important logs)
