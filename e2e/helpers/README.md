# E2E Helpers

Layered test helpers for Playwright E2E tests.

## Configuration

### E2E_BASE_URL — Single Source of Truth

| Layer | Role |
|-------|------|
| `playwright.config.ts` | **DEFINES** `E2E_BASE_URL` (default: `http://localhost:8081`), exports to `process.env` |
| `scripts/run-e2e-web.mjs` | **READS** from `process.env.E2E_BASE_URL` (fail-fast if not set) |
| `e2e/helpers/ui.ts` | **READS** from `process.env.E2E_BASE_URL` (fail-fast if not set) |

**Rule: NEVER hardcode `http://localhost:8081` in E2E code. Only `playwright.config.ts` may have a default.**

### Running E2E Tests

| Command | Supabase | Web Server | Use Case |
|---------|----------|------------|----------|
| `npm run e2e:core` | Local (`127.0.0.1:54321`) | Local (`:8081`) | Default dev |
| `npm run e2e:remote` | Remote (from `e2e.remote.json`) | Local (`:8081`) | Test with production Supabase |
| `E2E_BASE_URL=https://... npm run e2e:remote` | Remote | Remote URL | CI / staging |

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `E2E_ENV` | Supabase config: `local` or `remote` | `local` |
| `E2E_BASE_URL` | Web server URL for tests | `http://localhost:8081` |

---

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

**TRUE MITIGATION:** Before each navigation attempt, probes server readiness using 
Playwright's `page.request.get()` (same network stack as `page.goto()`).

**Probe target:** `/favicon.ico` (static asset, fast response)  
> TODO: Replace with `/health` endpoint when app provides one.

| | |
|-|-|
| **Success condition** | Page navigates successfully (DOMContentLoaded) |
| **Probe timeout** | 10s (Expo cold start can be slow) |
| **Retry strategy** | Exponential backoff: 2s → 4s → 8s → 16s (capped) |
| **Timeout behavior** | Throws after maxRetries with grep-friendly signature |

**Evidence on failure (grep-friendly categories):**
- `REFUSED`: Connection refused - server not listening
- `TIMEOUT`: Server slow to respond (cold start/compile)  
- `DNS`: DNS resolution failed
- `UNKNOWN`: Other network error
- Screenshot: `test-results/fail-goto-refused-*.png`
- Final error: `ERR_CONNECTION_REFUSED: Failed to navigate to... [probe: <category>]`

**When to use:** Always use `gotoWithRetry` instead of `page.goto` in specs.

**Grep gate:** No spec should contain direct `page.goto(` calls.

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

## Connection Refused Handling (ERR_CONNECTION_REFUSED)

**Failure Signature:** `ERR_CONNECTION_REFUSED: Failed to navigate to...`

**Root Cause:** Dev server (localhost:8081) not ready or crashed.

### Mitigation (IMPLEMENTED)

1. **HTTP health check in gotoWithRetry:**
   - Before each navigation, `isServerReady(baseURL)` makes an HTTP GET request
   - Only attempts `page.goto()` when server actually responds (not just port-reachable)
   - 5 retries with 2s delay = up to ~10s of server wait

2. **Playwright webServer config:**
   - `webServer.url` check waits for server to be accessible
   - `webServer.timeout: 120000` — wait up to 2min for server start
   - `stdout: 'pipe'` — capture server output for debugging

3. **Evidence on failure:**
   - Attempt number, URL, baseURL, error logged
   - Screenshot saved to `test-results/fail-goto-refused-*.png`
   - Diagnostic hints printed

**Status:** ✅ MITIGATED at code level. Server availability is verified via HTTP before navigation.

---

## HTTP 409 Conflict Handling (Room Creation)

**Failure Signature:** `Failed to create room: duplicate key value violates unique constraint`

**Root Cause:** Race condition between `generateRoomNumber()` check and `createRoom()` insert.
If another client creates a room with the same 4-digit code in between, Supabase returns 409.

### Mitigation (IMPLEMENTED in SimplifiedRoomService)

1. **createRoom() retry logic:**
   - On 409/duplicate error: generate new room number and retry
   - Up to 3 attempts (configurable via `maxRetries`)
   - Logs each retry attempt with error details

2. **Detection patterns:**
   - PostgreSQL error code `23505` (unique_violation)
   - Error message contains "duplicate", "conflict", or "already exists"

**Status:** ✅ MITIGATED at app level. Room creation retries with new code on conflict.

---

## Flake Reporting Rules

Per `.github/copilot-instructions.md`:

> "Re-run and it passed" is NOT evidence. If a test fails during validation:
> - Record the exact failure signature (error type/message)
> - State whether it's mitigated by code in this PR (and where)
> - Or explicitly mark as "unmitigated external flake"

**Known mitigated flakes:**
- `ERR_CONNECTION_REFUSED` → `gotoWithRetry()` with HTTP health check
- `HTTP 409 room conflict` → `createRoom()` retry logic in SimplifiedRoomService
