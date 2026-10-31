# End-to-end tests

Scope: `e2e/**` plus the workflows that run it. Unit and contract tests live under the root file's gates and the package files.

## Layout and configuration

- Specs live in `e2e/specs/`; fixtures in `e2e/fixtures/`; helpers in `e2e/helpers/`; reporters in `e2e/reporters/`. The guide is `e2e/helpers/README.md`; read it before writing a spec.
- Config (`playwright.config.ts`): `testDir` is `./e2e/specs`, `fullyParallel: true`, test timeout 60 seconds, `forbidOnly` on CI, 2 retries on CI only, 2 workers on CI. Trace is `retain-on-failure`; screenshots are `only-on-failure`.
- Projects: desktop Chromium, plus a 320×640 small-mobile Chromium project for home, config, and responsive specs. Two servers start before tests: the local API on port 8787 and the web client on port 8081. The config is the single source of the default browser URL (`http://localhost:8081`, via `E2E_BASE_URL`).

## Seats

- Each player is an independent browser context with its own storage, created by the fixture (`createPlayerContexts`): one context per player, index 0 is the host.

## Running and verifying specs

- The reusable run workflow (`e2e-run.yml`) validates that the named spec exists under `e2e/specs/` (bare filename only, no path) before installing, so a typo fails fast instead of reporting no tests found.
- Verify the run through the actions API: check `head_branch` and `head_sha` against the target branch and commit, and read the run's `conclusion` field. Never infer success from the exit status of a piped watch command; that status belongs to the last stage of the pipeline, not to the run.
- In the full suite, nine shards run through the same reusable workflow, gated on the quality, lint, and web-build jobs. Unit and worker test results deliberately do not gate the E2E job.

## Interaction rules

- `page.waitForTimeout()` in new specs is polling cadence only, at most 300 ms, except duration holds in `e2e/specs/resilience-reconnect.spec.ts` where the held duration itself is the test condition (offline 5s, flap 1s, hidden 30s).

## Logging

- Focused tests are forbidden on CI by `forbidOnly` in `playwright.config.ts`.

## Failure investigation and digest

- The failure-bundle reporter writes one JSON bundle per shard under `failure-bundles/` for failed or flaky tests, and stays silent on green. The digest script renders all bundles (plus unit-test JSON results) into one maintained pull-request comment, calling failures and flaky tests out separately; without the pull-request option it runs summary-only, and with the ledger option it maintains the rolling flake-ledger record. The digest is record-only: it opens and closes nothing else and mentions nobody.
