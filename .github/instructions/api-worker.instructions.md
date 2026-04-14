````instructions
---
applyTo: packages/api-worker/**
---

# @werewolf/api-worker 规范

Cloudflare Worker（Durable Objects + D1 + R2）。Game API + Auth API。

## Handler 请求体校验

- 所有 handler 使用 `parseBody(req, schema, env)` 解析 + 校验请求体。禁止 `(await req.json()) as { ... }` 类型断言。
- `parseBody` 返回 `T | Response`：校验失败返回 400（`VALIDATION_ERROR` + 首个 issue detail），成功返回强类型数据。
- roomCode-only 的 handler 用 `createSimpleHandler` factory（内部已用 `parseBody` + `roomCodeSchema`）。

## Zod Schema 文件

- Schema 定义在 `src/schemas/`，按路由分模块（`auth.ts`、`game.ts`、`night.ts`、`room.ts`、`gemini.ts`、`shareImage.ts`）。
- 项目使用 **zod 4**。用顶级格式校验器（`z.email()`、`z.url()` 等），不用已废弃的方法链（`z.string().email()`）。
- seat 数字用 `z.coerce.number().int().min(0)`。discriminated union 按 `action` / `type` 字段区分。
- Schema 新增/修改时，必须同步更新对应 handler 的 `parseBody` 调用和解构。

## Handler 模式

```typescript
export const handleXxx: HandlerFn = async (req, env) => {
  const parsed = await parseBody(req, xxxSchema, env);
  if (parsed instanceof Response) return parsed;
  // ... 业务逻辑，用 parsed.field（强类型，无需手动校验）
};
````

## 共享工具（`handlers/shared.ts`）

| 导出                             | 用途                                      |
| -------------------------------- | ----------------------------------------- |
| `parseBody<T>(req, schema, env)` | JSON 解析 + zod 校验                      |
| `createSimpleHandler(rpcMethod)` | roomCode-only handler factory             |
| `callDO(fn, env)`                | DO RPC 错误处理（retryable / overloaded） |
| `getGameRoomStub(env, roomCode)` | 获取 DO stub                              |
| `resultToStatus(result)`         | `{ success, reason }` → HTTP 状态码       |
| `isValidSeat(value)`             | seat number type guard（供测试使用）      |

```

```
