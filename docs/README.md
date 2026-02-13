# docs

## 用户指南

| 文档                             | 说明                                                   |
| -------------------------------- | ------------------------------------------------------ |
| [offline-sop.md](offline-sop.md) | 线下同桌多设备场景的完整游戏操作流程（开局→夜晚→天亮） |

## 架构设计

| 文档                                                                       | 说明                                                       |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [services-design.md](services-design.md)                                   | 服务层完整架构设计（协议契约、决策日志）                   |
| [services-restructure-v3.2.md](services-restructure-v3.2.md)               | `src/services/` 目录扁平化 + 前缀清理设计方案              |
| [phase2-design.md](phase2-design.md)                                       | Night-1 从 legacy 架构迁移到新架构的详细设计               |
| [room-interaction-policy-refactor.md](room-interaction-policy-refactor.md) | RoomScreen 交互统一到 RoomInteractionPolicy 纯函数决策入口 |
| [roomscreen-next-refactor-todo.md](roomscreen-next-refactor-todo.md)       | RoomScreen 拆分重构 PR 记录与后续 TODO                     |

## Night-1 角色对齐

| 文档                                                               | 说明                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| [NIGHT1_ROLE_ALIGNMENT_MATRIX.md](NIGHT1_ROLE_ALIGNMENT_MATRIX.md) | 所有角色在 Handler→Facade→UI 架构下的完整行为对齐矩阵  |
| [night1-role-alignment-plan.md](night1-role-alignment-plan.md)     | 逐角色对齐 UI→Handler→Resolver 的 on-wire 协议执行方案 |
| [night1-test-coverage-audit.md](night1-test-coverage-audit.md)     | 每个 schemaId 的 Handler / Resolver 测试覆盖审计       |

## 审计与规范

| 文档                                                               | 说明                                                                 |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| [DRIFT_AUDIT.md](DRIFT_AUDIT.md)                                   | Actor Identity / Night Steps / BroadcastGameState 双写与语义漂移审计 |
| [random-and-id-guidelines.md](random-and-id-guidelines.md)         | 随机数、唯一 ID、确定性选择的使用规则                                |
| [board-test-100-coverage-plan.md](board-test-100-coverage-plan.md) | Board UI 测试100%覆盖计划                                            |
| [wolf-vote-revote-countdown.md](wolf-vote-revote-countdown.md)     | 狼人投票/重投倒计时设计方案                                          |

## 开发工具

| 文档                                   | 说明                                     |
| -------------------------------------- | ---------------------------------------- |
| [debug-bots.md](debug-bots.md)         | 填充机器人 + Host 接管代发行动的调试方案 |
| [avatar-prompts.md](avatar-prompts.md) | Leonardo.AI 生成角色头像的 prompt 模板   |

## 部署

| 文档                           | 说明                                       |
| ------------------------------ | ------------------------------------------ |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Supabase + Vercel 从零到生产的完整部署流程 |
