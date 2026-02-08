## WerewolfGameJudge Copilot 指令（全中文）

## 快速索引（Table of Contents）

- 协作规则：未确认禁止写代码（MUST follow）
- 不可协商规则（先读）
- 架构边界（Architecture boundaries）
- 夜晚流程与 NightPlan（Host 权威）
- 约束、校验与 Night-1-only
- 并补 E2E/contract fail-fast，禁止靠超时隐藏问题
- 广播架构（Broadcast architecture）
- Anti-drift 护栏（MUST follow）
- 实现清单（角色 / schema / step / UI 必做）
- 交付与门禁（必须执行）
- 终端输出规范（MUST follow）
- Git Commit 规范（Conventional Commits）
- Instruction 文件自检与同步提醒（MUST follow）

---

## Theme Token 使用规范（MUST follow）

> 详细规则（token 类别、import 路径、禁止项、例外、审计）已迁移至 `screens.instructions.md` 和 `components.instructions.md`。

**核心原则**：所有样式值必须来自 `src/theme/tokens.ts`，禁止硬编码颜色/间距/字号/字重/圆角/阴影。`componentSizes`、`fixed` 必须从 `src/theme/tokens` 直接导入。

---

## UI 风格统一规范（SHOULD follow）

> 详细规则（Header/卡片/Banner/文字层级/按钮层级/自查清单）已迁移至 `screens.instructions.md`。

**核心原则**：以 SettingsScreen 为标准 — Header 用 `surface` 背景 + `borderBottom`，卡片用 `shadows.sm` 不用 border 描边，页面背景用 `background` 色。

---

### 0.5) 协作规则：未确认禁止写代码（MUST follow）

- **禁止在未明确征得用户同意的情况下修改代码**（尤其是 apply_patch / edit）。
  - ✅ 允许：只读检查（read/search/list/grep）、运行测试/格式化/类型检查。
  - ✅ 若需要改动：必须先在回复中列出“将修改的文件 + 变更点摘要 + 风险”，等待用户明确确认（例如“OK/同意/可以改”）后才能动手。
- **收到涉及代码修改的需求时，必须先用 Sequential Thinking 做完整分析**（分解问题 → 收集上下文 → 制定变更计划 → 验证假设），再列出变更计划等待确认。禁止跳过分析直接动手。

### 0) 不可协商规则（先读）

- **Host 是唯一的游戏逻辑权威。** Supabase 只负责 transport/discovery/identity（传输/发现/身份）。
- **离线本地玩法。** 这是本地/离线的游戏辅助；Host 设备同时也是玩家，不是单独裁判机。
- **仅 Night-1 范围。** 绝对不要加入跨夜状态/规则。
- **`BroadcastGameState` 是唯一且完整的单一真相（Single source of truth）。**
  - 所有游戏信息（包括角色上下文，如女巫 `killedIndex`、预言家 reveal）都必须公开广播在 `BroadcastGameState` 中；UI 再按 `myRole` 过滤显示。
  - 禁止并行维护顺序表/map/双写字段导致 drift。
- **优先使用成熟库而不是自研。** 新增能力（日志、校验等）先找成熟 npm 库；只有在库不合适或过度复杂时才写自定义代码。
- **单一职责原则（SRP）。** 每个 class/module 必须且只能负责一件事。禁止 God Class（多个不相关职责揉在一起）。若单个模块超过 ~400 行或承担多个关注点，必须拆分。
  - **但行数是信号，不是判决。** 超过阈值时，先评估：(1) 文件内部是否已有清晰的分区和职责边界？(2) 拆出的模块是否有独立的复用/测试/修改场景？(3) 拆分后跨文件跳转成本是否超过收益？若三项都不成立，应保持现状并注释说明为何不拆。禁止机械套用行数规则无条件输出拆分方案。

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

### Night Flow Handler 不变量（invariants）

- `nightFlowHandler` / `stepTransitionHandler` 是夜晚推进（night progression）的单一真相。
- 当 `isHost === true` 且 `state.status === ongoing` 时，夜晚流程必须处于活跃状态（违反则 fail-fast）。
- 禁止手动推进 index（`++` 兜底策略是禁止的）。
- phase 不匹配事件必须是幂等 no-op（仅 debug）。

#### 自动推进（auto-advance）硬性护栏（MUST follow）

- **禁止在 Facade / UI / submit 成功回调里做“自动推进夜晚”决策**（例如 `submitAction()` 成功后直接调用 `advanceNight()`）。
  - 这会导致推进权威分裂、重入（double-advance）、以及 Host/Player drift。
- 自动推进如果需要存在：
  - **必须集中在 Host-only 的 night flow handler**（即 `nightFlowHandler` / `stepTransitionHandler`），由它基于 `BroadcastGameState` 的事实判断“是否推进/推进到哪一步/是否 endNight”。
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

> 详细规则（三层分工、禁止组件层吞点击）已迁移至 `screens.instructions.md` 和 `components.instructions.md`。

**核心原则**：Policy（纯逻辑）→ Orchestrator（副作用）→ Presentational（渲染+上报 intent）。禁止组件层 gate/吞点击，禁止 orchestrator 并行业务判断。

---

## Actor identity（my/effective/actor）三层语义（MUST follow）

> 详细规则（三层定义、硬规则、Review 清单）已迁移至 `screens.instructions.md`。

**核心原则**：`my*`=展示、`effective*`=提交、`actor*`=UI 决策。提交路径只用 `effective*`，policy 只用 `actor*`，禁止混用。

---

## Screen 性能 / Player 端 / Wire Protocol

> 详细规则已迁移至对应目标文件：
> - Screen 性能模式（styles factory / memo / useCallback / 测试 / 音频 Gate 优先级合约 / 交互 policy 测试门禁）→ `screens.instructions.md`
> - Player 端禁止运行业务逻辑 / Wire protocol 稳定性 → `services.instructions.md`

## 实现清单（角色 / schema / step / UI 必做）

当你新增或修改任意 Night-1 行动角色（含 UI）时，必须同时检查下面这些点：

1. **Schema-first + Resolver 对齐**（详见上方"约束、校验"章节）

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

> 详细规则（UI-level 测试门禁、反作弊硬红线、Integration tests 真实性、质量门禁、修复审计）已迁移至 `tests.instructions.md`。

**核心原则**：
- 新增/修改板子或 Night-1 行动角色时，必须同时补齐 UI-level 测试（RoomScreenTestHarness + board UI tests + contract gate），否则视为未完成交付。
- 禁止跳过测试（no `.skip`）、禁止动态口径覆盖（必须字面量数组）、难测分支不得移出 required 清单。
- Integration board tests 必须跑真实 NightFlow、fail-fast、禁止自动清 gate。
- 修 bug 优先根因修复，禁止无证据宣称“已修复”。
### 终端输出规范（MUST follow）

- **跑测试（Jest / Playwright / tsc 等）时，禁止用 `| grep`、`| head`、`| tail` 截断输出。** 必须看完整结果，避免遗漏错误或误判通过。
- 只有在非测试场景（如查看日志、搜索代码）中，才允许使用 `grep` 过滤。
- **跑 Playwright 时必须加 `--reporter=list`**（例如 `npx playwright test ... --reporter=list 2>&1`）。项目 `playwright.config.ts` 默认 reporter 是 `html`，跑完后会启动 HTTP server 展示报告并阻塞终端，导致命令永远不会退出。
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

### Instruction 文件标准格式（MUST follow）

每个 `*.instructions.md` **必须**包含明确的"允许"和"禁止"约束，格式如下：

- 使用 `✅` 标记**允许**的行为（e.g. `✅ 声明式内容（spec/schema/types）`）。
- 使用 `❌` 标记**禁止**的行为（e.g. `❌ 禁止 import service`）。
- 允许写在"核心原则"中或独立的"✅ 允许 / ❌ 禁止"区块中，但必须一眼可辨。
- 禁止只用散文描述约束而不带 `✅/❌` 标记。

### Class / Module JSDoc 标准格式（MUST follow）

每个 class、exported module（含纯函数模块）的文件头 JSDoc **必须**按以下顺序包含：

1. **名称 + 一句话定位**（这个 class/module 是什么、做什么）。
2. **职责描述**（列出关键职责，用 `职责：` 或散文皆可）。
3. **✅ 允许 / ❌ 禁止**（约束条目）。

```
/**
 * ClassName - 一句话定位
 *
 * 职责：
 * - 职责 A
 * - 职责 B
 *
 * ✅ 允许：xxx
 * ❌ 禁止：yyy
 */
```

- **禁止只有 ✅/❌ 而没有功能介绍**（读者必须先知道"是什么"再知道"什么能做什么不能做"）。
- **禁止只有功能介绍而没有 ✅/❌**（缺少约束的 JSDoc 视为不完整）。
- 纯函数 resolver / handler 模块同样适用（将 `class` 替换为文件/模块即可）。

### 写/改文件时的 Instruction 检查（MUST follow）

每次**创建新文件**或**修改现有文件**时，必须：

1. **确认该文件所属目录有对应的 instruction 文件**（`.github/instructions/*.instructions.md`，`applyTo` glob 匹配）。
2. **确认 instruction 中有明确的 `✅ 允许` 和 `❌ 禁止` 约束**。
3. 如果缺失（无 instruction 文件，或 instruction 缺少 ✅/❌ 约束），**必须主动提醒用户**："该目录 `xxx` 尚无 instruction 文件（或缺少 ✅/❌ 约束），要我补充吗？"
4. **禁止在明知缺少约束的情况下静默写代码**。

> 当前尚无 instruction 覆盖的目录：`src/utils/**`、`src/config/**`、`src/constants/**`、`src/contexts/**`、`src/navigation/**`。遇到这些目录的文件操作时，必须提醒。
