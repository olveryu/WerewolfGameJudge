---
name: 'API Worker'
description: 'Cloudflare Worker 规范：Hono 路由、Zod 校验、DO 调用、扭蛋系统、认证中间件'
applyTo: 'packages/api-worker/**'
---

# @werewolf/api-worker 规范

Cloudflare Worker（Durable Objects + D1 + R2）。Game API + Auth API。
使用 **Hono** 框架（`hono/cors`、`hono/validator`、`hono/http-exception`、`hono/factory`）。

## 路由组织

- 每个 handler 文件导出一个 Hono 子路由：`export const xxxRoutes = new Hono<AppEnv>()`。
- `index.ts` 用 `app.route('/prefix', xxxRoutes)` 挂载。
- CORS 由 `hono/cors` 中间件统一处理（`app.use('*', cors(...))`）。

## 请求体校验

- 使用 `jsonBody<T>(schema)` 中间件（`handlers/shared.ts`，基于 `hono/validator`）校验 JSON body。
- 校验失败返回 400（`{ success: false, reason: 'VALIDATION_ERROR', detail }`）。
- handler 中用 `c.req.valid('json')` 获取强类型数据。禁止 `(await req.json()) as { ... }`。

## Zod Schema 文件

- Schema 定义在 `src/schemas/`，按路由分模块（`auth.ts`、`game.ts`、`night.ts`、`room.ts`、`gemini.ts`、`shareImage.ts`）。
- 项目使用 **zod 4**（`^4.3`）。关键变化：
  - 顶级格式校验器（`z.email()`、`z.url()` 等），不用已废弃的方法链（`z.string().email()`）。
  - `z.input<typeof schema>` / `z.output<typeof schema>` 替代旧版 `z.infer<>`（`z.infer` 仍可用但 `z.output` 更精确）。
  - Zod 4 实现 Standard Schema 接口，Hono 内置 `validator('json', zodSchema)` 可直接使用，但本项目使用自定义 `jsonBody(schema)` 中间件——因为需要统一错误响应格式（`{ success: false, reason: 'VALIDATION_ERROR', detail }`）和结构化日志，内置 validator 的错误格式不可控。
- seat 数字用 `z.coerce.number().int().min(0)`。discriminated union 按 `action` / `type` 字段区分。
- Schema 新增/修改时，必须同步更新对应 handler 的 `jsonBody` 调用和解构。

## Handler 模式

```typescript
// 带 body 校验的路由
xxxRoutes.post('/action', jsonBody(xxxSchema), async (c) => {
  const { field } = c.req.valid('json');
  const env = c.env;
  // ... 业务逻辑
  return c.json(result, resultToStatus(result));
});

// 需要认证的路由
xxxRoutes.post('/action', requireAuth, jsonBody(xxxSchema), async (c) => {
  const userId = c.var.userId;
  // ...
});
```

## 认证中间件

- `requireAuth`（`lib/auth.ts`，`createMiddleware` from `hono/factory`）：验证 Bearer token，设置 `c.var.userId` 和 `c.var.jwtPayload`。
- 可选认证（如 signup）在 handler 内 inline 处理 `extractBearerToken` + `verifyToken`。

## 错误处理

- `callDO(fn)` 在 DO 错误时抛 `HTTPException`（503 retryable、429 overloaded）。
- `app.onError` 统一捕获 `HTTPException`、`SyntaxError`（malformed JSON）、泛型错误。
- Handler 内不需要 `try/catch` DO 调用错误。

## 共享工具（`handlers/shared.ts`）

| 导出                      | 用途                                          |
| ------------------------- | --------------------------------------------- |
| `jsonBody<T>(schema)`     | `hono/validator` 中间件，JSON 解析 + zod 校验 |
| `callDO<T>(fn)`           | DO RPC 调用 + HTTPException 错误处理          |
| `getGameRoomStub(env, c)` | 获取 DO stub                                  |
| `resultToStatus(result)`  | `{ success, reason }` → `200 \| 400 \| 500`   |
| `isValidSeat(value)`      | seat number type guard                        |

## 扭蛋系统（Gacha）

### 路由（`gachaHandlers.ts` → `/api/gacha/*`）

| 方法   | 路径                      | Auth | Body Schema         | 说明                                          |
| ------ | ------------------------- | ---- | ------------------- | --------------------------------------------- |
| `GET`  | `/api/gacha/status`       | ✅   | —                   | 券数 / pity / 已解锁数 / lastLoginRewardAt    |
| `POST` | `/api/gacha/draw`         | ✅   | `gachaDrawSchema`   | 抽奖（drawType: normal\|golden, count: 1-10） |
| `POST` | `/api/gacha/daily-reward` | ✅   | `dailyRewardSchema` | 每日登录奖励（localDate: YYYY-MM-DD）         |

### 并发安全

- OCC（乐观并发控制）：`user_stats.version` 列，draw/daily-reward 读 version → 写入 `WHERE version = readVersion`，冲突时重试（MAX_DRAW_RETRIES=3）
- `crypto.getRandomValues()` 生成随机数，概率函数（`rollRarity` / `selectReward`）从 `@werewolf/game-engine` 导入

### 每日登录奖励

- 客户端传 `localDate`（玩家本地时区日期），服务端校验：同日已领取 → `already_claimed`；距上次 < 20h → `cooldown`
- 通过后 normalDraws + 1，更新 `lastLoginRewardAt`

### 结算（`settleGameResults.ts`）

- 每局有效游戏：+1 普通券 + XP
- 每次升级：+1 黄金券
- 幂等 key：`${roomCode}:${revision}`
