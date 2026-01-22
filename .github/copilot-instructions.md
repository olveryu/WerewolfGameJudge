## WerewolfGameJudge Copilot 指令（全中文）

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
- `src/services/night/resolvers/**`：Host-only 的纯函数 resolution + validation。
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

```
ROLE_SPECS (角色固有属性)
    │ 定义：displayName, faction, wolfMeeting, flags
    │ 文件：src/models/roles/spec/specs.ts
    │
    ▼
SCHEMAS (行动输入协议)    ← 单一真相
    │ 定义：kind, constraints, ui.prompt, meeting (for wolfVote)
    │ 文件：src/models/roles/spec/schemas.ts
    │ UI 从 schema 推导行为 (e.g., showWolves = schema.meeting.canSeeEachOther)
    │
    ▼
NIGHT_STEPS (步骤序列)    ← 只管顺序和音频
    │ 定义：id (= SchemaId), roleId, audioKey
    │ 文件：src/models/roles/spec/nightSteps.ts
    │
    ▼
GameStateService / Resolvers (Host 执行)
    │
    ▼
UI (从 schema + gameState 推导显示)
```

**职责划分：**
| 层级 | 职责 | 示例 |
|------|------|------|
| `ROLE_SPECS` | 角色固有属性，不随步骤变化 | `wolfMeeting.canSeeWolves` = 这个角色能否被狼队友看到 |
| `SCHEMAS` | 行动输入协议，描述 UI 交互和约束 | `meeting.canSeeEachOther` = 会议中能否互相看到 |
| `NIGHT_STEPS` | 步骤序列，只管顺序和音频 | `audioKey` = 播放哪个音频 |

**不是双写：**

- `schema.meeting.canSeeEachOther` 控制 "何时" 显示队友 (开关)
- `ROLE_SPECS[role].wolfMeeting.canSeeWolves` 控制 "谁" 被高亮 (过滤)

### 日志（Logging）

- **使用结构化 logger**：统一从 `src/utils/logger.ts` 获取（例如 `gameRoomLog`、`roomScreenLog`、`gameStateLog`）。
- **禁止在业务代码中使用 `console.*`**：除非明确属于**测试/脚本/Storybook mock/E2E 调试**，否则一律用 logger。
  - ✅ 允许：`src/**/__tests__/**`、`e2e/**`、`scripts/**`、`*.stories.tsx` 中的 `console.*`
  - ✅ 允许：对第三方库/运行环境不可控的 `console.*`（例如依赖内部）
  - ❌ 禁止：`src/**` 业务/服务/组件代码里新增 `console.log/warn/error`
  - 推荐用法：
    - `import { log } from 'src/utils/logger'` 然后 `log.extend('Module').debug('msg', data)`
    - 或直接用预置的 `roomScreenLog` / `broadcastLog` 等
- **关键事件必须打日志**：状态迁移、action 提交、错误、关键分支决策。
- **日志格式**：包含 context（例如 `[RoomScreen]`、`[GameStateService]`）与相关数据。
- **Debug vs Error**：正常流程用 `.debug()`；可恢复问题用 `.warn()`；失败用 `.error()`。

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

### 音频 Gate（`isAudioPlaying`）硬性护栏（MUST follow）

- **`isAudioPlaying` 代表“权威音频 Gate 的事实状态”，不是推导状态。**
- **唯一允许修改 `isAudioPlaying` 的 action：`SET_AUDIO_PLAYING`。**
  - ✅ 允许：`handleSetAudioPlaying`（Host-only）→ reducer 处理 `SET_AUDIO_PLAYING`。
  - ❌ 禁止：在 reducer 中对 `START_NIGHT` / `ADVANCE_TO_NEXT_ACTION` / `SET_CURRENT_STEP` 等 action “顺便”把 `isAudioPlaying` 设为 `true/false`（这会把事实状态变成推导状态，导致 drift / 卡死）。
- **Host 负责“音频时序编排”，但音频播放 IO 可以在 UI 层触发。** 允许的模式是：
  1) Host 看到 step 切换（`currentStepId` 变化）→ 先调用 `setAudioPlaying(true)` 广播 Gate
  2) Host 播放对应 `audioKey`
  3) 音频结束/跳过 → Host 调用 `setAudioPlaying(false)` 解除 Gate（必须 finally/兜底）
- **Player 端绝对不能写 Gate**：Player 不允许调用 `setAudioPlaying`（`host_only`）。
- **Fail-fast 要求（测试门禁）**：若出现“UI 已进入可行动提示（如狼刀/技能选择）但 `isAudioPlaying===true` 持续不释放”或“提交行动持续被 `forbidden_while_audio_playing` 拒绝”，必须：
  - 优先修复 Host 的 setAudioPlaying(false) 兜底链路
  - 并补 E2E/contract fail-fast，禁止靠超时隐藏问题

### StepSpec id 规则

- Step id 必须是稳定的 `SchemaId`。
- 禁止使用 UI 文案作为逻辑 key；测试必须断言稳定 identifier。

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

- **所有游戏状态都是公开的。** `BroadcastGameState` 必须包含全部信息（包括角色特定数据）。
- **UI 层过滤显示。** Client UI 根据 `myRole` 决定显示什么：
  - 女巫仅在 `myRole === 'witch'` 时显示 `witchContext.killedIndex`
  - 预言家仅在 `myRole === 'seer'` 时显示 `seerReveal.result`
  - 狼人仅在 `isWolfRole(myRole)` 时显示 `wolfVoteStatus`
- **不允许 PRIVATE_EFFECT。** 为简化架构，所有私有消息基础设施已移除。
- **Host 和 Player 读取同一份 state。** 不允许 Host 用本地状态、Player 用广播状态导致不同步。

---

## Anti-drift 护栏（MUST follow）

这些规则用于防止任何重构/迁移（尤其 services v2）过程中出现回归：

- host/player 分支逻辑漂移
- Host UI 因读取不同 state shape 而与 Player UI 不一致
- “临时” feature-flag 导出破坏模块系统
- v2 在运行时意外依赖 legacy

### 单一真相：`BroadcastGameState`

- 禁止在任何 v2 state 类型中引入 `HostOnlyState`、`hostOnly` 字段或“不会广播”的字段。
- Host 如果执行需要某字段，那它就必须属于 `BroadcastGameState`。
- 隐私是 UI 层问题（按 `myRole` / `isHost` 过滤显示），不是数据模型问题。
- Host 与 Player 内存中的 state shape 必须完全一致。
- 计算/派生字段必须从同一份 state 计算，或只写入 `BroadcastGameState` 一次（禁止双写/漂移）。

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

### Feature flag：禁止运行时条件导出（no runtime conditional exports）

- **禁止：** 运行时条件 re-export，例如：
  - `if (flag) { export * from './v2' } else { export * from './legacy' }`

  这在 TS/ESM 中是非法/不稳定的。

- Feature flag 必须通过以下方式之一实现：
  - 工厂函数（推荐）：`createServices({ mode: 'legacy' | 'v2' })`
  - 在组合根（composition root）做依赖注入（DI）
  - 静态双导出（namespaced）+ 调用方显式选择

### v2 禁止在运行时 import legacy

- `src/services/v2/**` 禁止 import `src/services/legacy/**`。
  - legacy 只能用于参考与回滚，不允许 v2 运行时依赖。
  - v2 行为对齐必须通过测试保证，而不是调用 legacy。

### “legacy” 边界（纯模块禁止移入 legacy）

- 迁移期间禁止把这些内容移动到 `legacy/`：
  - `src/services/night/resolvers/**`
  - `src/models/roles/spec/**`（ROLE_SPECS / SCHEMAS / NIGHT_STEPS）
  - `NightFlowController`（纯状态机）
  - `DeathCalculator`（纯计算）
- 只允许把即将被替换的编排/胶水代码移动到 `legacy/`（例如 God service / 旧 transport wrapper / persistence glue）。

### wire protocol 必须稳定（Transport protocol stability）

- on-wire protocol 是稳定的，必须保持兼容：
  - `HostBroadcast`
  - `PlayerMessage`
  - `BroadcastGameState`
- v2 可以引入内部 “Intent” 类型，但必须适配到现有 protocol。
  - 除非同时提供兼容层 + 合约测试，否则禁止发明平行的消息协议。

---

## 实现清单（角色 / schema / step / UI 必做）

当你新增或修改任意 Night-1 行动角色（含 UI）时，必须同时检查下面这些点：

1) **Schema-first + Resolver 对齐**

- 输入合法性必须写在 `SCHEMAS[*].constraints`。
- resolver 的校验必须与 schema constraints 完全一致：
  - schema 写了 `notSelf` → resolver 必须拒绝自指目标。
  - schema 允许自指 → resolver 不得擅自拒绝（除非明确文档化 + 测试覆盖）。

2) **Nightmare 阻断**

- resolver 必须检查 `currentNightResults.blockedSeat === actorSeat`。
- 若被阻断：返回 `{ valid: true, result: {} }`（有效但无效果）。

3) **上下文/结果必须写入 `BroadcastGameState`（公开广播）**

- 需要上下文：必须加到 `BroadcastGameState`（例如 `witchContext`、`confirmStatus`）。
- 需要 reveal：必须把结果写回 `BroadcastGameState`（例如 `seerReveal`、`psychicReveal`）。
- UI 只从 `gameState.*` 读取，并按 `myRole` 过滤显示。

4) **三层表驱动：角色/协议/步骤**

- 角色加入 `ROLE_SPECS`（`src/models/roles/spec/specs.ts`）。
- 行动协议在 `SCHEMAS`（`src/models/roles/spec/schemas.ts`）。
- Night-1 顺序与音频在 `NIGHT_STEPS`（`src/models/roles/spec/nightSteps.ts`），step id 必须是稳定 `SchemaId`。

5) **狼人相关 UI/规则（schema 驱动）**

- UI 从 schema 推导 `showWolves`：`schema?.kind === 'wolfVote' && schema.meeting.canSeeEachOther`。
- 禁止使用 step-level visibility 字段。
- `wolfKillDisabled` 单一真相：在 `handlePlayerAction` 中当 nightmare 阻断狼时设置，并在 `toBroadcastState` 中直接读取。

---

## 交付与门禁（必须执行）

### 质量门禁（Quality gates）

- 修改代码后，必须跑 ESLint/Prettier（以项目既有 npm scripts 为准），确保 0 errors。
- 合约测试必须覆盖：
  - `NIGHT_STEPS` 引用有效性（`roleId`、`SchemaId`）
  - step ids 顺序确定性（snapshot）与唯一性
  - Night-1-only 红线
  - audioKey 非空
- E2E 只做 smoke：核心 e2e 必须 `workers=1`，房间就绪必须用 `waitForRoomScreenReady()`。

### 修复与审计规范

- 修 bug 优先根因修复；修复后回滚基于错误假设的过时 patch，避免补丁叠补丁。
- 禁止无证据宣称“已修复”。非 trivial 必须给：commit hash、修改文件、关键符号、行为变化、验证结果（typecheck/Jest/e2e）。

### 终端输出规范

- 禁止使用 `| head` / `| tail` 截断输出；输出过长用 `grep` 过滤关键行。
