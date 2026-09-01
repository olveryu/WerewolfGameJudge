# Project skills (canonical source)

Each subdirectory contains a `SKILL.md` (Agent Skills open standard).

GitHub Copilot, Cursor, and Gemini CLI discover this directory directly. `pnpm run sync:agents`
validates every skill and mirrors it to `.claude/skills/` for Claude Code.

After editing, run `pnpm run sync:agents`, then `pnpm run sync:agents:check` before committing.
