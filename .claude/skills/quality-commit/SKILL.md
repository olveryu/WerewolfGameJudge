---
name: quality-commit
description: 'Run full quality pipeline, auto-fix lint/format issues, then commit and push. Use when: quality fix commit push, run quality, fix lint, fix format, quality commit push.'
---

# quality-commit Skill

> **输出语言：执行本 skill 过程中，所有面向用户的输出（进度报告、询问、完成通知、错误提示）一律使用中文。**

Run quality checks and authorized fixes, then commit and/or push only when explicitly requested.

## Authorization Boundary

- Loading this skill is not permission to commit or push. A request for quality, lint or formatting ends after checks and authorized fixes.
- Commit requires an explicit commit request; push requires an explicit push request. A commit-only request must not push.
- Inspect staged, unstaged and untracked changes before fixing or staging. Preserve unrelated user work; stage only the agreed files/hunks, never automatically run `git add -A`.
- Do not expand a formatting or quality request into unrelated code cleanup. Follow the repository confirmation rules for manual changes outside the approved scope.

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

Record output. If all pass, finish unless commit or push was requested. Continue only to the authorized phase.

### Phase 2 — Auto-fix (handle by failure type)

**Only do auto-fixable things; bugs that cannot be auto-fixed must be reported.**

#### 2a. Lint / Format Errors and Warnings

```bash
# Run lint --fix first, then prettier
pnpm exec eslint --fix <approved-existing-files>
pnpm exec prettier --write <approved-existing-files>
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

Verify each Knip finding against actual consumers and configuration. Do not assume named files or packages are false positives. Remove only verified dead code within the approved scope; request approval for unrelated cleanup. Re-run the gate after authorized changes.

---

### Phase 3 — Generate Commit Message

1. Inspect `git status --short`, `git diff` and `git diff --cached` to identify the agreed change set.
2. Generate **Conventional Commits** format message based on changes:
   - `<type>(<scope>): <description>` (English lowercase imperative)
   - type: `feat` / `fix` / `refactor` / `chore` / `docs` / `test` / `style` / `perf`
   - scope: main change directory/module name (e.g., `roomscreen`, `api-worker`, `game-engine`)
   - description: specifically state what was done, no vague words

3. If user already provided commit message in argument → use user's message directly, don't override.

---

### Phase 4 — Commit & Push

Execute only the steps explicitly authorized by the user. Stage the agreed paths and inspect the staged diff before committing:

```bash
git add -- <approved-paths>
git commit -m "<commit message>"
# Only when push was explicitly requested:
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
- **Commitlint line limits.** Header ≤ 100 chars; **every body/footer line ≤ 100 chars** (`commitlint.config.js` + config-conventional). Wrap long bullets across multiple lines — a single bullet over 100 chars fails `commit-msg`. Prefer `git commit -F -` with a heredoc and pre-wrapped lines.
- **Force push is forbidden.** Do not use `--force` / `--force-with-lease`.
- **Do not change business logic.** When fixing lint/TS/test issues, only make the minimum change needed to eliminate the issue — no opportunistic refactoring.
