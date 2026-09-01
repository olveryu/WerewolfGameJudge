# Agent 配置（单源多端）

本仓库用一组规范源驱动 GitHub Copilot、Claude Code、Cursor 和 Gemini CLI。规则正文只维护一份，宿主差异由生成器处理。

## 规范源与生成物

```text
AGENTS.md                    # 全局规则
agents/
  path-rules/*.md            # 路径规则（frontmatter: applyTo）
.agents/skills/<name>/       # 可移植 Agent Skill（SKILL.md）

── pnpm run sync:agents 生成，禁止手改 ──
.github/instructions/*.instructions.md
.cursor/rules/*.mdc
.claude/skills/<name>/**
CLAUDE.md
GEMINI.md
```

## 日常命令

| 命令                         | 作用                                        |
| ---------------------------- | ------------------------------------------- |
| `pnpm run sync:agents`       | 严格校验规范源并重建全部宿主适配器          |
| `pnpm run sync:agents:check` | 只读检查缺失、过期、多余和已废弃生成物      |
| `pnpm run quality`           | 包含 `sync:agents:check` 的完整本地质量门禁 |

修改规范源后先执行 `pnpm run sync:agents`，再提交规范源与生成物。`lint-staged` 只负责格式化，不会改写生成物；`quality` 与 CI 负责拒绝漂移。

## 宿主发现规则

| 工具               | 仓库内入口                                               |
| ------------------ | -------------------------------------------------------- |
| **GitHub Copilot** | `AGENTS.md`、`.github/instructions/`、`.agents/skills/`  |
| **Claude Code**    | `CLAUDE.md` 导入 `AGENTS.md`；技能位于 `.claude/skills/` |
| **Cursor**         | `AGENTS.md`、`.cursor/rules/`、`.agents/skills/`         |
| **Gemini CLI**     | `GEMINI.md` 导入 `AGENTS.md`；技能位于 `.agents/skills/` |

不生成 `.github/copilot-instructions.md`，避免与 `AGENTS.md` 重复注入。同理，不生成 `.github/skills/`、`.cursor/skills/` 或根 `skills/`；支持的宿主直接读取 `.agents/skills/`。

## 校验契约

生成器会在写文件前完成以下检查：

- YAML frontmatter 必须从文件首字节开始，并通过严格解析
- path rule 只允许 `name`、`description`、`applyTo`
- skill 必须满足 Agent Skills 命名与必填字段约束
- 源文件不得包含 Unicode replacement character
- `--check` 不修改工作区，并检测缺失、过期、多余及废弃路径

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
3. `pnpm run sync:agents:check`

## 维护 SOP

见 [instruction-maintenance-sop.md](instruction-maintenance-sop.md)。
