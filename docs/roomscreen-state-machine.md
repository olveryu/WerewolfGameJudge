# RoomScreen UI State Machine Reference

## GameStatus → Bottom Buttons and Host Task

The bottom panel is the viewer's own participant surface. Host commands live in host management
and reach the host through the **host task card** (`docs/room-shell-contract.md` → "Host Task").

| GameStatus | Participant bottom buttons (host included)   | Spectator bottom | Host task (card)                                                                                                                                                                                                                                                                             |
| ---------- | -------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Unseated` | (none)                                       | (none)           | `assign-roles`, blocked by the seat-count reason; remedy `share-room`                                                                                                                                                                                                                        |
| `Seated`   | (none)                                       | (none)           | `assign-roles` (blocked until full, same remedy)                                                                                                                                                                                                                                             |
| `Assigned` | View Role (primary)                          | (none)           | `start-game`, blocked by the viewing-progress reason; remedy `mark-bots-viewed` while a bot is unviewed                                                                                                                                                                                      |
| `Ready`    | View Role (primary)                          | (none)           | `start-game`; plague mode: message 黑死病模式…                                                                                                                                                                                                                                               |
| `Ongoing`  | View Role, schema action buttons if actioner | (none)           | `null`; message 等待本步玩家确认 + escape `mark-bots-confirmed` while bots are unconfirmed                                                                                                                                                                                                   |
| `Day`      | Election dock: personal action + View Role   | Night Review     | Until confirmed: an equal choice of every move that applies now — `sheriff-advance`, `sheriff-self-destruct` (speeches), `last-night-info` — with steps; during votes `last-night-info` with the vote progress as note. After confirmation: the election's own moves, or the waiting message |
| `Ended`    | View Role; Night Review if shared            | Night Review     | steps 昨夜信息 → 本局复盘 (note: share reminder) → choice `next-round` / `return-lobby`                                                                                                                                                                                                      |

Host transition controls are disabled while their submission is pending; the card then shows the
task blocked without a reason. During narration the audio lock disables the sheet's commands and
the card shows the lock reason; View Role stays available.

`Day` uses a dedicated compact dock for the participant surface: the personal election action is
the dock primary; the host's dock has no trailing review tool (the review reaches the host through
the task card and sheet). A wolf may self-destruct mid-election, so 昨夜信息 is never gated behind
the election; its dialog (昨夜信息可能影响警长竞选) is the host's confirmation. Voting is performed only in the election details surface: seat taps
retain their ordinary room semantics. The Worker remains the only authority for candidate
eligibility, ballots, phase changes, and the final result.

## First-Day Sheriff Election

### Lifecycle

```text
Ongoing -- night complete --> Day -- election complete --> Ended
													 \-- rule disabled -----------> Ended
```

- New rooms default `isSheriffElectionEnabled` to `true` in both ConfigScreen and engine config.
- Existing version-2 snapshots with a missing rule keep legacy behavior: missing means disabled.
- An explicit `false` override must be serialized; it cannot be removed as an "inactive" rule.
- `GameState.sheriffElection` is retained in its `completed` phase after status becomes `Ended`, so
  every player can continue reviewing the registration, withdrawal, and closed-round history.

### Phase Permissions

| Phase             | Player Actions                                       | Host Action                   |
| ----------------- | ---------------------------------------------------- | ----------------------------- |
| `registration`    | Register; registered players may cancel registration | End registration              |
| `candidateSpeech` | Current and future active candidates may withdraw    | Advance in seeded table order |
| `withdrawal`      | Active candidates may withdraw                       | Confirm candidate list        |
| `firstVote`       | Occupied seats that never registered may vote        | Publish when all voted        |
| `runoffSpeech`    | Tied candidates speak in reverse relative order      | Advance tied speakers         |
| `runoffVote`      | Every occupied non-tied seat may vote or abstain     | Publish when all voted        |
| `completed`       | Review public election history                       | None                          |

### Day Presentation

- A compact election HUD remains above the seat board and shows the public phase and status summary.
- Below 1100 px, tapping the HUD or the Vote dock action opens a safe-area-aware details Sheet.
- At 1100 px and wider, a persistent 360 px Inspector replaces the Sheet; eligible voters cast their
  ballot there, and the dock points them to the right side.
- The dock keeps Identity visible for seated users and Restart visible for the Host. During audio,
  its center reports `语音播报中…`; election commands and Host Restart cannot execute.
- Once candidate identities are public, seats show `上警`, `退水`, `PK`, `发言`, or `警长` markers.
  The current speaker also receives an independent emphasis ring, without replacing selected,
  controlled, or danger highlights.
- The HUD, details, and seat markers consume only `SheriffElectionViewModel`. Registration identities
  therefore remain hidden until registration closes.

While registration is open, the public panel hides candidate identities from every player, including
the Host. Each player can still tell whether they personally registered from their available Register
or Cancel Registration action. Cancellation removes the seat from `registeredSeats`, does not append
to `withdrawnSeats`, and allows the player to register again. Closing registration publishes the
complete candidate record to every client before candidate speeches begin; only withdrawals after
that point are retained in public withdrawal history.

Withdrawal preserves the seat in `registeredSeats`. The first vote therefore excludes every player
who registered before registration closed, including withdrawn players. A runoff excludes only its
active tied candidates, so withdrawn players and registered candidates outside the tie may vote.

During an open vote, the public panel exposes only submission progress. Each eligible player can see
their own current ballot and can replace it until the Host publishes the round. A published round
contains candidate totals, every eligible voter's target or abstention, and remains visible through
the runoff and final result.

When registration closes, the engine deterministically draws a starting seat and direction from the
game seed. It walks the physical table clockwise by increasing seat number or counterclockwise by
decreasing seat number, wraps at the table edge, and skips seats that did not register. The expanded
candidate order is stored in `GameState`; clients never generate it independently, and later
withdrawals are skipped while advancing speakers. Runoff speech reconstructs the table traversal,
filters it to active tied candidates, then reverses their relative first-round speaking order so the
candidate who spoke later speaks first. No second daytime speaking-order prompt appears after the
election completes.

## Host Management Sheet (⋯)

There is no separate room menu: the ⋯ button opens the shared host-management sheet
(`createWerewolfHostManagement`, gated on `viewer.isHost` by the shell factory). Sections render
only when they have actions. Non-host users have the header user-settings button only
(`RoomHeaderActions`); the reveal animation is an equipped profile effect, not a room setting.

| Section (`key`)         | Action                                                                                       | Condition                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 当前流程 `current-flow` | `assign-roles` / `start-game` / `select-mvp` / `next-round` / `return-lobby` / sheriff moves | By `GameStatus` (see the first table); disabled with the blocking reason while unavailable                                                                     |
| 房间管理 `room`         | `configure-game`, `fill-bots`, `clear-seats`, `share-room`                                   | Shared `createRoomSetupCapabilities`: host + setup phase; `fill-bots` needs an empty seat, `clear-seats` an occupied one; `share-room` in `Unseated \| Seated` |
| 赛后管理 `post-game`    | 昨夜信息 (`last-night-info`), 本局复盘 (`night-review`)                                      | `Day \| Ended`                                                                                                                                                 |
| 辅助工具 `tools`        | `music-settings`                                                                             | `!isStartingGame && !isAudioPlaying && status ∉ {Ongoing, Day}`                                                                                                |
| 辅助工具 `tools`        | `mark-bots-viewed`                                                                           | `Assigned` and a bot seat has not viewed its role (also the `start-game` task remedy)                                                                          |
| 辅助工具 `tools`        | `mark-bots-confirmed`                                                                        | `Ongoing`, `night.actionSchema.kind === 'groupConfirm'`, `!isAudioPlaying`                                                                                     |
| 危险操作 `danger`       | `abort-game`                                                                                 | `Assigned \| Ready \| Ongoing \| Day`; disabled while a host command is in flight                                                                              |

There is no debug mode: `mark-bots-viewed` is a regular host tool.

## Night Interaction: `NightInteractionModel.kind` → UI

The night UI is `f(viewModel, draft)`: `room/night/resolveNightInteraction.ts` turns the engine
projection (`night.actionSchema`, `night.isActioner`, `night.pendingReveal`, …) plus the local
draft into one `NightInteractionModel`; the seat board (`createWerewolfSeatDataSource`), the bottom
bar (`buildNightButtons`) and the dialogs (`useNightInteraction` via `showConfirmAlert` /
`showDismissAlert`) all render from it. Non-actioners always get `idle`: seats are not interactive
and no buttons show. Every confirm submits a durable command built by `buildNightCommand`.

| `kind`            | Source                                       | Actioner UI                                                                                                                                                               |
| ----------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle`            | not actioner / not `Ongoing`                 | Nothing (bottom bar shows the waiting line)                                                                                                                               |
| `blocked`         | `isAudioPlaying` or previous durable pending | Seats inert; tap → throttled toast with the reason (`语音播报中…` / `正在确认上一步…`)                                                                                    |
| `pickSeat`        | `chooseSeat`                                 | Prompt once; tap seat → confirm dialog → `target`; Skip button when the schema allows; reveal schemas continue with `ackReveal`                                           |
| `wolfVote`        | `wolfVote`                                   | Wolf seats highlighted; tap → confirm vote (change allowed); bottom: `emptyVoteLabel` (schema) / 取消投票 after voting; countdown + immune-target note in the status line |
| `pickTwoSeats`    | `swap`                                       | First tap sets `pick.first` (title prompt), second tap sets `pick.second` and opens confirm in the same render; cancel clears both                                        |
| `multiSelect`     | `multiChooseSeat`                            | Tap toggles; full set ignores further taps; bottom: 确认（{count}）disabled at 0 / Skip                                                                                   |
| `witch`           | `compound`                                   | Info prompt (killed seat, potions); `saveLabel` button only when `canSave`; poison = tap seat → confirm; 都不用 = skip                                                    |
| `confirmStatus`   | `confirm`                                    | Bottom button opens the status dialog (can / cannot act); Skip when allowed                                                                                               |
| `chooseCard`      | `chooseCard`                                 | Bottom `openLabel` button opens `ChooseBottomCardModal`; card availability + reason come from engine `night.chooseCard`                                                   |
| `ackGroupReveal`  | `groupConfirm`                               | Every subject sees the personalised reveal text; the bottom `openLabel` button opens it and confirming sends `groupConfirm.ack`; host may 标记机器人已确认                |
| `ackReveal`       | `night.pendingReveal`                        | Result dialog (`<prefix>：N号是…`) shown once per step, re-shown after reload until acked → `reveal.ack`                                                                  |
| `ackHunterStatus` | wolf-robot learned hunter                    | Status gate dialog → `wolfRobot.ackHunterStatus`                                                                                                                          |
| `skipOnly`        | `skip`                                       | Prompt + Skip button                                                                                                                                                      |

Business rejections arrive through `night.rejection` (engine-cropped to the viewer) and are shown
once per `rejectionId`; transport failures toast and keep the dialog open for retry. The draft
(`firstSwapSeat`, `multiSelectedSeats`) survives a reload within the step scope
(`stepId / actorSeat / roleRevealRandomNonce / seatCount`) through the platform `useScopedDraft`.

## Overlay / Modal Trigger Conditions

| Component               | Trigger Condition                                                                                                   | Visible To                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `RoomAuthGate`          | No session when entering room via deep link (rendered by `RoomResolverScreen` before the authenticated room lookup) | Unauthenticated users     |
| `RoomAudioResumeDialog` | Host rejoin mid-narration (`useRoomAudioResume.isDue`; shared with avalon)                                          | Host                      |
| `RoomSeatConfirmModal`  | Tap seat (Unseated/Seated phase)                                                                                    | Tapper                    |
| `WerewolfRoleCardModal` | Tap "View Role" → `useRoleViewing` (server confirms `role.viewed`, then the card opens)                             | Players with seat         |
| `NightReviewModal`      | Tap "Night Review" (Ended phase)                                                                                    | Host + authorized players |
| `ShareReviewModal`      | Host picks 授权玩家查看 in the 本局复盘 action sheet (`useRoomModals`)                                              | Host                      |
| `QRCodeModal`           | Tap "Share Room"                                                                                                    | All users                 |
| `ChooseBottomCardModal` | `NightInteractionModel.kind === 'chooseCard'` and the actioner taps the bottom button                               | Actioner                  |
| `MvpSelectionModal`     | Host taps `select-mvp` (Ended, no MVP yet)                                                                          | Host                      |
| `BoardNominationModal`  | Tap 我来建议 / 修改建议 in the board info card (setup phases only; closes on leaving setup)                         | All users                 |
| `ShareProgressModal`    | A night-review share capture is running                                                                             | Sharer                    |
| `SheriffElectionSheet`  | Day details requested below 1100 px                                                                                 | All users                 |

## SeatTile Visual States

| State            | Condition                                              | Visual                                                  |
| ---------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| Empty            | no occupant (`playerAvatarSeed === null`)              | Shows "Empty"                                           |
| My Seat          | `isMySpot`                                             | Seat number badge turns green (`colors.success`)        |
| Wolf Highlight   | `highlight === 'danger'` (wolf pack during `wolfVote`) | Red background + red semi-transparent overlay           |
| Selected         | `highlight === 'selected'`                             | Dark primary background + selected overlay              |
| Controlled (bot) | `highlight === 'controlled'`                           | Warning border thickened                                |
| Anonymous User   | `isPlayerAnonymous`                                    | Nickname style dimmed                                   |
| Election Status  | Public sheriff projection                              | Semantic `上警` / `退水` / `PK` / `发言` / `警长` badge |
| Current Speaker  | Public current speaker                                 | Independent emphasis ring plus `发言` badge             |
