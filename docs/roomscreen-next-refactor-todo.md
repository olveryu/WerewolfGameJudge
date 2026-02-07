# RoomScreen 拆分重构 — PR 说明 & 后续 TODO

## 本次 PR 完成内容

### 目标
将 `RoomScreen.tsx` 从 **1830 行 → 985 行**，提取三个模块化 hooks，保持全部 500+ 测试绿灯。

### 新增/修改文件

| 文件 | 行数 | 职责 |
|---|---|---|
| `hooks/useRoomInit.ts` | 167 | Room 初始化 + retryKey + roleRevealAnimation 状态 |
| `hooks/useActionOrchestrator.ts` | 669 | Night action intent 大 switch + auto-trigger + rejection effect + pendingRevealDialog / pendingHunterStatusViewed gate |
| `hooks/useInteractionDispatcher.ts` | 355 | Interaction context 构建 + policy dispatch + seat tap / long-press / bot takeover |
| `hooks/index.ts` | 30 | 统一导出 |
| `RoomScreen.tsx` | 985 | 顶层 wiring + JSX 渲染（不再包含任何业务逻辑） |

### 关键设计决策

1. **Orchestrator 拥有 gate 状态**（`pendingRevealDialog` / `pendingHunterStatusViewed`），dispatcher 通过 params 读取。
2. **Dispatcher 的 `handleActionTap` / `ACTION_FLOW`** 对 `handleActionIntent` 返回的 Promise 做 `void …catch(roomScreenLog.error)` 兜底，避免 unhandled rejection。
3. **Dispatcher 的 `HUNTER_STATUS_VIEWED`** 前置 `pendingHunterStatusViewed` gate，防重复提交（与 orchestrator 的 `wolfRobotViewHunterStatus` 保持一致）。
4. **Contract test** 拆分为 orchestrator + dispatcher 独立断言，不再用宽松 regex 合并检查。

### 验证结果

- TypeScript 类型检查 ✅
- 46 suites / 500 RoomScreen tests ✅
- 81 suites / 1316 broader tests ✅
- Contract tests（delegationSeatIdentity）✅

---

## 后续拆分 TODO（下一步 PR）

RoomScreen 当前仍有 **985 行**，目标是 < 600 行。以下是可继续提取的模块：

### 1. `useNightProgress` hook（预估 −120 行）

**提取内容：**
- Night-end 说话顺序弹窗逻辑（`speakOrderDialogShown` + `useEffect`）
- Night progress 相关的 derived state（`currentStep`、`nightProgress` 计算）
- `showLastNightInfoDialog` 构建

**当前位置：** RoomScreen 内联 `useEffect` + 散落的 derived state

### 2. `useHiddenDebugTrigger` hook（预估 −60 行）

**提取内容：**
- 10 次连击进入 debug 模式的计数器（`hiddenTapCount` + `tapTimer`）
- `handleHiddenTap` callback
- debug 模式开关逻辑

**当前位置：** RoomScreen 内联 `useRef` + `useCallback`

### 3. `useLocalUiState` hook（预估 −80 行）

**提取内容：**
- `roleCardVisible` / `shouldPlayRevealAnimation`
- `anotherIndex` / `secondSeatIndex`（Magician 状态）
- 各种 dialog visible 状态

**当前位置：** RoomScreen 顶部的多个 `useState`

### 4. JSX 分区抽取（预估 −100 行）

**提取内容：**
- Header 区域 → `<RoomHeader />` 组件
- Footer / BottomActionPanel wiring → 可进一步简化
- Role Card Modal 区域 → 已有 `RoleCardSimple`，但 Modal wrapper 仍在 RoomScreen

### 优先级建议

1. **P1**: `useNightProgress`（逻辑最独立、风险最低）
2. **P2**: `useHiddenDebugTrigger`（纯 UI，零业务风险）
3. **P3**: `useLocalUiState`（需要评估 state 间依赖）
4. **P4**: JSX 分区（需配合 styles factory 调整）

### 门禁要求

- 每次提取后必须跑 `npx jest --testPathPattern="RoomScreen" --no-coverage --forceExit` 全绿
- Contract test（delegationSeatIdentity）必须保持通过
- 不得引入新的 `console.*`（用 `roomScreenLog`）
- 每个新文件必须有 `✅ Allowed` / `❌ Do NOT` header
