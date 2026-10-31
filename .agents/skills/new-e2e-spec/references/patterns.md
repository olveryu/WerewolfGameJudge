# Patterns — setup, driving, naming

## Choose the pattern first

| Situation                                 | Pattern                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Werewolf night-role flow                  | `withSetup` (`night-setup.ts`) + night-driver helpers.                                      |
| Multi-player game setup with known roles  | `setupNPlayerGameWithRoles` (`multi-player.ts`), via `withSetup` when a night flow follows. |
| Multi-player setup without role capture   | `setupNPlayerGame`.                                                                         |
| Single-page home / entry / lifecycle flow | `app` fixture (`app.fixture.ts`).                                                           |
| Cold entry (deep link before login)       | `createColdRoomContext`.                                                                    |

`withSetup(browser, { playerCount, configure }, body)` creates one
independent room, runs the body with `{ setup, pages, roleMap }`,
and closes all contexts afterwards. `configure` receives a
`ConfigPage`; use `configureCustomTemplate` for template selection.

## Seats and roles

`roleMap` maps page index → `{ displayName, seat }`, where `seat` is
the 0-based seat index equal to the page index
(`setupNPlayerGameWithRoles`). Display labels are 1-based:
`formatSeat(seat)` (engine, `platform/room/formatSeat.ts`) converts
a 0-based index to the user-readable label.

Drive roles in `NIGHT_STEP_ORDER` (see
`references/night-step-order.md`). Use the night-driver helpers
(`waitForRoleTurn`, `clickSeatAndConfirm`, `driveWolfVote`,
`tryClickAdvanceButton`) instead of hand-rolling waits and clicks;
`waitForNightEnd` takes the pages array. Roles act from their own
page's role card.

## Naming

Filename families in `e2e/specs/` at drafting time:

- `werewolf-night-<category>.spec.ts` — night flows (`block`,
  `check`, `check-interactions`, `gun-status`, `kill`, `protect`,
  `piper`, `gargoyle`, `seed-wolf`, `special-roles`,
  `special-roles-2`, `completion`, `flow`).
- `werewolf-<area>.spec.ts` — `config`, `seating`,
  `sheriff-election`.
- `app-<area>.spec.ts` — `entry-flow`, `home`, `room-lifecycle`.
- `resilience-<area>.spec.ts` — `reconnect`, `rejoin`, `restart`,
  `db-recovery`, `offline-canary`.
- `<game>.spec.ts` — one per game (`avalon`, `fibking`,
  `fibking-responsive`, `undercover`, `pictionary`, `storyrelay`,
  `drawguess`); plus `room-narration.spec.ts`.
- `demo.spec.ts.tmpl` — a template, not a runnable spec.

Describe/test names use English (convention). A new spec file name
follows the family it joins; a new category needs a reason, stated
in the work notes.

## Required patterns (from `e2e/helpers/README.md`)

- Navigate with `gotoWithRetry()`; never call `page.goto()` directly
  in a spec.
- Readiness via `waitForRoomScreenReady()`.
- Locators and assertions instead of fixed sleeps; mark phases with
  `test.step()`.
- Each spec creates an independent room so parallel workers cannot
  share state (`fullyParallel: true` in the config).
- `test.setTimeout(180_000)` is the established budget in night
  specs (some specs use 300,000 ms).
