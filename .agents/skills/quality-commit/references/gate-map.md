# Gate map

Gate split, verified against `package.json` scripts, `.husky/pre-commit`, `.husky/commit-msg`, `.husky/pre-push`, and `.github/workflows/ci.yml`.

## Locally, scoped (this skill's default)

| Check                    | Command                                                                                                                                                         | Runs when                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Targeted tests           | The test script of the package that owns the changed code (root Vitest for `contracts/`, or the Vitest suite of the changed package)                            | Scoped check for the changed area                                     |
| Type check, changed area | `npx tsc --noEmit` (root configuration: `contracts/` and root configs) or the owning package's `typecheck` script (`@game-judge/web`, `@game-judge/api-worker`) | Scoped check, and the root form automatically before push (see below) |
| Lint fix, approved files | `pnpm exec eslint --fix <approved-existing-files>`                                                                                                              | Step 3, approved files only                                           |
| Format, approved files   | `pnpm exec prettier --write <approved-existing-files>`                                                                                                          | Step 3, approved files only                                           |
| Dead-code check          | `npx knip`                                                                                                                                                      | Scoped check, and automatically before push (see below)               |

The scoped set covers the changed area; `tsc --noEmit` and `knip` also run automatically before push (see below).

## Automatically, on commit and push

Commit-time automation (`.husky/pre-commit`) runs the staged-file formatter and linter over staged files only:

- TypeScript files: `eslint --fix --max-warnings=0 --no-warn-ignored` then `prettier --write`.
- JSON, Markdown, and YAML files: `prettier --write`.
- Web stylesheets (`packages/web/**/*.css`): `stylelint --fix` (`stylelint.config.mjs`, with `stylelint-suppressions.json`) then `prettier --write`.

The configuration for that staged-file behaviour lives in the `lint-staged` section of `package.json`.

The commit-message check (`.husky/commit-msg`) runs the commit-message linter over the message being committed. See `references/commit-rules.md` for the enforced rules.

Push-time automation (`.husky/pre-push`) runs exactly three commands, in order:

```bash
npx tsc --noEmit
npx knip
npm run --silent lint:css
```

All three run; the hook stops at the first failure. `lint:css` runs Stylelint over `packages/web/**/*.css` with `stylelint.config.mjs` (`stylelint-declaration-strict-value`, `stylelint-value-no-unknown-custom-properties` and built-in rules); existing problems are recorded per file and rule in `stylelint-suppressions.json` (Stylelint bulk suppressions), and more problems than recorded fail. The web TSX rules of the UI drift lock (inline style keys, script style writes, `CSSProperties`, prop spreading onto DOM elements, package adapters through `no-restricted-imports`) are part of `eslint.config.mjs` and run with every ESLint run; their existing problems are in `eslint-suppressions.json` (ESLint bulk suppressions), and an entry no longer needed fails `eslint .` until pruned with `--prune-suppressions`. Neither file may gain entries: fix the code.

The check files are installed by the `prepare` script (`husky`) in `package.json`.

## In continuous integration, the full gate

The full gate is the `quality` script in `package.json`:

```bash
turbo run build typecheck lint knip format test && pnpm run validate:agents && pnpm run lint:css
```

The turbo portion runs `build` (the game-engine build and the web build with its bundle budgets; the root and worker packages have no `build` script), `typecheck` (root and worker type checks after the engine build via `dependsOn` in `turbo.json`; the web type check maps the engine to its source through `tsconfig.json` paths), `lint`, `knip`, `format`, and `test` (the root contracts and every package's test script, after the build). The trailing steps are `pnpm run validate:agents`, then Stylelint (`lint:css`) (`package.json` scripts).

Continuous integration additionally splits the work into separate jobs: a quality job (turbo build, typecheck, and dead-code check, plus the agent-file check), a lint job (ESLint, Stylelint and format) running in parallel, sharded unit-test jobs for the root contracts plus engine and web (`test-root`) and for the worker (`test-api-worker`), a web-build job, and a separate end-to-end gate that on this branch runs only the specs migrated to the web client. A single required gate job depends on all five of quality, lint, both unit-test jobs, and end-to-end, and fails unless all five succeed. End-to-end is not part of the `quality` script. Deployment jobs run only when the gate job succeeds on the main branch: `deploy-api-worker` needs `ci-gate`; `deploy-frontend` needs `ci-gate` and `deploy-api-worker`; `deploy-miniapp` needs `ci-gate`. The screenshot gate `e2e-visual` (`e2e/visual`, run by `scripts/e2e-visual.mjs` in the pinned Playwright image through `e2e-run.yml` with suite `visual`) is also required by `ci-gate`. (Job names in `.github/workflows/ci.yml`: `quality`, `lint`, `test-root`, `test-api-worker`, `build-web`, `e2e`, `e2e-visual`, `ci-gate`.)

## What runs nowhere in this skill

- No end-to-end run is required by this skill. Run an end-to-end spec only when the change touches room or realtime behaviour and the relevant spec is the scoped check for it.
- No full local quality run is required.
