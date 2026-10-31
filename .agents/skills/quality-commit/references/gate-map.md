# Gate map

Exactly which checks run where, verified against `package.json`, the commit-time and push-time check files, and the continuous-integration workflow at drafting time. The full quality script is quoted verbatim in `SOURCES.md`. This reference states the split; it does not re-order it.

## Locally, scoped (this skill's default)

| Check                    | Command                                                                                                           | Runs when                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Targeted tests           | The test script of the package that owns the changed code (root Jest, or the Vitest suite of the changed package) | Scoped check for the changed area                       |
| Type check, changed area | `npx tsc --noEmit` (root configuration) or the owning package's type check                                        | Scoped check, and automatically before push (see below) |
| Lint fix, approved files | `pnpm exec eslint --fix <approved-existing-files>`                                                                | Step 3, approved files only                             |
| Format, approved files   | `pnpm exec prettier --write <approved-existing-files>`                                                            | Step 3, approved files only                             |
| Dead-code check          | `npx knip`                                                                                                        | Scoped check, and automatically before push (see below) |

The scoped set is the acceptance gate for this skill. It is deliberately smaller than the full gate: it covers the changed area and the checks the push-time automation already runs.

## Automatically, on commit and push

Commit-time automation (`.husky/pre-commit`) runs the staged-file formatter and linter over staged files only:

- TypeScript files: `eslint --fix --max-warnings=0 --no-warn-ignored` then `prettier --write`.
- JSON, Markdown, and YAML files: `prettier --write`.

The configuration for that staged-file behaviour lives in the `lint-staged` section of `package.json`.

The commit-message check (`.husky/commit-msg`) runs the commit-message linter over the message being committed. See `references/commit-rules.md` for the enforced rules.

Push-time automation (`.husky/pre-push`) runs exactly two commands, in order:

```bash
npx tsc --noEmit
npx knip
```

Both run. The push-time check is not "type check only": the dead-code check runs too. The previous version of this skill omitted the dead-code step; this reference corrects that. Bypassing these checks is forbidden.

The check files are installed by the `prepare` script (`husky`) in `package.json`.

## In continuous integration, the full gate

The full gate is the `quality` script in `package.json`:

```bash
turbo run build typecheck lint knip format test && pnpm run validate:agents
```

In the generic rewrite, the trailing drift check is replaced by the generic agent-file validator; the coordinator owns that wiring. Do not invoke the old generator check from this skill. The turbo portion runs, in the order written: `build` (game-engine build only; the root and worker packages have no build script), `typecheck` (root type check plus the worker type check, each after the engine build), `lint`, `knip`, `format`, and `test` (all three packages' test scripts, after the build).

Continuous integration additionally splits the work into separate jobs: a quality job (turbo build, typecheck, and dead-code check, plus the agent-file check), a lint job (lint plus format) running in parallel, sharded unit-test jobs for the root plus engine and for the worker, a web-build job, and a separate end-to-end gate. A single required gate job depends on all five of quality, lint, both unit-test jobs, and end-to-end, and fails unless all five succeed. End-to-end is not part of the `quality` script. Deployment jobs depend on the gate job and run only on the main branch. See `SOURCES.md` for the workflow file and job names.

## What runs nowhere in this skill

- No end-to-end run is required by this skill. Run an end-to-end spec only when the change touches room or realtime behaviour and the relevant spec is the scoped check for it.
- No full local quality run is required. If one is run, report it as an extra, not as the gate.
- No business-logic rewrite is authorised by a failing check. Failing checks are classified in Steps 3 to 6 of `SKILL.md`.
