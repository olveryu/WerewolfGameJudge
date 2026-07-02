# Network Resilience Design

> Goal: Solve frequent login failures, action failures, and disconnections for China-based users.
> Root cause: China → Cloudflare international link has high packet loss (5–15%), existing HTTP layer has zero network retry.

---

## 1. Current State Analysis

### 1.1 Current Architecture

```
┌──────────────────────────┐     ┌──────────────────────────────┐
│  cfFetch (cfPost/cfGet)  │     │  apiUtils (callApiOnce)      │
│  - JWT 注入              │     │  - x-request-id 注入         │
│  - withTimeout 超时       │     │  - AbortController+setTimeout │
│  - JSON 解析             │     │  - JSON 解析（重复）           │
│  - 零重试                │     │  - optimistic update/rollback │
│  消费者: 24 处            │     │  - 无 JWT（游戏端点无 auth）   │
└──────────────────────────┘     │  - 零网络重试                 │
                                 │  消费者: 25 game/seat actions │
                                 └──────────────────────────────┘

> **Current timeout mechanism issue**: `cfPost` 用 `withTimeout`（内部 `Promise.race`），超时后 fetch 仍在后台跑（ghost request）。
> `callApiOnce` 用手动 `AbortController + setTimeout`，超时后取消请求。
> `AIChatService` 已用 `AbortSignal.timeout(30_000)`（社区标准）。本次改造统一到 `AbortSignal.timeout()`。
┌──────────────────────────┐
│  直接 fetch()            │
│  - CFStorageService      │
│  - AIChatService (stream)│
│  消费者: 2 处             │
└──────────────────────────┘
```

### 1.2 Current Retry Status

| Location                       | What Is Retried                 | Strategy        | Issue                                                 |
| ------------------------------ | ------------------------------- | --------------- | ----------------------------------------------------- |
| `cfFetch` (cfPost/cfGet/cfPut) | None                            | Zero retry      | All 24 call sites have zero retry                     |
| `callApiWithRetry`             | CONFLICT_RETRY / INTERNAL_ERROR | 2×              | **Skips** NETWORK_ERROR / TIMEOUT / SERVER_ERROR      |
| `CFAuthService.initAuth`       | Network/timeout                 | 2× exp backoff  | Manual implementation, inconsistent with other places |
| `CFRoomService.createRoom`     | 409 conflict                    | 5×              | Business retry only, no network retry                 |
| WebSocket (ConnectionFSM)      | Disconnection                   | 15× exp backoff | ✅ Already complete                                   |

### 1.3 Complete HTTP Call Inventory

**Via cfPost/cfGet/cfPut (24 call sites):**

| Service           | Method            | Endpoint                     | Network Retry |
| ----------------- | ----------------- | ---------------------------- | ------------- |
| CFAuthService     | signInAnonymously | POST /auth/anonymous         | ❌            |
| CFAuthService     | signUpWithEmail   | POST /auth/signup            | ❌            |
| CFAuthService     | signInWithEmail   | POST /auth/signin            | ❌            |
| CFAuthService     | signOut           | POST /auth/signout           | ❌            |
| CFAuthService     | forgotPassword    | POST /auth/forgot-password   | ❌            |
| CFAuthService     | resetPassword     | POST /auth/reset-password    | ❌            |
| CFAuthService     | signInWithWechat  | POST /auth/wechat            | ❌            |
| CFAuthService     | bindWechat        | POST /auth/bind-wechat       | ❌            |
| CFAuthService     | getCurrentUser    | GET /auth/user               | ❌            |
| CFAuthService     | initAuth          | GET /auth/user               | ⚠️ Manual 2×  |
| CFAuthService     | updateProfile     | PUT /auth/profile            | ❌            |
| CFAuthService     | changePassword    | PUT /auth/password           | ❌            |
| CFRoomService     | createRoom        | POST /room/create            | ⚠️ 409 only   |
| CFRoomService     | getRoom           | POST /room/get               | ❌            |
| CFRoomService     | deleteRoom        | POST /room/delete            | ❌            |
| CFRoomService     | getStateRevision  | POST /room/revision          | ❌            |
| CFRoomService     | getGameState      | POST /room/state             | ❌            |
| GachaService      | fetchGachaStatus  | GET /api/gacha/status        | ❌            |
| GachaService      | performDraw       | POST /api/gacha/draw         | ❌            |
| GachaService      | claimDailyReward  | POST /api/gacha/daily-reward | ❌            |
| StatsService      | fetchUserStats    | GET /api/user/stats          | ❌            |
| StatsService      | fetchUserProfile  | GET /api/user/:id/profile    | ❌            |
| StatsService      | fetchUserUnlocks  | GET /api/user/unlocked-items | ❌            |
| ShareImageService | uploadShareImage  | POST /share/image            | ❌            |

**Via callApiWithRetry (25 game/seat actions):**
assignRoles, updateTemplate, setRoleRevealAnimation, restartGame, clearAllSeats,
startNight, submitAction, markViewedRole, clearRevealAcks,
submitGroupConfirmAck, setWolfRobotHunterStatusViewed, setAudioPlaying, postAudioAck, postProgression,
shareNightReview, boardNominate, boardUpvote, boardWithdraw,
fillWithBots, markAllBotsViewed, markAllBotsGroupConfirmed, updatePlayerProfile,
takeSeat, leaveSeat, kickPlayer

> **Note**: Game endpoints (`/game/*`) do not use `requireAuth` middleware; `callApiOnce` intentionally does not inject JWT.
> This differs from cfPost (which auto-injects Bearer token) auth model.

**Direct fetch() (3 call sites):**

- `apiUtils.ts` callApiOnce — Game/seat actions (independent fetch implementation, not via cfFetch, no JWT, uses AbortController timeout)
- `CFStorageService.uploadAvatar` — multipart/form-data
- `AIChatService.streamChat` — SSE streaming (AbortSignal.timeout(30s), should not retry)

### 1.4 Current UI Feedback Status

| Scenario      | Loading                             | Failure Notification | Manual Retry                                                           |
| ------------- | ----------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| Login         | Button "处理中" + disabled          | Alert dialog         | Home banner → refresh page                                             |
| Create room   | "创建中" + spinner                  | handleError → Alert  | None                                                                   |
| Join room     | Modal loading                       | Inline error text    | User re-clicks button                                                  |
| Game action   | None (fire-and-forget + optimistic) | Toast / Alert        | None                                                                   |
| WS disconnect | "正在重连" progress bar             | Auto-reconnect       | Failed state shows same UI as Disconnected, no manual reconnect button |
| Gacha/stats   | TanStack isLoading                  | TanStack built-in    | TanStack auto-retry                                                    |
| Avatar upload | spinner                             | Alert                | None                                                                   |
| AI chat       | spinner                             | Inline error         | None                                                                   |

### 1.5 Current TanStack Query Usage

Project has `@tanstack/react-query@5.99.0` installed, `QueryClientProvider` is configured in App.tsx.

**Already using TanStack Query (7 hooks + 4 queryOptions factories):**

- `useQuery`: 4 query hooks — userStats and gachaStatus via `useAuthenticatedQuery` (with auth guard), userProfile and userUnlocks via direct `useQuery`
- `useMutation`: drawGacha, claimDailyReward (2 mutation hooks)
- `queryOptions` factories: queryOptions.ts has 4 option factories (not hooks, consumed by useQuery)
- `QueryClient` config: `retry: 1`, `staleTime: 2min`

**Not yet using TanStack Query (57 call sites):**

- AuthContext 11 async methods (manual useState loading/error)
- Room operations 5 methods (manual useState + handleError)
- Game actions 25 (callApiWithRetry + handleMutationResult)
- Settings operations ~5 (AuthContext + showErrorAlert)
- Others ~12 (various manual patterns)

---

## 2. Target Architecture

### 2.1 Layered Design

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Screen / Component                                │
│  消费 useMutation / useQuery 的 isPending / isError 状态     │
│  职责: 纯 UI 渲染                                           │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Custom Hooks (useAuthMutations, useRoomMutations) │
│  封装 useMutation + 业务 onSuccess/onError                   │
│  职责: 声明 mutationFn, retry, 业务级回调                     │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Service Classes (CFAuthService, CFRoomService)    │
│  纯异步函数: 调 cfFetch → 返回数据 / 抛异常                   │
│  职责: HTTP 调用封装, 不含 UI 逻辑                            │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: cfFetch (网络传输层)                               │
│  fetch + 网络层自动重试 + 超时 + JWT 注入 + JSON 解析         │
│  职责: 唯一 HTTP 客户端, 处理网络层瞬态错误                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Retry Strategy

**Two-layer retry, each with its own scope:**

| Layer                    | What Is Retried                                              | Condition                                    | Count                 | Backoff                              |
| ------------------------ | ------------------------------------------------------------ | -------------------------------------------- | --------------------- | ------------------------------------ |
| **Layer 1: cfFetch**     | `fetch()` throws (DNS failure/TCP RST/TLS handshake failure) | Request **most likely** did not reach server | 2×                    | 1s, 2s exponential backoff           |
| **Layer 3: useMutation** | HTTP 5xx status / custom reason (CONFLICT_RETRY etc.)        | Request **reached** server but failed        | Per-mutation decision | TanStack default exponential backoff |

**Why two layers:**

- Layer 1 retry is **safe in most cases** (`fetch()` throwing usually = request did not reach server)
- Layer 3 retry requires business logic judgment (should 409 conflict retry with new code? 401 should not retry? Only business layer knows)

> **⚠️ `fetch()` exception ≠ 100% request did not arrive**
>
> In rare edge cases (TCP RST after request sent, TLS alert after handshake complete, proxy interruption),
> `fetch()` throws TypeError but the server has already received and processed the request. For **idempotent operations** (the vast majority) this is fine;
> for **non-idempotent operations** (e.g. gacha draw) extra protection is needed. See §3.14.

**Cases that are not retried:**

- HTTP 4xx (401/403/404/422) — client error, retry is pointless
- `AIChatService.streamChat` — SSE streaming, not suitable for retry
- User-initiated cancellation (AbortError)

### 2.3 Timeout Strategy

| Config Item      | Current | New Value           | Reason                                                                                                  |
| ---------------- | ------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| `API_TIMEOUT_MS` | 8000ms  | **12000ms**         | China → CF first TLS handshake can take 3-5s                                                            |
| cfFetch budget   | None    | **No total budget** | cfFetch retry 2× × 12s = worst 36s, but fetch exceptions are known within 1-3s, only timeout waits full |
| WeChat auth      | 15000ms | **20000ms**         | Cross-border Worker → api.weixin.qq.com                                                                 |
| `waitForInit`    | 20000ms | **25000ms**         | Must be > WeChat timeout                                                                                |

> **Worst-case wait time**:
>
> | Scenario                       | cfFetch (Layer 1) | Business (Layer 2/3) | Total                      |
> | ------------------------------ | ----------------- | -------------------- | -------------------------- |
> | Auth mutation (retry:2)        | 3×12s = 36s       | 3×36s = 108s         | **Capped by total budget** |
> | Game action (callApiWithRetry) | 3×12s = 36s       | 3×36s = 108s         | **30s total budget cap**   |
>
> Without a total budget, worst-case wait is 108s. `callApiWithRetry` has a 30s total budget; `useMutation` relies on TanStack built-in `retryDelay` to control pacing (cfFetch internal timeout in each layer provides the cap).
>
> In practice 99% of cases: fetch exceptions are known within 1-3s (DNS/TCP failures are fast), only timeouts wait the full 12s.

---

## 3. Detailed Changes

### 3.1 Layer 1: cfFetch — Network Layer Retry

**File**: `src/services/cloudflare/cfFetch.ts`

**Changes**: Extract `fetchWithRetry` internal function, wrapping all `fetch()` calls.

**Also unifying timeout mechanism**: Migrate `cfPost/cfGet/cfPut` from `withTimeout(Promise.race)` to `AbortSignal.timeout()`.

> **`AbortSignal.timeout()` is 2024 Baseline (2026 community standard)**: Chrome 124+, Safari 16+, Node 17.3+.
> `AIChatService` already uses this. This refactoring unifies all fetch calls.
> Benefits: After timeout **aborts request** (TCP connection closed), no ghost request;
> Composable with user cancellation: `AbortSignal.any([AbortSignal.timeout(ms), userSignal])`;
> Code size from ~15 lines (withTimeout wrapper) down to 1 line.

```typescript
// cfFetch.ts 内部
const FETCH_RETRY_COUNT = 2;
const FETCH_RETRY_BASE_MS = 1000;

/**
 * 网络层重试: 仅重试 fetch() 抛出的异常（请求未到达服务器）。
 * 不重试 HTTP 错误响应（4xx/5xx）— 那是服务端已收到请求。
 */
async function fetchWithRetry(input: RequestInfo, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      // signal 已 aborted（用户取消 AbortError 或超时 TimeoutError）→ 不重试
      if (init?.signal?.aborted) throw error;
      // 最后一次重试也失败 → 抛出
      if (attempt === FETCH_RETRY_COUNT) throw error;
      // 指数退避: 1s, 2s
      const delay = FETCH_RETRY_BASE_MS * 2 ** attempt;
      cfFetchLog.debug('fetch network error, retrying', {
        attempt: attempt + 1,
        delay,
        error: (error as Error).message,
      });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // TypeScript: unreachable, for 循环必定 return 或 throw
  throw new Error('fetchWithRetry: unreachable');
}
```

**cfPost/cfGet/cfPut**: All `fetch()` calls replaced with `fetchWithRetry()`, `withTimeout` replaced with `AbortSignal.timeout()`.

```typescript
// cfPost 改后示例（关键行）
const res = await fetchWithRetry(url, {
  ...init,
  signal: AbortSignal.timeout(options?.timeoutMs ?? API_TIMEOUT_MS),
});
```

> **Timeout semantics: total-operation timeout**
>
> `AbortSignal.timeout(12s)` is created once at the cfPost layer, passed into fetchWithRetry where all 3 attempts share the same countdown.
> First attempt fails fast (DNS/TCP ~1s) → delay 1s → second attempt has ~10s → normal.
> First attempt slow timeout (~11s) → delay 1s → second attempt only has ~0s → immediate TimeoutError.
> This is **intentional total-operation timeout semantics**: regardless of internal retry count, the externally promised maximum wait time stays constant.
> Document this behavior in fetchWithRetry JSDoc during implementation.

**cfPost**: New optional `extraHeaders` parameter for apiUtils to pass `x-request-id` / `x-region`.
**cfPost**: New optional `noRetry` parameter to disable network-layer retry (see §3.14).

**Impact scope**: All 24 call sites via cfPost/cfGet/cfPut automatically gain network retry + timeout cancellation. Zero business code changes.

After exporting `fetchWithRetry`, apiUtils.ts `callApiOnce` can also use it, covering 25 game/seat actions. Total 49 call sites gain network retry.

> **Deprecating withTimeout**: After this change `withTimeout` is only kept for non-fetch Promises (e.g. DO RPC timeout). All fetch calls use `AbortSignal.timeout()` uniformly.

### 3.1b Error Classification Utility Adaptation — errorUtils.ts

**File**: `src/utils/errorUtils.ts`

`AbortSignal.timeout()` throws `DOMException { name: 'TimeoutError' }` on timeout, not `AbortError`.
Existing `isAbortError()` and `isNetworkError()` do not match `TimeoutError`, causing §3.13 MutationCache onError to falsely report to Sentry.

**Changes**:

```typescript
// errorUtils.ts

/** AbortSignal.timeout() 抛 TimeoutError，用户取消抛 AbortError。两者都是“预期内终止”。 */
export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'AbortError' || err.name === 'TimeoutError';
  }
  if (err instanceof Error) return err.name === 'AbortError';
  if (err != null && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message).includes('AbortError');
  }
  return false;
}
```

`isNetworkError`'s `NETWORK_ERROR_PATTERNS` entry `'operation timed out after'` (matching withTimeout errors) is kept after the change (DO RPC timeout still uses withTimeout), no modification needed.

**Impact**: §3.13 MutationCache `isAbortError(error)` now also matches TimeoutError, preventing false Sentry reports.

### 3.2 Layer 1: cfFetch — cfPost Supports extraHeaders + noRetry

```typescript
export async function cfPost<T = Record<string, unknown>>(
  path: string,
  body?: Record<string, unknown>,
  options?: {
    timeoutMs?: number;
    extraHeaders?: Record<string, string>;
    noRetry?: boolean; // 禁用 fetchWithRetry，见 §3.14
  },
): Promise<T> {
  // ... 现有逻辑，headers 合并 extraHeaders
}
```

**Why**: `extraHeaders` provides call sites using cfPost (auth/room etc.) the ability to pass custom headers like `x-request-id`.
`noRetry` protects non-idempotent operations (see §3.14 for details).

### 3.3 Layer 2: apiUtils — callApiOnce Injects fetchWithRetry

**File**: `src/services/games/werewolf/apiUtils.ts`

**Before**: `callApiOnce` implements its own fetch + AbortController + JSON parsing, zero network retry.
**After**: **Keep independent fetch path** (not switching to cfPost), only replace `fetch()` with `fetchWithRetry()`.

**Reason for not using cfPost**:

- **Different auth model**: Game endpoints (`/game/*`) do not use `requireAuth` middleware; `callApiOnce` intentionally does not inject JWT. `cfPost` auto-injects Bearer token (though the server ignores it, it changes request semantics).

```typescript
import { fetchWithRetry } from '@/services/cloudflare/cfFetch';

async function callApiOnce(
  path: string,
  body: Record<string, unknown>,
  label: string,
  store?: WerewolfStore,
): Promise<ApiResponse> {
  try {
    const requestId = crypto.randomUUID?.() ?? `req_${Date.now()}`;

    // fetch() → fetchWithRetry()，统一用 AbortSignal.timeout() 超时
    const res = await fetchWithRetry(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-region': API_REGION,
        'x-request-id': requestId,
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      body: JSON.stringify(body),
    });

    // ... 现有 JSON 解析 / applySnapshot / rollback 逻辑不变
  } catch (e) {
    // ⚠️ catch 块需适配 AbortSignal.timeout() 的错误类型
    // AbortSignal.timeout() 超时抛 DOMException { name: 'TimeoutError' }（不是 'AbortError'）
    // 用户取消抛 DOMException { name: 'AbortError' }
    // 两者都应分类为 TIMEOUT
    const isDomAbort =
      e instanceof DOMException && (e.name === 'AbortError' || e.name === 'TimeoutError');
    if (isDomAbort) {
      facadeLog.warn('timeout', { label, path, timeoutMs: API_TIMEOUT_MS });
      if (store) store.rollbackOptimistic();
      return { success: false, reason: 'TIMEOUT' };
    }
    // ... 其余 catch 逻辑不变（TypeError → NETWORK_ERROR）
  }
}
```

**Change points**: 3 items —

1. `fetch()` → `fetchWithRetry()`
2. Manual `AbortController+setTimeout` → `AbortSignal.timeout()`
3. catch block: detect `TimeoutError` (DOMException thrown by AbortSignal.timeout) + existing `AbortError`

Keeps no-JWT and independent JSON parsing. Removes `setTimeout`/`clearTimeout`/`abortController` related code.
**Impact**: cfFetch.ts needs to export `fetchWithRetry`.

### 3.4 Layer 2: apiUtils — callApiWithRetry Supports Network Error Retry

**Before**: NETWORK_ERROR / TIMEOUT / SERVER_ERROR returned directly, no retry.
**After**: Retry NETWORK_ERROR and SERVER_ERROR (fetch exception / non-JSON response = request was not properly processed).
**Do not retry TIMEOUT** (AbortController timeout = request may have reached server and executed, just response not returned, retry is unsafe).

Add **30s total budget**: Prevent cfFetch retry × callApiWithRetry retry stacking leading to excessive wait.

> **Note**: 30s is a **soft budget** — checked at loop start. If the Nth iteration starts at 29s,
> its callApiOnce still runs to completion (adding up to 12s timeout). Actual worst wait ~41s.
> This is intentional — do not cancel already-in-flight requests.

```typescript
const CALL_API_TOTAL_BUDGET_MS = 30_000;

export async function callApiWithRetry(...): Promise<ApiResponse> {
  applyOptimisticUpdate(store, optimisticFn);
  const startTime = Date.now();

  for (let attempt = 0; attempt <= MAX_CLIENT_RETRIES; attempt++) {
    // 总预算检查
    if (attempt > 0 && Date.now() - startTime > CALL_API_TOTAL_BUDGET_MS) {
      facadeLog.warn('total budget exceeded', { path, elapsed: Date.now() - startTime });
      break;
    }

    const result = await callApiOnce(path, body, label, store);

    if (result.success) return result;

    // TIMEOUT 不重试：请求可能已到达服务端，重发不安全
    if (result.reason === 'TIMEOUT') return result;

    // 可重试的 reason
    const isRetryable =
      result.reason === 'CONFLICT_RETRY' ||
      result.reason === 'INTERNAL_ERROR' ||
      result.reason === 'NETWORK_ERROR' ||
      result.reason === 'SERVER_ERROR';

    if (isRetryable && attempt < MAX_CLIENT_RETRIES) {
      // cfFetch 层已处理慢网络（1s+2s 退避），业务层退避保持短（面对面游戏不能等太久）
      const delay = 300 * (attempt + 1) + secureRng() * 100;
      facadeLog.warn('client retrying', { reason: result.reason, path, attempt: attempt + 1 });
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    return result;
  }

  if (store) store.rollbackOptimistic();
  return { success: false, reason: 'NETWORK_ERROR' };
}
```

> **Idempotency safety**:
>
> - `NETWORK_ERROR` retry safe: `fetch()` throws = request did not reach server = no side effects.
> - `SERVER_ERROR` retry safe: non-JSON response = Cloudflare proxy error page (502/503), Worker did not process request.
> - `TIMEOUT` **not retried**: Request may have already executed. Most game actions are naturally idempotent via reducer state check (ignores duplicate ack after step advances), but not all actions have this protection, so we don't risk it.
> - `CONFLICT_RETRY` / `INTERNAL_ERROR` retry safe: Server explicitly indicates retryable.

### 3.5 Layer 2: CFAuthService.initAuth — Remove Manual Retry

**Before**: Manual for loop + try/catch + exponential backoff.
**After**: cfFetch has built-in network retry; only keep business logic (401/403 → clear token).

```typescript
async initAuth(): Promise<string | null> {
  const token = storage.getString(TOKEN_STORAGE_KEY) ?? null;
  if (!token) return null;
  this.#cachedToken = token;
  try {
    const resp = await cfGet<GetCurrentUserResponse>('/auth/user');
    if (resp.data.user) {
      this.#currentUserId = resp.data.user.id;
      this.#isAnonymous = resp.data.user.is_anonymous ?? false;
      this.#hasWechat = resp.data.user.has_wechat ?? false;
      return this.#currentUserId;
    }
  } catch (error: unknown) {
    const status = (error as { status?: number }).status;
    if (status !== 401 && status !== 403) {
      // 网络错误（cfFetch 已重试过 2 次仍失败）
      authLog.warn('initAuth: network error after retries', { status });
    }
  }
  await this.#clearToken();
  return null;
}
```

### 3.6 Layer 2: CFStorageService.uploadAvatar — Add Network Retry

**Before**: Direct `fetch()` for multipart/form-data upload, zero retry.
**After**: Use `fetchWithRetry`.

Since `fetchWithRetry` was already decided to be exported in §3.3 (for apiUtils), using it directly does not break encapsulation.

To unify cfFetch.ts upload API (JWT injection + JSON parsing), add a new `cfUpload` function:

```typescript
// cfFetch.ts
export async function cfUpload<T = Record<string, unknown>>(
  path: string,
  formData: FormData,
  timeoutMs?: number,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {};
  const token = tokenProvider?.();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // 注意: FormData 不设 Content-Type, 让浏览器自动加 boundary
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers,
    body: formData,
    signal: AbortSignal.timeout(timeoutMs ?? API_TIMEOUT_MS),
  });
  return parseJsonResponse<T>(res, path);
}
```

CFStorageService changes to call `cfUpload`.

### 3.7 Layer 3: Auth mutations — Convert to useMutation

**New file**: `src/hooks/mutations/useAuthMutations.ts`

Convert 11 manual try/catch + useState(loading) methods from AuthContext to useMutation.

> **TanStack Query v5 community conventions** (verified via context7):
>
> - mutation defaults to `retry: 0` (official docs: "By default, React Query does not retry mutations on error").
>   Each mutation declaring its own `retry` is the standard practice.
> - **`networkMode: 'offlineFirst'`**: TanStack's built-in offline→recovery auto-retry mechanism.
>   "mutations that fail due to an offline state will automatically be retried once the device reconnects"。
>   For China weak-network scenarios, this may be more suitable than manual `retry: 2 + retryDelay` — device auto-retries after recovering from weak network, no user manual re-operation needed.
>   **Recommended to evaluate for auth mutations**, decide during implementation.

```typescript
import { useMutation } from '@tanstack/react-query';
import { useServices } from '@/contexts/ServiceContext';

export function useSignInAnonymously() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: () => authService.signInAnonymously(),
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}

export function useSignInWithEmail() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.signInWithEmail(email, password),
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}

export function useSignUpWithEmail() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: ({
      email,
      password,
      displayName,
    }: {
      email: string;
      password: string;
      displayName?: string;
    }) => authService.signUpWithEmail(email, password, displayName),
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}

export function useUpdateProfile() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: (updates: Parameters<typeof authService.updateProfile>[0]) =>
      authService.updateProfile(updates),
    retry: 1,
  });
}
```

**Separate file**: `src/hooks/mutations/useUploadAvatar.ts`

`uploadAvatar` belongs to storage/upload domain, not auth; extracted separately:

```typescript
export function useUploadAvatar() {
  const { storageService } = useServices();
  return useMutation({
    mutationFn: (fileUri: string) => storageService.uploadAvatar(fileUri),
    retry: 1,
  });
}
```

**Continuing `useAuthMutations.ts`** (remaining 6 hooks):

```typescript
export function useSignOut() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: () => authService.signOut(),
    retry: 0, // 登出不重试
  });
}

export function useChangePassword() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) =>
      authService.changePassword(oldPassword, newPassword),
    retry: 1,
  });
}

export function useForgotPassword() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
    retry: 2,
  });
}

export function useResetPassword() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: ({
      email,
      code,
      newPassword,
    }: {
      email: string;
      code: string;
      newPassword: string;
    }) => authService.resetPassword(email, code, newPassword),
    retry: 1,
  });
}

export function useSignInWithWechat() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: (code: string) => authService.signInWithWechat(code),
    retry: 0, // 微信 code 一次性, 不可重试
  });
}

export function useBindWechat() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: (code: string) => authService.bindWechat(code),
    retry: 0, // 微信 code 一次性
  });
}
```

> **WeChat login/bind retry design notes**:
>
> WeChat code is one-time-use (invalidated once used), but two-layer retry is still safe:
>
> - **Layer 1 cfFetch network retry (active)**: `fetch()` throws = request didn't reach server = code not consumed = retry safe.
>   In rare "request sent but response lost" cases, retry yields server "code already used" error, no worse than not retrying.
> - **Layer 3 useMutation retry: 0 (no retry)**: Server already returned HTTP response (200/4xx/5xx),
>   code may have been consumed, retry is pointless. User needs to re-authorize via WeChat for new code.
>
> So `retry: 0` only disables useMutation-layer retry; cfFetch network-layer retry still applies to WeChat.

### 3.8 Layer 3: Room mutations — Convert to useMutation

**New file**: `src/hooks/mutations/useRoomMutations.ts`

```typescript
export function useCreateRoom() {
  const { roomService } = useServices();
  return useMutation({
    mutationFn: (params: {
      hostUserId: string;
      initialRoomNumber?: string;
      maxRetries?: number;
      buildInitialWerewolfState?: (roomCode: string) => WerewolfState;
    }) =>
      roomService.createRoom(
        params.hostUserId,
        params.initialRoomNumber,
        params.maxRetries,
        params.buildInitialState,
      ),
    retry: 1,
    // createRoom 内部已有 409 冲突重试，这里再加 1 次网络重试
  });
}

export function useJoinRoom() {
  const { roomService } = useServices();
  return useMutation({
    mutationFn: (roomCode: string) => roomService.getRoom(roomCode),
    retry: 2,
  });
}
```

### 3.9 Layer 3: Game actions — Keep callApiWithRetry

**Not converting to useMutation. Reason: architecture model mismatch.**

Game actions use `defineGameAction` → `callApiWithRetry`, which is fundamentally incompatible with TanStack Query's cache model:

1. **Different state management model** — Werewolf room state is managed by WerewolfStore (local mirror of authoritative server state), driven by WebSocket snapshot updates, not HTTP responses. TanStack Query cache manages client-side cache of server state — these are different data flows
2. **Callers are outside the React tree** — Werewolf actions are called by `WerewolfFacade` and `AudioOrchestrator` classes; useMutation is a React hook and cannot be used inside classes
3. **20+ actions share `defineGameAction` factory** — Unified guard → build body → callApi → after hook flow; switching to useMutation requires rewriting the entire factory pattern

This is the standard 2026 game client layering: meta-game (lobby/account/store) uses TanStack Query, core-game (real-time actions) uses dedicated state store + WebSocket.

**Correct approach**: Already solved in §3.4 — callApiWithRetry now retries network errors.

### 3.10 Layer 4: AuthContext Simplification

**Before**: AuthContext contains 11 async methods, each with manual setLoading + try/catch + handleAuthError.
**After**: AuthContext only retains `user`, `loading` (init phase), `error`. Mutations move to consumers via useMutation.

```typescript
// 改后的 AuthContext 只暴露:
interface AuthContextValue {
  user: User | null;
  loading: boolean; // 仅 init 阶段
  error: string | null; // 仅 init 阶段
  isAuthenticated: boolean;
  /** 更新本地 user state（mutation onSuccess 后调用） */
  refreshUser: () => Promise<void>;
}
```

**Screen consumer migration example**:

```tsx
// 之前 (AuthLoginScreen.tsx):
const { signInAnonymously, loading } = useAuthContext();
const handleAnonymous = async () => {
  try {
    await signInAnonymously();
  } catch {
    showErrorAlert('登录失败', message);
  }
};
<Button disabled={loading} title={loading ? '处理中' : '匿名登录'} onPress={handleAnonymous} />;

// 之后:
const signIn = useSignInAnonymously();
const handleAnonymous = () =>
  signIn.mutate(undefined, {
    onSuccess: () => {
      refreshUser();
      toast.success('登录成功');
    },
    onError: (err) => showErrorAlert('登录失败', mapAuthError(err)),
  });
<Button
  disabled={signIn.isPending}
  title={signIn.isPending ? '处理中' : '匿名登录'}
  onPress={handleAnonymous}
/>;
```

### 3.11 Layer 4: Settings / Profile mutations

**Before**: SettingsScreen calls updateProfile / changePassword via AuthContext.
**After**: Directly use useUpdateProfile / useChangePassword mutations.

```tsx
// SettingsScreen 改后:
const updateProfileMutation = useUpdateProfile();
const handleSaveName = () => {
  updateProfileMutation.mutate(
    { displayName: newName },
    {
      onSuccess: () => {
        refreshUser();
        toast.success('已更新');
      },
      onError: (err) => showErrorAlert('更新失败', err.message),
    },
  );
};
```

### 3.12 Layer 4: ConnectionStatusBar — Add Manual Reconnect Button

**Before**: After WS enters Failed state, only shows "连接断开，正在重连" with no actionable UI.
**After**: Failed state shows "连接失败" + "点击重连" button.

```tsx
// ConnectionStatusBar.tsx
if (status === ConnectionStatus.Failed) {
  return (
    <View style={styles.bar}>
      <Text>连接失败</Text>
      <Pressable onPress={onManualReconnect}>
        <Text>点击重连</Text>
      </Pressable>
    </View>
  );
}
```

Needs to expose `manualReconnect()` method from ConnectionManager (already has `MANUAL_RECONNECT` event support).

> **Note**: ConnectionFSM's Failed state already supports three auto-recovery triggers: `MANUAL_RECONNECT`, `NETWORK_ONLINE`, `VISIBILITY_VISIBLE`.
> When user returns to foreground or network recovers, FSM auto-transitions Failed → Reconnecting. The manual reconnect button is a fallback for when neither triggers.

### 3.13 QueryClient Global Configuration

```typescript
// src/lib/queryClient.ts
import { MutationCache, QueryClient } from '@tanstack/react-query';
import { isExpectedAuthError } from '@/utils/logger';
import { isAbortError, isNetworkError } from '@/utils/errorUtils';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      retry: 2, // 从 1 → 2
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    },
    mutations: {
      retry: 0, // mutation 默认不重试，由各 mutation 自行声明
    },
  },
  mutationCache: new MutationCache({
    // TanStack v5 MutationCache.onError 签名:
    // (error, variables, onMutateResult, mutation, context)
    onError: (error, _variables, _onMutateResult, mutation) => {
      // 全局 mutation 错误日志（不含 UI 反馈，UI 在各 mutation 的 onError 里）
      // 跳过可预期错误：网络错误（已重试过）、用户取消、auth 错误（401/403）
      if (!isNetworkError(error) && !isAbortError(error) && !isExpectedAuthError(error)) {
        Sentry.captureException(error, {
          tags: { mutationKey: String(mutation.options.mutationKey) },
        });
      }
    },
  }),
});
```

### 3.14 Non-Idempotent Operation Protection — cfPost `noRetry` Option

**Problem**: `fetch()` throwing does not guarantee 100% request did not reach server (see §2.2 warning). For non-idempotent operations, network-layer auto-retry may cause duplicate execution.

**Non-idempotent operations in the project**:

| Operation                     | Endpoint               | Risk                   | Existing Protection                                                                   |
| ----------------------------- | ---------------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| Gacha draw                    | `POST /api/gacha/draw` | Double-spend tickets   | OCC version check (only prevents concurrency, not duplicate requests)                 |
| Vote `submitAction`(wolfVote) | `POST /game/action`    | Same wolf double-votes | reducer step check (ignored after step advances, but no per-wolf dedup during window) |

**Solution**: Add `noRetry` option to `cfPost`; non-idempotent callers disable Layer 1 network retry.

```typescript
// cfFetch.ts
export async function cfPost<T = Record<string, unknown>>(
  path: string,
  body?: Record<string, unknown>,
  options?: {
    timeoutMs?: number;
    extraHeaders?: Record<string, string>;
    noRetry?: boolean; // 禁用 fetchWithRetry，直接用 fetch()
  },
): Promise<T> {
  const fetchFn = options?.noRetry ? fetch : fetchWithRetry;
  // ... 其余逻辑不变
}
```

**Consumer side**:

```typescript
// GachaService — draw 禁用网络重试
async performDraw(ticketType: TicketType): Promise<DrawResult> {
  return cfPost('/api/gacha/draw', { ticketType }, { noRetry: true });
}
```

`claimDailyReward` does not need `noRetry` (server has 20h cooldown guard, naturally idempotent).

> **Better long-term solution**: Server-side idempotency key (client sends `x-idempotency-key: <uuid>`, server deduplicates using D1 with 5min window).
> More general-purpose, but requires server changes, not in this scope. Recorded as follow-up.
>
> **CF official docs reference**: Cloudflare Workers docs _Use the Platform > Idempotent requests_ provides the standard pattern —
> Client generates `crypto.randomUUID()` as idempotency key, server stores `(key, response)` in D1/KV and returns cached result on duplicate requests.
> Reference this pattern during implementation.

---

## 4. UI Design

### 4.1 Core Principles

**Silent retry + delayed feedback**: Users only see slightly longer loading, never see intermediate retry process.

| Phase                     | What User Sees                                             |
| ------------------------- | ---------------------------------------------------------- |
| mutation.isPending = true | loading spinner / "处理中" / button disabled (same as now) |
| Internal retrying         | **Same as above** (isPending stays true during retry)      |
| All retries failed        | isError = true → **only then show error notification**     |

### 4.2 Error Notification Strategy

| Action Type                   | Error UI                       | Reason                        |
| ----------------------------- | ------------------------------ | ----------------------------- |
| Login/register                | `showErrorAlert` dialog        | Blocks flow, user must handle |
| Room create/join              | `showErrorAlert` dialog        | Same as above                 |
| Edit profile/password         | `showErrorAlert` dialog        | Same as above                 |
| Game action (network error)   | `showErrorAlert` dialog        | Blocks flow                   |
| Game action (business reject) | `toast.error` light toast      | Non-fatal                     |
| Gacha/check-in                | `toast.error` light toast      | Non-fatal                     |
| Avatar upload                 | `showErrorAlert` dialog        | User is waiting for result    |
| WS reconnecting               | ConnectionStatusBar "正在重连" | Auto-recovery                 |
| WS reconnect failed           | "连接失败" + "点击重连" button | Requires user intervention    |

### 4.3 WeChat Mini-Program Login Failure — Dedicated Full-Screen Error Page

Existing Alert dialogs are unsuitable for mini-programs: after tapping "确定" the user has nowhere to go.

**Inside mini-program**: WeChat code is one-time-use; after failure it cannot be retried, must re-enter to get new code.
Display full-screen error page (not Alert):

```
┌─────────────────────────────┐
│                             │
│      😿 登录失败             │
│                             │
│   网络异常，请重新进入小程序   │
│                             │
│      [ 重新进入 ]            │  ← wxReLaunch() 重新加载
│                             │
└─────────────────────────────┘
```

Click "重新进入" → `wx.miniProgram.reLaunch()` → web-view reloads → URL carries new code → re-runs login.

**Non-mini-program (browser)**: Already has fallback → `signInAnonymously()` → anonymous entry to home. No extra UI needed.

Implementation: In `#autoSignIn` mini-program WeChat login catch branch, set a `wechatLoginFailed` state;
App layer renders full-screen error page component based on this state (replacing current splash screen), instead of showing Alert.

### 4.4 UI Not Being Added

- **No "retrying (2/3)" counter** — Increases user anxiety, not recommended by community
- **No global offline banner** — `window.online/offline` is unreliable in China (WiFi connected but CF unreachable doesn't trigger offline), misleads users
- **No failureCount display** — Same reason

---

## 5. Migration Plan

### Phase 1: Infrastructure (cfFetch + apiUtils + config)

| Commit | File                                          | Changes                                                                                                                                          |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1      | `src/config/api.ts`                           | Timeout 8s→12s, add `FETCH_RETRY_COUNT` constant                                                                                                 |
| 2      | `src/services/cloudflare/cfFetch.ts`          | Add `fetchWithRetry` (exported), used internally by cfPost/cfGet/cfPut, cfPost adds `options` (extraHeaders, timeoutMs, noRetry), add `cfUpload` |
| 3      | `src/utils/errorUtils.ts`                     | `isAbortError()` expanded to cover `TimeoutError` (AbortSignal.timeout error type)                                                               |
| 4      | `src/services/games/werewolf/apiUtils.ts`     | `callApiOnce` `fetch()` → `fetchWithRetry()` + catch adapts to TimeoutError, `callApiWithRetry` supports network error retry + 30s total budget  |
| 5      | `src/services/cloudflare/CFAuthService.ts`    | `initAuth` remove manual retry loop                                                                                                              |
| 6      | `src/services/cloudflare/CFStorageService.ts` | `uploadAvatar` switch to `cfUpload`                                                                                                              |
| 7      | `src/services/feature/GachaService.ts`        | `performDraw` add `{ noRetry: true }`                                                                                                            |

**Verification**: Run `pnpm run quality`. Zero UI changes in this phase. 24 cfPost/cfGet/cfPut call sites + 25 callApiOnce call sites automatically gain network retry (except draw).

### Phase 2: Auth mutations

| Commit | File                                                            | Changes                                                  |
| ------ | --------------------------------------------------------------- | -------------------------------------------------------- |
| 8      | `src/hooks/mutations/useAuthMutations.ts`                       | New, 10 auth mutation hooks (excluding uploadAvatar)     |
| 9      | `src/hooks/mutations/useUploadAvatar.ts`                        | New, uploadAvatar separate file (storage domain)         |
| 10     | `src/contexts/AuthContext.tsx`                                  | Simplified to only expose user/loading/error/refreshUser |
| 11     | `src/screens/AuthScreen/AuthLoginScreen.tsx`                    | Switch to useSignInAnonymously                           |
| 12     | `src/screens/AuthScreen/AuthEmailScreen.tsx` + `useAuthForm.ts` | Switch to useSignInWithEmail / useSignUpWithEmail        |
| 13     | `src/screens/AuthScreen/AuthForgotPasswordScreen.tsx`           | Switch to useForgotPassword                              |
| 14     | `src/screens/AuthScreen/AuthResetPasswordScreen.tsx`            | Switch to useResetPassword                               |
| 15     | `src/components/auth/LoginOptions.tsx` + `EmailForm.tsx` etc.   | Consume mutation state                                   |
| 16     | `src/screens/HomeScreen/HomeScreen.tsx`                         | AuthContext consumer adaptation                          |
| 17     | `src/components/AuthGateOverlay.tsx`                            | AuthContext consumer adaptation                          |

> **All AuthContext consumers** (~28 `useAuthContext` usages): Above commits cover all auth mutation consumers.
> Files that only consume `user` / `isAuthenticated` (e.g. `src/hooks/werewolf/useWerewolfRoom.ts`, `RoomScreen.tsx`) are unaffected since AuthContext still exposes these fields.

**Verification**: Login/register/forgot-password E2E flows.

### Phase 3: Room + Settings mutations

| Commit | File                                                    | Changes                                            |
| ------ | ------------------------------------------------------- | -------------------------------------------------- |
| 18     | `src/hooks/mutations/useRoomMutations.ts`               | New                                                |
| 19     | `src/screens/ConfigScreen/useConfigScreenState.ts`      | createRoom switch to useCreateRoom                 |
| 20     | `src/hooks/werewolf/useWerewolfRoomLifecycle.ts`        | joinRoom switch to mutation                        |
| 21     | `src/screens/SettingsScreen/SettingsScreen.tsx`         | updateProfile / changePassword switch to mutations |
| 22     | `src/screens/AvatarPickerScreen/AvatarPickerScreen.tsx` | uploadAvatar / updateProfile switch to mutations   |

**Verification**: Create/join room E2E.

### Phase 4: QueryClient + ConnectionStatusBar

| Commit | File                                                   | Changes                                                                                        |
| ------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 23     | `src/lib/queryClient.ts`                               | Update config (retry: 2, MutationCache onError)                                                |
| 24     | `src/components/room/ConnectionStatusBar.tsx`          | Failed state add manual reconnect button                                                       |
| 25     | `src/services/connection/ConnectionManager.ts`         | Expose manualReconnect to UI                                                                   |
| 26     | `src/services/cloudflare/CFAuthService.ts` + App layer | Mini-program WeChat login failure → wechatLoginFailed state + full-screen error page component |

**Verification**: `pnpm run quality` + full E2E suite.

### Phase 5: Clean Up Temporary mutation hooks retry

Phase 1's fetchWithRetry already handles network retry at the cfPost layer. `retry` on mutation hooks creates double-layer retry (TanStack retry re-runs entire mutationFn, internal cfPost retries network again) — should be removed.

TanStack Query community convention: mutations default to `retry: 0`, network retry belongs to transport layer.

| Commit | File                                      | Changes                                                                |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------- |
| 27     | `src/hooks/mutations/useAuthMutations.ts` | 8 hooks remove `retry` + `retryDelay` (keep wechat/signOut `retry: 0`) |
| 28     | `src/hooks/mutations/useRoomMutations.ts` | 2 hooks remove `retry`                                                 |

**Verification**: `pnpm run quality`.

---

## 6. Parts Not Changed

| Part                                                         | Reason                                                                                                                                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defineGameAction` + `callApiWithRetry` keep current pattern | Architecture model mismatch: Werewolf state is driven by WerewolfStore + WebSocket, not HTTP response cache; callers are in classes (WerewolfFacade/AudioOrchestrator), cannot use React hooks |
| `AIChatService.streamChat`                                   | SSE streaming not suitable for retry                                                                                                                                                           |
| WebSocket (ConnectionFSM/ConnectionManager)                  | Already complete, not in this scope                                                                                                                                                            |
| `useDrawMutation` / `useClaimDailyRewardMutation`            | Already correctly using useMutation ✅                                                                                                                                                         |
| `useQuery` hooks (stats/profile/unlocks/gacha)               | Already correctly using useQuery ✅                                                                                                                                                            |

### 6.1 networkMode Evaluation

TanStack Query provides three `networkMode` options: `online` (default), `offlineFirst`, `always`.

**Not adopting `offlineFirst`**: This mode is suited for Service Worker offline cache or HTTP Cache-Control scenarios (first request might hit local cache). All requests in this project go directly to Cloudflare Workers API with no local cache layer; `offlineFirst` would just fire one doomed request when offline.

**Not adopting `always` (no change for now)**: `always` mode ignores `navigator.onLine` state and never pauses requests. Under current default `online` mode, when China users have WiFi connected but CF unreachable, `navigator.onLine === true` so mutations are not paused — behavior is equivalent to `always`. Explicitly setting `networkMode: 'always'` would make semantics clearer but has no actual behavior difference; low priority.

**Conclusion**: Keep default `networkMode: 'online'`. Network resilience is guaranteed by cfPost fetchWithRetry + callApiWithRetry network retry, not relying on TanStack's network state detection.

---

## 7. Change Statistics

| Category                   | File Count    | New Files                                       |
| -------------------------- | ------------- | ----------------------------------------------- |
| Infrastructure (Phase 1)   | 7             | 0                                               |
| Auth mutations (Phase 2)   | 10            | 2 (`useAuthMutations.ts`, `useUploadAvatar.ts`) |
| Room/Settings (Phase 3)    | 5             | 1 (`useRoomMutations.ts`)                       |
| QueryClient + UI (Phase 4) | 4             | 0                                               |
| **Total**                  | **~26 files** | **3 new files**                                 |

---

## 8. Risks & Mitigation

| Risk                                                  | Impact                              | Mitigation                                                                                                                                                                        |
| ----------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cfFetch retry causes duplicate submission             | Side effect executes twice          | fetch() throwing **most likely** = request didn't reach server, but edge cases exist (see §2.2). Non-idempotent operations protected with `noRetry`                               |
| cfFetch retries non-idempotent op (gacha draw)        | Double-spend tickets                | `noRetry: true` disables network-layer retry. Long-term: add server idempotency key                                                                                               |
| callApiWithRetry network retry duplicates game action | State corruption                    | Only retry NETWORK_ERROR/SERVER_ERROR (request not arrived/not processed), no TIMEOUT retry. Reducer state check provides extra protection (ignores dup ack after step advances)  |
| AuthContext simplification breaks consumers           | Compile errors                      | Phase 2 covers all ~28 useAuthContext consumption points, file-by-file migration + tsc verification                                                                               |
| WeChat code gets retried                              | Server reports code used            | signInWithWechat/bindWechat retry: 0                                                                                                                                              |
| 12s timeout causes long wait                          | Poor UX                             | In practice 99% <3s, 12s is fallback. cfFetch retry is for network-layer errors (usually known within <3s)                                                                        |
| Non-JSON response (502/503) retried                   | Pointless retry                     | 502/503 are HTTP Responses, fetch doesn't throw, doesn't trigger retry. Only parseJsonResponse errors, thrown to caller                                                           |
| ~~withTimeout Promise.race ghost request~~            | ~~Request continues after timeout~~ | **Resolved**: All fetch calls unified to `AbortSignal.timeout()`, timeout aborts request (TCP close), no ghost requests. Non-idempotent ops additionally protected with `noRetry` |
| wolfVote same wolf double-votes                       | Vote result bias                    | DO single-thread + inline progression provides de facto protection. Long-term follow-up: add per-seat dedup guard at handler layer                                                |

---

## 9. Verification Checklist

- [ ] `pnpm run quality` passes
- [ ] E2E: Anonymous login → create room → take seat → game flow
- [ ] E2E: Email register → login → edit profile → change password
- [ ] E2E: Gacha draw
- [ ] Manual: Disconnect → action → recover → auto-success
- [ ] Manual: China network environment test (if conditions allow)
- [ ] Manual: WS Failed state → click reconnect button → recover
- [ ] Manual: Mini-program WeChat login failure → full-screen error page → click "重新进入" → wxReLaunch works

---

## Appendix A: Idempotency Analysis

Verified each DO handler and API endpoint for idempotency to determine whether network-layer retry is safe.

### Game Actions (via callApiWithRetry)

| Operation                              | Idempotent | Retry Safe      | Protection Mechanism                                                                                                                                                                                                                                                                              |
| -------------------------------------- | ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handleJoinSeat` (same seat same user) | ✅         | Safe            | userId match allows re-entry, data overwrite                                                                                                                                                                                                                                                      |
| `handleLeaveMySeat`                    | ✅         | Safe            | `mySeat === null` → `REASON_NOT_SEATED`                                                                                                                                                                                                                                                           |
| `handleKickPlayer`                     | ✅         | Safe            | `players[seat] === null` → `REASON_SEAT_EMPTY`                                                                                                                                                                                                                                                    |
| `handleClearAllSeats`                  | ✅         | Safe            | Empty iterator → 0 actions                                                                                                                                                                                                                                                                        |
| `handleAssignRoles`                    | ✅         | Safe            | Status gate `Seated` → `Assigned`, second time `invalid_status`                                                                                                                                                                                                                                   |
| `handleStartNight`                     | ✅         | Safe            | Status gate `Ready` → `Ongoing`, second time `invalid_status`                                                                                                                                                                                                                                     |
| `handleRestartGame`                    | ✅         | Safe            | No status gate, but reset to initial state, equivalent effect                                                                                                                                                                                                                                     |
| `handleSetAudioPlaying`                | ✅         | Safe            | Boolean pure assignment                                                                                                                                                                                                                                                                           |
| `handleViewedRole`                     | ✅         | Safe            | `hasViewedRole: true` → idempotent assignment                                                                                                                                                                                                                                                     |
| `groupConfirmAck`                      | ✅         | Safe            | **Explicit dedup**: `if (acks.includes(seatNum)) return handlerSuccess([])`                                                                                                                                                                                                                       |
| `revealAck`                            | ✅         | Safe            | `pendingRevealAcks.length === 0` → `no_pending_acks`                                                                                                                                                                                                                                              |
| `audioAck`                             | ✅         | Safe            | `!isAudioPlaying` → empty actions                                                                                                                                                                                                                                                                 |
| `progression`                          | ✅         | Safe            | evaluateProgression full guard chain + `MAX_PROGRESSION_LOOPS`                                                                                                                                                                                                                                    |
| **`handleSubmitAction`**               | **⚠️**     | **Conditional** | Gate 4b `expectedSchemaId !== currentStepId` → `step_mismatch`. No intra-step dedup, but DO single-thread + inline progression synchronously advances step in processAction. **wolfVote exception**: multi-player vote does not immediately advance step, same wolf can theoretically double-vote |

### cfPost/cfGet/cfPut Operations (via cfFetch)

| Operation                      | Idempotent | Retry Safe       | Protection Mechanism                                                                                          |
| ------------------------------ | ---------- | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `POST /auth/anonymous`         | ❌         | **Acceptable**   | Creates new UUID each time. Retry = orphan anonymous user (no business impact)                                |
| `POST /auth/signup`            | ✅         | Safe             | email unique constraint → duplicate = 409                                                                     |
| `POST /auth/signin`            | ✅         | Safe             | No side effects, returns token                                                                                |
| `POST /auth/signout`           | ✅         | Safe             | Repeated signout has no side effects                                                                          |
| `PUT /auth/profile`            | ✅         | Safe             | Pure assignment update                                                                                        |
| `PUT /auth/password`           | ✅         | Safe             | Old password verification + new password write                                                                |
| `POST /auth/forgot-password`   | ✅         | Safe             | May send duplicate email, has rate limit                                                                      |
| `POST /auth/wechat`            | ⚠️         | **Layer 1 Safe** | Code is one-time, but fetch exception = code not consumed. useMutation retry:0                                |
| `POST /room/create`            | ✅         | Safe             | DO init uses `INSERT OR REPLACE`, idempotent                                                                  |
| `POST /room/get`               | ✅         | Safe             | Read-only                                                                                                     |
| **`POST /api/gacha/draw`**     | **❌**     | **Unsafe**       | OCC version check only prevents concurrency. Retry = double-spend tickets. **Protected with `noRetry: true`** |
| `POST /api/gacha/daily-reward` | ✅         | Safe             | 20h cooldown guard                                                                                            |

### Follow-up (Out of Scope)

| Item                                         | Priority | Description                                                                                                                                                                 |
| -------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server-side idempotency key                  | P1       | `x-idempotency-key: <uuid>`, D1 stores key+result, 5min window dedup. Reference CF official docs _Idempotent requests_ pattern                                              |
| `handleSubmitAction` per-seat dedup          | P2       | Add `actions.some(a => a.schemaId === schemaId && a.actorSeat === seat)` check at handler layer                                                                             |
| ~~`withTimeout` add AbortController option~~ | ~~P2~~   | **Resolved in this refactoring**: All fetch calls unified to `AbortSignal.timeout()`, timeout = abort. `withTimeout` only kept for non-fetch Promises (e.g. DO RPC timeout) |

---

## Implementation Notes

### Prefetch Race Fix（2026-05-24）

**Root cause**: `#fetchState` unconditionally awaits prefetch promise. On slow network + cold DO, prefetch does not settle within 12s → blocks fetchState from issuing new request → 15s connectAndWait envelope timeout.

**Fix**: `Promise.race(prefetch, graceTimer)` — After WS open, give prefetch a 3s grace window (`PREFETCH_GRACE_MS = 3000`). If not settled after timeout, abandon prefetch and fetch fresh (DO is already warm from WS upgrade, new request completes in 2-3s).

**Additionally**: `connectAndWait` timeout marked as expected error (network conditions, not code defect).
