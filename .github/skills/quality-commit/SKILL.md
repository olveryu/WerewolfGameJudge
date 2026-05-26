---
name: quality-commit
description: 'Run full quality pipeline, auto-fix lint/format issues, then commit and push. Use when: quality fix commit push, run quality, fix lint, fix format, quality commit push.'
argument-hint: 'commit message (optional, auto-generated if not provided)'
---

# quality-commit Skill

Run the full quality pipeline → auto-fix fixable issues → commit → push, completely hands-free.

## When to Use

- User requests any combination of quality / fix / commit / push
- User wants a one-click delivery of current changes
- User says "run quality fix then commit"

---

## Procedure

### Phase 1 — Run Quality Check

```bash
pnpm run quality
```

Record output. If all pass → skip to Phase 3.

### Phase 2 — Auto-fix (handle by failure type)

**Only do auto-fixable things; bugs that cannot be auto-fixed must be reported.**

#### 2a. Lint / Format Errors and Warnings

```bash
# Run lint --fix first, then prettier
pnpm exec eslint . --fix
pnpm exec prettier --write .
```

Errors and warnings that `--fix` can't handle (e.g., `no-explicit-any`, `no-unnecessary-act`), **fix directly with code editing tools** — don't report BLOCKED. After fixing, re-run `pnpm run quality` to confirm zero issues.

Only stop and report when the change scope exceeds verifiable range (e.g., type refactoring affecting multiple modules simultaneously).

#### 2b. TypeScript Type Errors

Try to fix with code editing tools first. If fix would affect multiple downstream modules or root cause is unclear, report immediately:

```
STATUS: BLOCKED
REASON: TypeScript type errors cannot be safely auto-fixed: <list each>
ATTEMPTED: code editing fix
RECOMMENDATION: manually confirm root cause then re-run skill
```

#### 2c. Test Failures

Test failures do not auto-modify business logic, report immediately:

```
STATUS: BLOCKED
REASON: Test failures: <list failed test names>
ATTEMPTED: pnpm run quality
RECOMMENDATION: manually fix tests then re-run skill
```

#### 2d. knip Dead Code

knip false positives (`metro.config.js`, `react-dom` etc.) are ignored. Other dead code (unused exports, files, dependencies) **delete directly**, re-run `pnpm run quality` after deletion to confirm.

---

### Phase 3 — Generate Commit Message

1. Use `get_changed_files` or `git diff --cached --stat` to get changed file list.
2. Generate **Conventional Commits** format message based on changes:
   - `<type>(<scope>): <description>` (English lowercase imperative)
   - type: `feat` / `fix` / `refactor` / `chore` / `docs` / `test` / `style` / `perf`
   - scope: main change directory/module name (e.g., `roomscreen`, `api-worker`, `game-engine`)
   - description: specifically state what was done, no vague words

3. If user already provided commit message in argument → use user's message directly, don't override.

---

### Phase 4 — Commit & Push

Commit directly without waiting for user confirmation (the skill itself is user-authorized automation):

```bash
git add -A
git commit -m "<commit message>"
git push
```

Check push output, confirm success. If push rejected (non-fast-forward), report to user:

```
STATUS: BLOCKED
REASON: git push rejected, remote has new commits requiring pull/rebase first
ATTEMPTED: git push
RECOMMENDATION: git pull --rebase then re-run skill
```

---

## Constraints

- **`--no-verify` is forbidden.** Do not bypass git hooks.
- **Force push is forbidden.** Do not use `--force` / `--force-with-lease`.
- **Do not change business logic.** When fixing lint/TS/test issues, only make the minimum change needed to eliminate the issue — no opportunistic refactoring.
