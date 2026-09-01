# GitHub Copilot 配置

Copilot 直接读取仓库根 `AGENTS.md` 和 `.agents/skills/`。以下路径规则由
`pnpm run sync:agents` 从 `agents/path-rules/` 生成，**请勿直接编辑**：

- `instructions/*.instructions.md` ← `agents/path-rules/`

源文件说明：[agents/README.md](../agents/README.md)
