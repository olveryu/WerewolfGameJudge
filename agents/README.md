# Agent configuration (single source)

Edit **only** the canonical paths below.

| Path                                    | Purpose                                      |
| --------------------------------------- | -------------------------------------------- |
| [`AGENTS.md`](../AGENTS.md)             | Always-on repository instructions            |
| [`path-rules/`](path-rules/)            | Path-scoped rules (`applyTo` in frontmatter) |
| [`.agents/skills/`](../.agents/skills/) | Portable Agent Skills                        |

`pnpm run sync:agents` generates only the host adapters that need a different location:

- `.github/instructions/*.instructions.md` for GitHub Copilot path rules
- `.cursor/rules/*.mdc` for Cursor path rules
- `.claude/skills/**` for Claude Code skill discovery
- `CLAUDE.md` and `GEMINI.md` entrypoints

```bash
pnpm run sync:agents        # validate sources and regenerate adapters
pnpm run sync:agents:check  # read-only drift check used by quality and CI
```

GitHub Copilot, Cursor, and Gemini CLI discover `.agents/skills/` directly. Do not add
`.github/skills/`, `.cursor/skills/`, or a root `skills/` mirror.

See [docs/agent-config.md](../docs/agent-config.md).
