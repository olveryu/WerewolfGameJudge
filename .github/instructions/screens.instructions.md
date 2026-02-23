```instructions
---
applyTo: 'src/screens/**,src/components/**'
---

# Screen & Component 层规范

## 三层分工（RoomScreen）

| 层 | 职责 | 位置 |
|---|---|---|
| **Policy** | 纯逻辑：输入 → Instruction（NOOP/ALERT/SUBMIT 等） | `policy/**` |
| **Orchestrator** | 调用 policy → 执行副作用 | Screen / hooks |
| **Presentational** | 渲染 + 上报 intent（onPress/onChange 回调） | `components/**` |

- Policy 必须可单元测试，禁止 showAlert / navigation / service / hooks / 副作用。
- Orchestrator 禁止写与 policy 并行的业务判断。
- Presentational 禁止 import services，禁止组件内做业务逻辑判断（gate 决策由 policy 完成）。
- 禁止 `console.*`（使用命名 logger）。

## 组件层规则

- 渲染 UI + 上报 intent，不做业务逻辑判断。禁止 import service（runtime 值）/ showAlert / navigation。
- 接收 styles prop（父组件 `createXxxStyles(colors)` → `useMemo` 创建一次 → props 传子组件），禁止子组件 `StyleSheet.create`。
- 视觉置灰（样式 / activeOpacity / accessibilityState）允许，但禁止 `disabled={true}` 阻断 onPress（RN 直接不触发回调）。禁止 onPress 内 `if (xxx) return` 做业务 gate。
- `React.memo(Component)` 默认 shallow compare，禁止自定义 `arePropsEqual`。回调由父级 `useCallback` 稳定化。

## Theme Token（MUST）

所有颜色用 `colors.*`（来自 `useColors()`），间距 `spacing.*`，字号 `typography.*`，圆角 `borderRadius.*`，阴影 `shadows.*`。`componentSizes` / `fixed` 必须从 `src/theme/tokens` 直接导入（`index.ts` 未 re-export）。

- 禁止硬编码：`'#xxx'` / `padding: 16` / `fontSize: 14` / `fontWeight: '600'` / `borderRadius: 12` / 手写 shadow。
- 例外：`*.stories.tsx`、`RoleRevealEffects/*` 动画常量、Emoji fontSize、statusDot 6×6、第三方不可控值。
- 卡片用 `shadows.sm` + `borderRadius.large` + `colors.surface`，不用 border 描边。全宽 bar 卡片化。Banner 用浅色背景（主色+`'20'`透明度）+ `borderWidth: fixed.borderWidth`。

### 4-Faction 阵营色（MUST）

阵营颜色统一使用 theme token，禁止硬编码色值：

| 阵营 | Token | 用途 |
|---|---|---|
| 狼人 | `colors.wolf` | chip 边框/文字、badge、notepad 角色标签 |
| 神职 | `colors.god` | 同上 |
| 村民 | `colors.villager` | 同上 |
| 第三方 | `colors.third` | 同上 |

- 所有 UI 展示阵营色的地方（ConfigScreen chip、BoardInfoCard chip、RoleCard、NotepadPanel badge、AIChatBubble 等）必须从 `colors.*` 读取，确保跟随主题切换。
- `RoleRevealEffects` 动画组件通过 `createAlignmentThemes(colors)` 工厂函数派生 glow/particle/gradient 色值（`src/theme/colorUtils.ts`）。
- 新增阵营相关 UI 时，必须覆盖全部 4 个 faction（wolf / god / villager / third）。

## Actor Identity 三层语义

- `my*` — 真实身份，仅展示用。
- `effective*` — 提交身份（`controlledSeat ?? mySeatNumber`），提交路径只用这个。
- `actor*` — UI 决策身份，policy 入参来自 `getActorIdentity()`。

提交路径禁止 `mySeatNumber`。Policy 禁止直接读 `effectiveSeat`。

## Screen 拆分信号

行数 >400 且 hook 调用 10+ / useMemo+useCallback 10+ / 副作用 5+ 时拆为薄壳组件 + `useXxxScreenState` hook。300 行以下且逻辑简单不拆。拆分不得引入新 Context/Provider。

## RN 性能规则

- 超 ~10 项列表用 `FlatList` / `SectionList`，禁止 `<ScrollView>{items.map(...)}</ScrollView>`。
- `keyExtractor` 返回稳定唯一字符串（`item.id` / `String(item.seatNumber)`），禁止 index key。
- `renderItem` 用 `useCallback` 或独立组件，禁止内联匿名函数（每次渲染新函数 → memo 失效）。
- 禁止循环/列表内创建内联 style 对象，用预计算 style 或 `StyleSheet.compose`。
- `<Image>` 必须指定 `resizeMode` + 明确 width/height。
- 动画优先 `react-native-reanimated` 或 `useNativeDriver: true`，禁止动画回调中频繁 `setState`。
- 导航后重计算用 `InteractionManager.runAfterInteractions`。
- 禁止渲染路径同步 I/O（大对象 JSON.parse 放 useEffect）。

## Loading / Mutex Flag 必须在 `finally` 中重置

`isStarting` / `isSubmitting` / `isLoading` 等互斥旗（disable 按钮防重复提交）必须放 `try/finally` 重置，不只在 success 路径重置。否则异常后 UI 永久锁死。

## One-shot Effect 需 Ref Guard

应该在生命周期内只触发一次的 effect（如"进入发言阶段显示发言顺序"）必须用 `useRef(false)` 守卫，防止每次 state broadcast 导致 deps 变化重新触发。Guard ref 在适当时机（phase 切换 / unmount）重置。

## 音频 Gate 合约

`isAudioPlaying` gate 必须最高优先级：audio 播放时交互统一 NOOP，不得被 `disabledReason` / `notSelf` 等提示抢先。必须有 policy 单测锁死此优先级。新增/修改交互 policy 必须补单测覆盖关键 gate。

```
