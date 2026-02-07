## WerewolfGameJudge Copilot 指令（全中文）

## 快速索引（Table of Contents）

- 协作规则：未确认禁止写代码（MUST follow）
- 不可协商规则（先读）
- 架构边界（Architecture boundaries）
- 夜晚流程与 NightPlan（Host 权威）
  - 自动推进（auto-advance）硬性护栏
  - 音频 Gate（isAudioPlaying）硬性护栏
- 广播架构（Broadcast architecture：无私聊/无私有消息）
- Anti-drift 护栏（MUST follow）
  - 新增字段必须同步 `normalizeState`（MUST follow）
- RoomScreen UI 交互架构（MUST follow）
- Screen 性能设计一致性（All - 可以引入内部 "Intent" 类型，但必须适配到现有 protocol。
  - 除非同时提供兼容层 + 合约测试，否则禁止发明平行的消息协议。
- Git Commit 规范（Conventional Commits）
- Instruction 文件自检与同步提醒（MUST follow）

---

## Theme Token 使用规范（MUST follow）

> 目标：禁止硬编码样式值，所有视觉属性必须来自主题系统（`src/theme/tokens.ts`），确保全局一致性与主题切换能力。

### Token 类别与用途

| 类别             | 导入来源                     | 说明                                                                                         |
| ---------------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| `colors`         | `useColors()` / `useTheme()` | 所有颜色值（背景、文字、边框、阵营色等）                                                     |
| `spacing`        | `src/theme`                  | 间距：tight=4, small=8, medium=16, large=24, xlarge=32, xxlarge=48                           |
| `typography`     | `src/theme`                  | 字号（caption=12 ~ display=40）+ `weights`（normal/medium/semibold/bold）                    |
| `borderRadius`   | `src/theme`                  | 圆角：none=0, small=8, medium=12, large=16, xlarge=24, full=9999                             |
| `shadows`        | `src/theme`                  | 阴影预设：none, sm, md, lg                                                                   |
| `layout`         | `src/theme`                  | 页面级常量：screenPaddingH, screenPaddingV, cardPadding, listItemGap                         |
| `componentSizes` | ⚠️ `src/theme/tokens`        | 组件尺寸：button.sm/md/lg, avatar.xs~xl, chip, header, tabBar                                |
| `fixed`          | ⚠️ `src/theme/tokens`        | 固定值：borderWidth=1, borderWidthThick=2, divider=1, minTouchTarget=44, maxContentWidth=600 |

### Import 路径规则（硬性）

- `spacing`、`typography`、`borderRadius`、`shadows`、`layout`：从 `src/theme`（`index.ts`）导入。
- **`componentSizes`、`fixed`**：**必须从 `src/theme/tokens` 直接导入**（`index.ts` 未 re-export）。
  - ✅ `import { componentSizes, fixed } from '../../../theme/tokens';`
  - ❌ `import { componentSizes } from '../../../theme';`（编译通过但值为 `undefined`）

### 禁止项（Hard rules）

- ❌ 禁止硬编码颜色值：`'#xxx'`、`'rgb(...)'`、`'rgba(...)'` → 必须用 `colors.*`。
- ❌ 禁止硬编码间距/尺寸数字：`padding: 16` → 必须用 `spacing.medium`。
- ❌ 禁止硬编码字号：`fontSize: 14` → 必须用 `typography.secondary`。
- ❌ 禁止硬编码字重：`fontWeight: '600'` → 必须用 `typography.weights.semibold`。
- ❌ 禁止硬编码圆角：`borderRadius: 12` → 必须用 `borderRadius.medium`。
- ❌ 禁止硬编码阴影：手写 `shadowColor/Offset/Opacity/Radius` → 必须用 `shadows.sm/md/lg`。

### 允许的例外

- `*.stories.tsx`：Storybook 演示文件允许硬编码。
- `RoleRevealEffects/*`：动画组件（缩放/旋转等动画常量）。
- Emoji `fontSize`：Emoji 渲染尺寸不走 `typography`，允许直接写数字。
- `statusDot` 6×6：极小的状态指示点。
- 第三方库/平台层面不可控的样式值。

### 审计口径

- 修改/新增任何 `styles.ts` 或内联样式时，必须检查是否用了 token。
- PR 自查：`grep -rn "fontSize: [0-9]" src/screens/` → 如有非例外项，必须修正。

---

## UI 风格统一规范（SHOULD follow）

> 目标：所有 Screen 的视觉风格保持一致，以 **SettingsScreen** 为参考标准。

### 参考标准：SettingsScreen

SettingsScreen 定义了 App 的统一视觉语言，其他 Screen 应与之保持一致：

- Header：`surface` 背景 + `borderBottom`（`border` 色 + `fixed.divider`）
- 返回/操作按钮：方形（`componentSizes.avatar.md` × `avatar.md`）+ `background` 背景色 + `borderRadius.medium`
- 内容卡片/分区：`surface` 背景 + `borderRadius.large` + `shadows.sm`（**不用 border 描边**）
- 页面背景：`background` 色

### Header 样式

```
backgroundColor: colors.surface
borderBottomWidth: fixed.divider
borderBottomColor: colors.border
```

- 返回按钮：方形容器，`width/height: componentSizes.avatar.md`，`borderRadius: borderRadius.medium`，`backgroundColor: colors.background`。
- 操作按钮（齿轮/菜单等）：同上规格。

### 卡片 / 分区（Card / Section）

- ✅ 使用 `shadows.sm` 提供层次感（代替 border 描边）。
- ✅ `borderRadius: borderRadius.large`。
- ✅ `backgroundColor: colors.surface`。
- ❌ 禁止用 `borderWidth + borderColor` 做卡片边框（视觉上不统一）。
- 例外：输入框、选中态高亮等功能性边框仍可使用。

### 信息条 / 进度条（Bar → Card 化）

- 全宽铺满的 bar（如 NightProgressIndicator、ConnectionStatusBar）应改为卡片风格：
  - 加 `marginHorizontal: spacing.medium`
  - 加 `borderRadius: borderRadius.large`
  - 加 `shadows.sm`
  - 加 `marginTop/marginBottom` 适当间距

### Banner / 提示条

- 使用浅色背景（主色 + `'20'` 透明度后缀），而非实色填满。
- 加 `borderWidth: fixed.borderWidth` + 对应颜色 border。
- 加 `borderRadius: borderRadius.large`。
- 加 `marginHorizontal` + `shadows.sm`。
- 文字颜色用 `colors.text`（而非 `textInverse`），确保可读性。

### 文字层级

| 层级              | 字号                                      | 字重       | 颜色                   |
| ----------------- | ----------------------------------------- | ---------- | ---------------------- |
| 标题              | `typography.title` ~ `typography.heading` | `bold`     | `colors.text`          |
| 副标题 / 分区标题 | `typography.body` ~ `typography.subtitle` | `semibold` | `colors.text`          |
| 正文              | `typography.body`                         | `normal`   | `colors.text`          |
| 辅助说明          | `typography.secondary`                    | `normal`   | `colors.textSecondary` |
| 提示 / 标签       | `typography.caption`                      | `normal`   | `colors.textMuted`     |

### 按钮层级

- 主按钮：`backgroundColor: colors.primary`，`color: colors.textInverse`，`borderRadius: borderRadius.medium`。
- 次要/功能按钮：`backgroundColor: colors.background`，`color: colors.text`，`borderRadius: borderRadius.medium`。
- 文字按钮 / 链接：无背景，`color: colors.primary`。
- 危险操作：`backgroundColor: colors.error`，`color: colors.textInverse`。

### 新增 Screen 时的自查清单

1. Header 是否使用 `surface` bg + `borderBottom`？
2. 返回按钮是否方形 + `background` 色 + `borderRadius.medium`？
3. 内容卡片是否用 `shadows.sm` 而非 border 描边？
4. 全宽 bar 是否改为卡片化？
5. 文字层级是否与上表一致？
6. 所有样式值是否来自 theme token？

---

## 实现清单（角色 / schema / step / UI 必做）s SHOULD follow）

- Theme Token 使用规范（MUST follow）
- UI 风格统一规范（SHOULD follow）
- 实现清单（角色 / schema / step / UI 必做）
- 交付与门禁（必须执行）

### 0.5) 协作规则：未确认禁止写代码（MUST follow）

- **禁止在未明确征得用户同意的情况下修改代码**（尤其是 apply_patch / edit）。
  - ✅ 允许：只读检查（read/search/list/grep）、运行测试/格式化/类型检查。
  - ✅ 若需要改动：必须先在回复中列出“将修改的文件 + 变更点摘要 + 风险”，等待用户明确确认（例如“OK/同意/可以改”）后才能动手。

### 0) 不可协商规则（先读）

- **Host 是唯一的游戏逻辑权威。** Supabase 只负责 transport/discovery/identity（传输/发现/身份）。
- **离线本地玩法。** 这是本地/离线的游戏辅助；Host 设备同时也是玩家，不是单独裁判机。
- **仅 Night-1 范围。** 绝对不要加入跨夜状态/规则。
- **`BroadcastGameState` 是唯一且完整的单一真相（Single source of truth）。**
  - 所有游戏信息（包括角色上下文，如女巫 `killedIndex`、预言家 reveal）都必须公开广播在 `BroadcastGameState` 中；UI 再按 `myRole` 过滤显示。
  - 禁止并行维护顺序表/map/双写字段导致 drift。
- **优先使用成熟库而不是自研。** 新增能力（日志、校验等）先找成熟 npm 库；只有在库不合适或过度复杂时才写自定义代码。
- **单一职责原则（SRP）。** 每个 class/module 必须且只能负责一件事。禁止 God Class（多个不相关职责揉在一起）。若单个模块超过 ~400 行或承担多个关注点，必须拆分。

不清楚就先问再写代码。不要臆造仓库事实。

---

## 架构边界（Architecture boundaries）

### Host vs Supabase

- Host 负责：夜晚流程（night flow）、校验（validation）、resolver 执行、死亡结算（death calculation）、音频时序（audio sequencing）。
- Supabase 负责：房间生命周期（4 位房间号）、presence、auth metadata、realtime transport。
- Supabase **绝对不能**存储/校验任何游戏状态、行动、投票、结果。

### 代码归属边界（Code ownership boundaries）

- `src/models/roles/**`：只允许声明式内容（spec/schema/types）。禁止 service、禁止副作用。
- `src/services/night/resolvers/**`：Host-only 的纯函数 resolution + validation（旧路径；允许迁移到 `src/services/engine/night/resolvers/**`，但必须保持“纯函数/无副作用/不碰 IO/UI”）。
- `src/services/engine/night/resolvers/**`：Host-only 的纯函数 resolution + validation（新路径；与旧路径语义完全一致）。
- `src/screens/RoomScreen/components/**`：仅 UI，禁止 import service。

### Resolver 集成架构（Resolver Integration Architecture）

```
ACTION (UI submit)
    │
    ▼
GameStateService.handlePlayerAction()
    │
    ├─ 1. buildActionInput() - 从 wire protocol 构建 ActionInput
    │
    ├─ 2. invokeResolver() - 调用 Resolver 纯函数
    │      └─▶ 返回 { valid, rejectReason?, updates?, result? }
    │
    ├─ 3. 如果 !valid → 拒绝，广播 actionRejected
    │
    └─ 4. 如果 valid → applyResolverResult()
           ├─ 合并 updates → state.currentNightResults
           ├─ 设置 reveal 结果 (seerReveal, psychicReveal, etc.)
           └─ 记录 action → state.actions
    │
    ▼
advanceToNextAction()
```

**关键原则：**

- **Resolver 是唯一的验证与计算逻辑来源**：Host 不允许做业务逻辑“二次计算”。
- **`currentNightResults` 在步骤间传递并累积结果**（例如 nightmare block → `wolfKillDisabled`）。
- **reveal 结果必须从 resolver 返回值读取**：Host 不允许自行推导/重复计算。

### Role/Schema/Step 三层架构

三层表驱动（单一真相）：

- `ROLE_SPECS`：角色固有属性（不随步骤变化）→ `src/models/roles/spec/specs.ts`
- `SCHEMAS`：行动输入协议（约束/提示/meeting，可驱动 UI）→ `src/models/roles/spec/schemas.ts`
- `NIGHT_STEPS`：Night-1 步骤顺序 + 音频（id=SchemaId）→ `src/models/roles/spec/nightSteps.ts`

不是双写：

- `schema.meeting.canSeeEachOther` 决定“何时显示队友”（开关）
- `ROLE_SPECS[role].wolfMeeting.canSeeWolves` 决定“谁被高亮”（过滤）

### 日志（Logging）

- **入口**：统一从 `src/utils/logger.ts` 获取（例如 `gameRoomLog`、`roomScreenLog`、`gameStateLog`）。
- **禁止**：`src/**` 业务/服务/组件代码里新增 `console.*`。
- **允许**：`src/**/__tests__/**`、`e2e/**`、`scripts/**`、`*.stories.tsx`；以及第三方库/运行环境不可控的 `console.*`。
- **必须打日志**：状态迁移、action 提交、错误、关键分支决策（带 context + 关键数据）。
- **级别**：正常流程 `.debug()`；可恢复问题 `.warn()`；失败 `.error()`。

---

## 夜晚流程与 NightPlan（Host 权威）

### NightFlowController 不变量（invariants）

- `NightFlowController` 是夜晚推进（night progression）的单一真相。
- 当 `isHost === true` 且 `state.status === ongoing` 时，`nightFlow` 必须非空（违反则 fail-fast）。
- 禁止手动推进 index（`++` 兜底策略是禁止的）。
- phase 不匹配事件必须是幂等 no-op（仅 debug）。

#### 自动推进（auto-advance）硬性护栏（MUST follow）

- **禁止在 Facade / UI / submit 成功回调里做“自动推进夜晚”决策**（例如 `submitAction()` 成功后直接调用 `advanceNight()`）。
  - 这会导致推进权威分裂、重入（double-advance）、以及 Host/Player drift。
- 自动推进如果需要存在：
  - **必须集中在 Host-only 的 night flow 控制器/handler**（例如 `NightFlowController` / `nightFlowHandler`），由它基于 `BroadcastGameState` 的事实判断“是否推进/推进到哪一步/是否 endNight”。
  - **必须幂等**：同一 `{revision, currentStepId}` 组合最多推进一次；重复触发必须 safe no-op（仅 debug）。
- Facade 允许做的事情仅限：
  - “发起 intent / request”（transport + orchestration），例如向 Host 发送 `ADVANCE_NIGHT` intent；
  - **不得**自行在 Facade 层计算“all wolves voted / action succeeded ⇒ should advance”。

### 表驱动 NightPlan 的单一真相（single-source-of-truth）

- Night-1 的推进顺序必须来自**单一表驱动计划**。
- **权威表（Night-1）：** `src/models/roles/spec/nightSteps.ts` 中的 `NIGHT_STEPS`。
  - 数组顺序就是权威顺序。
  - Step id 必须是稳定的 `SchemaId`。
  - 禁止重新引入 `night1.order` 或任何平行的 `ACTION_ORDER`。
- Plan builder 在遇到非法 `roleId` / `schemaId` 时必须 fail-fast。
- 禁止用 UI 文案作为逻辑 key；测试必须断言稳定 identifier。

### 音频时序单一真相（Audio sequencing single source of truth）

- Night-1 的 `audioKey` / 可选的 `audioEndKey` 必须来自 `NIGHT_STEPS`。
- 禁止在 specs/steps 双写 audio key。若确实需要临时兼容：必须 `@deprecated` + 移除日期 + 合约测试强制二者相等。

### 音频时序分层架构（Audio sequencing layering）

- **单一音频编排来源：Handler 声明，Facade 执行，UI 只读**。避免 Facade & UI “双路径触发音频”导致竞态（两段音频重叠/重复、Gate 误释放、UI 提前可点）。
- **Handler（Host-only 业务状态机）**：
  - 只负责“什么时候该播什么音频”的**声明**，通过 `SideEffect: { type: 'PLAY_AUDIO', audioKey, isEndAudio? }` 返回。
  - 禁止在 handler 里做任何音频 IO、也禁止在 handler 里碰 UI。
- **Facade（Host-only 编排/IO 入口）**：
  - 负责执行 `PLAY_AUDIO` 的副作用：
    1. `setAudioPlaying(true)` 广播 Gate
    2. 执行音频播放（`AudioService`）
    3. `finally { setAudioPlaying(false) }` 兜底释放 Gate（无论成功/失败/跳过/中断）
  - 只允许 Facade 触发/调用 `setAudioPlaying`；Player 端绝对禁止写 Gate。
- **RoomScreen（UI）**：
  - **只读 `isAudioPlaying` 并据此禁用交互**（按钮/提交/advance）。
  - ❌ 禁止在 `useEffect` 里根据 step/status 去主动播放音频（这会引入第二条音频触发链路）。
  - ❌ 禁止 UI 自己 toggle `setAudioPlaying(true/false)` 充当 Gate。

### 音频 Gate（`isAudioPlaying`）硬性护栏（MUST follow）

- **`isAudioPlaying` 代表“权威音频 Gate 的事实状态”，不是推导状态。**
- **唯一允许修改 `isAudioPlaying` 的 action：`SET_AUDIO_PLAYING`。**
  - ✅ 允许：`handleSetAudioPlaying`（Host-only）→ reducer 处理 `SET_AUDIO_PLAYING`。
  - ❌ 禁止：在 reducer 中对 `START_NIGHT` / `ADVANCE_TO_NEXT_ACTION` / `SET_CURRENT_STEP` 等 action “顺便”把 `isAudioPlaying` 设为 `true/false`（这会把事实状态变成推导状态，导致 drift / 卡死）。
- **Host 负责“音频时序编排”，但音频播放 IO 可以在 UI 层触发。** 允许的模式是：
  1. Host 看到 step 切换（`currentStepId` 变化）→ 先调用 `setAudioPlaying(true)` 广播 Gate
  2. Host 播放对应 `audioKey`
  3. 音频结束/跳过 → Host 调用 `setAudioPlaying(false)` 解除 Gate（必须 finally/兜底）
- **Player 端绝对不能写 Gate**：Player 不允许调用 `setAudioPlaying`（`host_only`）。
- **Fail-fast 要求（测试门禁）**：若出现“UI 已进入可行动提示（如狼刀/技能选择）但 `isAudioPlaying===true` 持续不释放”或“提交行动持续被 `forbidden_while_audio_playing` 拒绝”，必须：
  - 优先修复 Host 的 setAudioPlaying(false) 兜底链路
  - 并补 E2E/contract fail-fast，禁止靠超时隐藏问题

### StepSpec id 规则

- Step id 必须是稳定的 `SchemaId`。
- 禁止使用 UI 文案作为逻辑 key；测试必须断言稳定 identifier。（同“NightPlan 单一真相”处的稳定 key 规则）

---

## 约束、校验与 Night-1-only 红线

### Schema-first（约束以 schema 为准）

- 输入合法性必须写在 `SCHEMAS[*].constraints`（schema-first）。
- Host resolver 的校验必须与 schema 约束保持一致。
  - 如果 schema 规定 `notSelf`，resolver 必须拒绝自指目标。
  - 如果 schema 允许自指目标，resolver 不得拒绝（除非明确文档化 + 测试覆盖）。

### Night-1-only 禁止项

- 禁止跨夜记忆：禁止 `previousActions`、`lastNightTarget`、“连续两晚/第二晚开始”等约束。
- Resolver context/types 不得携带跨夜字段。

### 中立裁判规则（狼人 Neutral judge rule）

- 本 app 的狼刀是中立的：可以刀**任意座位**（包括自己/狼队友）。
- 不要为狼刀添加 `notSelf`/`notWolf` 约束。

---

## 广播架构（Broadcast architecture：无私聊/无私有消息）

- **所有游戏状态都是公开的。** `BroadcastGameState` 必须包含全部信息（含角色特定数据）。
- **UI 层过滤显示。** Client UI 按 `myRole` 过滤：
  - 例：女巫仅在 `myRole === 'witch'` 时显示 `witchContext.killedIndex`
  - 例：预言家仅在 `myRole === 'seer'` 时显示 `seerReveal.result`
  - 狼人同理：仅狼阵营显示狼队信息（例如 `currentNightResults.wolfVotesBySeat`）
- **不允许 `PRIVATE_EFFECT`。** 私有消息基础设施已移除。
- **Host 与 Player 读取同一份 state。** 禁止 Host 用本地状态、Player 用广播状态导致不同步。

---

## Anti-drift 护栏（MUST follow）

这些规则用于防止任何重构/迁移过程中出现回归：

- host/player 分支逻辑漂移
- Host UI 因读取不同 state shape 而与 Player UI 不一致
- “临时” feature-flag 导出破坏模块系统

### 单一真相：`BroadcastGameState`

- 禁止在 state 类型中引入 `HostOnlyState`、`hostOnly` 字段或“不会广播”的字段。
- Host 如果执行需要某字段，那它就必须属于 `BroadcastGameState`。
- 隐私是 UI 层问题（按 `myRole` / `isHost` 过滤显示），不是数据模型问题。

- Host 与 Player 内存中的 state shape 必须完全一致。
- 计算/派生字段必须从同一份 state 计算，或只写入 `BroadcastGameState` 一次（禁止双写/漂移）。

### 新增字段必须同步 `normalizeState`（MUST follow）

当你向 `BroadcastGameState`（或其子结构）新增任何字段时：

1. **必须检查 `src/services/engine/state/normalize.ts`**
   - `normalizeState` 函数是 state 存储/广播前的必经之路
   - 它显式列出所有要保留的字段；**遗漏的字段会被静默丢弃**
2. **必须把新字段加到 `normalizeState` 返回值**
   - 例如：新增 `ui` 字段 → 必须加 `ui: raw.ui`
3. **测试门禁**：新增字段后，写一个端到端流程验证 Host→Player 广播后字段仍存在（而非 `undefined`）

这是高频 bug 源：reducer 正确设置了字段，但 `normalizeState` 没透传 → 广播后变 `undefined`。

---

## RoomScreen UI 交互架构（MUST follow）

> 目标：避免 "双 gate / 多处决策" 导致 drift；让交互逻辑可测试、可推理。

### 三层分工（Single-source-of-truth for interaction decisions）

当你修改/新增任何 RoomScreen 交互（Seat 点击、BottomAction、Confirm/Skip、Ack、弹窗按钮等）时，必须遵守：

1. **Policy / Guard（纯逻辑层）**
   - ✅ 只做：输入（纯数据）→ 输出（Instruction）
   - ✅ 输出举例：`NOOP` / `ALERT` / `SEATING_FLOW` / `ACTION_FLOW` / `SUBMIT` / `SHOW_DIALOG`
   - ✅ 必须可单元测试锁顺序（contract tests）
   - ❌ 禁止：`showAlert`、navigation、service 单例、React hooks、任何副作用
   - 推荐目录：`src/screens/RoomScreen/seatTap/**` 或 `src/screens/RoomScreen/policy/**`

2. **Orchestrator（编排层：RoomScreen / hooks）**
   - ✅ 只做：调用 policy → `switch` 执行副作用（`showAlert` / submitAction / navigation / showDialog）
   - ❌ 禁止：在 orchestrator 里再写一套与 policy 并行的业务判断（否则 drift）

3. **Presentational UI（展示层：`src/screens/RoomScreen/components/**`）\*\*
   - ✅ 只做：渲染 + 上报用户 intent（onPress/onChange）
   - ❌ 禁止：import services / `showAlert` / navigation
   - ❌ 禁止：组件层 gate/吞点击（见下条）

### 禁止组件层“吞点击 / 逻辑 gate”（Hard rule）

为了保证 policy 是交互决策的单一真相：

- **禁止在 `components/**`内用`disabled={true}`来阻断`onPress` 事件\*\*（RN 会直接不触发回调）：
  - ✅ 允许：视觉置灰（样式 / activeOpacity / accessibilityState）
  - ✅ 允许：仍然触发回调，把 "disabled" 作为参数上报给 orchestrator/policy
  - ❌ 禁止：`disabled={disabled}` 让点击不上报

- **禁止在组件 `onPress` 里 `if (xxx) return;` 作为业务 gate**
  - 例：`if (disabled) return;`、`if (isAudioPlaying) return;` 都属于禁止项
  - gate 必须由 policy 决策并在 orchestrator 执行（NOOP / ALERT）

> 说明：这一条是为了避免出现 "PlayerGrid 挡一层、RoomScreen/Policy 再挡一层" 的双 gate。

> 同样规则适用于 `src/screens/**/components/**`：`disabled` 只能做视觉/无障碍语义，不得阻断事件；Storybook/test files 允许演示性例外。

---

## Actor identity（my/effective/actor）三层语义与使用口径（MUST follow）

> 目标：避免 debug bot 接管（`controlledSeat`）引入“用错 seat/role”导致的 `role_mismatch`、无法提交行动、以及 UI/Host 漂移（drift）。

### 三层语义（必须按职责使用）

- `mySeatNumber` / `myRole`
  - **真实身份**：本设备/uid 自己是谁。
  - 用途：展示（“我是谁”）、本地文案；不作为“提交行动身份”。

- `effectiveSeat` / `effectiveRole`
  - **提交身份**：当需要向 Host 提交行动/intent 时，应该以哪个 seat/role 去提交。
  - 典型定义：`effectiveSeat = controlledSeat ?? mySeatNumber`（接管 bot 时即 bot seat）。
  - 用途：构造 wire payload、调用 `submitAction/submitWolfVote/submitRevealAck/...` 等“会影响 Host 状态”的提交。

- `actorSeatNumber` / `actorRole`
  - **UI 决策身份（单一真相）**：给 policy / `useRoomActions` / `useActionerState` 使用的行动者身份。
  - RoomScreen 里通常来自 `getActorIdentity()` 的输出（例如 `actorSeatForUi/actorRoleForUi`）。
  - 用途：所有“UI 是否可行动 / seat 高亮 / intent 生成 / imActioner 判断”等纯 UI 决策。

### 硬规则（MUST）

1. **提交给 Host 的地方只能用 `effective*`**
   - ✅ 例如：`proceedWithAction` / `submitAction` / `submitWolfVote` / `confirmTrigger` / compound schema（witch）的 `skip/save/poison` 等。
   - ❌ 禁止：在提交路径里使用 `mySeatNumber`（debug 接管会不一致、甚至为 null）。
   - ❌ 禁止：用 `actorSeatNumber` 代替 `effectiveSeat` 来 submit（会把 UI 决策层字段耦合进提交层，增加 drift 风险）。

2. **UI 决策（policy/intent/useRoomActions/useActionerState）只能用 `actor*`**
   - ✅ `gameContext.actorSeatNumber` / `interactionContext.actorSeatForUi` 等传入 policy 的字段必须来自 `getActorIdentity()`。
   - ❌ 禁止：policy 里直接读取 `effectiveSeat/effectiveRole` 或 `controlledSeat` 来决定“我是不是 actioner/能不能点”。

3. **展示用逻辑才用 `my*`**
   - ✅ 例如：显示“你本人座位/身份”、debug panel 显示真实 uid 绑定。
   - ❌ 禁止：把 `my*` 当作行动提交身份（除非明确不支持接管模式且有测试门禁）。

### Review/防回归清单（SHOULD 在 PR 里自查）

- 搜索 `submitAction(` / `proceedWithAction` / `submitWolfVote(` 周边：是否出现 `mySeatNumber`？（应为 `effectiveSeat` 或 submit API 内部封装）
- 搜索 policy / `useRoomActions(` / `useActionerState(` 入参：是否使用 `actorSeatNumber/actorRole`（来自 `getActorIdentity`）？
- 如果出现了“同时传 `my*`、`effective*`、`actor*`”：必须在注释里说明用途分层，避免后续误用。

---

## Screen 性能设计一致性（All Screens SHOULD follow）

当你修改/新增任何 Screen（`src/screens/**`）的 UI 结构或性能相关代码时，优先遵守以下统一模式（参考：`HomeScreen` / `SettingsScreen` / `ConfigScreen` / `RoomScreen PlayerGrid/SeatTile`）：

### 1) Styles factory 上提（单次创建）

- ✅ 用 `createXxxScreenStyles(colors)`（或 `createXxxStyles(colors)`）集中创建样式。
- ✅ 在 Screen 父组件里 `useMemo(() => createXxxScreenStyles(colors), [colors])` **只创建一次**。
- ✅ styles 通过 props 传给子组件；子组件 **禁止**各自 `StyleSheet.create`。

### 2) 子组件 memo 化（只比较 UI primitive + styles 引用）

- ✅ 子组件使用 `React.memo(Component, arePropsEqual)`。
- ✅ `arePropsEqual` 只比较：UI 相关 primitive props + `styles` 引用。
- ✅ 回调（`onPress/onChange/...`）通常不参与比较（由父级 `useCallback` 稳定化）。

### 3) Handler 稳定化（useCallback）

- ✅ 父级 Screen 负责把 handler 用 `useCallback` 固定引用。
- ✅ 避免大量内联 `onPress={() => ...}` 导致 props identity 抖动；必要时抽成 `useCallback`。

### 4) 性能门禁测试（最小集）

- ✅ 至少提供一种：
  - `createXxxScreenStyles` key coverage（防漏字段）
  - 或 memo 行为测试（无关 state 变化不重渲染）

### 必须锁定的优先级合约（Contract MUST exist）

当存在 `isAudioPlaying` gate 时（ongoing 阶段）：

- **Audio gate 必须是最高优先级**：播放音频时的交互应统一 NOOP（或可选轻提示），且不得被 `disabledReason`/notSelf 等提示抢先。
- 必须有对应 policy 单测锁死："audio_playing 优先于 disabledReason"。

### 测试门禁（必须执行）

- 任何新增/修改交互 policy 都必须补单元测试：
  - Happy path + 关键 gate（audio_playing / pendingRevealAcks / disabledReason）
- 若修改影响 RoomScreen 弹窗/互动路径，必须保持 board UI tests + contract tests 全绿。

### Player 端禁止运行业务逻辑

- Player 客户端绝对不能执行：
  - resolvers
  - reducers/state transitions
  - death calculation
  - night flow progression
- Player 仅作为 transport：
  - 发送 `PlayerMessage` intent 给 Host
  - 接收 `HostBroadcast.STATE_UPDATE`
  - `applySnapshot(broadcastState, revision)`

### wire protocol 必须稳定（Transport protocol stability）

- on-wire protocol 是稳定的，必须保持兼容：
  - `HostBroadcast`

  - `PlayerMessage`
  - `BroadcastGameState`

- 可以引入内部 “Intent” 类型，但必须适配到现有 protocol。
  - 除非同时提供兼容层 + 合约测试，否则禁止发明平行的消息协议。

---

## 实现清单（角色 / schema / step / UI 必做）

当你新增或修改任意 Night-1 行动角色（含 UI）时，必须同时检查下面这些点：

1. **Schema-first + Resolver 对齐**

- 输入合法性必须写在 `SCHEMAS[*].constraints`。
- resolver 的校验必须与 schema constraints 完全一致：
  - schema 写了 `notSelf` → resolver 必须拒绝自指目标。
  - schema 允许自指 → resolver 不得擅自拒绝（除非明确文档化 + 测试覆盖）。

2. **Nightmare 阻断**

- resolver 必须检查 `currentNightResults.blockedSeat === actorSeat`。
- 若被阻断：返回 `{ valid: true, result: {} }`（有效但无效果）。

3. **上下文/结果必须写入 `BroadcastGameState`（公开广播）**

- 需要上下文：必须加到 `BroadcastGameState`（例如 `witchContext`、`confirmStatus`）。
- 需要 reveal：必须把结果写回 `BroadcastGameState`（例如 `seerReveal`、`psychicReveal`）。
- UI 只从 `gameState.*` 读取，并按 `myRole` 过滤显示。

4. **三层表驱动：角色/协议/步骤**

- 角色加入 `ROLE_SPECS`（`src/models/roles/spec/specs.ts`）。
- 行动协议在 `SCHEMAS`（`src/models/roles/spec/schemas.ts`）。
- Night-1 顺序与音频在 `NIGHT_STEPS`（`src/models/roles/spec/nightSteps.ts`），step id 必须是稳定 `SchemaId`。

5. **狼人相关 UI/规则（schema 驱动）**

- UI 从 schema 推导 `showWolves`：`schema?.kind === 'wolfVote' && schema.meeting.canSeeEachOther`。
- 禁止使用 step-level visibility 字段。
- `wolfKillDisabled` 单一真相：在 `handlePlayerAction` 中当 nightmare 阻断狼时设置，并在 `toBroadcastState` 中直接读取。

---

## 交付与门禁（必须执行）

### UI-level 测试门禁（RoomScreen 弹窗/互动必须全覆盖）

当你新增/修改任意“板子/模板”（12p preset）或新增/修改任意 Night-1 行动角色（含 UI 交互、弹窗、gate）时，**必须同时补齐 UI-level 测试**，否则视为未完成交付。

#### 必须（MUST）

1. `RoomScreenTestHarness`

- 必须实现并使用 `RoomScreenTestHarness`：拦截并记录所有 `showAlert/showDialog`（title/message/buttons/type）。
- 允许在测试环境 mock `src/utils/alert.ts` 的 `showAlert` 入口。
- 测试末尾必须做覆盖清单断言：缺任意弹窗类型/互动分支必须 fail。

2. Board UI tests

- 每新增一个板子（12p preset）必须新增对应 UI-level board test。
- 位置：`src/screens/RoomScreen/__tests__/boards-ui/**/*.ui.test.tsx`（或项目既有一致路径）。
- 最低覆盖：Night-1 全流程涉及的 prompt/confirm/reveal/skip 等互动。
- 禁止用 snapshot/Storybook 截图替代交互覆盖。

3. 角色行动 UI 覆盖

- 每新增/修改一个 Night-1 行动角色，至少覆盖：prompt / confirm /（如有）reveal + `REVEAL_ACK`。
- 任何额外 gate（例如 `wolfRobotHunterStatusViewed`）必须在 UI test 中显式点击/发送并断言解除，禁止自动清 gate。
- nightmare（高风险）必须覆盖 blocked 的弹窗/拒绝路径，并断言对后续 UI 的影响（如 `wolfKillDisabled`）。

4. Contract gate 防漏测

- 必须存在 contract test：强制“板子 × 必需弹窗类型”覆盖清单全部满足；漏任意一个直接 fail。
- required 清单必须 schema/steps 驱动（来自 `SCHEMAS` / `NIGHT_STEPS`），禁止手写散落硬编码。

#### 反作弊硬红线（不可协商 / MUST）

- 禁止跳过：`src/screens/RoomScreen/__tests__/boards/**` 下禁止出现 `it.skip` / `test.skip` / `describe.skip`。
  - CI/contract gate 必须检查到任意 `*.board.ui.test.tsx` 含 `\.skip\b` 直接 fail。
- 禁止“动态口径覆盖”：Board UI tests 的最终覆盖断言必须使用字面量数组。
  - ✅ 允许：`harness.assertCoverage(['actionPrompt', 'wolfVote', ...])`
  - ❌ 禁止：`harness.assertCoverage(getRequired*DialogTypes(...))`
  - ❌ 禁止：`harness.assertCoverage(requiredTypes)`（任何非字面量数组都视为可作弊）
  - Contract gate 必须解析并对照覆盖矩阵（schema/board 驱动 required 清单），少任意一个 `DialogType` 直接 fail。
- 难测分支不得移出 required 清单（禁止以“button-dependent/不好测”为理由降级覆盖）：
  - 例如：`confirmTrigger`、`skipConfirm`、`actionConfirm`、`wolfRobotHunterStatus`、`wolfRobotHunterStatusViewed`。
  - 不好测只能增强 mock/harness，不允许改成 optional/移层。

### 质量门禁（Quality gates）

- 格式化/静态检查：修改代码后必须跑 ESLint/Prettier（以项目既有 npm scripts 为准），确保 0 errors。
- 合约测试必须覆盖：
  - `NIGHT_STEPS` 引用有效性（`roleId`、`SchemaId`）
  - Step ids 顺序确定性（snapshot）与唯一性
  - Night-1-only 红线
  - `audioKey` 非空
- E2E 仅 smoke：核心 e2e 必须 `workers=1`，房间就绪必须用 `waitForRoomScreenReady()`。

### Integration tests 必须“真实”（硬性要求）

当你新增/修改 `src/services/__tests__/boards/**` 下的 integration board tests 时，必须满足：

1. **必须跑真实 NightFlow（按 `NIGHT_STEPS` 顺序逐步执行）**

- 禁止使用“一键跑完整晚”但无法插入中间断言/交互的黑盒 helper。
- 禁止新增任何 “跳过 step / 直达 step” 的工具（例如 `advanceToStep/skipToStep/fastForward`）。

2. **禁止 helper 自动清除任何 gate / 自动发送任何确认类消息**

- 例如：`pendingRevealAcks` / `wolfRobotHunterStatusViewed` / `isAudioPlaying` 等 gate。
- 例如：`REVEAL_ACK`、`WOLF_ROBOT_HUNTER_STATUS_VIEWED`、以及任何“确认/查看状态/ack”类型消息。
- 这些必须由测试用例显式发送，以便测试能覆盖“卡 gate / 解除 gate / step mismatch”等真实 bug。

3. **必须 fail-fast（失败即停止）**

- runner/harness 内每一次 `sendPlayerMessage(...)` / `advanceNight()` 只要返回失败，都必须立刻抛错（包含 stepId、seat、reason）。
- 禁止 warn / 吞掉失败 / 继续推进（否则测试会把 bug 吃掉而误绿）。

4. **测试断言必须基于 `BroadcastGameState` 单一真相**

- 禁止直接改 state / 注入 host-only 状态。
- 需要验证拒绝（reject）就显式断言 `{ success:false, reason }` 或抛错；不要把输入改成 skip 来绕开规则。

### 修复与审计规范

- 修 bug 优先根因修复；修复后回滚基于错误假设的过时 patch，避免补丁叠补丁。
- 禁止无证据宣称“已修复”：非 trivial 必须给 commit hash、修改文件、关键符号、行为变化、验证结果（typecheck/Jest/e2e）。

### 终端输出规范

- 禁止使用 `| head` / `| tail` 截断输出；输出过长用 `grep` 过滤关键行。

---

## Git Commit 规范（Conventional Commits）

> 格式：`<type>(<scope>): <description>`

### Type（必须）

| Type | 用途 |
|------|------|
| `feat` | 新功能（对应 MINOR） |
| `fix` | Bug 修复（对应 PATCH） |
| `refactor` | 重构（不改行为） |
| `perf` | 性能优化 |
| `test` | 测试新增/修改 |
| `docs` | 文档变更 |
| `style` | 格式化（不影响逻辑） |
| `chore` | 构建/依赖/CI 等杂务 |

### Scope（推荐）

- 按模块：`night`、`room`、`config`、`hooks`、`theme`、`e2e`、`models`、`services`、`audio`
- 例：`feat(night): add seer reveal flow`
- 例：`fix(room): audio gate not releasing after skip`
- 例：`refactor(hooks): extract useNightProgress`

### 规则

- description 用英文、小写开头、不加句号、祈使语气（`add` 而非 `added`）。
- 破坏性变更：在 type 后加 `!`，例如 `feat(models)!: rename BroadcastGameState.ui`。
- body（可选）：空一行后写详细说明。
- 单个 commit 只做一件事，禁止大杂烩 commit。

---

## Instruction 文件自检与同步提醒（MUST follow）

> 目标：确保 `.github/copilot-instructions.md` 和 `.github/instructions/*.instructions.md` 始终与代码现状保持一致。

### 触发时机

当你执行的代码变更涉及以下任一情况时，**必须主动检查**现有 instruction 文件是否需要同步更新：

1. **新增/重命名/删除目录或文件路径** — 可能导致 `applyTo` glob 失配。
2. **新增/修改/废弃编码约定** — 例如新增 theme token 类别、改变 state 字段、引入新的架构模式。
3. **新增/修改 wire protocol / 消息类型** — `BroadcastGameState`、`PlayerMessage`、`HostBroadcast` 等变更。
4. **新增角色 / schema / step** — 可能需要更新实现清单或示例。
5. **修改构建/测试/部署流程** — 可能影响质量门禁章节。

### 行为要求（MUST）

- **发现可能需要同步时，主动问用户**："这次变更可能需要同步更新 `xxx.instructions.md` 的 `YYY` 章节，要我一起更新吗？"
- **禁止静默跳过**：不得在明知 instruction 与代码不一致的情况下不提醒。
- **禁止自作主张修改 instruction**：必须先告知用户具体要改什么、为什么，获得确认后再改。
