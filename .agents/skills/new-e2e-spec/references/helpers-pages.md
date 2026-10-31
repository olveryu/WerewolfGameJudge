# Helpers and pages inventory

Verified by reading export lists at drafting time. If a name below is
missing, the helper changed — read the file, do not guess a replacement.

## Layout

```
e2e/
  fixtures/app.fixture.ts
  helpers/ diagnostics.ts, home.ts, image-sharing.ts, multi-player.ts,
           night-driver.ts, night-setup.ts, resilience.ts, ui.ts, waits.ts
  pages/ BoardPickerPage.ts, ConfigPage.ts, FibConfigPage.ts, FibRoomPage.ts,
         HomePage.ts, NightFlowPage.ts, PictionaryConfigPage.ts,
         PictionaryRoomPage.ts, RoomPage.ts, RulesPage.ts, SheriffElectionPage.ts
  reporters/failureBundle.ts
  specs/ *.spec.ts (plus demo.spec.ts.tmpl, not a runnable spec)
```

The helper-ownership tree in `e2e/helpers/README.md` omits
`image-sharing.ts`, `resilience.ts`, the per-game config/room pages,
and the word-pool SQL fixtures; this inventory is the complete one.

## Fixtures — `app.fixture.ts`

- `test` with an `app` fixture: one logged-in page on the home screen.
- `createPlayerContexts(browser, count)`: one `browser.newContext()`
  per player (index 0 = host), each logged in; returns
  `{ pages, diags, contexts }`. Manually created contexts do not
  inherit the config `use` block, so the fixture pins action timeout
  10,000 ms and navigation timeout 30,000 ms.
- `createColdRoomContext(browser, roomCode)`: a fresh context that
  opens a room URL before any home navigation.

## Helpers

| File               | Exports (entry points)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diagnostics.ts`   | `setupDiagnostics(page, label)` — forwards only `[DIAG]` and error-level browser logs; the single sanctioned `console.*` forwarder in E2E tooling.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `home.ts`          | `registerAutoDismissers`, `waitForAppReady`, `startRoomCreation`, `selectGameMode`, `ensureAnonLogin`, `extractRoomCode`, `enterRoomCodeViaNumPad`.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `multi-player.ts`  | `setupNPlayerGame`, `setupNPlayerGameWithRoles`, `viewRoleWithRetry`. Presence handling lives here.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `night-setup.ts`   | `withSetup(browser, { playerCount, configure }, body)` — one independent room per call, contexts closed in `finally`.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `night-driver.ts`  | `findRolePageIndex`, `findAllRolePageIndices`, `readRoomPhase`, `readRoomStep`, `isNightEnded`, `isTextVisible`, `clickSeatAndConfirm`, `chooseFirstEnabledBottomCard`, `tryClickAdvanceButton`, `waitForRoomStep`, `waitForPromptCycle`, `waitForStepAndSettle`, `waitForHostAudioAck`, `waitForRoleTurn`, `waitForNightEnd(pages)`, `viewLastNightInfo`, `driveWolfVote`, `driveMagicianSwap`, `driveWolfEmptyVote`, `readAlertText`, `dismissAlert`, `clickBottomButton`. Its prefixed action log uses `console.log` by design (E2E tooling, not app code). |
| `ui.ts`            | `gotoWithRetry`, `getVisibleText`, `clickIfVisible`, `screenshotOnFail`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `waits.ts`         | `waitForRoomScreenReady`, `ensureConnected`, `waitForLinkLive`, `linkStatusBanner`, `isDisconnected`.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `image-sharing.ts` | `expectWeChatImageShare`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `resilience.ts`    | `setOffline`, `setPageHidden`, `dropRoomSockets`, `seatOfflineIndicator`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Pages

Page objects own selectors and user actions: `HomePage`,
`ConfigPage`, `RoomPage`, `BoardPickerPage` (`selectTemplate`,
`selectDefaultTemplate`, `waitForReady`), `NightFlowPage`
(`runNightFlowLoop`), `SheriffElectionPage`, `RulesPage`, and the
per-game `FibConfigPage`, `FibRoomPage`, `PictionaryConfigPage`,
`PictionaryRoomPage` (room pages extend `RoomPage`).

`ConfigPage.configureCustomTemplate({ wolves, villagers, goodRoles,
wolfRoles, specialRoles })` deselects the default special roles,
zeroes the wolf/villager steppers, then enables exactly the requested
roles. Prefer it over hand-clicking config controls in a new spec.

## Failure evidence

`e2e/reporters/failureBundle.ts` writes one JSON bundle per shard
for tests ending failed/flaky (spec, title, status, error, attempts,
attachments, error-context file), silent on green runs.
`scripts/e2e-failure-digest.mjs` renders the bundles into one
maintained PR comment (failures and flaky called out separately).
Investigation order: failure bundle / PR digest first, trace
second, CI job logs last and only for infrastructure-shaped
failures. See `e2e/helpers/README.md`, "Failure Investigation".
