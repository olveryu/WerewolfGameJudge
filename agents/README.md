# Agent configuration (single source)

Edit **only** these paths. Everything under `.github/copilot-instructions.md`, `.github/instructions/`, `.github/skills/`, `.cursor/rules/`, `skills/`, `.claude/skills/`, etc. is **generated**.

| Path                                    | Purpose                                               |
| --------------------------------------- | ----------------------------------------------------- |
| [`AGENTS.md`](../AGENTS.md)             | Always-on project rules (AAIF / agents.md convention) |
| [`path-rules/`](path-rules/)            | Path-scoped rules (`applyTo` in frontmatter)          |
| [`.agents/skills/`](../.agents/skills/) | Agent Skills (`SKILL.md` per workflow)                |
| [`prompts/`](prompts/)                  | Long prompt sources (e.g. delegate-expert → skill)    |

```bash
pnpm run sync:agents      # regenerate all tool targets
pnpm run agent:install    # gh skill → Copilot / Claude / Cursor (local)
```

See [docs/agent-config.md](../docs/agent-config.md).
