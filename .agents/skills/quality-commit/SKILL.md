---
name: quality-commit
description: Run scoped quality checks, auto-fix only lint and format issues within the approved scope, then commit and push only when each is explicitly requested. Loading this skill is not permission to commit or push. Use when quality, lint, format, commit, or push work is requested.
---

# quality-commit

> User-facing output during this skill (progress reports, questions, completion notices, error messages) is in Chinese.

Run scoped quality checks and authorised fixes, then commit and/or push only when explicitly requested.

## Authorisation boundary (read first)

- Loading this skill is not permission to commit or push. A request for quality, lint, or formatting ends after checks and authorised fixes.
- Commit requires an explicit commit request. Push requires an explicit push request. A commit-only request must not push.
- Inspect staged, unstaged, and untracked changes before fixing or staging. Preserve unrelated work. Stage only the agreed files, never run an automatic add-all. Do not expand a formatting or quality request into unrelated code cleanup.
- Auto-fix authorisation covers lint and format fixes on approved files only (Step 3). Any other code change needs the repository confirmation rule: list file, change point, and risk, and wait for confirmation. Where this boundary and an older "fix it directly" wording disagree, this boundary wins.

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

Do not run the full quality script locally as the default gate. The full gate runs in continuous integration. A local full-gate run is not forbidden, but it is not required, not the acceptance test for this skill, and its local runtime was not verified. If a local full run is used for another reason, say so in the report and do not present it as the required gate.

If all scoped checks pass, finish here unless commit or push was requested. Continue only to the authorised phase.

### Step 3 — Auto-fix lint and format only

Auto-fix only lint and format issues, and only on approved files:

```bash
pnpm exec eslint --fix <approved-existing-files>
pnpm exec prettier --write <approved-existing-files>
```

Re-run the scoped checks from Step 2 after fixing. If a lint or format issue cannot be fixed by the fixer and the fix would change behaviour or touch files outside the approved scope, stop and report it under Step 4 instead of editing directly. Do not use a fixer to rewrite business logic.

### Step 4 — Type errors: fix only within scope, otherwise report

A type error may be fixed directly only when the fix is confined to the approved scope and a single module, and the root cause is clear. Otherwise, stop and report blocked, listing each type error, what was attempted, and the recommendation to confirm the root cause manually and re-run this skill. Never silently fix a type error by weakening a type, adding a cast to silence it, or making a required field optional. If the fix would affect multiple downstream modules or the root cause is unclear, report immediately; do not keep editing.

### Step 5 — Test failures: report, do not rewrite

Test failures do not auto-modify business logic. Report immediately:

```
STATUS: BLOCKED
REASON: Test failures: <list failed test names>
ATTEMPTED: <scoped checks run>
RECOMMENDATION: manually fix tests then re-run skill
```

Do not weaken a test, an assertion, or a contract to make a failure pass. A failing contract test is evidence about the change, not an obstacle to edit away.

### Step 6 — Verify dead-code findings before removing anything

Verify each dead-code finding against actual consumers and configuration. Do not assume a named file or package is a false positive. Remove only verified dead code within the approved scope. Request approval for unrelated cleanup. Re-run the scoped checks after authorised removals.

### Step 7 — Commit only when explicitly requested

Follow `references/commit-rules.md`: generate the message from the inspected diff (or use the user's message verbatim when one was provided), stage only the agreed paths, inspect the staged diff, then commit. Check the commit output. The commit-time checks run automatically; never bypass them. If the commit is rejected by a commit-time check, fix the stated problem within scope or report it; do not bypass the check.

### Step 8 — Push only when explicitly requested, then report

Push only when push was explicitly requested. Check the push output and confirm success. If the push is rejected because the remote has new commits, report blocked with the recommendation to pull with rebase and re-run this skill. Do not force-push.

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

1. Running an automatic add-all and sweeping unrelated work into the commit.
2. Running the full quality script locally as if it were the required gate, or presenting its result as the gate when continuous integration is the gate.
3. Fixing a type error by weakening a type or silencing it with a cast.
4. Weakening a failing test or contract instead of fixing the change.
5. Bypassing commit-time or push-time checks, or force-pushing to resolve a rejection.
