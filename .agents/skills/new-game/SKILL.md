---
name: new-game
description: 'Add a new party minigame to WerewolfGameJudge end-to-end: design doc, module registration, infrastructure alignment, bots, word supply, tests, acceptance. Use when: adding a game, new game request, minigame proposal.'
---

# New Game Skill

> **输出语言：执行本 skill 过程中，所有面向用户的输出（进度报告、询问、完成通知、错误提示）一律使用中文。**

End-to-end addition of a new party minigame (e.g. 瞎掰王 / 你画我猜 / 故事接龙 / 谁是卧底同级),
from design discussion to merged PR. The single biggest failure mode is inventing a parallel
infrastructure for the new game instead of reusing the existing one — this skill exists to
prevent exactly that.

## Non-Goals

- 不做狼人杀新角色/新板子（用 `new-role` / `new-board` skill）。
- 不做已有游戏的玩法改动（那是普通 feature，不是新游戏）。

## Phase 0 — 先读这些，再谈设计

动手前必须读完（只读，不改）：

1. 本 skill 全文。
2. `docs/room-shell-contract.md` —— 跨游戏 UI 与房间外壳契约（组件归属 + 验收矩阵）。
3. `docs/multigame-platform-design.md` 第 25 节 —— 新增游戏接入清单（模块注册）。
4. `docs/roomscreen-state-machine.md` —— RoomScreen 状态机。
5. 仓库 `AGENTS.md` —— 质量门禁、协作规则、核心原则。
6. 至少通读一个现有小游戏的 `docs/<game>-game-design.md`（如 `docs/fibking-game-design.md`），
   理解 design doc 的颗粒度。

## Phase 1 — 设计（先给方案，用户批准后才能动手）

### 1a. 需求收集

从用户输入中提取已知项，对照下表**主动追问**所有缺失的必填项，**不许猜**：

| 必填项     | 说明                             | 示例                                               |
| ---------- | -------------------------------- | -------------------------------------------------- |
| 游戏中文名 | 2-6 字，不带人数后缀             | `你画我猜`                                         |
| 一句话玩法 | 给 game picker 展示用            | `一人作画，其余人聊天框猜词`                       |
| 人数范围   | 最小–最大，默认人数              | `4–12，默认 6`                                     |
| 核心循环   | 一局内重复的最小单元             | `选词 → 作画 → 猜词 → 结算`                        |
| 回合结构   | 每人几轮、谁先手、顺序           | `每人画 2 轮，按入座顺序轮流`                      |
| 计时       | 各阶段秒数、超时行为             | `作画 90s，超时按未猜中结算`                       |
| 计分       | 公式必须精确到可实现             | `猜中：50 + round(100 × 剩余毫秒 / 90000)`         |
| 终局条件   | 什么情况下结束、排名规则         | `全部轮次结束，同分按 1,2,2,4 竞赛排名`            |
| 机器人策略 | 是否支持、谁可接管、未接管时行为 | `支持，仅房主接管；无人接管则等 deadline 超时结算` |
| 词库需求   | 是否需要词/题库、首批数量        | `需要，首批 200 个可画名词`                        |

### 1b. 输出设计文档

在仓库外工作稿起草，定稿后必须提交到仓库：`docs/<game-id>-game-design.md`。
**Design doc 进仓库是交付的一部分**，不是可选的 —— PR 里必须包含它，且后续 UI 文案/语义
变化时同步更新（grep 查旧文案）。

Design doc 至少包含：玩法概述、人数与开局、房间大厅行为、配置项、完整状态机、
每条命令的输入/输出/权限/失败文案、计时与超时、计分公式、机器人行为、词库（如有）、
XP/结算、测试计划。

### 1c. 对齐评审（设计阶段就做，不要等到写代码）

逐项回答，**每一项都要有结论**（对齐 / 合理差异+理由 / 待实现）：

- [ ] 大厅：复用 `RoomShell` + 共享房主管理面板（填充机器人、清空座位、配置、踢人），
      不自建第二套大厅 UI。
- [ ] 配置页：复用 `GameSettings` / `GameSettingsStepper` / `GameScreen`；
      人数之外的配置项说明为什么不能复用现有模式。
- [ ] 规则说明：复用 `GameGuide`；玩法介绍写清目标、流程、房主职责、工具边界。
- [ ] 机器人：开局门槛计数方式（真人+机器人如何计）、接管权限（仅房主？）、
      受控席位提示、未接管时的默认行为，与现有小游戏一致。
- [ ] 房间外壳：`RoomShell` 的 `content` 用 `seats` 还是 `workspace`，
      参照 contract 中各游戏的选择并说明理由。
- [ ] 结算：XP/完成效应、再来一局、返回大厅、终局排名、匿名玩家显示。
- [ ] 失败文案：命令失败有中文映射，走 `AlertModal`（`Alert.alert` 在 web 上是空实现，禁用）。

**输出完整方案（含改动点、影响范围、备选），等待用户明确批准后才能进入 Phase 2。**

## Phase 2 — 注册清单（缺一不可）

加新游戏时以下白名单/硬编码列表必须同步。通用找法：grep 现有游戏名
（如 `pictionary`）在**测试文件**里的所有出现，逐个确认要不要加新项。

| #   | 位置                                                                        | 内容                                           |
| --- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | `packages/game-engine/src/platform/protocol/gameTypes.ts`                   | `GAME_TYPES` 加 ID                             |
| 2   | `packages/game-engine/src/games/catalog.ts`                                 | engine catalog 注册                            |
| 3   | `packages/game-engine/package.json`                                         | `exports` 加 `./games/<game>/public`           |
| 4   | `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts` | `EXPECTED_PACKAGE_EXPORTS`                     |
| 5   | `packages/api-worker/src/games/catalog.ts`                                  | worker module 注册                             |
| 6   | `packages/api-worker/src/index.ts`                                          | workflow export（如有供词等 workflow）         |
| 7   | `packages/api-worker/src/games/__tests__/catalog.test.ts`                   | httpRoutes 期望列表                            |
| 8   | `src/games/catalog.ts`                                                      | client catalog 注册                            |
| 9   | `src/test-utils/clientGameCatalog.tsx`                                      | 测试用 catalog                                 |
| 10  | `src/__tests__/architecture.contract.test.ts`                               | 多处白名单（workflow 导出、permissive zod 等） |
| 11  | migration                                                                   | 所有 `game_type CHECK` 加新 ID + 新表          |
| 12  | `pnpm-lock.yaml`                                                            | 加了新依赖必须同步 lockfile                    |

## Phase 3 — 实现

### 3a. 分层

- **game-engine** (`packages/game-engine/src/games/<game>/`)：纯逻辑，服务端权威。
  状态机、命令处理、计时、计分、机器人默认行为全部在这里。
- **api-worker** (`packages/api-worker/src/games/<game>/`)：路由 + schema
  （`z.strictObject`）+ workflow（如供词）。Worker 只做读写-计算-广播，
  不写玩法逻辑。
- **client** (`src/games/<game>/`)：screens / room / components，只做展示与意图上报。
  遵守 screens.instructions.md 的三层分离（policy / orchestrator / presentational）。

### 3b. 铁律（违反即返工）

- 服务端是玩法逻辑的唯一权威；客户端完全对等，不许藏逻辑。
- 生产代码不许普通 `as`（只许 `as const`）；样式值必须用 theme token
  （`noHardcodedStyleValues.contract.test.ts` 会扫）。
- 确认框用 `AlertModal`，不用 `Alert.alert`。
- 用户可见文案全中文；`showAlert` 标题用具体动作（如 `'创建失败'`）。
- 命名先 grep：已有概念必须复用已有名字，不许另起一套。
- UI 文案/语义变化时同步更新 design doc（grep 查旧文案）。
- 不把已 revert 的内容带回来：合并前以 `main` 为准核对。

### 3c. 机器人与房主面板（与现有小游戏对齐的默认模式，不允许 drift）

狼人杀是房主面板的基准。标准按钮只有两个：`填充机器人`（key `fill-bots`）+
`清空座位`（key `clear-seats`，variant `danger`）。**不许自创"移除机器人"按钮**
（故事接龙/卧底曾有，已统一移除）——想清机器人就用清空座位，真人重进。

除非设计评审中明确推翻，否则采用以下模式：

- `supportsBots: true`；大厅房主管理面板提供"填充机器人"。
- 配置页**不设**机器人前置开关。
- 开局要求**坐满**：已入座席位（真人+机器人）必须等于配置人数，与故事接龙等现有小游戏一致
  （`occupiedSeatCount !== config.numberOfPlayers → reject('请先坐满所有座位，或填充机器人。')`；
  客户端开始按钮条件同理，禁用文案 `'座位尚未坐满'`）。不许自创"达到最小人数即可开"的放宽口径。
- 仅房主可接管/释放机器人席位；受控席位有 banner/hint。
- 机器人无自主 AI；无人接管时按超时/deadline 默认行为结算，不自动跳过。

### 3d. 词库（如需要）

- 新表 + migration；Admin 触发接口走现有 `gameWords` 模式。
- 首批种子词数量在设计阶段定死（如 200），上线前灌满 —— 空表上线是未完成交付。
- 供词 workflow 注册到 api-worker `index.ts` exports（见注册清单 #6）。

## Phase 4 — 测试与验收

1. **本地**（push 前必须过）：改动文件 prettier + `tsc --noEmit` +
   architecture/noHardcodedStyleValues contract tests + 相关单测。
   全量 `pnpm run quality` 的 test 部分交给 PR 的 CI（本地跑不下）。
2. **room-shell-contract 验收矩阵**：逐行记录证据（config/lobby/active/overlays/recovery/layout），
   不适用的行写理由，不许静默跳过。
3. **E2E**：新游戏的 create/join/config/guide/core-flow 覆盖加入现有 E2E 惯例；
   断言可见行为，不只断言 import 了共享组件。
4. **Design doc** 已进仓库且与代码一致（抽查 3 处文案/语义）。
5. PR 合并后检查 main 的 CI 全绿才能收尾。

## Phase 5 — 收尾

- 工作稿 design doc 已复制进 `docs/` 并提交。
- PR 描述列出：注册清单 12 项核对结果、对齐评审结论、验收矩阵证据链接。
- 分支清理；`docs/<game>-game-design.md` 与实现一致。

---

## Key Constraints（速查）

- 新游戏不许自建第二套大厅/配置/房间外壳；先查 `src/features/room/` 和共享组件。
- `docs/room-shell-contract.md` 是 UI 集成的唯一权威，细节不复制到本 skill。
- 方案先行：用户明确批准前不写代码；design doc 先行，代码随后。
- 词库表不许空表上线。
- main 为准，不复活 revert 内容；merge 后盯 main CI 全绿。
