---
name: quality-commit
description: Run scoped quality checks, auto-fix only lint and format issues, then commit and push. Use when quality, lint, format, commit, or push work is requested.
---

# quality-commit

> User-facing output during this skill (progress reports, questions, completion notices, error messages) is in Chinese.

Run scoped quality checks and authorised fixes, then commit and/or push.

## Scope

- Inspect staged, unstaged, and untracked changes before fixing or staging. Preserve unrelated work. Stage only the agreed files.
- Auto-fix authorisation covers lint and format fixes on approved files only (Step 3).

## Triggers

Use this skill when:

- Quality, lint, format, commit, or push work is requested, in any combination.
- The user asks for a delivery of current changes through checks plus commit and/or push.

Do not use this skill when:

- The request is only to run a single test or type check with no commit intent. Run that check directly; do not run this whole procedure.
- The request is a release. Use the release skill instead; the release script owns its own commit, tag, and push.
- No change set has been agreed. Stop and ask what is in scope before fixing or staging anything.

## Must-read references

Read these before starting Step 1.

- `references/gate-map.md` — exactly which checks run locally, which run in continuous integration, and which run automatically on commit and push.
- `references/commit-rules.md` — commit message format, the enforced header limit, and the staging procedure.

## Procedure

### Step 1 — Inspect the change set

Inspect `git status --short`, `git diff`, and `git diff --cached`. Identify the agreed change set: which files are in scope, which are unrelated work to preserve, and which are untracked. Record the scope before running any fixer. If the scope is unclear, ask and wait.

### Step 2 — Run scoped checks locally

Run the scoped checks for the changed area, as mapped in `references/gate-map.md`:

- The targeted tests for the changed modules, using the test script for the package that owns them.
- The type check for the changed area.
- The lint and format checks on the changed files.

The full gate runs in continuous integration (see
`references/gate-map.md`).

If all scoped checks pass, finish here unless commit or push was requested. Continue only to the authorised phase.

### Step 3 — Auto-fix lint and format only

Auto-fix only lint and format issues, and only on approved files:

```bash
pnpm exec eslint --fix <approved-existing-files>
pnpm exec prettier --write <approved-existing-files>
```

Re-run the scoped checks from Step 2 after fixing. If a lint or format issue cannot be fixed by the fixer and the fix would change behaviour or touch files outside the approved scope, leave it for Step 4.

### Step 4 — Type errors

A type error fix in this skill is confined to the approved scope and a single module, with a clear root cause. A plain `as` assertion fails the architecture contract test (`src/__tests__/architecture.contract.test.ts`, 'Production types: no ordinary assertions'; only `as const` is allowed).

### Step 5 — Test failures

Test failures are not fixed by editing business logic in this skill. This skill does not edit tests or contracts to reach green. Report the failed test names (see Step 8).

### Step 6 — Verify dead-code findings before removing anything

Verify each dead-code finding against actual consumers and configuration. Remove only verified dead code within the approved scope. Re-run the scoped checks after authorised removals.

### Step 7 — Commit

Follow `references/commit-rules.md`: generate the message from the inspected diff (or use the user's message verbatim when one was provided), stage only the agreed paths, inspect the staged diff, then commit. Check the commit output. The commit-time checks run automatically (`.husky/pre-commit`, `.husky/commit-msg`). If the commit is rejected by a commit-time check, fix the stated problem within scope.

### Step 8 — Push, then report

Check the push output and confirm success.

Report in Chinese: the scope inspected, the scoped checks run with their results, the fixes applied (lint/format only, or none), the commit created if any, and whether the push succeeded. If anything was left blocked, list it exactly.

## Acceptance commands

```bash
git status --short
pnpm exec eslint --fix <approved-existing-files>
pnpm exec prettier --write <approved-existing-files>
npx tsc --noEmit
npx knip
git add -- <approved-paths>
git commit -m "<commit message>"
git push
```

Acceptance is: scoped checks pass, only lint/format fixes were auto-applied, the staged diff was inspected before committing, commit happened only on explicit request, and push happened only on explicit push request. The `git push` line above is conditional on that request; it is not a default step.

## Pitfalls

1. A plain `as` cast fails `src/__tests__/architecture.contract.test.ts` ('Production types: no ordinary assertions'; only `as const` is allowed).
2. The push-time checks are exactly `npx tsc --noEmit` and `npx knip`, in that order (`.husky/pre-push`); a local scoped pass does not replace them.
