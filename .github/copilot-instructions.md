## WerewolfGameJudge Copilot 指令（全中文）

### 0) 不可协商规则（先读）

- **Host 是唯一的游戏逻辑权威。** Supabase 只负责 transport/discovery/identity（传输/发现/身份）。
- **离线本地玩法。** 这是本地/离线的游戏辅助；Host 设备同时也是玩家，不是单独裁判机。
- **仅 Night-1 范围。** 绝对不要加入跨夜状态/规则。
- **所有状态都通过 `BroadcastGameState` 广播。** 所有游戏信息（包括角色上下文，如女巫 `killedIndex`、预言家 reveal）都必须公开广播在 `BroadcastGameState` 中；UI 根据玩家角色过滤显示。这能简化架构，并消除 Host/Player 状态不同步问题。
- **迁移期协议扩展护栏（避免遗忘）。** 如果需要在 `BroadcastGameState` 中新增字段：
  - 迁移期（v1/v2/legacy 并存）**必须先做成 `?` 可选字段**，并确保缺字段时不会导致崩溃（容错由读取方处理）。
  - TODO(remove by 2026-03-01): 当 legacy 与切换开关移除、v2 成为唯一路径后，评估把这些字段收紧为必填或移除此迁移期规则，并更新合约测试。
- **单一真相（Single source of truth）。** 禁止并行维护顺序表/map/双写字段导致 drift。
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

### StepSpec 的 id/schemaId 去重（迁移规则）

- 如果 `StepSpec` 同时存在 `id` 和 `schemaId`，这只能是迁移期产物。
  - `schemaId` 必须加 `@deprecated` + `TODO(remove by YYYY-MM-DD)`。
  - 保留合约测试强制 `step.id === step.schemaId`。
- 最终形态：只保留 `id: SchemaId`。

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

### `BroadcastGameState` 必须保持为完整、唯一的 state

- **绝对规则：** `BroadcastGameState` 是唯一且完整的单一真相。
  - 禁止在任何 v2 state 类型中引入 `HostOnlyState`、`hostOnly` 字段或“不会广播”的字段。
  - Host 如果执行需要某字段，那它就必须属于 `BroadcastGameState`。
  - 隐私是 UI 层问题（按 `myRole` / `isHost` 过滤显示），不是数据模型问题。
- **禁止双 state shape：** Host 与 Player 内存中的 state shape 必须完全一致。
- **禁止派生字段漂移：** 计算/派生字段必须从同一份 state 计算，或只写入 `BroadcastGameState` 一次。
  - 禁止保留 Player 没有的“Host 本地计算副本”。

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

### 迁移期间 wire protocol 必须稳定（Transport protocol stability）

- v2 迁移期间，on-wire protocol 是稳定的，必须保持兼容：
  - `HostBroadcast`
  - `PlayerMessage`
  - `BroadcastGameState`
- v2 可以引入内部 “Intent” 类型，但必须适配到现有 protocol。
  - 除非同时提供兼容层 + 合约测试，否则禁止发明平行的消息协议。

---

## 夜晚行动角色检查清单（每个角色都必须遵守）

当实现或修改任意夜晚行动角色时：

1. **Nightmare 阻断逻辑**

- 每个夜晚行动角色都必须处理被 nightmare 阻断的情况
- resolver 中检查 `currentNightResults.blockedSeat === actorSeat`
- 若被阻断：返回 `{ valid: true, result: {} }`（有效但无效果）

2. **上下文必须在 `BroadcastGameState` 中**
   - 需要上下文的角色必须在 `BroadcastGameState` 里有对应字段：
     - `witch` → `witchContext: { killedIndex, canSave, canPoison }`
     - `hunter` / `darkWolfKing` → `confirmStatus: { role, canShoot }`
   - 需要 reveal 的角色必须把结果写入 `BroadcastGameState`：
     - `seer` → `seerReveal: { targetSeat, result }`
     - `psychic` → `psychicReveal: { targetSeat, result }`
     - 等等

3. **UI 只从 gameState 读**

- Client 从 `gameState.witchContext`、`gameState.seerReveal` 等字段读取
- UI 根据 `myRole` 决定显示内容

4. **与 schema 对齐**

- resolver 的校验必须与 schema constraints 完全一致
- 如果 schema 写了 `notSelf`，resolver 必须拒绝自指目标

---

## Tests & quality gates（测试与质量门禁）

### Linting（ESLint + Prettier）

- **每次修改代码后**，运行 `npm run lint:fix` 与 `npm run format:write`，确保 0 errors / 0 warnings。
- **未使用变量（unused variables）**：用 `_` 前缀（例如 `_unusedParam`）以满足 `@typescript-eslint/no-unused-vars`。
- **React hooks exhaustive-deps**：
  - 如果你刻意省略某个 dependency：添加 `// eslint-disable-next-line react-hooks/exhaustive-deps`，并写明原因。
  - 如果缺少 dependency：把它补到依赖数组。
  - 如果 dependency 不需要：把它从依赖数组移除。
- **不要全局禁用 lint 规则**（除非明确批准）。优先使用带理由的单行 disable。
- **Prettier**：使用默认配置。提交前运行 `npm run format:write`。

### Jest 合约测试（表驱动 Night 必须）

维护/更新合约测试以保证：

- `NIGHT_STEPS` 引用有效性（`roleId` 存在；`SchemaId` 存在）
- 顺序确定性（step ids 的 snapshot）
- 唯一性（step ids 不重复）
- Night-1-only 红线
- audioKey 非空

### E2E 规则（Playwright）

- E2E 只做 smoke，不要把它当规则裁判。
- 运行核心 e2e 时必须 `workers=1`；绝对不要并行跑多个 e2e 进程。
- 房间就绪必须使用 `waitForRoomScreenReady()`（加入者必须到达 `🟢 已连接` 或完成“强制同步”）。

### UI 测试稳定性（Jest + RNTL）

- 优先使用 `getByTestId` / `findByTestId`。不要新增 `UNSAFE_*`。
- 将 testIDs 集中维护在 `src/testids.ts`，并通过兼容映射保留 legacy IDs。

---

## Checklists（检查清单）

### 新增角色 / schema / step

- 将角色加入 `ROLE_SPECS`（`src/models/roles/spec/specs.ts`），并保持 `RoleId` 从 registry keys 推导。
- 如果该角色在 Night-1 行动：
  - 在 `SCHEMAS`（`src/models/roles/spec/schemas.ts`）中新增/扩展 schema-first 约束
  - 在 `NIGHT_STEPS`（`src/models/roles/spec/nightSteps.ts`）中加入 step，包含 `id: SchemaId` 与 `audioKey`
  - 在 `src/services/night/resolvers/**` 下实现/更新 resolver（与 schema 对齐）
  - **若可被 nightmare 阻断：**在 resolver 中加入阻断检查（`currentNightResults.blockedSeat === actorSeat`）
  - **若回合开始需要上下文：**为 `BroadcastGameState` 增加字段 + Host 设置 + UI 读取
  - **若行动后需要 reveal：**为 `BroadcastGameState` 增加结果字段
  - 更新合约测试（顺序 snapshot + 引用有效性 + 红线）

### 狼人投票的 schema 驱动 UI

- **UI 从 schema 推导 `showWolves`：** `schema?.kind === 'wolfVote' && schema.meeting.canSeeEachOther`
- **不要使用 step-level visibility 字段。** 所有可见性逻辑都来自 schema。
- **`wolfKillDisabled` 单一真相：**在 `handlePlayerAction` 中当 nightmare 阻断狼时设置，并在 `toBroadcastState` 中直接读取。

---

## 修复策略（Fix strategy）

### 优先根因修复，避免补丁叠补丁

- 修 bug 时，优先做**单一、完整的根因修复**，不要堆多个小补丁/创可贴。
- 如果修复需要同时改多个文件/层级，这是可以接受的——整体修复优于零散 workaround。
- 除非被外部依赖阻塞或明确达成一致，否则不要加“临时”或“部分”修复。

### 找到真正根因后，回滚过时/错误的修复

- 一旦定位并修复**真正根因**：
  1. 审计之前基于错误假设做出的 patch。
  2. **完整回滚**这些过时 patch（不要留下死代码/误导代码）。
  3. 在 commit message 中说明回滚了哪些提交、原因是什么。
- 一个干净的“正确修复 + 回滚”优于层层叠加“以防万一”的代码。

---

## 报告规范（Reporting discipline）

- 不要在没有证据的情况下宣称“已经改了/已经修了”。
- 对于非 trivial 的工作，必须报告：
  - commit hash（或“尚未提交”）
  - 修改的文件
  - 关键符号（symbols）变更
  - 行为变化
  - 验证运行（typecheck/Jest/e2e）+ 结果

---

## 终端命令规则（Terminal command rules）

- **禁止使用 `| head` 或 `| tail` 管道截断输出。** 请直接运行命令以看到完整结果。
- 如果输出特别长，用 `grep` 过滤关键行，而不是 head/tail。
