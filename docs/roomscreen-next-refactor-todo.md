# RoomScreen 拆分重构 — PR 说明 & 后续 TODO

## 本次 PR 完成内容

### 目标

将 `RoomScreen.tsx` 从 **1830 行 → 985 行**，提取三个模块化 hooks，保持全部 500+ 测试绿灯。

### 新增/修改文件

| 文件                                | 行数 | 职责                                                                                                                   |
| ----------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------- |
| `hooks/useRoomInit.ts`              | 167  | Room 初始化 + retryKey + roleRevealAnimation 状态                                                                      |
| `hooks/useActionOrchestrator.ts`    | 669  | Night action intent 大 switch + auto-trigger + rejection effect + pendingRevealDialog / pendingHunterStatusViewed gate |
| `hooks/useInteractionDispatcher.ts` | 355  | Interaction context 构建 + policy dispatch + seat tap / long-press / bot takeover                                      |
| `hooks/useNightProgress.ts`         | 119  | Night progress 计算 + speak order dialog 自动弹窗                                                                      |
| `hooks/useHiddenDebugTrigger.ts`    | 63   | 5 连击 debug 面板触发器                                                                                                |
| `hooks/index.ts`                    | 40   | 统一导出                                                                                                               |
| `RoomScreen.styles.ts`              | 109  | Styles factory（`createRoomScreenStyles`）                                                                             |
| `components/RoleCardModal.tsx`      | 108  | Role Card 弹窗（静态/动画两模式）                                                                                      |
| `RoomScreen.tsx`                    | 793  | 顶层 wiring + JSX 渲染（不再包含任何业务逻辑）                                                                         |

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

RoomScreen 当前仍有 **793 行**，目标是 < 600 行。以下是可继续提取的模块：

### 1. ~~`useNightProgress` hook~~ ✅ 已完成（−49 行）

**已提取到** `hooks/useNightProgress.ts`（119 行）：

- Night progress derived state（`buildNightPlan` → step index/total/roleName）
- Speak order dialog auto-show effect（Host-only, one-shot + restart reset）

### 2. ~~`useHiddenDebugTrigger` hook~~ ✅ 已完成（−14 行）

**已提取到** `hooks/useHiddenDebugTrigger.ts`（63 行）：

- 5 连击 debug 面板触发器（`tapCountRef` + `tapTimeoutRef` + `handleDebugTitleTap`）
- 常量 `TAP_THRESHOLD=5`、`TAP_TIMEOUT_MS=2000`

### 3. ~~`useLocalUiState` hook~~ ⏭️ 跳过（state 分散，提取收益低）

经分析，8 个 `useState` 的 setter 分别传给不同 hooks（useActionOrchestrator、useInteractionDispatcher、useRoomSeatDialogs、useRoomHostDialogs），grouping 只是移动声明不减少 wiring。

**替代方案已完成：**

### 3a. ✅ Styles extraction（−97 行）

**已提取到** `RoomScreen.styles.ts`（109 行）：

- `createRoomScreenStyles(colors)` factory（原 `createStyles`）
- 移除了 RoomScreen 中对 `typography`、`borderRadius`、`componentSizes`、`fixed`、`StyleSheet` 的直接依赖

### 3b. ✅ `RoleCardModal` component（−47 行）

**已提取到** `components/RoleCardModal.tsx`（108 行）：

- 角色身份展示弹窗（静态 RoleCardSimple / 动画 RoleRevealAnimator）
- 内聚 `ALIGNMENT_MAP`、`getRoleSpec`/`getRoleDisplayName`/`Faction` 等角色数据转换
- React.memo 优化
- 从 RoomScreen 移除了 5 个 import（RoleCardSimple、RoleRevealAnimator、createRoleData、RoleData、RevealEffectType、getRoleSpec、getRoleDisplayName、Faction）

### 4. JSX 分区抽取（预估 −60~100 行）

**提取内容：**

- Header 区域 → `<RoomHeader />` 组件
- Footer / BottomActionPanel wiring → 可进一步简化
- Role Card Modal 区域 → 已有 `RoleCardSimple`，但 Modal wrapper 仍在 RoomScreen

### 优先级建议

1. ~~**P1**: `useNightProgress`~~ ✅ 已完成
2. ~~**P2**: `useHiddenDebugTrigger`~~ ✅ 已完成
3. ~~**P3**: `useLocalUiState`~~ ⏭️ 跳过 → **P3a**: Styles extraction ✅ + **P3b**: RoleCardModal ✅
4. **P4**: JSX 分区（Header 抽取等，需进一步评估 ROI）

### 门禁要求

- 每次提取后必须跑 `npx jest --testPathPattern="RoomScreen" --no-coverage --forceExit` 全绿
- Contract test（delegationSeatIdentity）必须保持通过
- 不得引入新的 `console.*`（用 `roomScreenLog`）
- 每个新文件必须有 `✅ Allowed` / `❌ Do NOT` header
