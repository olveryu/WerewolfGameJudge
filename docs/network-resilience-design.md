# 网络韧性改造设计文档

> 目标：解决国内用户经常登录失败、操作失败、断线的问题。
> 根因：中国 → Cloudflare 国际链路丢包率高（5–15%），现有 HTTP 层零网络重试。

---

## 1. 现状分析

### 1.1 当前架构

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

> **超时机制现状问题**：`cfPost` 用 `withTimeout`（内部 `Promise.race`），超时后 fetch 仍在后台跑（ghost request）。
> `callApiOnce` 用手动 `AbortController + setTimeout`，超时后取消请求。
> `AIChatService` 已用 `AbortSignal.timeout(30_000)`（社区标准）。本次改造统一到 `AbortSignal.timeout()`。
┌──────────────────────────┐
│  直接 fetch()            │
│  - CFStorageService      │
│  - AIChatService (stream)│
│  消费者: 2 处             │
└──────────────────────────┘
```

### 1.2 重试现状

| 位置                           | 重试什么                        | 策略          | 问题                                            |
| ------------------------------ | ------------------------------- | ------------- | ----------------------------------------------- |
| `cfFetch` (cfPost/cfGet/cfPut) | 无                              | 零重试        | 24 个调用点全裸奔                               |
| `callApiWithRetry`             | CONFLICT_RETRY / INTERNAL_ERROR | 2 次          | **跳过** NETWORK_ERROR / TIMEOUT / SERVER_ERROR |
| `CFAuthService.initAuth`       | 网络/超时                       | 2 次指数退避  | 手动实现，与其他地方不统一                      |
| `CFRoomService.createRoom`     | 409 冲突                        | 5 次          | 仅业务重试，无网络重试                          |
| WebSocket (ConnectionFSM)      | 断线                            | 15 次指数退避 | ✅ 已完善                                       |

### 1.3 HTTP 调用全量清单

**通过 cfPost/cfGet/cfPut（24 处）：**

| 服务              | 方法              | 端点                         | 网络重试     |
| ----------------- | ----------------- | ---------------------------- | ------------ |
| CFAuthService     | signInAnonymously | POST /auth/anonymous         | ❌           |
| CFAuthService     | signUpWithEmail   | POST /auth/signup            | ❌           |
| CFAuthService     | signInWithEmail   | POST /auth/signin            | ❌           |
| CFAuthService     | signOut           | POST /auth/signout           | ❌           |
| CFAuthService     | forgotPassword    | POST /auth/forgot-password   | ❌           |
| CFAuthService     | resetPassword     | POST /auth/reset-password    | ❌           |
| CFAuthService     | signInWithWechat  | POST /auth/wechat            | ❌           |
| CFAuthService     | bindWechat        | POST /auth/bind-wechat       | ❌           |
| CFAuthService     | getCurrentUser    | GET /auth/user               | ❌           |
| CFAuthService     | initAuth          | GET /auth/user               | ⚠️ 手动 2 次 |
| CFAuthService     | updateProfile     | PUT /auth/profile            | ❌           |
| CFAuthService     | changePassword    | PUT /auth/password           | ❌           |
| CFRoomService     | createRoom        | POST /room/create            | ⚠️ 仅 409    |
| CFRoomService     | getRoom           | POST /room/get               | ❌           |
| CFRoomService     | deleteRoom        | POST /room/delete            | ❌           |
| CFRoomService     | getStateRevision  | POST /room/revision          | ❌           |
| CFRoomService     | getGameState      | POST /room/state             | ❌           |
| GachaService      | fetchGachaStatus  | GET /api/gacha/status        | ❌           |
| GachaService      | performDraw       | POST /api/gacha/draw         | ❌           |
| GachaService      | claimDailyReward  | POST /api/gacha/daily-reward | ❌           |
| StatsService      | fetchUserStats    | GET /api/user/stats          | ❌           |
| StatsService      | fetchUserProfile  | GET /api/user/:id/profile    | ❌           |
| StatsService      | fetchUserUnlocks  | GET /api/user/unlocked-items | ❌           |
| ShareImageService | uploadShareImage  | POST /share/image            | ❌           |

**通过 callApiWithRetry（25 处游戏/座位操作）：**
assignRoles, updateTemplate, setRoleRevealAnimation, restartGame, clearAllSeats,
startNight, submitAction, markViewedRole, clearRevealAcks,
submitGroupConfirmAck, setWolfRobotHunterStatusViewed, setAudioPlaying, postAudioAck, postProgression,
shareNightReview, boardNominate, boardUpvote, boardWithdraw,
fillWithBots, markAllBotsViewed, markAllBotsGroupConfirmed, updatePlayerProfile,
takeSeat, leaveSeat, kickPlayer

> **注意**: 游戏端点（`/game/*`）不使用 `requireAuth` 中间件，`callApiOnce` 有意不注入 JWT。
> 这与 cfPost（自动注入 Bearer token）的 auth 模型不同。

**直接 fetch()（3 处）：**

- `apiUtils.ts` callApiOnce — 游戏/座位操作（独立 fetch 实现，不走 cfFetch，无 JWT，用 AbortController 超时）
- `CFStorageService.uploadAvatar` — multipart/form-data
- `AIChatService.streamChat` — SSE streaming（AbortSignal.timeout(30s)，不应重试）

### 1.4 UI 反馈现状

| 场景      | Loading                            | 失败提示            | 手动重试                                                 |
| --------- | ---------------------------------- | ------------------- | -------------------------------------------------------- |
| 登录      | 按钮"处理中" + 禁用                | Alert 弹窗          | 首页 banner → 刷新页面                                   |
| 创建房间  | "创建中" + spinner                 | handleError → Alert | 无                                                       |
| 加入房间  | Modal loading                      | 内联错误文字        | 用户重新点按钮                                           |
| 游戏操作  | 无（fire-and-forget + optimistic） | Toast / Alert       | 无                                                       |
| WS 断线   | "正在重连" 进度条                  | 自动重连            | Failed 状态显示与 Disconnected 相同的 UI，无手动重连按钮 |
| 扭蛋/统计 | TanStack isLoading                 | TanStack 内建       | TanStack 自动重试                                        |
| 头像上传  | spinner                            | Alert               | 无                                                       |
| AI 聊天   | spinner                            | 内联错误            | 无                                                       |

### 1.5 TanStack Query 使用现状

项目已安装 `@tanstack/react-query@5.99.0`，`QueryClientProvider` 已配在 App.tsx。

**已接入 TanStack Query 的（7 个 hooks + 4 个 queryOptions factory）：**

- `useQuery`: 4 个 query hook — userStats 和 gachaStatus 走 `useAuthenticatedQuery`（带 auth guard），userProfile 和 userUnlocks 走直接 `useQuery`
- `useMutation`: drawGacha, claimDailyReward（2 个 mutation hook）
- `queryOptions` 工厂：queryOptions.ts 已有 4 个 option factory（非 hook，供 useQuery 消费）
- `QueryClient` 配置：`retry: 1`, `staleTime: 2min`

**未接入 TanStack Query 的（57 处）：**

- AuthContext 11 个 async 方法（手动 useState loading/error）
- Room 操作 5 个方法（手动 useState + handleError）
- 游戏操作 25 个（callApiWithRetry + handleMutationResult）
- Settings 操作 ~5 个（AuthContext + showErrorAlert）
- 其他 ~12 个（各种手动模式）

---

## 2. 目标架构

### 2.1 分层设计

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

### 2.2 重试策略

**两层重试，各管各的：**

| 层                       | 重试什么                                            | 条件                         | 次数                   | 退避                  |
| ------------------------ | --------------------------------------------------- | ---------------------------- | ---------------------- | --------------------- |
| **Layer 1: cfFetch**     | `fetch()` 抛异常（DNS失败/TCP RST/TLS握手失败）     | 请求 **大概率** 未到达服务器 | 2 次                   | 1s, 2s 指数退避       |
| **Layer 3: useMutation** | HTTP 状态码 5xx / 自定义 reason (CONFLICT_RETRY 等) | 请求 **到达** 服务器但失败   | 由各 mutation 自行决定 | TanStack 默认指数退避 |

**为什么分两层：**

- Layer 1 重试 **大部分情况安全**（`fetch()` 抛异常通常 = 请求没到服务器）
- Layer 3 重试需要业务判断（409 冲突该换 code 重试？401 不该重试？只有业务层知道）

> **⚠️ `fetch()` 异常 ≠ 100% 请求未到达**
>
> 极少数边界情况下（TCP RST after request sent、TLS alert after handshake complete、proxy 中断），
> `fetch()` 抛 TypeError 但服务端已收到并处理请求。对**幂等操作**（绝大多数）这没问题，
> 对**非幂等操作**（如扭蛋 draw）需要额外保护。见 §3.14。

**不重试的情况：**

- HTTP 4xx（401/403/404/422）— 客户端错误，重试无意义
- `AIChatService.streamChat` — SSE streaming，不适合重试
- 用户主动取消（AbortError）

### 2.3 超时策略

| 配置项           | 现值    | 新值           | 理由                                                                                |
| ---------------- | ------- | -------------- | ----------------------------------------------------------------------------------- |
| `API_TIMEOUT_MS` | 8000ms  | **12000ms**    | 国内 → CF 首次 TLS 握手可达 3-5s                                                    |
| cfFetch 总预算   | 无      | **不设总预算** | cfFetch 重试 2 次 × 12s = 最坏 36s，但 fetch 异常通常 1-3s 内就知道，只有超时才等满 |
| WeChat auth      | 15000ms | **20000ms**    | 跨境 Worker → api.weixin.qq.com                                                     |
| `waitForInit`    | 20000ms | **25000ms**    | 必须 > WeChat timeout                                                               |

> **最坏等待时间**：
>
> | 场景                           | cfFetch (Layer 1) | 业务层 (Layer 2/3) | 总计               |
> | ------------------------------ | ----------------- | ------------------ | ------------------ |
> | Auth mutation (retry:2)        | 3×12s = 36s       | 3×36s = 108s       | **用总预算兜底**   |
> | Game action (callApiWithRetry) | 3×12s = 36s       | 3×36s = 108s       | **30s 总预算截断** |
>
> 不设总预算会出现 108s 最坏等待。`callApiWithRetry` 设 30s 总预算；`useMutation` 靠 TanStack 内建的 `retryDelay` 控制节奏（每层 cfFetch 内部超时已兜底）。
>
> 实际 99% 场景：fetch 异常在 1-3s 内就知道（DNS/TCP 失败很快），只有超时才等满 12s。

---

## 3. 详细改动

### 3.1 Layer 1: cfFetch — 网络层重试

**文件**: `src/services/cloudflare/cfFetch.ts`

**改动**：提取 `fetchWithRetry` 内部函数，包裹所有 `fetch()` 调用。

**同时统一超时机制**：`cfPost/cfGet/cfPut` 从 `withTimeout(Promise.race)` 迁移到 `AbortSignal.timeout()`。

> **`AbortSignal.timeout()` 是 2024 Baseline（2026 社区标准）**：Chrome 124+, Safari 16+, Node 17.3+。
> `AIChatService` 已在使用。本次统一到所有 fetch 调用。
> 好处：超时后 **abort 请求**（TCP 连接关闭），不存在 ghost request；
> 与用户取消可组合：`AbortSignal.any([AbortSignal.timeout(ms), userSignal])`；
> 代码量从 ~15 行（withTimeout wrapper）降到 1 行。

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

**cfPost/cfGet/cfPut** 中的 `fetch()` 全部替换为 `fetchWithRetry()`，`withTimeout` 替换为 `AbortSignal.timeout()`。

```typescript
// cfPost 改后示例（关键行）
const res = await fetchWithRetry(url, {
  ...init,
  signal: AbortSignal.timeout(options?.timeoutMs ?? API_TIMEOUT_MS),
});
```

> **超时语义：total-operation timeout**
>
> `AbortSignal.timeout(12s)` 在 cfPost 层创建一次，传入 fetchWithRetry 的 3 次 attempt 共享同一倒计时。
> 首次 attempt 快速失败（DNS/TCP ~1s）→ delay 1s → 第二次有 ~10s → 正常。
> 首次 attempt 慢超时（~11s）→ delay 1s → 第二次只剩 ~0s → 立即 TimeoutError。
> 这是**有意的 total-operation timeout 语义**：不管内部重试几次，对外承诺的最大等待时间不变。
> 实施时在 fetchWithRetry JSDoc 中注明此行为。

**cfPost** 新增可选 `extraHeaders` 参数，供 apiUtils 传 `x-request-id` / `x-region`。
**cfPost** 新增可选 `noRetry` 参数，禁用网络层重试（见 §3.14）。

**影响范围**: 24 个通过 cfPost/cfGet/cfPut 的调用点自动获得网络重试 + 超时取消。零业务代码改动。

导出 `fetchWithRetry` 后，apiUtils.ts 的 `callApiOnce` 也可使用，覆盖 25 个游戏/座位操作。总计 49 个调用点获得网络重试。

> **弃用 withTimeout**：改造后 `withTimeout` 仅保留给非 fetch 的 Promise（如 DO RPC timeout）。所有 fetch 调用统一用 `AbortSignal.timeout()`。

### 3.1b 错误分类工具适配 — errorUtils.ts

**文件**: `src/utils/errorUtils.ts`

`AbortSignal.timeout()` 超时抛 `DOMException { name: 'TimeoutError' }`，不是 `AbortError`。
现有 `isAbortError()` 和 `isNetworkError()` 都不匹配 `TimeoutError`，会导致 §3.13 MutationCache onError 误报 Sentry。

**改动**：

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

`isNetworkError` 的 `NETWORK_ERROR_PATTERNS` 中 `'operation timed out after'`（匹配 withTimeout 报错）在改造后仍保留（DO RPC timeout 仍用 withTimeout），无需改动。

**影响**：§3.13 MutationCache `isAbortError(error)` 现在也能匹配 TimeoutError，不会误报 Sentry。

### 3.2 Layer 1: cfFetch — cfPost 支持 extraHeaders + noRetry

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

**为什么**: `extraHeaders` 为 auth/room 等走 cfPost 的调用方提供传 `x-request-id` 等自定义 header 的能力。
`noRetry` 保护非幂等操作（详见 §3.14）。

### 3.3 Layer 2: apiUtils — callApiOnce 注入 fetchWithRetry

**文件**: `src/services/facade/apiUtils.ts`

**现在**: `callApiOnce` 自己写 fetch + AbortController + JSON 解析，零网络重试。
**改后**: **保留独立 fetch 路径**（不改用 cfPost），仅把 `fetch()` 替换为 `fetchWithRetry()`。

**不用 cfPost 的原因**：

- **auth 模型不同**: 游戏端点（`/game/*`）不使用 `requireAuth` 中间件，`callApiOnce` 有意不注入 JWT。`cfPost` 会自动注入 Bearer token（虽然服务端忽略，但改变了请求语义）。

```typescript
import { fetchWithRetry } from '@/services/cloudflare/cfFetch';

async function callApiOnce(
  path: string,
  body: Record<string, unknown>,
  label: string,
  store?: GameStore,
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

**改动点**：3 处——

1. `fetch()` → `fetchWithRetry()`
2. 手动 `AbortController+setTimeout` → `AbortSignal.timeout()`
3. catch 块：检测 `TimeoutError`（AbortSignal.timeout 抛的 DOMException）+ 原有 `AbortError`

保留无 JWT、独立 JSON 解析。删除 `setTimeout`/`clearTimeout`/`abortController` 相关代码。
**影响**：cfFetch.ts 需 export `fetchWithRetry`。

### 3.4 Layer 2: apiUtils — callApiWithRetry 支持网络错误重试

**现在**: NETWORK_ERROR / TIMEOUT / SERVER_ERROR 直接 return，不重试。
**改后**: 重试 NETWORK_ERROR 和 SERVER_ERROR（fetch 异常 / 非 JSON 响应 = 请求未被正确处理）。
**不重试 TIMEOUT**（AbortController 超时 = 请求可能已到达服务端并执行，只是响应没回来，重试不安全）。

增加**总预算 30s**：防止 cfFetch 重试 × callApiWithRetry 重试叠加导致等待过长。

> **注意**：30s 是 **soft budget**——在循环开头检查，如果第 N 次 iteration 在 29s 时开始，
> 它的 callApiOnce 仍会跑完（最多加 12s timeout）。实际最坏等待 ~41s。
> 这是有意的——不在 mid-flight 取消已发出的请求。

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

> **幂等安全性**：
>
> - `NETWORK_ERROR` 重试安全：`fetch()` 抛异常 = 请求未到达服务器 = 无副作用。
> - `SERVER_ERROR` 重试安全：非 JSON 响应 = Cloudflare proxy 错误页（502/503），Worker 未处理请求。
> - `TIMEOUT` **不重试**：请求可能已执行。大部分游戏操作靠 reducer state check 天然幂等（step 前进后忽略重复 ack），但不是所有 action 都有此保护，因此不冒险。
> - `CONFLICT_RETRY` / `INTERNAL_ERROR` 重试安全：服务端明确告知可重试。

### 3.5 Layer 2: CFAuthService.initAuth — 删手动重试

**现在**: 手动 for 循环 + try/catch + exponential backoff。
**改后**: cfFetch 已内建网络重试，只保留业务判断（401/403 → 清 token）。

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

### 3.6 Layer 2: CFStorageService.uploadAvatar — 接入网络重试

**现在**: 直接 `fetch()` 上传 multipart/form-data，零重试。
**改后**: 用 `fetchWithRetry`。

但 `fetchWithRetry` 在 §3.3 中已经决定导出（供 apiUtils 使用）。所以直接用不破坏封装。

为了统一 cfFetch.ts 的上传 API（JWT 注入 + JSON 解析），额外新增 `cfUpload` 函数：

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

CFStorageService 改为调 `cfUpload`。

### 3.7 Layer 3: Auth mutations — useMutation 化

**新文件**: `src/hooks/mutations/useAuthMutations.ts`

将 AuthContext 中 11 个手动 try/catch + useState(loading) 方法改为 useMutation。

> **TanStack Query v5 社区惯例**（查阅 context7 确认）：
>
> - mutation 默认 `retry: 0`（官方文档："By default, React Query does not retry mutations on error"）。
>   各 mutation 自行声明 `retry` 是标准做法。
> - **`networkMode: 'offlineFirst'`**：TanStack 内建的离线→恢复自动重试机制。
>   "mutations that fail due to an offline state will automatically be retried once the device reconnects"。
>   对国内弱网场景，这可能比手动 `retry: 2 + retryDelay` 更合适——设备从弱网恢复后自动重试，不需要用户手动重新操作。
>   **建议在 auth mutations 中评估使用**，实施时决定。

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

**单独文件**: `src/hooks/mutations/useUploadAvatar.ts`

`uploadAvatar` 属于 storage/upload 领域，不属于 auth，单独拆出：

```typescript
export function useUploadAvatar() {
  const { storageService } = useServices();
  return useMutation({
    mutationFn: (fileUri: string) => storageService.uploadAvatar(fileUri),
    retry: 1,
  });
}
```

**继续 `useAuthMutations.ts`**（剩余 6 个 hooks）：

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

> **微信登录/绑定 retry 设计说明**：
>
> 微信 code 是一次性的（用过即失效），但两层重试仍然安全：
>
> - **Layer 1 cfFetch 网络重试（生效）**：`fetch()` 抛异常 = 请求没到服务器 = code 没被消费 = 重试安全。
>   极少数"请求发出但响应丢了"的情况，重试后服务端返回"code 已使用"错误，不比不重试更差。
> - **Layer 3 useMutation retry: 0（不重试）**：服务端已返回 HTTP 响应（200/4xx/5xx），
>   code 可能已被消费，重试无意义。用户需重新走微信授权拿新 code。
>
> 所以 `retry: 0` 只关闭 useMutation 层重试，cfFetch 网络层重试对微信仍然生效。

### 3.8 Layer 3: Room mutations — useMutation 化

**新文件**: `src/hooks/mutations/useRoomMutations.ts`

```typescript
export function useCreateRoom() {
  const { roomService } = useServices();
  return useMutation({
    mutationFn: (params: {
      hostUserId: string;
      initialRoomNumber?: string;
      maxRetries?: number;
      buildInitialState?: (roomCode: string) => GameState;
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

### 3.9 Layer 3: Game actions — 保持 callApiWithRetry

**不改为 useMutation。原因：架构模型不匹配。**

游戏操作走 `defineGameAction` → `callApiWithRetry`，与 TanStack Query 的 cache 模型根本不兼容：

1. **状态管理模型不同** — 游戏状态由 GameStore（authoritative server state 的 local mirror）管理，由 WebSocket snapshot 驱动更新，不是 HTTP 响应驱动。TanStack Query cache 管的是 server state 的 client-side cache，两者是不同的数据流
2. **调用方不在 React 树内** — 游戏 action 由 `GameFacade` 类和 `AudioOrchestrator` 类调用，useMutation 是 React hook，无法在 class 内使用
3. **20+ 个动作共享 `defineGameAction` 工厂** — 统一的 guard → build body → callApi → after hook 流程，改 useMutation 要重写整个工厂模式

这是 2026 游戏客户端的标准分层：meta-game（大厅/账户/商店）用 TanStack Query，core-game（实时操作）用专用 state store + WebSocket。

**正确做法**: 在 3.4 中已解决 — callApiWithRetry 现在重试网络错误。

### 3.10 Layer 4: AuthContext 简化

**现在**: AuthContext 包含 11 个 async 方法，每个都手动 setLoading + try/catch + handleAuthError。
**改后**: AuthContext 只保留 `user`, `loading`（init 阶段），`error`。mutations 移到消费者用 useMutation。

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

**Screen 消费者改法示例**：

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

**现在**: SettingsScreen 通过 AuthContext 调 updateProfile / changePassword。
**改后**: 直接用 useUpdateProfile / useChangePassword mutation。

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

### 3.12 Layer 4: ConnectionStatusBar — 加手动重连按钮

**现在**: WS 进入 Failed 状态后，只显示"连接断开，正在重连"但没有可操作 UI。
**改后**: Failed 状态显示"连接失败"+"点击重连"按钮。

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

需要从 ConnectionManager 暴露 `manualReconnect()` 方法（已有 `MANUAL_RECONNECT` 事件支持）。

> **注意**: ConnectionFSM 的 Failed 状态已支持三种自动恢复触发器：`MANUAL_RECONNECT`、`NETWORK_ONLINE`、`VISIBILITY_VISIBLE`。
> 用户切回前台或网络恢复时 FSM 会自动从 Failed → Reconnecting，手动重连按钮是两者都不触发时的 fallback。

### 3.13 QueryClient 全局配置

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

### 3.14 非幂等操作保护 — cfPost `noRetry` 选项

**问题**: `fetch()` 抛异常不等于 100% 请求未到达服务端（见 §2.2 警告）。对非幂等操作，网络层自动重试可能导致重复执行。

**项目中的非幂等操作**：

| 操作                          | 端点                   | 风险         | 现有保护                                                          |
| ----------------------------- | ---------------------- | ------------ | ----------------------------------------------------------------- |
| 扭蛋抽奖                      | `POST /api/gacha/draw` | 多扣券多抽   | OCC version check（只防并发，不防重复请求）                       |
| 投票 `submitAction`(wolfVote) | `POST /game/action`    | 同一只狼双投 | reducer step check（step 前进后忽略，但窗口期内无 per-wolf 去重） |

**方案**: 给 `cfPost` 加 `noRetry` 选项，非幂等调用方禁用 Layer 1 网络重试。

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

**消费方**：

```typescript
// GachaService — draw 禁用网络重试
async performDraw(ticketType: TicketType): Promise<DrawResult> {
  return cfPost('/api/gacha/draw', { ticketType }, { noRetry: true });
}
```

`claimDailyReward` 不需要 `noRetry`（服务端有 20h cooldown guard，天然幂等）。

> **远期更优方案**: 服务端加 idempotency key（客户端传 `x-idempotency-key: <uuid>`，服务端用 D1 去重 5min 窗口）。
> 通用性更好，但需要服务端改动，不在此次范围。记录为 follow-up。
>
> **CF 官方文档参考**：Cloudflare Workers 文档 _Use the Platform > Idempotent requests_ 提供了标准模式——
> 客户端生成 `crypto.randomUUID()` 作为 idempotency key，服务端在 D1/KV 中存储 `(key, response)` 并在重复请求时直接返回缓存结果。
> 实施时参考此模式。

---

## 4. UI 设计

### 4.1 核心原则

**静默重试 + 延迟反馈**：用户只看到 loading 稍长一点，不看到中间的重试过程。

| 阶段                      | 用户看到                                            |
| ------------------------- | --------------------------------------------------- |
| mutation.isPending = true | loading spinner / "处理中" / 按钮禁用（和现在一样） |
| 内部重试中                | **同上**（isPending 在重试期间保持 true）           |
| 全部重试失败              | isError = true → **才弹错误提示**                   |

### 4.2 错误提示策略

| 操作类型             | 错误 UI                        | 理由                   |
| -------------------- | ------------------------------ | ---------------------- |
| 登录/注册            | `showErrorAlert` 弹窗          | 阻断流程，用户必须处理 |
| 房间创建/加入        | `showErrorAlert` 弹窗          | 同上                   |
| 修改资料/密码        | `showErrorAlert` 弹窗          | 同上                   |
| 游戏操作（网络错误） | `showErrorAlert` 弹窗          | 阻断流程               |
| 游戏操作（业务拒绝） | `toast.error` 轻提示           | 非致命                 |
| 扭蛋/签到            | `toast.error` 轻提示           | 非致命                 |
| 头像上传             | `showErrorAlert` 弹窗          | 用户在等结果           |
| WS 断线重连中        | ConnectionStatusBar "正在重连" | 自动恢复               |
| WS 重连失败          | "连接失败" + "点击重连"按钮    | 需用户干预             |

### 4.3 小程序微信登录失败 — 专用全屏错误页

现有 Alert 弹窗对小程序不合适：用户点"确定"后无处可去。

**小程序内**：微信 code 一次性，失败后无法重试，需重新进入拿新 code。
显示全屏错误页（不是 Alert）：

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

点击"重新进入" → `wx.miniProgram.reLaunch()` → web-view 重新加载 → URL 带新 code → 重走登录。

**非小程序（浏览器）**：已有 fallback → `signInAnonymously()` → 匿名进入首页。无需额外 UI。

实现：在 `#autoSignIn` 的小程序微信登录 catch 分支中，设置一个 `wechatLoginFailed` 状态，
App 层根据此状态渲染全屏错误页组件（替代当前的 splash screen），而不是弹 Alert。

### 4.4 不新增的 UI

- **不加"重试中 (2/3)"计数器** — 增加用户焦虑，社区不推荐
- **不加全局 offline banner** — `window.online/offline` 在中国不可靠（WiFi 连着但 CF 不通不触发 offline），误导用户
- **不加 failureCount 显示** — 同上

---

## 5. 迁移计划

### Phase 1: 基础设施（cfFetch + apiUtils + config）

| Commit | 文件                                          | 改动                                                                                                                               |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1      | `src/config/api.ts`                           | 超时 8s→12s，新增 `FETCH_RETRY_COUNT` 常量                                                                                         |
| 2      | `src/services/cloudflare/cfFetch.ts`          | 加 `fetchWithRetry`（导出），cfPost/cfGet/cfPut 内部使用，cfPost 加 `options`（extraHeaders, timeoutMs, noRetry），新增 `cfUpload` |
| 3      | `src/utils/errorUtils.ts`                     | `isAbortError()` 扩展覆盖 `TimeoutError`（AbortSignal.timeout 超时错误类型）                                                       |
| 4      | `src/services/facade/apiUtils.ts`             | `callApiOnce` 的 `fetch()` → `fetchWithRetry()` + catch 适配 TimeoutError，`callApiWithRetry` 支持网络错误重试 + 30s 总预算        |
| 5      | `src/services/cloudflare/CFAuthService.ts`    | `initAuth` 删手动重试循环                                                                                                          |
| 6      | `src/services/cloudflare/CFStorageService.ts` | `uploadAvatar` 改用 `cfUpload`                                                                                                     |
| 7      | `src/services/feature/GachaService.ts`        | `performDraw` 加 `{ noRetry: true }`                                                                                               |

**验证**: 运行 `pnpm run quality`。此阶段零 UI 改动。24 个 cfPost/cfGet/cfPut 调用点 + 25 个 callApiOnce 调用点自动获得网络重试（draw 除外）。

### Phase 2: Auth mutations

| Commit | 文件                                                            | 改动                                                 |
| ------ | --------------------------------------------------------------- | ---------------------------------------------------- |
| 8      | `src/hooks/mutations/useAuthMutations.ts`                       | 新建，10 个 auth mutation hooks（不含 uploadAvatar） |
| 9      | `src/hooks/mutations/useUploadAvatar.ts`                        | 新建，uploadAvatar 单独文件（属 storage 领域）       |
| 10     | `src/contexts/AuthContext.tsx`                                  | 简化为只暴露 user/loading/error/refreshUser          |
| 11     | `src/screens/AuthScreen/AuthLoginScreen.tsx`                    | 改用 useSignInAnonymously                            |
| 12     | `src/screens/AuthScreen/AuthEmailScreen.tsx` + `useAuthForm.ts` | 改用 useSignInWithEmail / useSignUpWithEmail         |
| 13     | `src/screens/AuthScreen/AuthForgotPasswordScreen.tsx`           | 改用 useForgotPassword                               |
| 14     | `src/screens/AuthScreen/AuthResetPasswordScreen.tsx`            | 改用 useResetPassword                                |
| 15     | `src/components/auth/LoginOptions.tsx` + `EmailForm.tsx` 等     | 消费 mutation 状态                                   |
| 16     | `src/screens/HomeScreen/HomeScreen.tsx`                         | AuthContext 消费者适配                               |
| 17     | `src/components/AuthGateOverlay.tsx`                            | AuthContext 消费者适配                               |

> **AuthContext 消费者全量**（~28 处 `useAuthContext`）：上述 commit 覆盖所有 auth mutation 消费者。
> 仅消费 `user` / `isAuthenticated` 的文件（如 `useGameRoom.ts`、`RoomScreen.tsx`）不受影响，因为 AuthContext 仍暴露这些字段。

**验证**: 登录/注册/忘记密码 E2E 流程。

### Phase 3: Room + Settings mutations

| Commit | 文件                                                    | 改动                                          |
| ------ | ------------------------------------------------------- | --------------------------------------------- |
| 18     | `src/hooks/mutations/useRoomMutations.ts`               | 新建                                          |
| 19     | `src/screens/ConfigScreen/useConfigScreenState.ts`      | createRoom 改用 useCreateRoom                 |
| 20     | `src/hooks/useRoomLifecycle.ts`                         | joinRoom 改用 mutation                        |
| 21     | `src/screens/SettingsScreen/SettingsScreen.tsx`         | updateProfile / changePassword 改用 mutations |
| 22     | `src/screens/AvatarPickerScreen/AvatarPickerScreen.tsx` | uploadAvatar / updateProfile 改用 mutations   |

**验证**: 创建/加入房间 E2E。

### Phase 4: QueryClient + ConnectionStatusBar

| Commit | 文件                                                        | 改动                                                         |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------ |
| 23     | `src/lib/queryClient.ts`                                    | 更新配置（retry: 2, MutationCache onError）                  |
| 24     | `src/screens/RoomScreen/components/ConnectionStatusBar.tsx` | Failed 状态加手动重连按钮                                    |
| 25     | `src/services/connection/ConnectionManager.ts`              | 暴露 manualReconnect 给 UI                                   |
| 26     | `src/services/cloudflare/CFAuthService.ts` + App 层         | 小程序微信登录失败 → wechatLoginFailed 状态 + 全屏错误页组件 |

**验证**: `pnpm run quality` + E2E 全量。

### Phase 5: 清理 mutation hooks 临时 retry

Phase 1 的 fetchWithRetry 已在 cfPost 层处理网络重试。mutation hooks 上的 `retry` 是双层重试（TanStack retry 重跑整个 mutationFn，内部 cfPost 再重试网络），应清除。

TanStack Query 社区惯例：mutations 默认 `retry: 0`，网络重试归 transport 层。

| Commit | 文件                                      | 改动                                                                     |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------ |
| 27     | `src/hooks/mutations/useAuthMutations.ts` | 8 个 hook 删 `retry` + `retryDelay`（保留 wechat/signOut 的 `retry: 0`） |
| 28     | `src/hooks/mutations/useRoomMutations.ts` | 2 个 hook 删 `retry`                                                     |

**验证**: `pnpm run quality`。

---

## 6. 不改的部分

| 部分                                                 | 理由                                                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defineGameAction` + `callApiWithRetry` 保持现有模式 | 架构模型不匹配：游戏状态由 GameStore + WebSocket 驱动，不是 HTTP response cache；调用方在 class 内（GameFacade/AudioOrchestrator），无法使用 React hook |
| `AIChatService.streamChat`                           | SSE streaming 不适合重试                                                                                                                                |
| WebSocket (ConnectionFSM/ConnectionManager)          | 已完善，不在此次范围                                                                                                                                    |
| `useDrawMutation` / `useClaimDailyRewardMutation`    | 已正确使用 useMutation ✅                                                                                                                               |
| `useQuery` hooks (stats/profile/unlocks/gacha)       | 已正确使用 useQuery ✅                                                                                                                                  |

### 6.1 networkMode 评估

TanStack Query 提供三种 `networkMode`：`online`（默认）、`offlineFirst`、`always`。

**不采用 `offlineFirst`**：该模式适用于 Service Worker 离线缓存或 HTTP Cache-Control 场景（首次请求可能从本地缓存命中）。本项目所有请求直连 Cloudflare Workers API，无本地缓存层，`offlineFirst` 只会在离线时白发一次注定失败的请求。

**不采用 `always`（暂不改动）**：`always` 模式忽略 `navigator.onLine` 状态，不暂停请求。当前默认 `online` 模式下，中国用户 WiFi 连着但 CF 不通时 `navigator.onLine === true`，mutation 不会被 paused，行为等同 `always`。显式设 `networkMode: 'always'` 可让语义更明确，但无实际行为差异，优先级低。

**结论**：保持默认 `networkMode: 'online'`。网络韧性由 cfPost fetchWithRetry + callApiWithRetry 网络重试保证，不依赖 TanStack 的网络状态检测。

---

## 7. 改动统计

| 类别                       | 文件数       | 新建                                            |
| -------------------------- | ------------ | ----------------------------------------------- |
| 基础设施 (Phase 1)         | 7            | 0                                               |
| Auth mutations (Phase 2)   | 10           | 2 (`useAuthMutations.ts`, `useUploadAvatar.ts`) |
| Room/Settings (Phase 3)    | 5            | 1 (`useRoomMutations.ts`)                       |
| QueryClient + UI (Phase 4) | 4            | 0                                               |
| **总计**                   | **~26 文件** | **3 新文件**                                    |

---

## 8. 风险与缓解

| 风险                                       | 影响                       | 缓解                                                                                                                                                    |
| ------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cfFetch 重试导致重复提交                   | 副作用执行两次             | fetch() 抛异常 **大概率** = 请求没到服务器，但边界情况存在（见 §2.2）。非幂等操作用 `noRetry` 保护                                                      |
| cfFetch 重试非幂等操作（gacha draw）       | 多扣券多抽                 | `noRetry: true` 禁用网络层重试。远期加服务端 idempotency key                                                                                            |
| callApiWithRetry 网络重试导致游戏操作重复  | 状态错乱                   | 只重试 NETWORK_ERROR/SERVER_ERROR（请求未到达/未处理），不重试 TIMEOUT。reducer state check 提供额外保护（step 前进后忽略重复 ack）                     |
| AuthContext 简化后消费者断裂               | 编译报错                   | Phase 2 覆盖全部 ~28 个 useAuthContext 消费点，逐文件迁移 + tsc 验证                                                                                    |
| 微信 code 被重试                           | 服务端报 code 已使用       | signInWithWechat/bindWechat retry: 0                                                                                                                    |
| 超时 12s 导致用户等太久                    | 体验差                     | 实际 99% 场景 <3s，12s 是兜底。cfFetch 重试是网络层错误（通常 <3s 就知道）                                                                              |
| 非 JSON 响应（502/503）被 cfFetch 重试     | 无意义重试                 | 502/503 是 HTTP Response，fetch 不抛异常，不触发重试。只有 parseJsonResponse 报错，抛到调用方                                                           |
| ~~withTimeout Promise.race ghost request~~ | ~~超时后请求继续在后台跑~~ | **已解决**：所有 fetch 调用统一迁移到 `AbortSignal.timeout()`，超时后 abort 请求（TCP 连接关闭），不存在 ghost request。非幂等操作额外用 `noRetry` 保护 |
| wolfVote 同一只狼双投                      | 投票结果偏差               | DO 单线程 + inline progression 提供事实上的保护。远期 follow-up：handler 层加 per-seat 去重 guard                                                       |

---

## 9. 验证检查清单

- [ ] `pnpm run quality` 通过
- [ ] E2E: 匿名登录 → 创建房间 → 入座 → 游戏流程
- [ ] E2E: 邮箱注册 → 登录 → 修改资料 → 修改密码
- [ ] E2E: 扭蛋抽奖
- [ ] 手动: 断网 → 操作 → 恢复 → 自动成功
- [ ] 手动: 国内网络环境测试（如有条件）
- [ ] 手动: WS Failed 状态 → 点击重连按钮 → 恢复
- [ ] 手动: 小程序微信登录失败 → 全屏错误页 → 点击"重新进入" → wxReLaunch 正常

---

## 附录 A: 幂等性分析

逐个验证了每个 DO handler 和 API 端点的幂等性，判断网络层重试是否安全。

### 游戏操作（通过 callApiWithRetry）

| 操作                         | 幂等   | 重试安全   | 保护机制                                                                                                                                                                                                                |
| ---------------------------- | ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handleJoinSeat`（同座同人） | ✅     | 安全       | userId match 允许重入，数据覆写                                                                                                                                                                                         |
| `handleLeaveMySeat`          | ✅     | 安全       | `mySeat === null` → `REASON_NOT_SEATED`                                                                                                                                                                                 |
| `handleKickPlayer`           | ✅     | 安全       | `players[seat] === null` → `REASON_SEAT_EMPTY`                                                                                                                                                                          |
| `handleClearAllSeats`        | ✅     | 安全       | 空 iterator → 0 actions                                                                                                                                                                                                 |
| `handleAssignRoles`          | ✅     | 安全       | Status gate `Seated` → `Assigned`，第二次 `invalid_status`                                                                                                                                                              |
| `handleStartNight`           | ✅     | 安全       | Status gate `Ready` → `Ongoing`，第二次 `invalid_status`                                                                                                                                                                |
| `handleRestartGame`          | ✅     | 安全       | 无 status gate，但 reset to initial state，效果等价                                                                                                                                                                     |
| `handleSetAudioPlaying`      | ✅     | 安全       | Boolean 纯赋值                                                                                                                                                                                                          |
| `handleViewedRole`           | ✅     | 安全       | `hasViewedRole: true` → 幂等赋值                                                                                                                                                                                        |
| `groupConfirmAck`            | ✅     | 安全       | **显式去重**：`if (acks.includes(seatNum)) return handlerSuccess([])`                                                                                                                                                   |
| `revealAck`                  | ✅     | 安全       | `pendingRevealAcks.length === 0` → `no_pending_acks`                                                                                                                                                                    |
| `audioAck`                   | ✅     | 安全       | `!isAudioPlaying` → 空 actions                                                                                                                                                                                          |
| `progression`                | ✅     | 安全       | evaluateProgression 完整 guard 链 + `MAX_PROGRESSION_LOOPS`                                                                                                                                                             |
| **`handleSubmitAction`**     | **⚠️** | **有条件** | Gate 4b `expectedSchemaId !== currentStepId` → `step_mismatch`。step 内无去重，但 DO 单线程 + inline progression 在 processAction 中同步推进 step。**wolfVote 步骤例外**：多人投票不立即推进 step，同一只狼理论上可双投 |

### cfPost/cfGet/cfPut 操作（通过 cfFetch）

| 操作                           | 幂等   | 重试安全         | 保护机制                                                                     |
| ------------------------------ | ------ | ---------------- | ---------------------------------------------------------------------------- |
| `POST /auth/anonymous`         | ❌     | **可接受**       | 每次创建新 UUID。重试 = 孤儿匿名用户（无业务影响）                           |
| `POST /auth/signup`            | ✅     | 安全             | email 唯一约束 → 重复 = 409                                                  |
| `POST /auth/signin`            | ✅     | 安全             | 无副作用，返回 token                                                         |
| `POST /auth/signout`           | ✅     | 安全             | 重复 signout 无副作用                                                        |
| `PUT /auth/profile`            | ✅     | 安全             | 纯赋值更新                                                                   |
| `PUT /auth/password`           | ✅     | 安全             | 旧密码验证 + 新密码写入                                                      |
| `POST /auth/forgot-password`   | ✅     | 安全             | 可能发重复邮件，有 rate limit                                                |
| `POST /auth/wechat`            | ⚠️     | **Layer 1 安全** | code 一次性，但 fetch 异常 = code 没被消费。useMutation retry:0              |
| `POST /room/create`            | ✅     | 安全             | DO init 用 `INSERT OR REPLACE`，幂等                                         |
| `POST /room/get`               | ✅     | 安全             | 只读                                                                         |
| **`POST /api/gacha/draw`**     | **❌** | **不安全**       | OCC version check 只防并发。重试 = 多扣券多抽。**已用 `noRetry: true` 保护** |
| `POST /api/gacha/daily-reward` | ✅     | 安全             | 20h cooldown guard                                                           |

### Follow-up（不在此次范围）

| 项目                                      | 优先级 | 说明                                                                                                                                                    |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 服务端 idempotency key                    | P1     | `x-idempotency-key: <uuid>`，D1 存 key+result，5min 窗口去重。参考 CF 官方文档 _Idempotent requests_ 模式                                               |
| `handleSubmitAction` per-seat 去重        | P2     | handler 层加 `actions.some(a => a.schemaId === schemaId && a.actorSeat === seat)` 检查                                                                  |
| ~~`withTimeout` 加 AbortController 选项~~ | ~~P2~~ | **已在本次改造中解决**：所有 fetch 调用统一迁移到 `AbortSignal.timeout()`，超时即 abort。`withTimeout` 仅保留给非 fetch 的 Promise（如 DO RPC timeout） |
