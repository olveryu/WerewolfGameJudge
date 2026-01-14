# WerewolfGameJudge 测试矩阵表 & 大策略（Night-1-only）

> 目标：覆盖 **所有板子（PRESET_TEMPLATES）**、**模板/玩家弹窗（RoomScreen）**、**队友显示/可见性（anti-cheat + wolf visibility）**。
>
> 范围：只做第一晚（Night-1-only），Host 是唯一裁判（Host-authority）。Supabase 只负责 transport/discovery/identity。

---

## 0. 核心原则（定调）

- **Host-authority**：夜晚流程、校验、resolver、死亡计算、音频推进全部由 Host 负责。
- **Night-1-only**：不引入跨夜记忆（previousActions/连续两晚/第二晚开始等都禁止）。
- **Anti-cheat**：敏感信息必须通过 toUid 私信；public broadcast（room-public view-model）不允许携带敏感字段。
- **单一真相**：Night-1 步骤顺序来自 `NIGHT_STEPS`（表驱动）；UI 文案不能当逻辑契约。

---

## 1. 板子清单（来自 `PRESET_TEMPLATES`）

模板定义来源：`src/models/Template.ts`。

| 模板名 | 人数 | 关键角色/特性 | 已有 Host 集成测试文件 | 建议重点覆盖分支（大策略） |
|---|---:|---|---|---|
| 标准板12人 | 12 | Seer/Witch/Hunter/Idiot；无守卫、无技能狼 | `src/services/__tests__/boards/StandardBoard12.integration.test.ts` | 女巫救/毒、狼空刀、seer reveal 私信链路（Host→toUid） |
| 狼美守卫12人 | 12 | `wolfQueen` 链接死亡；有 guard | `src/services/__tests__/boards/WolfQueenGuard12.integration.test.ts` | 狼美被杀触发连坐；guard/witch 交互；反作弊可见性 |
| 狼王守卫12人 | 12 | `darkWolfKing` 死亡状态（可/不可开枪）；有 guard | `src/services/__tests__/boards/DarkWolfKingGuard12.integration.test.ts` | 黑狼王被毒 vs 被刀差异；status 弹窗（UI） |
| 石像鬼守墓人12人 | 12 | `gargoyle` 非参会狼（不该看到队友）；`graveyardKeeper` | **缺少 boards 集成测试文件**（现只有 template contract） | 重点：gargoyle wolfMeeting 可见性（不参会）；守墓人能力（若 Night-1 有动作） |
| 梦魇守卫12人 | 12 | `nightmare` block 一名玩家；有 guard | `src/services/__tests__/boards/NightmareGuard12.integration.test.ts` | block gate（host 拒绝 action）；block 对 DeathCalculator 的兜底；UI blocked 弹窗 |
| 血月猎魔12人 | 12 | `witcher` 免疫毒；`bloodMoon` 技能狼但 Night-1 无动作 | `src/services/__tests__/boards/BloodMoonWitcher12.integration.test.ts` | witcher 毒免疫；bloodMoon 是否出现在 actionOrder（应不行动） |
| 狼王摄梦人12人 | 12 | `dreamcatcher`（摄梦人）；`darkWolfKing` | **缺少 boards 集成测试文件** | 摄梦人夜间动作与约束（Night-1-only）；黑狼王 status |
| 狼王魔术师12人 | 12 | `magician` swap 两段；`darkWolfKing` | **缺少 boards 集成测试文件** | magician first/second 选择；UI 两段提示；黑狼王 status |
| 机械狼通灵师12人 | 12 | `wolfRobot` 非参会狼；`psychic` 私信 reveal；有 guard | **缺少 boards 集成测试文件** | psychic reveal 私信链路；wolfRobot 不应看到队友 |
| 恶灵骑士12人 | 12 | `spiritKnight` 反伤（被查/被毒反杀神职）；有 guard | `src/services/__tests__/boards/SpiritKnight12.integration.test.ts` | seer/witch 对骑士触发反伤；UI reveal 展示 |

> 说明：矩阵表里“缺少 boards 集成测试文件”的地方，不代表功能没实现，而是当前 repo 的 boards runtime integration 覆盖还没对齐 `PRESET_TEMPLATES` 全量。

---

## 2. 测试矩阵表（大策略版）

### 2.1 维度定义（你要测的“板子/弹窗/队友显示”拆成可勾选项）

下面每一行都是一个“测试维度”。每个 board 都应该对齐这些维度（是否适用取决于角色是否存在）。

| 维度编号 | 维度 | 归属层 | 主文件/模块锚点 | 验收标准（必须可自动化断言） |
|---|---|---|---|---|
| B1 | 模板合法性（roles 合法、人数匹配、actionOrder 与 NightPlan 一致） | Jest Contract | `src/models/__tests__/Template.contract.test.ts` | 所有 `PRESET_TEMPLATES` 通过 |
| B2 | NightPlan/NIGHT_STEPS 引用有效、顺序稳定、唯一性 | Jest Contract | `src/models/roles/spec/__tests__/nightSteps.contract.test.ts` 等 | stepId/roleId/schemaId 全有效、顺序快照稳定 |
| B3 | Host runtime：该板子 Night-1 可完整跑通，不 stuck | Jest Integration | `src/services/__tests__/boards/*.integration.test.ts` + `hostGameFactory.ts` | `result.completed === true` 且推进到 night end |
| B4 | 该板子特性分支（如 wolfQueen 连坐、nightmare block、spiritKnight 反伤等） | Jest Integration + Unit | `DeathCalculator`/resolver tests | 分支行为可观察、可断言（例如 deaths/info/status） |
| B5 | Anti-cheat：public broadcast 不含敏感字段 | Jest Contract | `src/services/__tests__/visibility.contract.test.ts` | public type/keys 不出现敏感字段 |
| B6 | Anti-cheat：seer/psychic/witchContext 等敏感结果只走私信（toUid） | Jest Integration/Unit | `privateEffect.contract.test.ts`、GameStateService | 只在 PrivatePayload 出现，public 不出现 |
| UI1 | RoomScreen：板子配置渲染正确（狼/神/特殊/村民计数） | RNTL | `RoomScreen.tsx` Board Info + `RoomScreen.helpers.ts` | 渲染文本/计数与 template.roles 一致 |
| UI2 | RoomScreen：女巫两阶段弹窗（save→poison prompt→confirm/cancel） | RNTL | `RoomScreen.tsx handleActionIntent` + `useRoomActionDialogs.ts` | 弹窗出现时机正确、按钮回调触发正确、幂等不重复 |
| UI3 | RoomScreen：seer/psychic reveal（submit 后等待 inbox 私信结果） | RNTL（可配合 hook mock） | `waitForSeerReveal/waitForPsychicReveal` | success: 展示 reveal；timeout: 有可恢复提示/重试入口（按你现有 UX 约束） |
| UI4 | RoomScreen：blocked（nightmare）弹窗与 skip 行为 | RNTL | `showBlockedAlert` + skip button | blocked 时不可提交非空 action，UI 引导“跳过” |
| V1 | 队友显示：wolfMeeting 可见性（参会狼可见队友；非参会狼不可见） | Jest Unit | `determineActionerState` + `buildSeatViewModels` | `showWolves` 与 overlay 标识严格符合规则 |
| V2 | actsSolo：单独行动不显示队友（但可见自己） | Jest Unit | NightSteps actsSolo + `determineActionerState` | actsSolo 时 `showWolves=false` |
| E2E1 | E2E smoke：1 局能跑通，不 stuck（不当规则裁判） | Playwright | `e2e/night1.basic.spec.ts` | 只验证流程可达终点，workers=1 |

---

## 3. 大策略：如何把“所有板子 + 弹窗 + 队友显示”落地

### 3.1 分层职责（避免测试互相踩线）

1) **Jest Contract（稳定性/红线）**
- 锁死 `PRESET_TEMPLATES` 自洽、`NIGHT_STEPS` 顺序与引用、anti-cheat public/private 边界。
- 这些测试负责“规则与边界的单一真相”，UI/E2E 不做规则裁判。

2) **Jest Host Integration（每个板子的运行时事实）**
- 每个 board 一份 `*.integration.test.ts`：像 spec 一样写清楚该板子的“关键分支”。
- 使用 `hostGameFactory.ts` 抽象公共推进逻辑，保持可读性与一致性。

3) **RNTL（RoomScreen 的交互/弹窗）**
- 只测“弹窗出现/交互回调/幂等”，不测 resolver 结果是否正确。
- 依赖稳定 selector：优先 `testID`（`AlertModal` 已有稳定 testID）。

4) **Playwright（smoke-only）**
- 只验证“可跑通不 stuck”，不验证死亡结果/规则。

---

## 4. 针对你最关心的三件事：验收口径

### 4.1 「我想测试所有的板子」
- 每个 `PRESET_TEMPLATES` 都要有：
  - 至少 1 条 Host runtime integration 覆盖 Night-1 完整推进（completed=true）。
  - 至少 1 条触发该板子独特角色分支（如：wolfQueen 连坐、nightmare block gate、witcher 毒免疫、spiritKnight 反伤）。

### 4.2 「template 的弹窗、玩家弹窗对不对」
- 覆盖所有 schema kind 的 UI 表现：
  - confirm（猎人/黑狼王 status）
  - chooseSeat（seer/psychic 等）
  - compound（witch save/poison）
  - wolfVote（狼会投票）
  - swap（magician）
- 每条用例至少断言：
  - 弹窗出现一次（幂等不重复）
  - button 点击触发正确回调
  - submit 后需要等待私信的场景，能处理延迟/超时（不重发 action，只重试读）

### 4.3 「显示的队友对不对」
- 需要同时满足：
  1) public broadcast 不泄漏队友/敏感字段（contract）
  2) host-side view-model（`showWolves`/wolf overlays）符合规则（unit）
  3) UI 渲染按 view-model 展示（RNTL 可选 smoke）

---

## 5. 现状盘点（基于当前仓库）

### 5.1 已经具备的“强覆盖”
- `PRESET_TEMPLATES` contract：`src/models/__tests__/Template.contract.test.ts`（✅）
- NightSteps/NightPlan contract（✅）
- Anti-cheat visibility contract（✅）
- 多个 board 的 Host runtime integration（✅）：标准板/狼王守卫/狼美守卫/梦魇守卫/血月猎魔/恶灵骑士

### 5.2 当前缺口（按大策略口径）
- 还没覆盖到所有 `PRESET_TEMPLATES` 的 boards integration：
  - 石像鬼守墓人12人
  - 狼王摄梦人12人
  - 狼王魔术师12人
  - 机械狼通灵师12人
- UI 弹窗层（RoomScreen）还缺“系统性覆盖”（目前更偏逻辑侧强、UI 侧薄）。

---

## 6. 建议的落地顺序（大策略，不是最小策略）

1) **先补齐 boards runtime integration 的“模板全覆盖”**
- 目标：`PRESET_TEMPLATES` 10 个模板，每个都有对应 integration。

2) **再补齐 RoomScreen 弹窗矩阵（按 schema kind 分类）**
- 目标：confirm/chooseSeat/compound/wolfVote/swap 每类都至少覆盖 2-3 条关键角色流。

3) **最后把队友显示做成三道门（contract + unit + UI smoke）**
- 目标：避免 UI 文案驱动、避免 public 泄漏。

---

## 6.1 实施计划（建议拆成 3 个 commit）

下面按“3 个 commit”拆分，方便你做 code review、CI 闸门与回滚。

### Commit 1：Boards 全覆盖（对齐 `PRESET_TEMPLATES` 10 个模板）

**目标**
- 让每个 `PRESET_TEMPLATES` 都存在且仅需维护一份对应的 Host runtime integration 测试。
- 每个板子至少覆盖：Night-1 完整推进（不 stuck）+ 该板子独特分支（可观察/可断言）。

**范围**
- 新增缺失的 boards integration 测试文件（当前缺口见“5.2 当前缺口”）：
  - 石像鬼守墓人12人
  - 狼王摄梦人12人
  - 狼王魔术师12人
  - 机械狼通灵师12人

**是否需要更新 template？（关键判断）**
你偏好“最大修复”，那 Commit 1 我建议直接按下面口径执行：

- **允许并鼓励改 template/role spec 来做一次性对齐**：Commit 1 不只补 tests，也把“模板/角色元数据/Night-1 行为”一起统一到 contract 约束之下。
- **最大修复的边界**（仍然遵守 Night-1-only/Host-authority/anti-cheat 红线）：
  - ✅ 可以改：`PRESET_TEMPLATES`（模板 roles）、角色元数据（如 `hasNightAction`）、以及相关 contract tests 的期望（如果模板名/列表变化）。
  - ✅ 可以加：针对新板子角色的 resolver/DeathCalculator 单测（用来锁分支），但不要把 UI/E2E 当规则裁判。
  - ❌ 不做：跨夜规则、第二晚开始的约束、以及任何把敏感信息塞进 public broadcast 的改动。
- **为什么这样更适合“最大修复”**：
  - 你会在一个 PR/commit 里把“模板 → NightPlan(actionOrder) → Host runtime → contract 红线”链路打通，后面补 UI 时更稳。
  - 代价是 commit 会更大，但 review 更像“把一套板子一次性拉齐”。

**建议改动文件（示例命名，保持与现有风格一致）**
- 新增：
  - `src/services/__tests__/boards/GargoyleGraveyardKeeper12.integration.test.ts`
  - `src/services/__tests__/boards/DarkWolfKingDreamcatcher12.integration.test.ts`
  - `src/services/__tests__/boards/DarkWolfKingMagician12.integration.test.ts`
  - `src/services/__tests__/boards/WolfRobotPsychicGuard12.integration.test.ts`
- 可能会共用/小幅增强（尽量保持向后兼容）：
  - `src/services/__tests__/boards/hostGameFactory.ts`（仅当缺少某些角色 action 组装/推进能力时再动）

**每个新增 integration 文件的结构建议（对齐你们当前写法）**
- `Happy Path`：`result.completed === true`（Night-1 不 stuck）
- `Board Feature`：覆盖该板子独特分支
  - gargoyle：非参会狼相关可见性（偏契约/逻辑层） + 若有 Night-1 行为则覆盖
  - dreamcatcher：Night-1 行为/约束（禁止跨夜）
  - magician：两段选择/编码（交换目标）
  - psychic：私信 reveal 的 Host 侧 payload 期望（anti-cheat）

**验收（CI 门禁）**
- 必跑：Jest（全量）
  - `npm test`
- 可选：typecheck（如果你们 CI 也跑就一起）
  - `npm run typecheck`
 - 可选：E2E smoke（确认流程不被你的“最大修复”搞挂；仍不当规则裁判）
   - `npm run e2e:core`

---

### Commit 2：RoomScreen UI 弹窗矩阵（按 schema kind 覆盖）

**目标**
- 把“template 弹窗/玩家弹窗对不对”系统化：覆盖 confirm/chooseSeat/compound/wolfVote/swap 五类 schema。
- UI 测试只当 UI 裁判：验证弹窗出现/按钮/回调/幂等；不验证 resolver 规则正确性。

**范围**
- RNTL：围绕 `RoomScreen.tsx`（orchestrator）与 `useRoomActionDialogs.ts`（dialog layer）补齐用例。
- 优先覆盖：女巫（两阶段）、预言家/通灵师（submit→等待私信→展示）、猎人/黑狼王（status confirm）。

**UI 弹窗测试是否必须严格用“12 人模板”？（推荐口径）**
- **不必严格限定 12 人模板**：UI 弹窗测试的核心是“schema kind → 弹窗/回调/幂等”，与人数关系不大。
- **推荐做法：2 组用例**
  1) **Schema-kind 测试（主力）**：用最小房间/最小 seats（例如 3~5 人）构造 state，覆盖 confirm/chooseSeat/compound/wolfVote/swap。
    - 好处：更稳定、更快、减少与具体 board 的耦合。
  2) **Preset 模板 smoke（可选）**：挑 1~2 个典型 12 人模板做“从模板渲染到弹窗出现”链路 smoke（例如：标准板 + 机械狼通灵师）。
    - 好处：防止模板↔UI wiring 断裂；但不把它当“弹窗全覆盖”的主载体。
- 如果你们团队明确要“每个 preset 模板都要 UI 覆盖一遍”，建议把它降级为 **Playwright smoke**（流程级），不要让 RNTL 变成 10×N 的维护地狱。

**建议改动文件**
- 新增：
  - `src/screens/RoomScreen/__tests__/RoomScreen.dialogs.test.tsx`（dialog layer：按钮回调、title/message、幂等）
  - `src/screens/RoomScreen/__tests__/RoomScreen.intent-orchestrator.test.tsx`（orchestrator：handleActionIntent 串联 submit/wait 流）
- 可能需要的测试辅助：
  - 对 `useGameRoom` 做 mock（仅在 UI 测试中），用来控制 `waitForSeerReveal/waitForPsychicReveal/getWitchContext` 的返回

**验收（CI 门禁）**
- 必跑：Jest（全量）
  - `npm test`

---

### Commit 3：队友显示（3 道门：anti-cheat contract + unit + UI smoke）

**目标**
- “显示的队友对不对”拆成三层约束，防止未来 UI/广播字段漂移：
  1) public broadcast 永不泄漏敏感字段（contract）
  2) host-side view-model（showWolves/overlay）逻辑正确（unit）
  3) UI 渲染按 view-model 表现（可选 smoke）

**范围**
- Unit：集中验证 `determineActionerState`、`buildSeatViewModels` 在以下情形下的输出：
  - wolfMeeting：参会狼可见队友
  - 非参会狼：`wolfRobot`/`gargoyle` 不可见队友
  - actsSolo：单独行动不显示队友（但可见自己）

**建议改动文件**
- 优先“复用现有测试文件加 case”，避免新文件太散：
  - 更新：`src/screens/RoomScreen/__tests__/RoomScreen.helpers.test.ts`
- 如需要 UI smoke：
  - 新增：`src/screens/RoomScreen/__tests__/PlayerGrid.wolfOverlay.test.tsx`

**验收（CI 门禁）**
- 必跑：Jest（全量）
  - `npm test`
- 可选：E2E smoke（仍然不当规则裁判）
  - `npm run e2e:core`

---

## 7. 附录：关键文件索引（方便你和队友定位）

- 模板：`src/models/Template.ts`
- Boards 集成测试：`src/services/__tests__/boards/*.integration.test.ts`
- Boards 测试工厂：`src/services/__tests__/boards/hostGameFactory.ts`
- RoomScreen：`src/screens/RoomScreen/RoomScreen.tsx`
- Intent Layer：`src/screens/RoomScreen/hooks/useRoomActions.ts`
- Dialog Layer：`src/screens/RoomScreen/useRoomActionDialogs.ts`
- Alert：`src/utils/alert.ts` + `src/components/AlertModal.tsx`
- 队友/可见性：`src/screens/RoomScreen/RoomScreen.helpers.ts`（`determineActionerState`, `buildSeatViewModels`）
- Anti-cheat contract：`src/services/__tests__/visibility.contract.test.ts`

