# AI Agent 配置维护 SOP

> 单源：`AGENTS.md`、`agents/path-rules/`、`.agents/skills/`。改完后执行 `pnpm run sync:agents`。

## 触发条件 → 应修改的文件

| 变更类型                   | 源文件                                            | 同步项                                                    |
| -------------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| **全局原则 / 命令 / 架构** | `AGENTS.md`                                       | `.github/copilot-instructions.md`、各工具读根 `AGENTS.md` |
| **某路径下编码规范**       | `agents/path-rules/<area>.md`                     | `.github/instructions/`、`.cursor/rules/`                 |
| **新增角色**               | `.agents/skills/new-role/SKILL.md`                | 索引表、契约测试；见 skill 内章节                         |
| **任意 skill**             | `.agents/skills/<name>/SKILL.md`                  | `pnpm run sync:agents`                                    |
| **委派 prompt**            | `agents/prompts/delegate-expert.md`               | `delegate-expert` skill、`.github/prompts/`               |
| **修改 UI 组件/modal**     | `agents/path-rules/screens.md`                    |                                                           |
| **修改 GameState**         | `agents/path-rules/services.md`、`game-engine.md` |                                                           |
| **修改依赖/CI**            | `AGENTS.md` + `agents/path-rules/ci-deploy.md`    | 对照 `package.json`、workflows                            |

## 验证

1. `pnpm run sync:agents`
2. `pnpm run quality`
3. 契约测试：`specs.contract.test.ts` 等

## 硬编码数字

在源文件旁注释权威来源，例如：

```markdown
<!-- 来自 specs.contract.test.ts: toHaveLength(N) -->
```

## 不要改

- `.github/copilot-instructions.md`
- `.github/instructions/*.md`
- `.github/skills/`、`skills/`、`.claude/skills/`、`.cursor/skills/`、`.cursor/rules/`
- 根目录 `CLAUDE.md`、`GEMINI.md`（由 sync 生成）

完整说明：[agent-config.md](agent-config.md)
