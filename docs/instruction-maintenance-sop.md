# AI Agent 配置维护 SOP

> 单源：`AGENTS.md`、`agents/path-rules/`、`.agents/skills/`。改完后执行 `pnpm run sync:agents`。

## 触发条件 → 应修改的文件

| 变更类型                        | 源文件                                                                                        | 同步项                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **全局原则 / 命令 / 架构**      | `AGENTS.md`                                                                                   | `CLAUDE.md`、`GEMINI.md`                                          |
| **某路径下编码规范**            | `agents/path-rules/<area>.md`                                                                 | `.github/instructions/`、`.cursor/rules/`                         |
| **新增角色**                    | `.agents/skills/new-role/SKILL.md`                                                            | 索引表、契约测试；见 skill 内章节                                 |
| **任意 skill**                  | `.agents/skills/<name>/SKILL.md`                                                              | `.claude/skills/`                                                 |
| **修改 UI 组件/modal**          | `agents/path-rules/screens.md`                                                                |                                                                   |
| **新增游戏 / 共享 UI 契约变更** | `docs/room-shell-contract.md`、`docs/DESIGN.md`、`docs/multigame-platform-design.md` 第 25 节 | `docs/README.md` 入口、相关组件测试；路径规则引用契约，不复制正文 |
| **修改 GameState**              | `agents/path-rules/services.md`、`game-engine.md`                                             |                                                                   |
| **修改依赖/CI**                 | `AGENTS.md` + `agents/path-rules/ci-deploy.md`                                                | 对照 `package.json`、workflows                                    |

## 验证

`sync:agents:check` 只验证源文件与生成适配器是否同步，不检查文档里的路径、组件 API 是否真实，也不能证明跨游戏视觉一致。
更新 UI 接入文档时，应核对所引用组件及现有测试；新游戏必须按 `room-shell-contract.md` 的状态矩阵给出验证证据。

1. `pnpm run sync:agents`
2. `pnpm run sync:agents:check`
3. `pnpm run quality`
4. 契约测试：`specs.contract.test.ts` 等

## 硬编码数字

在源文件旁注释权威来源，例如：

```markdown
<!-- 来自 specs.contract.test.ts: toHaveLength(N) -->
```

## 不要改

- `.github/instructions/*.md`
- `.claude/skills/`、`.cursor/rules/`
- 根目录 `CLAUDE.md`、`GEMINI.md`（由 sync 生成）

完整说明：[agent-config.md](agent-config.md)
