# Playwright E2E Guide

The E2E suite exercises the web client against a local Cloudflare Worker, Durable Objects, and D1 database. It never uses production data.

## Runtime Topology

`playwright.config.ts` starts two servers and waits for both health checks before collecting tests:

| Server | Local command                                                                         | Readiness URL                  | CI behavior                                      |
| ------ | ------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------ |
| API    | `node scripts/setup-e2e-api.mjs && pnpm --filter @game-judge/api-worker run dev:test` | `http://127.0.0.1:8787/health` | Starts a new local Wrangler process              |
| Web    | `npx expo start --web --port 8081`                                                    | `E2E_BASE_URL`                 | Exports Expo Web, then serves `dist/` statically |

Local runs reuse a server already listening at a readiness URL. CI always starts isolated processes.

Before Playwright starts the API, `scripts/setup-e2e-api.mjs`:

1. Applies all D1 migrations to Wrangler's local SQLite database.
2. Writes `packages/api-worker/.dev.vars` with an E2E-only `JWT_SECRET`.

Do not place production credentials in `.dev.vars`. If Playwright reuses an existing local API process, the preflight command does not run; that process must already have a migrated local database.

The web server always receives:

```text
EXPO_PUBLIC_CF_API_URL=http://127.0.0.1:8787
EXPO_PUBLIC_SENTRY_DSN=
```

Sentry is disabled so E2E failures do not enter production telemetry.

## Configuration

### `E2E_BASE_URL`

`playwright.config.ts` is the only place allowed to define the default browser URL:

```text
http://localhost:8081
```

It exports the resolved value to `process.env.E2E_BASE_URL`. Helpers read that environment variable and fail fast when it is absent. Specs and helpers must not hardcode the default URL.

Changing `E2E_BASE_URL` changes browser navigation and the web readiness probe. It does not switch the API to a remote backend; the configured API remains local Wrangler on port `8787`.

### Other Variables

| Variable                     | Purpose                              | Default             |
| ---------------------------- | ------------------------------------ | ------------------- |
| `WEB_PORT`                   | Port used by the web-server command  | `8081`              |
| `EXPO_PUBLIC_API_TIMEOUT_MS` | Optional client API timeout override | Application default |

No per-environment E2E JSON configuration is used.

## Commands

| Command                                            | Behavior                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm run e2e`                                     | Standard suite with the list reporter                                  |
| `pnpm run e2e:core`                                | Single worker, line reporter, full trace, stop after the first failure |
| `pnpm run e2e:night`                               | Night-flow subset with the list reporter                               |
| `pnpm run e2e:ui`                                  | Playwright UI mode                                                     |
| `pnpm exec playwright test e2e/specs/home.spec.ts` | One spec using the standard config                                     |

Playwright runs Chromium desktop tests in parallel. Home, configuration, and FibKing responsive coverage also run in a `320 x 640` Chromium project. Each spec must create an independent room so parallel workers cannot share state.

CI assigns the suite to five measured groups in `.github/workflows/ci.yml`. Each group uploads a blob report; `merge-reports` combines them into one HTML report.

## Helper Ownership

```text
e2e/
├── fixtures/
│   └── app.fixture.ts
├── helpers/
│   ├── diagnostics.ts
│   ├── home.ts
│   ├── multi-player.ts
│   ├── night-driver.ts
│   ├── night-setup.ts
│   ├── ui.ts
│   └── waits.ts
├── pages/
│   ├── BoardPickerPage.ts
│   ├── ConfigPage.ts
│   ├── FibConfigPage.ts
│   ├── FibRoomPage.ts
│   ├── HomePage.ts
│   ├── NightFlowPage.ts
│   ├── RoomPage.ts
│   └── SheriffElectionPage.ts
└── specs/
```

| Layer                               | Responsibility                                           |
| ----------------------------------- | -------------------------------------------------------- |
| Fixtures                            | Browser-context lifecycle and shared test setup          |
| Page Objects                        | Screen locators and user actions                         |
| `ui.ts`                             | Generic Playwright primitives with no application rules  |
| `home.ts`, `waits.ts`               | Application entry, login, room navigation, and readiness |
| `multi-player.ts`                   | Multi-context room and game setup                        |
| `night-setup.ts`, `night-driver.ts` | Role setup and Night-1 action orchestration              |
| `diagnostics.ts`                    | Browser diagnostics allowed by the test policy           |
| Specs                               | Scenario intent and assertions                           |

Keep dependencies flowing from scenarios toward lower-level helpers. `ui.ts` must not import application helpers. Prefer Page Objects for selector ownership; shared business flows belong in the domain helpers, not generic primitives.

## Required Test Patterns

- Navigate with `gotoWithRetry()` rather than direct `page.goto()` calls in specs.
- Wait for room readiness with `waitForRoomScreenReady()`.
- Use Playwright locators and assertions instead of fixed sleeps. Polling cadence is the only allowed `page.waitForTimeout()` use and must be at most 300 ms.
- Never use `force: true` to bypass actionability for normal user interactions.
- Do not swallow assertion or state-transition failures with `.catch(() => {})`.
- Mark scenario phases with `test.step()`.
- Do not use `console.log`. Attach structured evidence with `testInfo.attach()`.
- Do not commit `test.skip`, `describe.skip`, `test.only`, or temporary `[DIAG]` output.

## Room Creation Contract

The Worker allocates public four-digit room codes. The client keeps one `creationId` for a creation intent and retries that same identity after unknown delivery or application restart. D1 owns code-collision retries, and the create/delete saga reconciler resumes interrupted storage operations.

Tests must never generate room codes or retry one creation intent with a new identity.

## Failure Investigation

The standard configuration retains a trace and screenshot on failure. Start with the trace:

```bash
pnpm exec playwright show-trace test-results/<test>/trace.zip
```

The trace contains DOM snapshots, requests, browser logs, and action timing. Use `testInfo.attach()` when a scenario needs extra state in the HTML report.

### `ERR_CONNECTION_REFUSED`

`gotoWithRetry()` probes the actual navigation target before calling `page.goto()` and retries connection failures with bounded backoff. If it still fails:

1. Check the Playwright `API` and `Web` server output.
2. Confirm `/health` responds on port `8787` and the web root responds on port `8081`.
3. Check whether a reused local process is stale or bound to the wrong port.
4. Inspect the retained trace and screenshot before rerunning.

### Flake Evidence

"Rerun passed" is not a diagnosis. Record the exact error type and message, then identify either:

- The code path that mitigates the failure and the assertion proving it.
- An external failure that remains unmitigated.

Known structural mitigations include `gotoWithRetry()` for startup connection races and the room-creation idempotency contract for unknown delivery. Do not classify a new failure under either category without matching evidence.
