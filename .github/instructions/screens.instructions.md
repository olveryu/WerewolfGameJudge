---
applyTo: src/screens/**/*.ts,src/screens/**/*.tsx
---

# Screen 层规范

## 核心原则

- ✅ 三层分工：Policy（纯逻辑）→ Orchestrator（副作用）→ Presentational（渲染）。
- ✅ 所有样式值来自 theme token（`colors.*` / `spacing.*` / `typography.*` / `borderRadius.*` / `shadows.*`）。
- ✅ `createXxxScreenStyles(colors)` 集中创建，`useMemo` 只创建一次，props 传子组件。
- ✅ Actor identity 三层语义：`my*`=展示、`effective*`=提交、`actor*`=UI 决策。
- ❌ 禁止硬编码样式值（`'#xxx'` / `padding: 16` / `fontSize: 14` 等）。
- ❌ Policy 禁止副作用（`showAlert` / navigation / service / hooks）。
- ❌ Orchestrator 禁止写与 policy 并行的业务判断。
- ❌ Presentational 禁止 import services、禁止组件层 gate/吞点击。
- ❌ 提交路径禁止使用 `mySeatNumber`（必须用 `effectiveSeat`）。
- ❌ 禁止 `console.*`（使用命名 logger）。

## Theme Token（MUST follow）

- 所有样式值必须来自 theme token，禁止硬编码。
- `componentSizes`、`fixed` 必须从 `src/theme/tokens` 直接导入（`index.ts` 未 re-export，否则值为 `undefined`）。
- `spacing`、`typography`、`borderRadius`、`shadows`、`layout` 从 `src/theme`（`index.ts`）导入。

### 禁止项

- ❌ `'#xxx'` / `'rgb(...)'` → `colors.*`
- ❌ `padding: 16` → `spacing.medium`
- ❌ `fontSize: 14` → `typography.secondary`
- ❌ `fontWeight: '600'` → `typography.weights.semibold`
- ❌ `borderRadius: 12` → `borderRadius.medium`
- ❌ 手写 shadow → `shadows.sm/md/lg`

### 允许的例外

- `*.stories.tsx`、`RoleRevealEffects/*` 动画常量、Emoji `fontSize`、`statusDot` 6×6、第三方不可控值。

### 审计

- PR 自查：`grep -rn "fontSize: [0-9]" src/screens/` → 非例外必须修正。

---

## UI 风格统一（以 SettingsScreen 为标准 SHOULD follow）

### Header

- `backgroundColor: colors.surface` + `borderBottomWidth: fixed.divider` + `borderBottomColor: colors.border`
- 返回/操作按钮：方形 `componentSizes.avatar.md` × `avatar.md` + `colors.background` 背景 + `borderRadius.medium`

### 内容卡片 / 分区

- ✅ `colors.surface` 背景 + `borderRadius.large` + `shadows.sm`（代替 border 描边）
- ❌ 禁止 `borderWidth + borderColor` 做卡片边框（输入框/选中态等功能性边框除外）

### 信息条 / 进度条（Bar → Card 化）

- 全宽 bar 改为卡片风格：加 `marginHorizontal: spacing.medium` + `borderRadius.large` + `shadows.sm`

### Banner / 提示条

- 浅色背景（主色 + `'20'` 透明度后缀），加 `borderWidth: fixed.borderWidth` + `borderRadius.large` + `marginHorizontal` + `shadows.sm`。
- 文字用 `colors.text`（非 `textInverse`）。

### 文字层级

| 层级              | 字号                                      | 字重       | 颜色                   |
| ----------------- | ----------------------------------------- | ---------- | ---------------------- |
| 标题              | `typography.title` ~ `typography.heading` | `bold`     | `colors.text`          |
| 副标题 / 分区标题 | `typography.body` ~ `typography.subtitle` | `semibold` | `colors.text`          |
| 正文              | `typography.body`                         | `normal`   | `colors.text`          |
| 辅助说明          | `typography.secondary`                    | `normal`   | `colors.textSecondary` |
| 提示 / 标签       | `typography.caption`                      | `normal`   | `colors.textMuted`     |

### 按钮层级

- 主按钮：`colors.primary` 背景 + `colors.textInverse` + `borderRadius.medium`
- 次要按钮：`colors.background` 背景 + `colors.text`
- 文字按钮：无背景 + `colors.primary`
- 危险按钮：`colors.error` 背景 + `colors.textInverse`

### 新增 Screen 自查清单

1. Header 是否 `surface` bg + `borderBottom`？
2. 返回按钮方形 + `background` 色 + `borderRadius.medium`？
3. 卡片用 `shadows.sm` 而非 border？
4. 全宽 bar 卡片化？
5. 文字层级与上表一致？
6. 所有样式来自 theme token？

---

## 性能模式（MUST follow）

### 1) Styles factory 上提（单次创建）

- ✅ `createXxxScreenStyles(colors)` 集中创建。
- ✅ Screen 里 `useMemo(() => createXxxScreenStyles(colors), [colors])` 只创建一次。
- ✅ styles 通过 props 传子组件；子组件禁止各自 `StyleSheet.create`。

### 2) 子组件 memo 化

- ✅ `React.memo(Component, arePropsEqual)`，只比较 UI primitive + `styles` 引用。
- ✅ 回调不参与比较（由父级 `useCallback` 稳定化）。

### 3) Handler 稳定化（useCallback）

- ✅ 父级用 `useCallback` 固定回调引用，避免大量内联 `onPress={() => ...}`。

### 4) 性能门禁测试

- ✅ 至少提供 `createXxxScreenStyles` key coverage 或 memo 行为测试。

### 音频 Gate 优先级合约（Contract MUST exist）

- `isAudioPlaying` gate 必须是最高优先级：audio 播放时交互统一 NOOP，不得被 `disabledReason`/`notSelf` 等提示抢先。
- 必须有 policy 单测锁死此优先级。

### 交互 Policy 测试门禁

- 新增/修改交互 policy 必须补单测：Happy path + 关键 gate（audio_playing / pendingRevealAcks / disabledReason）。
- 修改影响弹窗/互动路径时，board UI tests + contract tests 必须全绿。

---

## RoomScreen 交互三层分工（MUST follow）

| 层 | 职责 | 位置 |
|---|---|---|
| **Policy** | 纯逻辑：输入 → Instruction（NOOP/ALERT/SUBMIT 等） | `src/screens/RoomScreen/policy/**` |
| **Orchestrator** | 调用 policy → 执行副作用 | RoomScreen / hooks |
| **Presentational** | 渲染 + 上报 intent | `src/screens/RoomScreen/components/**` |

- Policy 必须可单元测试（contract tests），禁止 `showAlert`/navigation/service/hooks/副作用。
- Orchestrator 禁止写与 policy 并行的业务判断。
- Presentational 禁止 import services、禁止组件层 gate/吞点击（详见 `components.instructions.md`）。

---

## Actor Identity 三层语义（MUST follow）

### 定义

- `mySeatNumber` / `myRole` — **真实身份**：展示用（"我是谁"）。
- `effectiveSeat` / `effectiveRole` — **提交身份**：向 Host 提交行动时使用（`controlledSeat ?? mySeatNumber`）。
- `actorSeatNumber` / `actorRole` — **UI 决策身份**：policy / `useRoomActions` / `useActionerState` 使用，来自 `getActorIdentity()`。

### 硬规则（MUST）

1. **提交路径只用 `effective*`**
   - ✅ `proceedWithAction` / `submitAction` / `submitWolfVote` / `confirmTrigger` / compound schema 的 skip/save/poison
   - ❌ 禁止提交路径使用 `mySeatNumber`（debug 接管不一致）
   - ❌ 禁止用 `actorSeatNumber` 代替 `effectiveSeat` 提交

2. **UI 决策只用 `actor*`**
   - ✅ 传入 policy 的字段必须来自 `getActorIdentity()`
   - ❌ 禁止 policy 直接读取 `effectiveSeat/effectiveRole/controlledSeat`

3. **展示逻辑才用 `my*`**
   - ❌ 禁止把 `my*` 当行动提交身份

### Review 清单（SHOULD）

- `submitAction(` / `proceedWithAction` / `submitWolfVote(` 周边是否出现 `mySeatNumber`？
- policy / `useRoomActions(` 入参是否用 `actorSeatNumber/actorRole`？
- 同时出现 `my*`+`effective*`+`actor*` 必须注释说明用途分层。
