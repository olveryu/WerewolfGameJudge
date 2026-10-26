# Agent 配置（单源多端）

本仓库用一组规范源驱动 GitHub Copilot、Claude Code、Cursor、Gemini CLI 和 Muse。规则正文只维护一份，宿主差异由生成器 `scripts/sync-agent-config.mjs` 处理。本文是 Agent 配置的唯一说明；[agents/README.md](../agents/README.md)、[.agents/skills/README.md](../.agents/skills/README.md) 与 [.github/NOTES.md](../.github/NOTES.md) 只是指向这里的指针。

## 规范源与生成物

```text
AGENTS.md                    # 全局规则（原则、命令、架构边界、协作规则）
agents/
  path-rules/*.md            # 路径规则（frontmatter: name / description / applyTo）
.agents/skills/<name>/       # 可移植 Agent Skill（SKILL.md）
docs/prompt-templates/       # 人工复用的审计/评审提示词，不参与 sync

── pnpm run sync:agents 生成，禁止手改 ──
.github/instructions/*.instructions.md
.cursor/rules/*.mdc
.claude/skills/<name>/**
CLAUDE.md
GEMINI.md
MUSE.md
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
| **Muse**           | `MUSE.md` 导入 `AGENTS.md`；技能位于 `.agents/skills/`   |

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

## 维护 SOP：变更类型 → 应修改的源文件

| 变更类型                        | 源文件                                                                                        | 连带同步项                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **全局原则 / 命令 / 架构边界**  | `AGENTS.md`                                                                                   | `CLAUDE.md`、`GEMINI.md`、`MUSE.md`（由 sync 生成）               |
| **某路径下编码规范**            | `agents/path-rules/<area>.md`                                                                 | `.github/instructions/`、`.cursor/rules/`（由 sync 生成）         |
| **任意 skill**                  | `.agents/skills/<name>/SKILL.md`                                                              | `.claude/skills/`（由 sync 生成）                                 |
| **新增角色**                    | `.agents/skills/new-role/SKILL.md`                                                            | 索引表、契约测试；见 skill 内章节                                 |
| **修改 UI 组件 / modal**        | `agents/path-rules/screens.md`                                                                | —                                                                 |
| **新增游戏 / 共享 UI 契约变更** | `docs/room-shell-contract.md`、`docs/DESIGN.md`、`docs/multigame-platform-design.md` 第 25 节 | `docs/README.md` 索引、相关组件测试；路径规则引用契约，不复制正文 |
| **修改 GameState**              | `agents/path-rules/services.md`、`agents/path-rules/game-engine.md`                           | —                                                                 |
| **修改依赖 / CI**               | `AGENTS.md` + `agents/path-rules/ci-deploy.md`                                                | 对照 `package.json`、`.github/workflows/`                         |

### 硬编码数字

规则或文档中出现的数量（角色数、板子数等）在源文件旁注释权威来源，例如：

```markdown
<!-- 来自 specs.contract.test.ts: toHaveLength(N) -->
```

### 验证边界

`sync:agents:check` 只验证源文件与生成适配器是否同步，不检查文档里的路径、组件 API 是否真实，也不能证明跨游戏视觉一致。更新 UI 接入文档时，应核对所引用组件及现有测试；新游戏必须按 `room-shell-contract.md` 的状态矩阵给出验证证据。

完整验证顺序：

1. `pnpm run sync:agents`
2. `pnpm run sync:agents:check`
3. `pnpm run quality`
4. 相关契约测试（如 `specs.contract.test.ts`）

### 不要改

- `.github/instructions/*.md`、`.cursor/rules/`、`.claude/skills/`
- 根目录 `CLAUDE.md`、`GEMINI.md`、`MUSE.md`

以上全部由 `pnpm run sync:agents` 生成，手改会被 `sync:agents:check` 判定为漂移。
