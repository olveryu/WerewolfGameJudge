# AI Instruction Maintenance SOP

> One-page workflow: ensure `.github/instructions/*.md` and project docs stay up to date.

## Trigger Conditions → Files That Must Be Updated

| Change Type                   | Affected instruction / doc         | Specific Update Items                                                                                                                                               |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Add new role**              | `.github/skills/new-role/SKILL.md` | §Reference role index table, §C2 `CurrentNightResults` field list, `TargetConstraint` enum (if new values), `ResolverResult.result` field list                      |
|                               | `README.md`                        | Total role count, faction group table                                                                                                                               |
|                               | `NIGHT1_ROLE_ALIGNMENT_MATRIX.md`  | NIGHT_STEPS table, behavior alignment section, UX-only constraint table, three-tier alignment table, date, test stats                                               |
| **Modify UI component/modal** | `screens.instructions.md`          | §Overlay/Modal table, §Bottom button mapping, §⋯ Menu items                                                                                                         |
| **Modify GameState field**    | `services.instructions.md`         | §State management Anti-drift                                                                                                                                        |
|                               | `game-engine.instructions.md`      | §normalizeState reminder                                                                                                                                            |
| **Modify Schema Kind**        | `.github/skills/new-role/SKILL.md` | §C4 Schema Kinds list, §Step 2 template                                                                                                                             |
|                               | `screens.instructions.md`          | §Schema Kind→Interaction mode table                                                                                                                                 |
| **Modify theme token**        | `screens.instructions.md`          | §Theme Token rules                                                                                                                                                  |
| **Modify test conventions**   | `tests.instructions.md`            | Corresponding rules                                                                                                                                                 |
| **Modify deps/scripts/CI**    | `copilot-instructions.md`          | Project Overview / Tech Stack / Quality Commands / Release-Deploy process; ensure consistency with `package.json`, lockfile, `.github/workflows/*.yml`, `scripts/*` |
|                               | `README.md` / `docs/DEPLOYMENT.md` | Sync dev commands, deploy commands, minimum Node version; match executable config                                                                                   |
| **Add preset template**       | `README.md`                        | Board UI Tests row count                                                                                                                                            |

## Verification Methods

1. **Contract tests** (automated): `pnpm run quality` runs `specs.contract.test.ts` to check ROLE_SPECS/NIGHT_STEPS/RESOLVERS alignment; missing new roles will fail in CI.
2. **Hardcoded number cross-check**: Counts in instructions (e.g., "36 roles", "27 steps", "27 resolvers") derive from assertion values in contract tests (`specs.contract.test.ts` → `toHaveLength(N)`). Both must be updated in sync.
3. **Authoritative source cross-check**: Versions and commands defer to executable config. Dependencies/runtime → `package.json` and lockfile; CI/deploy → `.github/workflows/*.yml` and `scripts/*`. Instructions/README are sync documentation only — when conflicts arise, fix the docs first.
4. **Manual checklist** (pre-release/quarterly): Review recent changes against the table above to catch missed doc updates.

## Reducing Hardcoded Values

Annotate the source next to counts in instructions for future maintainers:

```markdown
<!-- Derived from specs.contract.test.ts: expect(getAllRoleIds()).toHaveLength(N) -->

Currently 36; increment to 37 after adding a new role
```

No need to make counts dynamically generated — instructions are static markdown and contract tests already cover consistency. The key is knowing where to update.

## Historical Document Management

Completed migration/refactoring proposals: add `> ⚠️ Historical document — for reference only, does not reflect current code state` marker at the top. Do not delete.
