# E2E Helpers

Layered test helpers for Playwright E2E tests.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Spec Files (basic.spec.ts, night1.spec.ts, etc.)           │
│    ↓ import                                                 │
├─────────────────────────────────────────────────────────────┤
│  Domain Helpers                                             │
│  ├── home.ts   → Home screen / login / room create-join    │
│  └── waits.ts  → Room screen readiness / sync              │
│    ↓ import                                                 │
├─────────────────────────────────────────────────────────────┤
│  Generic Primitives                                         │
│  └── ui.ts     → Visibility, click, retry, evidence        │
└─────────────────────────────────────────────────────────────┘
```

**Rules:**
- `ui.ts` has **zero app-specific logic** — pure Playwright utilities
- `home.ts` and `waits.ts` import from `ui.ts`, never the reverse
- Specs import from domain helpers; avoid reaching into `ui.ts` unless needed

---

## ui.ts — Generic Primitives

Low-level utilities with no app-specific knowledge.

| Function | Purpose |
|----------|---------|
| `gotoWithRetry(page, url, opts)` | Navigate with auto-retry on ERR_CONNECTION_REFUSED |
| `getVisibleText(page, text)` | Locate visible text element (filters aria-hidden screens) |
| `waitForAnyVisible(page, targets, opts)` | Poll until any target is visible; returns winner index |
| `waitForAllVisible(page, targets, opts)` | Wait for all targets to be visible |
| `clickIfVisible(page, target, opts)` | Click if visible, return false otherwise (no throw) |
| `waitForTextGone(page, text, opts)` | Wait for text to disappear |
| `retry(fn, opts)` | Retry with exponential backoff |
| `screenshotOnFail(page, label)` | Save screenshot; never throws |
| `debugProbe(page, label)` | Log page state for debugging |
| `withStep(name, page, fn, timeoutMs)` | Wrap step with timeout + evidence on failure |

### `gotoWithRetry(page, url?, opts?)`

**Purpose:** Navigate to URL with automatic retry on connection errors.

| | |
|-|-|
| **Success condition** | Page navigates successfully (DOMContentLoaded) |
| **Recovery actions** | On `ERR_CONNECTION_REFUSED`: wait `retryDelayMs` (default 2s), retry up to `maxRetries` (default 3) |
| **Timeout behavior** | Throws after maxRetries; saves screenshot + diagnostic info |
| **Evidence on failure** | Screenshot saved to `test-results/fail-connection-refused-*.png` + console guidance |

**When to use:** Always prefer `gotoWithRetry` over `page.goto` in specs to handle slow server starts.

---

## home.ts — Home/Login/Room Entry

Handles app entry stabilization: hydration, login, home screen readiness.

### `waitForAppReady(page, timeoutMs?)`

**Purpose:** Wait for React Native Web hydration.

| | |
|-|-|
| **Success condition** | `text=狼人杀法官` visible |
| **Recovery actions** | None (passive wait) |
| **Timeout behavior** | Throws after `timeoutMs` (default 15s) |

---

### `ensureHomeReady(page, opts?)`

**Purpose:** Reach stable home screen where "创建房间" / "进入房间" are clickable.

| | |
|-|-|
| **Success condition** | Home buttons visible + NO blocking modals + NO transient states |
| **Recovery actions** | 1. Handle error dialogs (click 重试/确定) <br> 2. Wait out transient states (创建中/加载中) <br> 3. Dismiss blocking modals (取消/确定/关闭) |
| **Timeout behavior** | Throws after `maxRetries` (default 5) or `timeoutMs` (default 30s); saves screenshot |

**Blocking modals:** `需要登录`, `请先登录`, `👤 匿名登录`, `登录失败`, `加载超时`, `提示`

**Transient states:** `创建中`, `加载中`, `连接中`

---

### `ensureAnonLogin(page)`

**Purpose:** Complete anonymous login if not logged in, then return to stable home.

| | |
|-|-|
| **Success condition** | `匿名用户` visible AND home stable |
| **Recovery actions** | 1. If `匿名用户` visible → skip <br> 2. If `点击登录` visible → click → complete login → ensureHomeReady <br> 3. Fallback: click `创建房间` to trigger login dialog |
| **Timeout behavior** | Inherits from sub-calls (waitForAppReady, ensureHomeReady) |

**Important:** Does NOT click `创建房间` as primary trigger — that would start room creation after login.

---

### `createRoom(page): Promise<string>`

**Purpose:** Create a new room from home screen.

| | |
|-|-|
| **Precondition** | Logged in, on home screen |
| **Success condition** | Room screen visible with "房间 XXXX" header |
| **Recovery actions** | Delegates to `waitForRoomScreenReady(role='host')` |
| **Returns** | 4-digit room code |
| **Timeout behavior** | Inherits from waitForRoomScreenReady |

---

### `joinRoom(page, roomCode)`

**Purpose:** Join an existing room by code.

| | |
|-|-|
| **Precondition** | Logged in, on home screen |
| **Success condition** | Room screen visible + joiner is live (🟢 已连接) |
| **Recovery actions** | Delegates to `waitForRoomScreenReady(role='joiner')` which handles 强制同步 loop |
| **Timeout behavior** | Inherits from waitForRoomScreenReady |

---

### Other exports

| Function | Purpose |
|----------|---------|
| `getCurrentRoomCode(page)` | Returns room code if on room screen, null otherwise |
| `ensureInRoomOrHomeReady(page)` | Returns room code if in room, otherwise ensures home ready |
| `extractRoomNumber(page)` | Extract room code from header (throws if not on room screen) |

---

## waits.ts — Room Screen Readiness

Specialized waits for RoomScreen after creation or joining.

### `waitForRoomScreenReady(page, opts?)`

**Purpose:** Wait for RoomScreen to be fully ready.

| | |
|-|-|
| **Options** | `role`: 'host' \| 'joiner' <br> `maxRetries`: number (default 3) <br> `liveTimeoutMs`: number (default 20s) |
| **Success condition (host)** | Room header "房间 XXXX" visible |
| **Success condition (joiner)** | Room header visible + "🟢 已连接" status |
| **Recovery actions (host)** | Click 重试 if room load times out |
| **Recovery actions (joiner)** | 1. Click 重试 for room load <br> 2. Click 强制同步 if 🔴 连接断开 <br> 3. Poll until 🟢 已连接 |
| **Timeout behavior** | Throws after maxRetries (room) or liveTimeoutMs (joiner sync) |

---

## Connection Refused Handling

When `net::ERR_CONNECTION_REFUSED` occurs:

1. **Root cause:** Dev server (localhost:8081) not ready or crashed
2. **Playwright mitigation:**
   - `webServer.timeout: 120000` — wait up to 2min for server start
   - `webServer.reuseExistingServer: true` — use pre-started server if available
   - `stdout: 'pipe'` — capture server output for debugging
3. **Spec-level mitigation:**
   - `waitForAppReady()` waits for hydration before any action
   - `retry()` wrapper available for flaky network operations
4. **CI mitigation:**
   - `retries: 2` on CI — auto-retry failed tests
   - `trace: 'on-first-retry'` — collect trace for debugging

**If connection refused persists:**
- Check terminal output for server crash logs
- Verify port 8081 is not occupied: `lsof -i :8081`
- Manually start server: `npx expo start --web --port 8081`
