# 网络韧性设计

> 本文描述当前多游戏平台的网络与重放语义。旧的 pre-command-pipeline 方案已归档到
> `docs/archive/network-resilience-design-v1.md`，不得作为现行实现依据。

## 1. 目标与边界

网络层要在弱网、超时、WebSocket 断线、页面后台恢复和 Worker 中断时保持以下不变量：

1. 服务端 `GameRoom` 是游戏状态唯一权威来源。
2. HTTP response 丢失不能让同一用户意图变成第二条命令。
3. WebSocket 丢失只影响实时性，不能造成状态永久缺失。
4. 已提交的 post-commit effect 和用户通知不能依赖在线 socket 才能完成。
5. 协议损坏必须 fail fast，不能转换成可重试业务错误。
6. 认证、命令幂等、状态恢复和用户事件确认各自只有一套机制。

本文不把 TanStack Query 用作游戏状态缓存。账号、统计、抽卡等 meta-game 请求可以使用 Query；实时房间
仍使用 `RoomSession + ConnectionManager`；`RoomSession` 同时持有权威 snapshot mirror 与 command session。

## 2. 当前分层

```text
UI / game controller
        |
        v
GameFacade
  |- RoomCommandSession -------- POST /room/command
  |                                |
  |                                v
  |                         GameRoom receipt/state/outbox
  |
  `- ConnectionManager --------- WebSocket
                                   |-- STATE_SYNC_REQUEST/STATE_SYNC_RESPONSE
                                   |-- STATE_UPDATE
                                   `-- durable user event + USER_EVENT_ACK
```

职责边界：

- `cfFetch`：JWT 注入、`AbortSignal.timeout()`、网络层 retry、401 single-flight refresh、严格 JSON error。
- `roomCommandTransport`：只发送已 prepare 的 immutable envelope，解析共享 command result contract。
- `RoomCommandSession`：拥有 command ID 生命周期、同意图合并、snapshot generation 隔离。
- `CFRealtimeService`：WebSocket 建连、严格 wire parser、广播 revision 检查；不负责 reconnect。
- `ConnectionManager`：纯 FSM 的 imperative shell，负责 reconnect、ping/pong、关联快照同步和生命周期恢复。
- Worker `user_event_inbox`：认证用户事件的 durable at-least-once delivery。

## 3. HTTP 基础层

### 3.1 认证与 refresh

所有 room command 都经过认证。`cfFetch` 从 token provider 读取 access token；多个并发 401 共享一个 refresh
promise，避免 rotation token 被并发消费。refresh 成功后原请求只重发一次，且 room command body 不变。

WebSocket handshake 不能像普通 fetch 一样读取 401 body，因此 `CFRealtimeService` 在创建 socket 前调用同一
single-flight token refresh。refresh 期间若发生新的 connect/disconnect，generation 会使旧建连失效。

### 3.2 网络 retry

`cfFetch` 只在 `fetch()` 抛出网络 `TypeError` 时执行有限 retry；Abort/Timeout 和编程错误立即抛出。调用者可
对不具备幂等键的 endpoint 显式使用 `noRetry`。

Room command 不依赖“请求大概没到服务端”来判断 retry 是否安全。它有持久化 command receipt，因此
`roomCommandTransport` 可以在 timeout、5xx 和网络错误后用完全相同的 envelope 做有限重发。

## 4. Room command 生命周期

### 4.1 Immutable envelope

```ts
interface PreparedRoomCommand<TCommand> {
  readonly roomCode: string;
  readonly commandId: string;
  readonly command: Readonly<TCommand>;
  readonly controlledSeat: number | null;
}
```

`prepareRoomCommand` 深度冻结 command 和 envelope。`RoomCommandSession` 用排序后的 canonical JSON 生成
intent key，key 包含 room、controlled seat 和完整 command。禁止 circular reference、非有限数字、class
instance、`bigint`、function 等非 JSON 值。

### 4.2 Pending state

Session 以 `(roomCode, userId)` 为身份边界：

- 首次意图生成一个 command ID。
- 同一意图并发触发时共享一个 in-flight promise。
- 收到 `committed` 或 canonical `rejected` decision 后删除 pending envelope。
- `no_state` 404、网络错误、timeout、5xx、overload 不代表服务端 decision，保留原 envelope。
- response command ID、snapshot 或 state codec 非法时抛协议错误，也保留原 envelope。
- 切换 room/user 或 leave 会递增 generation 并清空 pending；旧 response 不能应用 snapshot。

服务端 receipt 绑定 actor、controlled seat、game type/version 和 canonical request JSON。同 ID 同请求返回原
decision；同 ID 换身份或 body 返回 `command_id_conflict`，不能在新 state 上重新解释。

### 4.3 Availability 与 decision

`no_state` 是 HTTP 404 availability，不是伪造的 `RoomCommandResult`。所有真正的 command decision 都返回
共享 protocol envelope，并携带请求的 exact command ID。客户端只有在解析、ID 校验和 state codec 全部
通过后才应用 committed snapshot。

## 5. State recovery

### 5.1 两类状态消息

每个 `STATE_UPDATE` 必须通过共享 parser 验证 game type、state version、revision 和 state。单个 socket 上
revision 必须严格递增；重复、倒退、未知 message type 或非法 JSON 都关闭 1002 protocol error。

`STATE_SYNC_REQUEST` 携带非空 request ID。Worker 从当前 `GameRoom` 同步读取完整 snapshot，并在同一 socket
返回相同 request ID 的 `STATE_SYNC_RESPONSE`。已初始化房间缺少 snapshot 是服务端完整性错误：记录日志、上报
Sentry，并关闭 1011 `state_unavailable`。

同步响应和广播使用独立顺序语义。同步响应可能与已经到达的广播 revision 相同，也可能因竞态更旧，因此不更新
`CFRealtimeService` 的广播 revision 游标。`RoomSession` 统一收敛完整 snapshot：旧 revision 忽略；相同 revision
要求 canonical payload 一致；新 revision 替换当前状态。

WebSocket 只传 committed snapshot，不承担命令确认的唯一职责。HTTP command response 同样携带 committed
snapshot，因此任一通路先到都按上述 revision 规则收敛。

### 5.2 Connection FSM

内部状态为：

```text
Idle -> Connecting -> Syncing -> Connected
                  \-> Disconnected -> Reconnecting -> Failed
                                             \-> Connected
```

`ConnectionManager` 的恢复机制：

- connect 只建立 WebSocket；socket open 后立即发送新的 `STATE_SYNC_REQUEST`，并启动 10 秒同步截止时间。
- 只有 request ID 与当前 pending request 完全一致的 `STATE_SYNC_RESPONSE` 才能进入 Connected。
- Syncing 期间到达的 `STATE_UPDATE` 可以应用，但不能越过同步屏障；未关联或 ID 不匹配的同步响应是协议错误。
- 同步请求发送失败或 10 秒内没有响应时关闭 socket，进入统一的断线重连路径。
- 每 25 秒 ping，10 秒无 pong 时主动关闭 socket 并进入断线重连。
- reconnect 使用 FSM 生成的 exponential backoff + jitter，最多 15 次；网络恢复、页面可见或手动操作可重启。
- Connected 状态进入后台时暂停 ping；恢复前台后重新进入 Syncing，并在原 socket 请求新的完整 snapshot。
- Syncing 状态进入后台时关闭 socket 且暂停重连；恢复前台后建立新 socket，再发起新的关联同步。
- 状态恢复不执行 HTTP snapshot 请求或 revision poll。异步建连带 generation，过期任务不能改变当前连接。

## 6. Durable user events

Settlement result 等用户私有通知不能只做 WebSocket unicast。Worker 按以下顺序处理：

1. 以 `(user_id, event_id)` 写入 D1 `user_event_inbox`。
2. 冲突时读取原 row；type 或原始 payload 不一致立即报完整性错误。
3. 尝试向当前 room 中该用户的 socket 推送最早未确认事件。
4. 客户端 listener 成功消费后发送严格的 `{type:'USER_EVENT_ACK', eventId}`。
5. Worker 从 socket tag 取得真实 user ID，只删除该用户自己的 row，再发送下一条。

断线、listener 抛错、ACK 丢失和 App 重启都不会删除服务端 row。客户端在当前用户生命周期内按 event ID
避免重复展示；重复投递仍重发 ACK。同 ID payload 改变是协议损坏，不做“以最后一次为准”的容错。

## 7. Effect recovery 与删除

Engine commit、receipt 和 effect outbox 在一个 DO transaction 中完成。外部 I/O 失败只推进 outbox retry，
不能把已提交 command 改写成失败。

房间删除前必须确认 outbox 没有任何 row，包括 terminal `failed` row。存在未处理 effect 时返回
`room_effects_pending`；修复或 reconcile effect 后才能删除。用户事件已经进入 user-scoped D1 inbox 后，不再
依赖原房间 DO 生命周期。

## 8. 错误分类

| 分类                | 示例                                 | 客户端行为                             |
| ------------------- | ------------------------------------ | -------------------------------------- |
| canonical decision  | `seat_taken`、`not_host`             | 释放 command ID，显示业务反馈          |
| availability        | 404 `no_state`                       | 保留 command ID，不应用 snapshot       |
| delivery unknown    | network、timeout、5xx                | 保留 command ID，后续重发同一 envelope |
| auth expired        | refresh 明确返回 expired             | 清理 session，要求重新登录             |
| protocol corruption | ID 不匹配、非法 state、revision 倒退 | fail fast、记录错误、关闭错误 socket   |
| storage integrity   | room identity/version/payload 冲突   | Worker 抛错并上报，不降级为业务 reason |

## 9. 验证门禁

涉及 command、realtime 或恢复语义的改动至少覆盖：

- 同一意图 retry 使用 exact command ID/body。
- delivery unknown 和 `no_state` 不释放 pending envelope。
- terminal decision 才释放 pending envelope。
- leave/switch 后晚到 response 不应用 snapshot。
- socket revision 重复或倒退关闭协议连接。
- broadcast 不能替代关联同步响应进入 Connected。
- 同步超时或发送失败关闭旧 socket，并通过重连请求完整 snapshot。
- Syncing 期间进入后台会关闭 socket；页面恢复可见后建立新连接并请求完整 snapshot。
- Connected 页面恢复可见时在现有 socket 请求完整 snapshot。
- durable event 在离线后重连 replay，ACK 只能删除认证用户自己的 row。
- listener 失败不 ACK，重复 event 不重复展示但会再次 ACK。
- outbox 未清空时房间删除失败。
- `pnpm run quality` 和受影响的 Playwright 流程通过。
