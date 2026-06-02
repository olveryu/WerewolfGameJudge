# Agent 配置（2026 单源多端）

本仓库用 **一份源文件** 驱动 Copilot、Claude Code、Cursor、Codex/Gemini CLI 等。换工具只换客户端，**不改规则正文**。

## 目录结构

```text
AGENTS.md                 # 常驻：原则、命令、架构（根目录，AAIF 约定）
agents/
  path-rules/*.md         # 按路径生效的规则（frontmatter: applyTo）
  prompts/*.md            # 可选：长 prompt 源（同步为 skill / Copilot prompt）
.agents/skills/<name>/    # 按需技能（SKILL.md）

── 以下全部为 pnpm run sync:agents 生成，勿手改 ──
.github/copilot-instructions.md
.github/instructions/*.instructions.md
.github/prompts/*.prompt.md
.github/skills/
skills/                     # gh skill publish / install
.claude/skills/
.cursor/skills/
.cursor/rules/*.mdc
CLAUDE.md
GEMINI.md
```

## 日常命令

| 命令                             | 作用                                            |
| -------------------------------- | ----------------------------------------------- |
| `pnpm run sync:agents`           | 从源生成上述所有目标                            |
| `pnpm run agent:install`         | `gh skill` 安装到本机 Copilot / Claude / Cursor |
| `pnpm run agent:publish:dry-run` | 校验 skill 能否发布                             |

修改 `AGENTS.md`、`agents/path-rules/` 或 `.agents/skills/` 后：**先 sync，再提交**。暂存这些路径时 `lint-staged` 也会自动 sync。

## 用哪个工具？

| 工具                         | 你怎么用                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| **GitHub Copilot**           | 自动读 `AGENTS.md`（经生成的 `copilot-instructions`）、`.github/instructions`、`.github/skills` |
| **Claude Code**              | 读 `CLAUDE.md` → `@AGENTS.md`；`/skill-name` 需 `agent:install` 或 sync 出的 `.claude/skills`   |
| **Cursor**                   | 读 `AGENTS.md` + `.cursor/rules/*.mdc` + skills                                                 |
| **Gemini CLI**               | 读 `GEMINI.md` → `AGENTS.md`                                                                    |
| **任意支持 gh skill 的 CLI** | `gh skill install OWNER/REPO new-role --agent <host>`                                           |

## 新增 path rule

1. 新建 `agents/path-rules/my-area.md`：

```yaml
---
name: 'My Area'
description: 'When to apply this rule'
applyTo: 'src/my-area/**'
---
# My Area Standards
...
```

2. `pnpm run sync:agents`

## 新增 skill

1. 新建 `.agents/skills/my-skill/SKILL.md`（`name` + `description` frontmatter）
2. `pnpm run sync:agents`
3. 可选：`pnpm run agent:install`

## gh skill（本机 / 远端）

需 [GitHub CLI ≥ 2.90](https://cli.github.com/)，`gh auth login`。

```bash
pnpm run sync:agents
pnpm run agent:install
gh skill install YOUR_ORG/WerewolfGameJudge new-role --agent claude-code
```

详见历史文档 [agent-skills.md](agent-skills.md)（内容已合并到本文）。

## 维护 SOP

见 [instruction-maintenance-sop.md](instruction-maintenance-sop.md)（路径已改为 `AGENTS.md` / `.agents/skills` / `agents/path-rules`）。
