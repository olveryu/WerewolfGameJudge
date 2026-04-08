# 全量代码审计报告

**日期**: 2026-04-08  
**范围**: 全项目逐文件审计  
**审计维度**: 正确性 Bug、边界场景、内存泄漏、性能、安全性、错误处理、代码异味、TypeScript 类型安全

---

## 汇总统计

| 严重度      | 数量 |
| ----------- | ---- |
| 🔴 CRITICAL | 2    |
| 🟠 HIGH     | 14   |
| 🟡 MEDIUM   | 40+  |
| 🔵 LOW      | 30+  |

---

## 修复优先级建议

### P0 — 立即修复（阻塞功能 / 安全漏洞） ✅ ALL FIXED

1. ✅ **cors.ts 加 PUT** — 一行修复，恢复 Web 端修改资料/密码功能 `34e034f9`
2. ✅ **index.ts 接收 ExecutionContext** — 防止广播被 CF runtime 截断 `34e034f9`
3. ✅ **gemini-proxy 加认证** — 防止 AI 额度被滥用 `34e034f9`
4. ✅ **upsert-state 加认证或移除** — 消除绕过服务端权威的后门 `34e034f9`

### P1 — 本周修复（安全强化） ✅ ALL FIXED

5. ✅ authHandlers rate limit 统一（邮箱枚举） `135eb123`
6. ✅ 重置验证码加频率限制 `135eb123`
7. ✅ avatarUpload Content-Type 白名单（SVG XSS） `135eb123`
8. ✅ deleteRoom 加 host 校验 `135eb123`

### P2 — 下周修复（正确性 Bug） ✅ ALL FIXED

9. ✅ stepTransitionGuards + wolfRobotHunterGateHandler 用 WOLF_ROBOT_GATE_ROLES `fbbab4fb`
10. ✅ nightActionReducers handleAddRevealAck 加 dedup `fbbab4fb`
11. ✅ useNotepad 修复陈旧读取 `fbbab4fb`
12. ✅ revealExecutor 加 unmount guard `fbbab4fb`
13. ✅ useGameActions.startGame BGM 时序修正 `fbbab4fb`

### P3 — 近期安排（代码质量）

14. SettingsScreen / AvatarPickerScreen 拆分
15. ✅ RoleCardSimple 架构修正 `1689f891`
16. ✅ AuthContext 统一 updateUserIfChanged `1689f891`
17. ✅ 清理 resolvers/shared.ts 死代码 `1689f891`
18. ✅ 主题 token 统一（硬编码值） `1689f891`

### P4 — 潜在正确性 + 错误处理补全 + 安全增强

> MEDIUM 中有运行时风险或可能导致功能异常的项。

19. ✅ M14 — `nightActionReducers` blockedSeat 不对称双写（currentNightResults 缺 blockedSeat 同步） `490838c9`
20. M16 — `DeathCalculator` 单程链式死亡无法跨 link 类型传播（couple→bonded 缺重扫）
21. M17 — `inlineProgression` groupConfirm ack 三路 fallthrough，新增步骤会用错 ack 列表
22. ✅ M22 — `authHandlers` signIn 无频率限制（暴力破解风险） `490838c9`
23. ✅ M27 — `gameStateManager` success:false + non-empty actions 仍被 apply `230acf8a`
24. M26 — `broadcast.ts` sideEffects `[]` vs `undefined` 语义差异未文档化
25. M5 — `stepTransitionHandler` night_end PLAY_AUDIO 缺 `isEndAudio` 字段
26. M30 — `AudioService` #initAudio catch 缺 showAlert（用户无感知音频初始化失败）
27. M31 — `BgmPlayer` `void close()` 的 Promise rejection 未处理
28. M32 — `AIChatService` streamChatMessage 不带 Authorization header（关联 P0 gemini-proxy）
29. ✅ M35 — `useGameActions` updateTemplate 缺少 handleMutationResult 错误处理 `490838c9`
30. ✅ M42 — `bottomActionBuilder` poisonStep! 无 null guard（schema 配置错误时崩溃） `230acf8a`
31. ~~M52~~ — `SettingsScreen` changePassword 错误未经 mapAuthError 映射 — **误报：handleAuthError 已 rethrow mapped Error**
32. ✅ M58 — `AIChatBubble` setTimeout 无 cleanup（卸载后 setState） `230acf8a`
33. ✅ M33 — `useBgmControl` settingsRef/audioRef 挂载后不更新（陈旧引用） `230acf8a`
34. M37 — `useNotepad` restart 检测依赖陈旧 status（关联 P2 useNotepad 修复）
35. M38 — `toLocalState` `as GameStatus` 无运行时校验
36. ✅ M46 — `useActionOrchestrator` confirmThenAct 闭包捕获 schema 可能已陈旧 `230acf8a`
37. M60 — `AIChatBubble.styles` SCREEN_WIDTH/HEIGHT 模块加载一次性取值（旋转后陈旧）

### P5 — TypeScript 类型安全 + DRY + 代码异味 + 性能微优化

> 剩余 MEDIUM（类型断言、DRY、风格）+ 全部 LOW。
> Layer-A（运行时风险）已修复 → 见 P4 中 M27/M33/M42/M46/M58 + 下方 L69 `230acf8a`

**MEDIUM — 类型安全 & 断言清理**

38. M1 — `actionGuards` isSkipAction switch 缺 assertNever default
39. M2 — `actionHandler` `state.thiefSeat!` 非空断言
40. M3 — `actionHandler` 不必要 `as RoleId` 断言
41. M4 — `actionHandler` 跨模块 inline type import `as` 断言
42. M9 — `genericResolver` ROLE_SPECS 双重类型断言（应用 `getRoleSpec()`）
43. M11 — `piper.ts` `as MultiChooseSeatSchema` 绕过类型收窄
44. M12 — `awakenedGargoyle.ts` `as ChooseSeatSchema` 同上
45. M18 — `schemas.ts` buildSchema switch 缺 assertNever
46. M19 — `schemas.ts` `step.meeting!` 非空断言
47. M20 — `schemas.ts` SCHEMAS `as Record<...>` 强转缺完整性断言
48. M28 — `gameControl.ts` `seat!` 非空断言
49. M41 — `useRoomActionDialogs` 多处 `schema.ui!.xxx!` 链式非空断言
50. M43 — `useRoomActions` `SCHEMAS as Record<string, ActionSchema>` 绕过类型安全
51. M44 — `actionIntentHelpers` double-cast + 动态 key 无编译期穷举
52. M56 — `AnimationSettingsScreen` `as RoleRevealAnimation` 无运行时校验
53. M59 — `AIChatBubble` webDragStyle 使用 `any` 类型
54. M64 — `logger.ts` `any` 泛型约束抑制

**MEDIUM — DRY & 代码异味**

55. M6 — `gameControlHandler` reason 中文句子 vs 英文 code 不一致
56. M7 — `wolfRobotHunterGateHandler` 参数顺序与全项目惯例相反
57. M10 — `thief.ts` THIEF_BOTTOM_CARD_COUNT 本地重定义（models 已导出）
58. M13 — `lifecycleReducers` `as RandomizableAnimation` 断言重复（DRY）
59. M15 — `nightActionReducers` handleApplyResolverResult ~78 行过长
60. M21 — `schema.types.ts` MeetingConfig 两处重复定义（DRY）
61. M25 — `night.ts` groupConfirm ack 分派逻辑重复两次（DRY）
62. M40 — `RoomScreen.helpers.ts` wolfVotes legacy fallback double-cast（可能死代码）
63. M45 — `useRoomScreenState` wolfVotesMap POJO→Map 与 toGameRoomLike 重复（DRY）
64. M48 — `useInteractionDispatcher` dispatchInteraction ~100 行 + 嵌套 switch
65. M51 — `SettingsScreen` renderAuthSection ~130 行内部渲染函数
66. M55 — `EncyclopediaScreen` Styles 应拆到 .styles.ts

**MEDIUM — 架构 & 性能**

67. M29 — `AudioOrchestrator` dispose() 从未被调用，reset 不 unsubscribe
68. M34 — `useConnectionStatus` useMemo deps 遗漏 setState 函数（虽无害）
69. M39 — `usePageGuide` cleanupTimer 变量在 .then() 之后声明
70. M47 — `useStepDeadlineCountdown` clearInterval 后同一 tick 多执行一次
71. M49 — `usePWAInstall` beforeinstallprompt 极窄竞态窗口
72. M53 — `AboutSection` 子组件自行调 useColors() 而非 props 接收
73. M54 — `RoleDetailSheet` Presentational 组件 import service
74. M57 — `AIChatBubble` createStyles(colors) 每次 render 无 useMemo
75. M61 — `SimpleMarkdown` style 对象每次 render 新建
76. M62 — `chat.styles.ts` 多处硬编码数字（lineHeight: 20, width: 32 等）
77. M63 — `alert.ts` Web fallback UX 混淆多种模式
78. M65 — `mobileDebug` Clipboard API 无兼容回退
79. M66 — `errorUtils` 网络错误 patterns 不完整
80. M67 — `AppNavigator` ROOM_CHILD_SCREENS Set getStateFromPath 内每次重建
81. M68-M71 — TipCard / InstallMenuItem / HomeScreen styles / ChangePasswordForm 硬编码数字

**LOW — 全部**

82. L1-L27 — Game-Engine LOW（断言风格、readonly 缺失、魔法数字、死配置、注释过期等）
83. L28-L32 — API Worker LOW（冗余 ws.close、as 断言、R2 list 不分页）
84. L33-L38 — Services LOW（冗余 await、三次 HTTP、非空断言、无 timeout）
85. L39-L43 — Hooks LOW（不必要 useMemo、长文件、重复调用）
86. L44-L63 — Screens LOW（未用参数、重复 JSDoc、log 级别、setTimeout 变通等）
87. L64-L69 — Components LOW（未用 props、未 memo、硬编码 borderWidth）— ✅ L69 useBubbleDrag 错误日志已补 `230acf8a`
88. L70-L75 — Utils LOW（空数组替换、as const 冲突、hash DRY、精度）
89. L76-L77 — Contexts LOW（unreachable throw、deps 注释矛盾）
90. L78 — Navigation/Top-Level LOW（splash setTimeout 无 cleanup）

---

## 🔴 CRITICAL (2)

### C1. CORS 缺 PUT 方法

- **文件**: `packages/api-worker/src/lib/cors.ts:8`
- **维度**: 正确性 + 安全性
- **描述**: `Access-Control-Allow-Methods` 仅含 `'GET, POST, OPTIONS'`，缺少 `PUT`。但 `index.ts` 定义了 `PUT /auth/profile` 和 `PUT /auth/password` 路由。浏览器 preflight 失败，修改资料和修改密码功能在 Web 端完全不可用。
- **代码片段**:
  ```ts
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  ```
- **建议修复**: 改为 `'GET, POST, PUT, OPTIONS'`

### C2. Worker 缺 ExecutionContext

- **文件**: `packages/api-worker/src/index.ts:107`
- **维度**: 安全性 / 正确性
- **描述**: Worker fetch handler 缺少 `ctx: ExecutionContext` 参数。`broadcastIfNeeded` 发起的 DO fetch 是 fire-and-forget，Worker 返回 Response 后 CF 可能提前终止尚未完成的子请求，导致广播丢失。
- **代码片段**:
  ```ts
  async fetch(request: Request, env: Env): Promise<Response> {
  ```
- **建议修复**: 接受 `ctx` 并用 `ctx.waitUntil()` 包装 broadcast

---

## 🟠 HIGH (14)

### H1. /gemini-proxy 无认证

- **文件**: `packages/api-worker/src/index.ts:224`
- **维度**: 安全性
- **描述**: `/gemini-proxy` 端点无任何认证。任何知道 API URL 的人可无限调用 Gemini API，消耗服务端 `GEMINI_API_KEY` 额度。
- **建议修复**: 至少加 `extractBearerToken` + `verifyToken` 校验

### H2. Rate limit 泄露邮箱注册状态

- **文件**: `packages/api-worker/src/handlers/authHandlers.ts:413-418`
- **维度**: 安全性（OWASP 用户枚举）
- **描述**: `handleForgotPassword` 先查用户（不存在返回 200）→ 存在再检查 rate limit（超限返回 429）。攻击者对同一邮箱发 4 次请求：存在→200,200,200,429；不存在→200,200,200,200。429 响应泄露了邮箱注册状态。
- **代码片段**:
  ```ts
  if (!user) {
    return jsonResponse({ success: true }, 200, env);
  }
  if (recentCount && recentCount.count >= RESET_RATE_LIMIT) {
    return jsonResponse({ error: '...' }, 429, env);
  }
  ```
- **建议修复**: 将 rate limit check 移到查用户之前（基于 email hash），或不存在时也返回 429

### H3. 重置验证码无频率限制

- **文件**: `packages/api-worker/src/handlers/authHandlers.ts` (handleResetPassword)
- **维度**: 安全性
- **描述**: 重置验证码为 6 位数字（900,000 种）。`handleResetPassword` 无频率限制。攻击者可在 15 分钟有效期内暴力枚举所有可能的验证码。
- **建议修复**: 添加 per-email per-IP rate limit（例如 5 次/15 分钟）或使用更长验证码

### H4. handleUpsertGameState 无认证

- **文件**: `packages/api-worker/src/handlers/roomHandlers.ts:145-164`
- **维度**: 安全性
- **描述**: `handleUpsertGameState` 无认证，任何人可直接覆写任意房间的 `game_state`。绕过了 `processGameAction` 的乐观锁和 game-engine 校验，直接违背「服务端是唯一的游戏逻辑权威」架构原则。
- **代码片段**:
  ```ts
  export async function handleUpsertGameState(request: Request, env: Env): Promise<Response> {
    const body = (await request.json()) as { roomCode?; state?; revision? };
    // ← 无 auth
    await env.DB.prepare(`UPDATE rooms SET game_state = ? ...`).bind(...)
  ```
- **建议修复**: 加 JWT 认证 + 校验 requester 是房间 host，或评估是否移除此端点

### H5. stepTransitionGuards 硬编码 'hunter'

- **文件**: `packages/game-engine/src/engine/handlers/stepTransitionGuards.ts:55`
- **维度**: 正确性 Bug
- **描述**: Gate 4 硬编码 `learnedRoleId === 'hunter'`，但 `revealPayload.ts` 从 spec 的 `gateTriggersOnRoles` 动态派生 `WOLF_ROBOT_GATE_ROLES`。如果新增 gate 触发角色，gate 会被 SET 但不被 ENFORCE，导致步骤提前推进。
- **代码片段**:
  ```ts
  state.wolfRobotReveal?.learnedRoleId === 'hunter' && state.wolfRobotHunterStatusViewed === false;
  ```
- **建议修复**: 导入并使用 `WOLF_ROBOT_GATE_ROLES` 判断

### H6. wolfRobotHunterGateHandler 硬编码 'hunter'

- **文件**: `packages/game-engine/src/engine/handlers/wolfRobotHunterGateHandler.ts:61`
- **维度**: 正确性 Bug
- **描述**: 与 H5 相同问题。`learnedRoleId !== 'hunter'` 时拒绝 "viewed" intent，新增 gate 触发角色时 gate 永久锁死。
- **建议修复**: 使用 `WOLF_ROBOT_GATE_ROLES` 判断

### H7. handleAddRevealAck 缺少去重

- **文件**: `packages/game-engine/src/engine/reducer/nightActionReducers.ts:229-237`
- **维度**: 正确性 Bug
- **描述**: `handleAddRevealAck` 直接 push 无去重，但 `gameReducer` 内所有其他 ACK handler（piper/conversion/cupid）均有幂等去重。相同 ackKey 被重复分发时会累积重复项。
- **代码片段**:
  ```ts
  return {
    ...state,
    pendingRevealAcks: [...existing, ackKey], // ← no dedup!
  };
  ```
- **建议修复**: 添加 `if (existing.includes(ackKey)) return state;`

### H8. CFStorageService uploadAvatar 缺 content-type 检查

- **文件**: `src/services/cloudflare/CFStorageService.ts:43-53`
- **维度**: 错误处理 / HTTP 响应防御
- **描述**: `uploadAvatar` 在 `res.ok` 为 true 时，未检查 content-type 就直接调 `.json()`。非 JSON 响应（代理配置错误）导致 `SyntaxError` 传播到 Sentry，违反 HTTP 响应防御规则。
- **建议修复**: 添加 `content-type` 检查后再调 `.json()`

### H9. useNotepad 陈旧读取

- **文件**: `src/hooks/useNotepad.ts:85`
- **维度**: 正确性
- **描述**: 直接在 render 中调用 `facade.getState()` 而非通过 `useSyncExternalStore`。`gameState` 变化时组件不会重渲染，restart 后笔记状态/模板不更新。
- **代码片段**:
  ```ts
  const gameState = facade.getState(); // ← stale read in render
  ```
- **建议修复**: 从父组件传入已订阅的 gameState

### H10. revealExecutor 轮询竞态

- **文件**: `src/screens/RoomScreen/executors/revealExecutor.ts:34-46`
- **维度**: 正确性 / 竞态条件
- **描述**: 轮询循环 30 次 × 100ms，组件卸载期间 `setPendingRevealDialog` 导致 React `setState on unmounted component` 警告。
- **建议修复**: 使用 mount ref 或 AbortController

### H11. RoleCardSimple 架构违规

- **文件**: `src/components/RoleCardSimple.tsx:18-20`
- **维度**: 架构
- **描述**: Presentational 组件直接 import service (`isAIChatReady`) + `showConfirmAlert`，包含业务逻辑 `handleAskAI`。违反「Presentational 禁止 import services」规则。
- **建议修复**: AI ask 逻辑提升为 callback prop

### H12. AuthContext 绕过 updateUserIfChanged

- **文件**: `src/contexts/AuthContext.tsx:159-274`
- **维度**: 性能 / 正确性
- **描述**: 多个 auth 流程（signUp, signIn, uploadAvatar 等）直接 `setUser()` 绕过 `updateUserIfChanged()`，导致不必要的 re-render。初始加载和刷新 token 正确使用了 `updateUserIfChanged()`，其他路径不一致。
- **建议修复**: 统一通过 `updateUserIfChanged()` 更新

### H13. SettingsScreen 超大 Screen

- **文件**: `src/screens/SettingsScreen/SettingsScreen.tsx`
- **维度**: 代码异味
- **描述**: ~520 行，hook 调用 10+，useMemo+useCallback 10+，副作用 5+。按规范应拆分。
- **建议修复**: 拆为 thin shell + `useSettingsScreenState` hook

### H14. AvatarPickerScreen 超大 Screen

- **文件**: `src/screens/AvatarPickerScreen/AvatarPickerScreen.tsx`
- **维度**: 代码异味
- **描述**: ~560 行，含 AvatarCell 子组件。按规范应拆分。
- **建议修复**: 拆为 thin shell + `useAvatarPickerScreenState` hook

---

## 🟡 MEDIUM

### Game-Engine: Handlers

| #   | 文件                               | 描述                                                   |
| --- | ---------------------------------- | ------------------------------------------------------ |
| M1  | `actionGuards.ts:195-215`          | `isSkipAction` switch 缺 `assertNever` default         |
| M2  | `actionHandler.ts:65`              | `state.thiefSeat!` 非空断言                            |
| M3  | `actionHandler.ts:137-138`         | 不必要的 `as RoleId` 断言                              |
| M4  | `actionHandler.ts:156`             | 跨模块 inline 类型 `as import(...)` 断言               |
| M5  | `stepTransitionHandler.ts:280`     | night_end PLAY_AUDIO 缺 `isEndAudio` 字段              |
| M6  | `gameControlHandler.ts:406-410`    | reason 用中文句子，其他 handler 用英文 code            |
| M7  | `wolfRobotHunterGateHandler.ts:42` | 参数顺序 `(ctx, intent)` 与全项目 `(intent, ctx)` 相反 |

### Game-Engine: Resolvers

| #   | 文件                         | 描述                                                      |
| --- | ---------------------------- | --------------------------------------------------------- |
| M8  | `shared.ts:46,110,164`       | 3 个死工厂函数（被 genericResolver 取代）                 |
| M9  | `genericResolver.ts:148,303` | 双重类型断言 `ROLE_SPECS[x as keyof] as RoleSpec`         |
| M10 | `thief.ts:15`                | `THIEF_BOTTOM_CARD_COUNT = 2` 本地重定义（models 已导出） |
| M11 | `piper.ts:22`                | `as MultiChooseSeatSchema` 绕过类型收窄                   |
| M12 | `awakenedGargoyle.ts:20`     | `as ChooseSeatSchema` 同上                                |

### Game-Engine: Reducer

| #   | 文件                             | 描述                                                        |
| --- | -------------------------------- | ----------------------------------------------------------- |
| M13 | `lifecycleReducers.ts:84,166`    | `as RandomizableAnimation` 断言在两个 handler 中重复（DRY） |
| M14 | `nightActionReducers.ts:190-204` | `handleSetWolfKillOverride` blockedSeat 不对称双写          |
| M15 | `nightActionReducers.ts:89-167`  | `handleApplyResolverResult` ~78 行过长                      |

### Game-Engine: Other

| #   | 文件                         | 描述                                                 |
| --- | ---------------------------- | ---------------------------------------------------- |
| M16 | `DeathCalculator.ts:230-244` | 单程链式死亡无法跨 link 类型传播                     |
| M17 | `inlineProgression.ts:72-80` | groupConfirm ack 三路 fallthrough 到 piperRevealAcks |
| M18 | `schemas.ts` (buildSchema)   | switch 缺 `assertNever` 守卫                         |
| M19 | `schemas.ts:79`              | `step.meeting!` 非空断言                             |
| M20 | `schemas.ts:181`             | `SCHEMAS` 使用 `as Record<...>` 强转缺完整性断言     |
| M21 | `schema.types.ts:~200`       | MeetingConfig 在两处重复定义（DRY）                  |

### API Worker

| #   | 文件                        | 描述                                             |
| --- | --------------------------- | ------------------------------------------------ |
| M22 | `authHandlers.ts` (signIn)  | 登录端点无频率限制                               |
| M23 | `avatarUpload.ts:40-42`     | Content-Type 校验允许 SVG（XSS 风险）            |
| M24 | `roomHandlers.ts:90-97`     | deleteRoom 不验证 requester 是否为 host          |
| M25 | `night.ts:200-260`          | groupConfirm ack 分派逻辑重复两次（DRY）         |
| M26 | `broadcast.ts:18`           | sideEffects `[]` vs `undefined` 语义差异未文档化 |
| M27 | `gameStateManager.ts:83-86` | `success: false` + non-empty actions 仍被 apply  |
| M28 | `gameControl.ts:62`         | `seat!` 非空断言                                 |

### Services

| #   | 文件                       | 描述                                                 |
| --- | -------------------------- | ---------------------------------------------------- |
| M29 | `AudioOrchestrator.ts:115` | `dispose()` 从未被调用，reset 不 unsubscribe         |
| M30 | `AudioService.ts:52-63`    | `#initAudio` catch 缺 showAlert 用户提示层           |
| M31 | `BgmPlayer.ts:168`         | `void this.#webAudioCtx.close()` 的 rejection 未处理 |
| M32 | `AIChatService.ts:143-154` | streamChatMessage 不带 Authorization header          |

### Hooks

| #   | 文件                           | 描述                                                 |
| --- | ------------------------------ | ---------------------------------------------------- |
| M33 | `useBgmControl.ts:63-64`       | settingsRef/audioRef 挂载后不再更新（陈旧引用）      |
| M34 | `useConnectionStatus.ts:48-57` | useMemo deps 遗漏 setState 函数（虽无害）            |
| M35 | `useGameActions.ts:117-123`    | updateTemplate 缺少 handleMutationResult             |
| M36 | `useGameActions.ts:140`        | startGame 在 startNight 之前启动 BGM                 |
| M37 | `useNotepad.ts:153-160`        | restart 检测依赖陈旧 status                          |
| M38 | `toLocalState.ts:47`           | `as GameStatus` 无运行时校验                         |
| M39 | `usePageGuide.ts:66-73`        | cleanupTimer 变量在 .then() 之后声明（代码顺序混淆） |

### Screens: RoomScreen

| #   | 文件                                  | 描述                                                    |
| --- | ------------------------------------- | ------------------------------------------------------- |
| M40 | `RoomScreen.helpers.ts:220-235`       | wolfVotes legacy fallback double-cast                   |
| M41 | `useRoomActionDialogs.ts:100`         | 多处 `schema.ui!.xxx!` 链式非空断言                     |
| M42 | `bottomActionBuilder.ts:244`          | `poisonStep!` 无 null guard                             |
| M43 | `useRoomActions.ts:209`               | `SCHEMAS as Record<string, ActionSchema>` 绕过类型安全  |
| M44 | `actionIntentHelpers.ts:35-40`        | double-cast + 动态 key 无编译期穷举                     |
| M45 | `useRoomScreenState.ts:236-244`       | wolfVotesMap POJO→Map 转换与 toGameRoomLike 重复（DRY） |
| M46 | `useActionOrchestrator.ts:180`        | confirmThenAct 闭包捕获 schema 可能已陈旧               |
| M47 | `useStepDeadlineCountdown.ts:78-95`   | clearInterval 后同一 tick 多执行一次 setCountdownTick   |
| M48 | `useInteractionDispatcher.ts:198-220` | dispatchInteraction ~100 行 + 嵌套 switch               |
| M49 | `usePWAInstall.ts:92-100`             | beforeinstallprompt 极窄竞态窗口                        |

### Screens: Other

| #   | 文件                                      | 描述                                            |
| --- | ----------------------------------------- | ----------------------------------------------- |
| M50 | `AnimationSettingsScreen/styles.ts:41,65` | 硬编码 borderWidth: 1（应用 fixed.borderWidth） |
| M51 | `SettingsScreen.tsx:227`                  | renderAuthSection ~130 行内部渲染函数           |
| M52 | `SettingsScreen.tsx:315`                  | changePassword 错误未经 mapAuthError 映射       |
| M53 | `AboutSection.tsx:21`                     | 子组件自行调 useColors() 而非 props 接收        |
| M54 | `RoleDetailSheet.tsx:25`                  | Presentational 组件 import service              |
| M55 | `EncyclopediaScreen.tsx:460-610`          | Styles 应拆到 .styles.ts 文件                   |
| M56 | `AnimationSettingsScreen.tsx:62,93`       | `as RoleRevealAnimation` 无运行时校验           |

### Components

| #   | 文件                        | 描述                                                 |
| --- | --------------------------- | ---------------------------------------------------- |
| M57 | `AIChatBubble.tsx:43`       | `createStyles(colors)` 每次 render 无 useMemo        |
| M58 | `AIChatBubble.tsx:103-106`  | setTimeout 无 cleanup（卸载后 setState）             |
| M59 | `AIChatBubble.tsx:126-127`  | webDragStyle 使用 `any` 类型                         |
| M60 | `AIChatBubble.styles.ts:18` | SCREEN_WIDTH/HEIGHT 模块加载一次性取值（旋转后陈旧） |
| M61 | `SimpleMarkdown.tsx:95-99`  | style 对象每次 render 新建                           |
| M62 | `chat.styles.ts`            | 多处硬编码数字（lineHeight: 20, width: 32 等）       |

### Utils

| #   | 文件                    | 描述                         |
| --- | ----------------------- | ---------------------------- |
| M63 | `alert.ts:87-102`       | Web fallback UX 混淆多种模式 |
| M64 | `logger.ts:26`          | `any` 泛型约束抑制           |
| M65 | `mobileDebug.ts:99-110` | Clipboard API 无兼容回退     |
| M66 | `errorUtils.ts:25-41`   | 网络错误 patterns 不完整     |

### Navigation

| #   | 文件                       | 描述                                                  |
| --- | -------------------------- | ----------------------------------------------------- |
| M67 | `AppNavigator.tsx:107-114` | ROOM_CHILD_SCREENS Set 在 getStateFromPath 内每次重建 |

### Config: Theme Token 违规

| #   | 文件                           | 描述                                       |
| --- | ------------------------------ | ------------------------------------------ |
| M68 | `TipCard.tsx:48`               | 硬编码 icon size 16                        |
| M69 | `InstallMenuItem.tsx:53,71,91` | 硬编码 icon size 14/16                     |
| M70 | `HomeScreen/styles.ts:145`     | hardcoded fontSize: 28                     |
| M71 | `ChangePasswordForm.tsx:78`    | inline style 对象 `{ gap: spacing.small }` |

---

## 🔵 LOW

### Game-Engine

| #   | 文件                               | 描述                                             |
| --- | ---------------------------------- | ------------------------------------------------ |
| L1  | `actionHandler.ts:209-212`         | IIFE-throw pattern 可读性差                      |
| L2  | `confirmContext.ts:137`            | loverSeats 无长度守卫                            |
| L3  | `deathResolution.ts:47`            | buildEffectiveRoleSeatMap 无 duplicate role 断言 |
| L4  | `gameControlHandler.ts:508-514`    | handleFillWithBots 未显式 `role: null`           |
| L5  | `revealPayload.ts:56-62`           | `as Pick<...>` 返回值断言                        |
| L6  | `uiHint.ts:55`                     | `as Partial<SchemaUi>` 断言                      |
| L7  | `genericResolver.ts:277`           | EFFECT_PROCESSORS Record<string, ...> 无穷举     |
| L8  | `genericResolver.ts:39-40`         | REJECT 常量与 shared.ts 重复                     |
| L9  | `wolf.ts:32,42`                    | -1/-2 魔法数字                                   |
| L10 | `cupid.ts:34`                      | validateConstraints([]) 空约束仪式性调用         |
| L11 | `magician.ts`                      | 唯一未调 validateConstraints 的 resolver         |
| L12 | `shadow.ts:20`                     | REJECT_TARGET_NOT_FOUND 三处重复                 |
| L13 | `treasureMaster.ts:40-55`          | 三分支全返回 Team.Good                           |
| L14 | `lifecycleReducers.ts:28`          | handleInitializeGame 无 satisfies Complete       |
| L15 | `nightActionReducers.ts:28-34`     | handleStartNight 不清除 reveal 字段              |
| L16 | `DeathCalculator.ts:444-453`       | dreamcatcher 无条件清除先前死因                  |
| L17 | `inlineProgression.ts:166-169`     | nowMs 默认值违反纯函数声明                       |
| L18 | `inlineProgression.ts:177`         | MAX_PROGRESSION_LOOPS 耗尽无日志                 |
| L19 | `GameStore.ts:85-90`               | applyOptimistic 未校验 state 已初始化            |
| L20 | `specs.ts:1-8`                     | 角色计数注释过期（41→43）                        |
| L21 | `schemas.ts:51`                    | `as SchemaUi` 无 extends 约束                    |
| L22 | `plan.ts:87`                       | NIGHT_STEP_ORDER 展开退化 tuple 类型             |
| L23 | `protocol/types.ts`                | Player/GameState 字段缺 readonly                 |
| L24 | `RoleAction.ts` / `WitchAction.ts` | interface 字段缺 readonly                        |
| L25 | `reasonCodes.ts:33`                | 空 "Type Union" 注释节                           |
| L26 | `Template.ts:128-138`              | slacker/wildChild 死配置 bottomActionText        |
| L27 | `Template.ts:128`                  | findMatchingPresetName 未预排序缓存              |

### API Worker

| #   | 文件                    | 描述                                        |
| --- | ----------------------- | ------------------------------------------- |
| L28 | `GameRoom.ts:75`        | double assertion 变通 CF Hibernation API    |
| L29 | `GameRoom.ts:131`       | webSocketClose 中冗余 ws.close()            |
| L30 | `gameControl.ts:84,109` | templateRoles/animation as 断言无运行时校验 |
| L31 | `auth.ts:49`            | JWT payload double assertion                |
| L32 | `avatarUpload.ts:62`    | R2 list 不分页（>1000 对象）                |

### Services

| #   | 文件                       | 描述                                            |
| --- | -------------------------- | ----------------------------------------------- |
| L33 | `CFAuthService.ts:168`     | 冗余 await                                      |
| L34 | `CFAuthService.ts:161-200` | 三次独立 HTTP 调用获取 profile 信息             |
| L35 | `ConnectionFSM.ts`         | ~10 处 `ctx.roomCode!` / `ctx.userId!` 非空断言 |
| L36 | `AudioService.ts:86-102`   | `as RoleId` 绕过类型检查                        |
| L37 | `AIChatService.ts:141`     | streaming fetch 无 timeout                      |
| L38 | `BgmPlayer.ts:148-163`     | 每次 track ended 创建新 AudioContext            |

### Hooks

| #   | 文件                        | 描述                           |
| --- | --------------------------- | ------------------------------ |
| L39 | `useConnectionStatus.ts:48` | 不必要的 useMemo               |
| L40 | `useGameActions.ts`         | 313 行文件                     |
| L41 | `useGameRoom.ts`            | 367 行文件                     |
| L42 | `useNotepad.ts`             | 279 行文件                     |
| L43 | `useRoomLifecycle.ts`       | 334 行 + 重复 authService 调用 |

### Screens

| #   | 文件                              | 描述                                       |
| --- | --------------------------------- | ------------------------------------------ |
| L44 | `useRoomSeatDialogs.ts:59`        | 未使用的 `_roomStatus` 参数                |
| L45 | `useRoomScreenState.ts:481`       | beginReportCapture 双 rAF 无 timeout       |
| L46 | `useRoomActions.ts:105-111`       | 重复 JSDoc block                           |
| L47 | `wolfVoteExecutor.ts:28-30`       | log.info 应为 .debug                       |
| L48 | `actionSubmitExecutor.ts:52-63`   | setTimeout(0) 变通 React batching          |
| L49 | `promptExecutor.ts:102-105`       | 硬编码 'avenger' 字符串                    |
| L50 | `useRoomModals.ts:87`             | `roleId as RoleId` 无校验                  |
| L51 | `useRoomInit.ts:100-104`          | 模板校验缺 numberOfPlayers                 |
| L52 | `useActionOrchestrator.ts:225`    | rejection key `as { rejectionId? }`        |
| L53 | `configHelpers.ts`                | 可能存在死代码（待 knip 验证）             |
| L54 | `useConfigScreenState.ts:293`     | `as RoleRevealAnimation` 无运行时校验      |
| L55 | `useConfigScreenState.ts:290-296` | 可能未使用的 settings 相关导出             |
| L56 | `NameSection.tsx:41`              | 未使用的 colors prop                       |
| L57 | `ThemeSelector.tsx:40`            | onPress inline arrow（小列表可接受）       |
| L58 | `SettingsScreen.tsx:71`           | useSyncExternalStore 订阅全 state          |
| L59 | `AvatarPickerScreen.tsx:404-460`  | 头像框 ScrollView + map（<10项可接受）     |
| L60 | `NotepadScreen.tsx:88-132`        | panelStyles 逐字段映射约 50 个字段         |
| L61 | `RoleDetailSheet.tsx:105`         | `'englishName' in spec` 探测 + `as string` |
| L62 | `RoleListItem.tsx:87`             | 模块级 StyleSheet 不走 factory 模式        |
| L63 | `AnimationSettingsScreen.tsx:92`  | eslint-disable exhaustive-deps（已注释）   |

### Components

| #   | 文件                            | 描述                                             |
| --- | ------------------------------- | ------------------------------------------------ |
| L64 | `Avatar.tsx:17-19`              | 未使用的 props roomId, avatarIndex               |
| L65 | `NotepadPanel.tsx:240`          | 未 React.memo                                    |
| L66 | `bubble.styles.ts:38`           | 硬编码 borderWidth: 2                            |
| L67 | `SimpleMarkdown.tsx:97`         | borderRadius.none + 3 魔法值                     |
| L68 | `SettingsOptionGroup.tsx:61-88` | 子组件自建 StyleSheet                            |
| L69 | `useBubbleDrag.ts:109`          | ✅ AsyncStorage 错误已加 chatLog.warn `230acf8a` |

### Utils

| #   | 文件                                         | 描述                                    |
| --- | -------------------------------------------- | --------------------------------------- |
| L70 | `alert.ts:64`                                | buttons 空数组被静默替换                |
| L71 | `alert.ts:15-22`                             | `as const` 与 AlertButton 类型标注冲突  |
| L72 | `avatar.ts:120-134`                          | Math.abs() 防御性包装可能掩盖调用方 bug |
| L73 | `storageAdapter.ts:52-81`                    | auth token 存储错误被静默忽略           |
| L74 | `defaultAvatarIcons.ts:29` + `avatar.ts:140` | FNV-1a hash 重复实现（DRY）             |
| L75 | `withTimeout.ts:61-67`                       | setTimeout <4ms 精度问题                |

### Contexts

| #   | 文件                      | 描述                                                |
| --- | ------------------------- | --------------------------------------------------- |
| L76 | `AuthContext.tsx:200-201` | `handleAuthError(rethrow)` 后 unreachable `throw e` |
| L77 | `AuthContext.tsx:131`     | useEffect deps 与 "runs ONCE" 注释矛盾              |

### Navigation / Top-Level

| #   | 文件         | 描述                         |
| --- | ------------ | ---------------------------- |
| L78 | `App.tsx:83` | splash setTimeout 无 cleanup |

---

## 已审查无发现的文件（部分列表）

以下文件经逐一检查，未发现问题：

**Game-Engine**: `progressionEvaluator.ts`, `seatHandler.ts`, `viewedRoleHandler.ts`, `witchContext.ts`, `types.ts` (handlers), `resolveWolfVotes.ts`, `constraintValidator.ts`, `witch.ts`, `types.ts` (resolvers), `index.ts` (resolvers), `gameReducer.ts`, `types.ts` (reducer), `store/{index,types}.ts`, `state/{buildInitialState,normalize}.ts`, `intents/types.ts`, `utils/{formatSeat,id,logger,playerHelpers,random,shuffle}.ts`, `models/{GameStatus,index}.ts`, roles/spec/{ability.types,index,nightSteps,nightSteps.types,plan.types,roleSpec.types,types}.ts

**API Worker**: `env.ts`, `cronHandlers.ts`, `shared.ts`, `email.ts`, `password.ts`

**Services**: `GameFacade.ts`, `apiUtils.ts`, `defineGameAction.ts`, `gameActions.ts`, `seatActions.ts`, `CFRealtimeService.ts`, `CFRoomService.ts`, `cfFetch.ts`, `ConnectionManager.ts`, `backoff.ts`, `NativeAudioStrategy.ts`, `WebAudioStrategy.ts`, `audioRegistry.ts`, `SettingsService.ts`, `registry.ts`, 全部 types/\*

**Hooks**: `useAuthForm.ts`, `useDebugMode.ts`, `useNightDerived.ts`

**Screens**: `shareRoom.ts`, `shareQRCode.ts`, policy/{index,types,actorIdentity}.ts, `useActionerState.ts`, `useHiddenDebugTrigger.ts`, `useNightProgress.ts`, `useRoomIdentity.ts`, `useRoomDerived.ts`, executors/{chooseCard,index,registry,types,multiSelect,wolfRobot,skip,groupConfirm}.ts, `ConfigScreen.tsx`, `configData.ts`, HomeScreen/{JoinRoomModal,index}.tsx, Auth\*Screen.tsx

**Components**: `AlertModal.tsx`, `AvatarWithFrame.tsx`, `BaseCenterModal.tsx`, `Button.tsx`, `ErrorBoundary.tsx`, `FactionChip.tsx`, `FormTextField.tsx`, `NumPad.tsx`, `PageGuideModal.tsx`, `PressableScale.tsx`, `RoleDescriptionView.tsx`, `SkiaShaderWarmup.tsx`, `ThemedToast.tsx`, `roleDisplayUtils.ts`, `MessageBubble.tsx`, `TypingIndicator.tsx`, `notepadSummary.ts`, `playerContext.ts`, `quickQuestions.ts`, `rolePlayGuide.ts`, `useAIChat.ts`, `useChatMessages.ts`, `useKeyboardHeight.ts`, `LoadingScreen.tsx`, SettingsSheet/_, auth/_, avatarFrames/\*

**Contexts**: `GameFacadeContext.tsx`, `ServiceContext.tsx`, `index.ts`

**Config**: `api.ts`, `emojiTokens.ts`, `errorMessages.ts`, `guideContent.ts`, `iconTokens.ts`, `storageKeys.ts`, `version.ts`

**Navigation**: `index.ts`, `navigationRef.ts`, `types.ts`

**Top-level**: `index.ts`, `testids.ts`
