# Claude Code 指令

本项目的协作规范、架构约束、命名规则等**统一维护在 GitHub Copilot 指令文件中**，由 Copilot 与 Claude Code 共享。修改这些文件时两端同步生效。

## 主指令（始终适用，已自动加载）

@.github/copilot-instructions.md

## 分领域指令（按 `applyTo` 路径生效，按需阅读）

编辑对应路径下的文件时，必须先读取相应的指令文件：

- [.github/instructions/typescript.instructions.md](.github/instructions/typescript.instructions.md) — `src/**/*.{ts,tsx}`, `packages/game-engine/src/**/*.ts`：类型安全、Hooks 卫生、未使用变量
- [.github/instructions/roomscreen.instructions.md](.github/instructions/roomscreen.instructions.md) — `src/screens/RoomScreen/**`：policy / hooks / executors / seatTap / components / share
- [.github/instructions/screens.instructions.md](.github/instructions/screens.instructions.md) — `src/screens/**`：屏幕级约定
- [.github/instructions/services.instructions.md](.github/instructions/services.instructions.md) — services 层规范
- [.github/instructions/game-engine.instructions.md](.github/instructions/game-engine.instructions.md) — `packages/game-engine/**`：纯游戏逻辑共享包
- [.github/instructions/api-worker.instructions.md](.github/instructions/api-worker.instructions.md) — `packages/api-worker/**`：Worker + DO + D1 + R2
- [.github/instructions/models.instructions.md](.github/instructions/models.instructions.md) — 数据模型
- [.github/instructions/tests.instructions.md](.github/instructions/tests.instructions.md) — 单元 / 集成 / E2E 测试
- [.github/instructions/ci-deploy.instructions.md](.github/instructions/ci-deploy.instructions.md) — CI / 部署 / Wrangler / npmmirror CDN

每个文件 frontmatter 的 `applyTo` 字段定义了精确生效路径，编辑前先看一眼。

## Prompts 与 Skills

- [.github/prompts/](/.github/prompts/) — 可复用 prompt 模板（如 `delegate-task`）
- [.github/skills/](/.github/skills/) — 项目专属 skill：`new-board`, `new-e2e-spec`, `new-role`, `query-prod-data`

## 维护说明

- 这些指令文件由 Copilot 与 Claude 共同维护，**遇到与现状不符或缺失的规则时主动更新对应 `.github/instructions/*.md`**，不要在 CLAUDE.md 内重复写规则。
- CLAUDE.md 仅作索引，规则正文一律落到 `.github/` 下，避免双写漂移。
