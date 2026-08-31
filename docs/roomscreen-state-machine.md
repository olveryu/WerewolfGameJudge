# RoomScreen UI State Machine Reference

## GameStatus → Bottom Button Mapping

| GameStatus | Host Bottom Buttons                                       | Non-Host Bottom Buttons                        |
| ---------- | --------------------------------------------------------- | ---------------------------------------------- |
| `Unseated` | Room Config                                               | (none)                                         |
| `Seated`   | Room Config, Assign Roles                                 | (none)                                         |
| `Assigned` | Restart, View Role                                        | View Role                                      |
| `Ready`    | Restart, Start Game, View Role                            | View Role                                      |
| `Ongoing`  | Restart, View Role, (schema action button if actioner)    | View Role, (schema action button if actioner)  |
| `Day`      | Identity, Host advance, personal election action, Restart | Identity when seated, personal election action |
| `Ended`    | Restart, Last Night Info, Night Review, View Role         | View Role, (Night Review if allowed)           |

Host transition controls are disabled while their submission is pending. During Day audio, election
commands and Restart are disabled while Identity remains available.

`Day` uses a dedicated compact dock instead of the night action layout. Host advance is the primary
command and any personal Host action is secondary; a player's personal action is primary. When no
command is available, the center button reports the current election state. Voting is performed only
in the election details surface: seat taps retain their ordinary room semantics. The Worker remains
the only authority for candidate eligibility, ballots, phase changes, and the final result.

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

## ⋯ Menu Item Visibility

| Menu Item         | Visibility Condition                                 |
| ----------------- | ---------------------------------------------------- |
| Role Encyclopedia | All users, always visible                            |
| Reveal Animation  | `isHost && !isAudioPlaying && (Unseated \| Seated)`  |
| Music Settings    | `isHost && !isAudioPlaying && (Unseated \| Seated)`  |
| User Settings     | All users, always visible                            |
| Stand All Up      | `isHost && (Unseated \| Seated) && anyPlayersSeated` |
| Fill With Bots    | `isHost && Unseated`                                 |
| Mark Bots Viewed  | `isHost && isDebugMode && Assigned`                  |

## Night Schema Kind → Interaction Mode

| Kind              | Host/Actioner UI                                                                          | Other Players UI                       |
| ----------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| `chooseSeat`      | Seats are tappable → confirm/reveal popup. Skip button in bottom bar when `canSkip`       | Seats not interactive                  |
| `wolfVote`        | Wolf seats highlighted, tap to vote/change vote. Bottom bar: Forfeit Attack / Cancel Vote | Cannot see wolf identities, no buttons |
| `compound`        | Auto-popup (Witch save/poison two steps). Bottom bar: Use Antidote / Skip All             | None                                   |
| `swap`            | Auto-popup. Tap two seats sequentially to complete swap                                   | None                                   |
| `confirm`         | Bottom bar button to view activation status → popup shows can/cannot activate             | None                                   |
| `multiChooseSeat` | Tap seats to toggle multi-select. Bottom bar: Confirm Hypnotize ({count}) / Skip          | None                                   |
| `groupConfirm`    | **All seated players** see their status popup → tap "Got it" to confirm                   | Same (all players participate)         |

## Overlay / Modal Trigger Conditions

| Component                  | Trigger Condition                           | Visible To                |
| -------------------------- | ------------------------------------------- | ------------------------- |
| `AuthGateOverlay`          | No session when entering room via deep link | Unauthenticated users     |
| AlertModal (Continue Game) | Host reconnect with `needsContinueOverlay`  | Host                      |
| `SeatConfirmModal`         | Tap seat (Unseated/Seated phase)            | Tapper                    |
| `RoleCardModal`            | Tap "View Role"                             | Players with seat         |
| `NightReviewModal`         | Tap "Night Review" (Ended phase)            | Host + authorized players |
| `ShareReviewModal`         | Host taps "Last Night Info"                 | Host                      |
| `QRCodeModal`              | Tap "Share Room"                            | All users                 |
| `NotepadModal`             | Tap BoardInfoCard notepad icon              | All users                 |
| `SettingsSheet`            | Game settings in ConfigScreen               | Host                      |
| `SheriffElectionSheet`     | Day details requested below 1100 px         | All users                 |

## SeatTile Visual States

| State            | Condition                 | Visual                                                  |
| ---------------- | ------------------------- | ------------------------------------------------------- |
| Empty            | `playerUid === null`      | Shows "Empty"                                           |
| My Seat          | `isMySpot`                | Seat number badge turns green (`colors.success`)        |
| Wolf Highlight   | `isWolf` (wolfVote step)  | Red background + red semi-transparent overlay           |
| Selected         | `isSelected`              | Dark primary background + selected overlay              |
| Controlled (bot) | `isControlled`            | Warning border thickened                                |
| Anonymous User   | `isPlayerAnonymous`       | Nickname style dimmed                                   |
| Election Status  | Public sheriff projection | Semantic `上警` / `退水` / `PK` / `发言` / `警长` badge |
| Current Speaker  | Public current speaker    | Independent emphasis ring plus `发言` badge             |
