# End-to-end tests

Scope: `e2e/**` plus the workflows that run it. Unit and contract tests live under the root file's gates and the package files.

## Layout and configuration

- Specs live in `e2e/specs/`; fixtures in `e2e/fixtures/`; helpers in `e2e/helpers/`; reporters in `e2e/reporters/`. The guide is `e2e/helpers/README.md`; read it before writing a spec.
- Config (`playwright.config.ts`): `testDir` is `./e2e/specs`, `fullyParallel: true`, test timeout 60 seconds, `forbidOnly` on CI, 2 retries on CI only, 2 workers on CI. Trace is `retain-on-failure`; screenshots are `only-on-failure`.
- The screenshot gate lives in `e2e/visual/` with its own config (`playwright.visual.config.ts`: 390×844, zero pixel tolerance, no retries) and baselines in `e2e/visual/__screenshots__/`; it runs only through `scripts/e2e-visual.mjs` inside the Playwright image matching `@playwright/test` (`pnpm run e2e:visual`, `e2e:visual:update`; CI job `e2e-visual`, manual `e2e-visual.yml`). The shared-component gallery it photographs is `/__bench/ui` (`packages/web/src/routes/bench/UiGallery.tsx`); random data is hidden: avatars (their own `.avatar` class) and toasts by the screenshot stylesheet `e2e/visual/app-page-screenshot.css`, the room title and the Home spotlight role by test-ID masks. Before each app-page capture and the gallery's avatar block, the render probe `e2e/visual/avatarShapeProbe.ts` waits for the page's avatars to render and measures each one at rest (it selects them by their `.avatar` class, a measurement exception to the test-ID rule): its used corner is `--avatar-corner-ratio` of its side, and no ancestor clips it by `clip-path`, mask or a rounded overflow clip (used radius on the padding box) that cuts its corners. Screens that depend on random results (gacha draw, dealt roles, dealt words) are shot from fixed data: a bench route (`/__bench/gacha-result`) or a fixed engine state served as the room snapshot (`e2e/visual/room-fixtures.ts`; the Avalon engine deals from Web Crypto, so its fixtures run under a seeded `getRandomValues`).
- Projects: desktop Chromium, plus a 320×640 small-mobile Chromium project for home, config, and responsive specs. Two servers start before tests: the local API on port 8787 and the web client on port 8081 (CI serves the prebuilt `packages/web/dist`; locally the Vite dev server). The config is the single source of the default browser URL (`http://localhost:8081`, via `E2E_BASE_URL`).
- Selectors come from `TESTIDS` in `packages/web/src/testids.ts`, the registry the web client renders. Elements are located only through `getByTestId(TESTIDS.x)`; visible copy is asserted on the located element (`toHaveText`, `toContainText`, `toHaveAccessibleName`), and an absence check is `not.toContainText` on a test-id root. Room task and host commands live in the shared host hand: open it through `roomMoreActionsButton`, then locate the action by its declared action test ID (for example `startGameButton` or `assignRolesButton`). Stage-specific host commands live in the stage menu (`roomStageMenuButton`); grouped player actions declare child-hand action IDs on their group card. The `e2e/**` block of `no-restricted-syntax` in `eslint.config.mjs` rejects `getByText`, `getByRole`, `getByLabel`, `getByPlaceholder`, `getByAltText`, `getByTitle`, `locator()`, and literal (string or regex) `getByTestId`; an any-seat match comes from `anySeatTestId` in `e2e/helpers/ui.ts`, built from a `TESTIDS` seat builder.

## Seats

- Each player is an independent browser context with its own storage, created by the fixture (`createPlayerContexts`): one context per player, index 0 is the host.

## Running and verifying specs

- The reusable run workflow (`e2e-run.yml`) validates that the named spec exists under `e2e/specs/` (bare filename only, no path) before installing, so a typo fails fast instead of reporting no tests found.
- Verify the run through the actions API: check `head_branch` and `head_sha` against the target branch and commit, and read the run's `conclusion` field. Never infer success from the exit status of a piped watch command; that status belongs to the last stage of the pipeline, not to the run.
- The `e2e` job runs through the same reusable workflow, gated on the quality, lint, and web-build jobs; unit and worker test results deliberately do not gate it. Its matrix lists every spec exactly once, pinned by `runs every E2E spec exactly once` in `contracts/ciE2eCoverage.contract.test.ts`; a new spec must join a shard.

## Interaction rules

- Night actions wait for the step/audio state and seat `data-inert`; never infer readiness from dialog changes. Read expected prompts by title, and prove readiness before negative assertions (see `e2e/helpers/README.md`).
- `page.waitForTimeout()` in new specs is polling cadence only, at most 300 ms, except duration holds in `e2e/specs/resilience-reconnect.spec.ts` where the held duration itself is the test condition (offline 5s, flap 1s, hidden 30s).

## Logging

- Focused tests are forbidden on CI by `forbidOnly` in `playwright.config.ts`.

## Failure investigation and digest

- The failure-bundle reporter writes one JSON bundle per shard under `failure-bundles/` for failed or flaky tests, and stays silent on green. The digest script renders all bundles (plus unit-test JSON results) into one maintained same-repository pull-request comment, calling failures and flaky tests out separately. Fork pull requests use summary-only mode because their token is read-only; without the pull-request option the script runs summary-only, and with the ledger option it maintains the rolling flake-ledger record. The digest is record-only: it opens and closes nothing else and mentions nobody.
