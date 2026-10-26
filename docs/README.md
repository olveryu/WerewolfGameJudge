# docs

> 入口约定：本文件是 `docs/` 下所有文档的唯一索引，新增文档必须在此登记。
> 面向 AI 编码助手的规则不在这里，见根 [AGENTS.md](../AGENTS.md) 与 [agent-config.md](agent-config.md)。

## 1. 平台架构（现行）

| 文档                                                         | 说明                                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [multigame-platform-design.md](multigame-platform-design.md) | 多游戏平台三层架构（Platform / Game module / Catalog）、不变量与第 25 节新游戏接入清单 |
| [room-shell-contract.md](room-shell-contract.md)             | config / guide / room 共享组件归属契约与完整状态验收矩阵                               |
| [seat-adapter-field-spec.md](seat-adapter-field-spec.md)     | `RoomSeatViewModel` 字段语义与各游戏座位 adapter 填充规则                              |
| [roomscreen-state-machine.md](roomscreen-state-machine.md)   | 狼人杀 RoomScreen UI 状态机（GameStatus → 按钮 / Schema Kind → 交互模式）              |
| [room-session-lifecycle.md](room-session-lifecycle.md)       | `RoomSession` 所有权、独占租约、连接与退出生命周期                                     |
| [network-resilience-design.md](network-resilience-design.md) | 多游戏网络层：fetch 重试、命令恢复、WebSocket 重连策略                                 |
| [outbox-recovery.md](outbox-recovery.md)                     | DO transactional outbox 的终态投递与管理端结算重放                                     |
| [auth-session-design.md](auth-session-design.md)             | 身份会话、`AuthSession` 缓存与用户资料的状态归属                                       |
| [DESIGN.md](DESIGN.md)                                       | 视觉基准与主题 token（以狼人杀为主）                                                   |

## 2. 各游戏设计

| 文档                                                               | 游戏 ID      | 说明                                              |
| ------------------------------------------------------------------ | ------------ | ------------------------------------------------- |
| [NIGHT1_ROLE_ALIGNMENT_MATRIX.md](NIGHT1_ROLE_ALIGNMENT_MATRIX.md) | `werewolf`   | 全部角色在 Handler→Facade→UI 架构下的行为对齐矩阵 |
| [PRESET_BOARDS.md](PRESET_BOARDS.md)                               | `werewolf`   | 全部 26 套预设板子配置一览（按分类）              |
| [offline-sop.md](offline-sop.md)                                   | `werewolf`   | 线下同桌多设备的完整操作流程（开局→夜晚→天亮）    |
| [avalon-game-design.md](avalon-game-design.md)                     | `avalon`     | 阿瓦隆                                            |
| [fibking-word-supply.md](fibking-word-supply.md)                   | `fibking`    | 瞎掰王发题契约与免费供题 / 审核流程               |
| [undercover-game-design.md](undercover-game-design.md)             | `undercover` | 谁是卧底                                          |
| [pictionary-game-design.md](pictionary-game-design.md)             | `pictionary` | 你画我猜接龙                                      |
| [drawguess-game-design.md](drawguess-game-design.md)               | `drawguess`  | 经典你画我猜                                      |
| [story-relay-game-design.md](story-relay-game-design.md)           | `storyrelay` | 故事接龙                                          |
| [demo-game-design.md](demo-game-design.md)                         | `demo`       | 新游戏生成器产出的骨架示例，非上线游戏            |

## 3. 产品模块

| 文档                                                       | 说明                                      |
| ---------------------------------------------------------- | ----------------------------------------- |
| [gacha-system-design.md](gacha-system-design.md)           | 扭蛋收集系统                              |
| [gacha-operation-recovery.md](gacha-operation-recovery.md) | 抽卡 / 兑换操作的本地持久化与未知投递恢复 |
| [growth-system-design.md](growth-system-design.md)         | XP / 等级成长系统                         |

## 4. 部署与运维

| 文档                           | 说明                                  |
| ------------------------------ | ------------------------------------- |
| [DEPLOYMENT.md](DEPLOYMENT.md) | 发版、CI 自动部署、验证与回滚完整流程 |

## 5. Agent 配置与提示词

| 文档                                                                           | 说明                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------- |
| [agent-config.md](agent-config.md)                                             | 单源多端 Agent 配置（规范源、生成物、维护 SOP） |
| [reusable-code-review-prompt.md](reusable-code-review-prompt.md)               | 通用 AI 代码审查提示词模板                      |
| [prompt-templates/instruction-audit.md](prompt-templates/instruction-audit.md) | 审计 instruction 时附加的原则提醒片段           |

## 6. 美术素材 Prompt

| 文档                                                                                 | 说明                                                   |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| [avatar-generation-prompts.md](avatar-generation-prompts.md)                         | 狼人杀 47 角色徽章图 prompt（豆包，中文，当前使用）    |
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
| [rolespec-schema-redesign.md](archive/rolespec-schema-redesign.md)             | RoleSpec 数据驱动重设计                                   |
| [refactoring-plan.md](archive/refactoring-plan.md)                             | 2026-03 大规模重构方案                                    |
| [refactoring-baseline.md](archive/refactoring-baseline.md)                     | 上述重构的基线指标快照                                    |
| [code-review-changes.md](archive/code-review-changes.md)                       | `feature/optimize_1` 代码审查变更计划                     |
| [code-audit-2026-04-08.md](archive/code-audit-2026-04-08.md)                   | 2026-04-08 全仓逐文件审计报告                             |
| [apple-design-uplift.md](archive/apple-design-uplift.md)                       | Apple 风格 UI 提升方案                                    |
| [bottom-panel-redesign.md](archive/bottom-panel-redesign.md)                   | BottomActionPanel 三层声明式布局重构                      |
| [avatar-prompts.md](archive/avatar-prompts.md)                                 | Leonardo.AI 头像 prompt（已被豆包版本取代）               |
