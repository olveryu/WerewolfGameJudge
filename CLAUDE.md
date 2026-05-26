# Claude Code Instructions

This project's collaboration standards, architecture constraints, and naming rules are **maintained centrally in GitHub Copilot instruction files**, shared by both Copilot and Claude Code. Changes to these files take effect on both sides.

## Main Instructions (always active, auto-loaded)

@.github/copilot-instructions.md

## Domain Instructions (activated by `applyTo` path, read on demand)

When editing files under the corresponding paths, you must first read the relevant instruction file:

- [.github/instructions/typescript.instructions.md](.github/instructions/typescript.instructions.md) — `src/**/*.{ts,tsx}`, `packages/game-engine/src/**/*.ts`: Type safety, hooks hygiene, unused variables
- [.github/instructions/roomscreen.instructions.md](.github/instructions/roomscreen.instructions.md) — `src/screens/RoomScreen/**`: policy / hooks / executors / seatTap / components / share
- [.github/instructions/screens.instructions.md](.github/instructions/screens.instructions.md) — `src/screens/**`: Screen-level conventions
- [.github/instructions/services.instructions.md](.github/instructions/services.instructions.md) — Services layer standards
- [.github/instructions/game-engine.instructions.md](.github/instructions/game-engine.instructions.md) — `packages/game-engine/**`: Pure game logic shared package
- [.github/instructions/api-worker.instructions.md](.github/instructions/api-worker.instructions.md) — `packages/api-worker/**`: Worker + DO + D1 + R2
- [.github/instructions/models.instructions.md](.github/instructions/models.instructions.md) — Data models
- [.github/instructions/tests.instructions.md](.github/instructions/tests.instructions.md) — Unit / integration / E2E tests
- [.github/instructions/ci-deploy.instructions.md](.github/instructions/ci-deploy.instructions.md) — CI / deployment / Wrangler / npmmirror CDN

Each file's frontmatter `applyTo` field defines the exact activation path — check it before editing.

## Prompts & Skills

- [.github/prompts/](/.github/prompts/) — Reusable prompt templates (e.g., `delegate-task`)
- [.github/skills/](/.github/skills/) — Project-specific skills: `new-board`, `new-e2e-spec`, `new-role`, `query-prod-data`, `quality-commit`

## Maintenance Notes

- These instruction files are co-maintained by Copilot and Claude. **When rules are outdated or missing, update the corresponding `.github/instructions/*.md`** — don't duplicate rules in CLAUDE.md.
- CLAUDE.md serves as an index only. Rule content goes exclusively into `.github/` to avoid dual-write drift.
