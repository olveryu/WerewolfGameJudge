# End-to-end tests

Scope: `e2e/**` plus the workflows that run it. Unit and contract tests live under the root file's gates and the package files. This file states process rules as process rules: nothing here is enforced by a linter or a contract test unless the text says so.

## Layout and configuration

- Specs live in `e2e/specs/`; fixtures in `e2e/fixtures/`; helpers in `e2e/helpers/`; reporters in `e2e/reporters/`. The guide is `e2e/helpers/README.md`; read it before writing a spec.
- Config (`playwright.config.ts`): `testDir` is `./e2e/specs`, `fullyParallel: true`, test timeout 60 seconds, `forbidOnly` on CI, 2 retries on CI only, 2 workers on CI. Trace is `retain-on-failure`; screenshots are `only-on-failure`.
- Projects: desktop Chromium, plus a 320×640 small-mobile Chromium project for home, config, and responsive specs. Two servers start before tests: the local API on port 8787 and the web client on port 8081. The config is the single source of the default browser URL (`http://localhost:8081`, via `E2E_BASE_URL`); specs and helpers must not hardcode it. Tests never use production data.

## Real seats

- Each player is an independent browser context with its own storage, created by the fixture (`createPlayerContexts`): one context per player, index 0 is the host. Do not share a context between seats.
- Avalon, FibKing, and Undercover specs run with real contexts and zero bot seats, as their spec headers state. Werewolf night specs drive real contexts through the night driver.
- The current split, stated honestly: DrawGuess still fills bot seats to reach a full room, and one Avalon scenario creates a bot room for music settings. Do not claim the whole suite is bot-free; move a spec to real seats only by changing the spec, and record the split when it changes.
- The no-bot rule is a standing process rule, not code-enforced. No contract test, lint rule, or CI check forbids bot use in E2E. Present it that way; never claim a check exists.

## One spec per change, verified one at a time

- Change one spec per commit and push. This is a process rule; no workflow, config, or repository check enforces commit contents.
- To verify one spec, dispatch the single-spec workflow with the branch as the dispatch reference and one input, `spec`, holding the bare filename. There is deliberately no branch input: the reference chooses which workflow definition runs.
- The reusable run workflow validates that the named spec exists under `e2e/specs/` (bare filename only, no path) before installing, so a typo fails fast instead of reporting no tests found.
- Verify the run through the actions API: check `head_branch` and `head_sha` against the target branch and commit, and read the run's `conclusion` field. Never infer success from the exit status of a piped watch command; that status belongs to the last stage of the pipeline, not to the run.
- In the full suite, nine shards run through the same reusable workflow, gated on the quality, lint, and web-build jobs. Unit and worker test results deliberately do not gate the E2E job.

## Interaction rules

- Navigate with `gotoWithRetry()`, never a direct page navigation in a spec. Wait for room readiness with `waitForRoomScreenReady()`. Use locators and assertions instead of fixed sleeps.
- The only allowed `page.waitForTimeout()` use is polling cadence, at most 300 ms. Do not use fixed sleeps to wait for state.
- Never use `force: true` to bypass actionability for normal user interactions. The one sanctioned exception is testing the disabled-state path: pressing a disabled button that a plain click would wait on forever, to assert nothing happens.
- Do not swallow assertion or state-transition failures with an empty catch. Catching is allowed only for conditional probing, retry polling, and teardown.
- Mark scenario phases with `test.step()`. Each spec creates an independent room so parallel workers cannot share state.

## Logging

- No `console.log` in specs. Attach structured evidence with `testInfo.attach()`. Do not commit skipped or focused tests (`test.skip`, `describe.skip`, `test.only`) or temporary diagnostic output. The only config gate here is `forbidOnly`, which covers focused tests on CI.
- Existing exceptions, and the only ones: the diagnostics helper forwards `[DIAG]` and error-level browser logs (its own console output is intentional tooling), and the night driver has one prefixed driver log. Do not add further ad-hoc logging.

## Failure investigation and digest

- Investigate in this order: failure bundle / digest first, trace second, CI job logs last (and only for infrastructure-shaped failures). Never start by rerunning or by reading raw CI logs.
- The failure-bundle reporter writes one JSON bundle per shard under `failure-bundles/` for failed or flaky tests, and stays silent on green. The digest script renders all bundles (plus unit-test JSON results) into one maintained pull-request comment, calling failures and flaky tests out separately; without the pull-request option it runs summary-only, and with the ledger option it maintains the rolling flake-ledger record. The digest is record-only: it opens and closes nothing else and mentions nobody.
- Summarize every run. Quote failure excerpts only; never paste full logs. State the failing spec, the error, and the bundle or trace location, then stop.

## What is not enforced by code

- The no-bot rule, one-spec-per-commit, and actions-API conclusion verification are process and procedure, not lint or CI gates. The only related config gate is `forbidOnly` for focused tests.
- The interaction and logging rules live in the helpers guide and in review, not in lint or CI gates. The linter's only E2E-specific settings are the console exemption for the diagnostics helper and a disabled rule for test files.
