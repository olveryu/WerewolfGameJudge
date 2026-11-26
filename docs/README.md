# docs

> 入口约定：本文件是 `docs/` 下所有文档的唯一索引，新增文档必须在此登记。
> 面向 AI 编码助手的规则不在这里，见根 [AGENTS.md](../AGENTS.md) 与 [agent-config.md](agent-config.md)。

## 1. 平台架构（现行）

玩家流程、正式对局清单及差异审批统一见 [玩家流程清单](catalogues/README.md)；生成文件保留在拥有它的测试旁。

| 文档                                                                                       | 说明                                                                                                                                                        |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [multigame-platform-design.md](multigame-platform-design.md)                               | 多游戏平台三层架构（Platform / Game module / Catalog）、不变量与第 25 节新游戏接入清单                                                                      |
| [room-shell-contract.md](room-shell-contract.md)                                           | config / guide / room 共享组件归属契约与完整状态验收矩阵                                                                                                    |
| [game-ui-mock-design.md](game-ui-mock-design.md)                                           | 新游戏离线 UI 预览与公共组件覆盖清单                                                                                                                        |
| [room-stage-layout-design.md](room-stage-layout-design.md)                                 | 你画我猜 / 你画我猜接龙 / 轮流讲故事进行中舞台布局：标题栏主持管理、信息条、名单抽屉接管、画布占满剩余高度                                                  |
| [room-hand-and-information-design.md](room-hand-and-information-design.md)                 | 房间手牌与信息区的目标外观、阶段展示与交互体验；不含实现细节                                                                                                |
| [room-hand-and-information-implementation.md](room-hand-and-information-implementation.md) | 房间手牌与信息区的实施步骤、游戏迁移与验收清单                                                                                                              |
| [game-config-schema-design.md](game-config-schema-design.md)                               | 游戏配置 Schema 驱动：引擎单源描述符 → worker zod → 客户端 GameConfigForm（已实施）                                                                         |
| [game-review-share-design.md](game-review-share-design.md)                                 | 跨游戏本局复盘与图片分享：声明式复盘文档 + 单一渲染器 + 统一导出链路（设计稿 v2，完全重建）                                                                 |
| [step-action-redesign.md](step-action-redesign.md)                                         | 步骤与动作重设计：狼人杀夜间步骤机制、共享展示与跨游戏交互统一（已实施）                                                                                    |
| [step-action-redesign-checkpoint-1.md](step-action-redesign-checkpoint-1.md)               | 步骤与动作重设计停点 1：逐步骤文案清单和各游戏偏离统一写法的清单，含逐条确认结果                                                                            |
| [step-action-interface.md](step-action-interface.md)                                       | 步骤机制接口设计：动作与步骤的声明、状态、引擎运行接口、客户端渲染接口（I1–I20 已确认，内部类型草图为草稿）                                                 |
| [step-action-implementation-plan.md](step-action-implementation-plan.md)                   | 步骤与动作重设计的开工说明：阅读顺序、硬性决定与草稿的区分、15 个 commit 的计划和四个停点（commit 计划为助手拟定）                                          |
| [step-action-review-498.md](step-action-review-498.md)                                     | PR #498 审核结论与返工清单：删旧未完成、场景测试缺失、规则更正、实现缺陷，每条含依据和验收标准（第 1–5 段完成，含防漂移的四份生成清单；清单待用户重新确认） |
| [game-client-convergence-design.md](game-client-convergence-design.md)                     | 七游戏客户端同构与狼人杀重建：共享控制器、旧夜间交互模型、阶段到期服务端结算、复盘事实入引擎（PR #333 历史记录；夜间交互已由步骤机制取代，§12 为修订记录）  |
| [seat-adapter-field-spec.md](seat-adapter-field-spec.md)                                   | `RoomSeatViewModel` 字段语义与各游戏座位 adapter 填充规则                                                                                                   |
| [roomscreen-state-machine.md](roomscreen-state-machine.md)                                 | 狼人杀 RoomScreen UI 状态机（GameStatus → 按钮 / Schema Kind → 交互模式）                                                                                   |
| [realtime-link-redesign.md](realtime-link-redesign.md)                                     | 实时链路（RoomLink v3）：协议 v2、关闭码、客户端链路状态机、Worker 网关与命令管线、在线表                                                                   |
| [word-draw.md](word-draw.md)                                                               | 瞎掰王 / 谁是卧底 / 你画我猜共用的抽词：随机、每账号永不重复、读行数恒定（已实施）                                                                          |
| [outbox-recovery.md](outbox-recovery.md)                                                   | DO transactional outbox 的终态投递与管理端结算重放                                                                                                          |
| [web-client-rewrite.md](web-client-rewrite.md)                                             | Web-only 客户端重写：去掉 React Native / Expo，React + 网页元素和 CSS 做界面、PixiJS 做场景层，单分支迁移与切换（设计稿 v3，P0–P5 已实施）                  |
| [auth-session-design.md](auth-session-design.md)                                           | 身份会话、`AuthSession` 缓存与用户资料的状态归属                                                                                                            |
| [DESIGN.md](DESIGN.md)                                                                     | 视觉基准与主题 token（以狼人杀为主）                                                                                                                        |

## 2. 各游戏设计

| 文档                                                             | 游戏 ID        | 说明                                           |
| ---------------------------------------------------------------- | -------------- | ---------------------------------------------- |
| [PRESET_BOARDS.md](PRESET_BOARDS.md)                             | `werewolf`     | 全部 27 套预设板子配置一览（按分类）           |
| [offline-sop.md](offline-sop.md)                                 | `werewolf`     | 线下同桌多设备的完整操作流程（开局→夜晚→天亮） |
| [avalon-game-design.md](avalon-game-design.md)                   | `avalon`       | 阿瓦隆                                         |
| [fibking-word-supply.md](fibking-word-supply.md)                 | `fibking`      | 瞎掰王发题契约与免费供题 / 审核流程            |
| [undercover-game-design.md](undercover-game-design.md)           | `undercover`   | 谁是卧底                                       |
| [pictionary-game-design.md](pictionary-game-design.md)           | `pictionary`   | 你画我猜接龙                                   |
| [drawguess-game-design.md](drawguess-game-design.md)             | `drawguess`    | 经典你画我猜                                   |
| [story-relay-game-design.md](story-relay-game-design.md)         | `storyrelay`   | 轮流讲故事                                     |
| [spotmatch-game-design.md](spotmatch-game-design.md)             | `spotmatch`    | 一眼成对：同时找相同，抢先出完手牌             |
| [secrethitler-game-design.md](secrethitler-game-design.md)       | `secrethitler` | 秘密希特勒：标准 5–10 人规则、首夜私密互认     |
| [decoding-battle-game-design.md](decoding-battle-game-design.md) | `decrypto`     | 解码战：已批准规则、交互决定及验收状态         |
| [decrypto-game-design.md](decrypto-game-design.md)               | `decrypto`     | 解码战                                         |
| [tabletop-toolbox-proposal.md](tabletop-toolbox-proposal.md)     | `toolbox`      | 聚会工具：摇骰子、抽身份；设计与实现状态       |

## 3. 产品模块

| 文档                                                                       | 说明                                               |
| -------------------------------------------------------------------------- | -------------------------------------------------- |
| [gacha-system-design.md](gacha-system-design.md)                           | 扭蛋收集系统                                       |
| [gacha-operation-recovery.md](gacha-operation-recovery.md)                 | 抽卡 / 兑换操作的本地持久化与未知投递恢复          |
| [growth-system-design.md](growth-system-design.md)                         | XP / 等级成长系统                                  |
| [agent-word-submissions.md](agent-word-submissions.md)                     | 外部 Agent 授权投稿、独立审核、人工发布及 API 接入 |
| [non-werewolf-game-stats-proposal.md](non-werewolf-game-stats-proposal.md) | 六款游戏统计、狼人杀延迟累计优化及画我猜互动       |

## 4. 部署与运维

| 文档                                                           | 说明                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [DEPLOYMENT.md](DEPLOYMENT.md)                                 | 发版、CI 自动部署、验证与回滚完整流程                                                      |
| [admin-console-redesign.md](admin-console-redesign.md)         | 管理后台重做与 D1 读取治理：读取分布、实现决策、本地读预算护栏及上线后验收                 |
| [e2e-night-driver-hardening.md](e2e-night-driver-hardening.md) | E2E 夜间 driver 加固方案：就绪读状态、座位点击验证结果、弹窗按状态关闭、提交清单（未实施） |

## 5. Agent 配置与提示词

| 文档                                                                           | 说明                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------- |
| [agent-config.md](agent-config.md)                                             | 单源多端 Agent 配置（规范源、生成物、维护 SOP） |
| [reusable-code-review-prompt.md](reusable-code-review-prompt.md)               | 通用 AI 代码审查提示词模板                      |
| [prompt-templates/instruction-audit.md](prompt-templates/instruction-audit.md) | 审计 instruction 时附加的原则提醒片段           |

## 6. 美术素材 Prompt

| 文档                                                                                 | 说明                                                   |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| [avatar-generation-prompts.md](avatar-generation-prompts.md)                         | 狼人杀 48 角色立绘 prompt（中文，当前使用）            |
| [avatar-generation-prompts.en.md](avatar-generation-prompts.en.md)                   | 同上的英文版（Gemini / Imagen 适配）                   |
| [avatar-generation-prompts-other-games.md](avatar-generation-prompts-other-games.md) | 阿瓦隆 / 瞎掰王 / 谁是卧底角色立绘 prompt（v3 风格锁） |

## 7. 预览页面

静态 HTML，浏览器直接打开：

- [previews/mythic-collections-preview.html](previews/mythic-collections-preview.html) — 神话收藏展示预览
- [previews/mythic-rewards-preview.html](previews/mythic-rewards-preview.html) — 神话奖励预览
- [previews/seat-animation-preview.html](previews/seat-animation-preview.html) — 入座动画预览

## 8. 历史归档

> `archive/` 下的文档记录已完成的迁移 / 重构 / 审计，仅供追溯，不反映当前架构。其中引用的路径、API 可能已不存在。

| 文档                                                                           | 说明                                                      |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| [multigame-migration-record.md](archive/multigame-migration-record.md)         | 多游戏重构 Phase 0–8 阶段计划、删除清单、DoD 与逐提交记录 |
| [system-architecture-assessment.md](archive/system-architecture-assessment.md) | 2026-09-17 系统审计（F01–F10）与修复记录                  |
| [server-authoritative-migration.md](archive/server-authoritative-migration.md) | 服务器权威架构迁移方案                                    |
| [do-migration-plan.md](archive/do-migration-plan.md)                           | 游戏状态从 D1 迁入 Durable Object                         |
| [network-resilience-design-v1.md](archive/network-resilience-design-v1.md)     | 命令管线前的网络韧性方案                                  |
| [network-resilience-design-v2.md](archive/network-resilience-design-v2.md)     | RoomLink v3 之前的 ConnectionManager / RoomSession 网络层 |
| [room-session-lifecycle.md](archive/room-session-lifecycle.md)                 | RoomLink v3 之前的 `RoomSession` 所有权与租约生命周期     |
| [rolespec-schema-redesign.md](archive/rolespec-schema-redesign.md)             | RoleSpec 数据驱动重设计                                   |
| [refactoring-plan.md](archive/refactoring-plan.md)                             | 2026-03 大规模重构方案                                    |
| [refactoring-baseline.md](archive/refactoring-baseline.md)                     | 上述重构的基线指标快照                                    |
| [code-review-changes.md](archive/code-review-changes.md)                       | `feature/optimize_1` 代码审查变更计划                     |
| [code-audit-2026-04-08.md](archive/code-audit-2026-04-08.md)                   | 2026-04-08 全仓逐文件审计报告                             |
| [apple-design-uplift.md](archive/apple-design-uplift.md)                       | Apple 风格 UI 提升方案                                    |
| [bottom-panel-redesign.md](archive/bottom-panel-redesign.md)                   | BottomActionPanel 三层声明式布局重构                      |
| [avatar-prompts.md](archive/avatar-prompts.md)                                 | Leonardo.AI 头像 prompt（已被豆包版本取代）               |
| [loop-motion-design.md](archive/loop-motion-design.md)                         | React Native 客户端的常驻装饰动画（loopMotion）设计       |
