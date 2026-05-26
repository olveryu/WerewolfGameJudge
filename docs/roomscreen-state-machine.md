# RoomScreen UI State Machine Reference

## GameStatus → Bottom Button Mapping

| GameStatus | Host Bottom Buttons                                    | Non-Host Bottom Buttons                       |
| ---------- | ------------------------------------------------------ | --------------------------------------------- |
| `Unseated` | Room Config                                            | (none)                                        |
| `Seated`   | Room Config, Assign Roles                              | (none)                                        |
| `Assigned` | Restart, View Role                                     | View Role                                     |
| `Ready`    | Restart, Start Game, View Role                         | View Role                                     |
| `Ongoing`  | Restart, View Role, (schema action button if actioner) | View Role, (schema action button if actioner) |
| `Ended`    | Restart, Last Night Info, Night Review, View Role      | View Role, (Night Review if allowed)          |

All Host buttons are disabled when `isAudioPlaying` or `isHostActionSubmitting`.

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

## SeatTile Visual States

| State            | Condition                | Visual                                           |
| ---------------- | ------------------------ | ------------------------------------------------ |
| Empty            | `playerUid === null`     | Shows "Empty"                                    |
| My Seat          | `isMySpot`               | Seat number badge turns green (`colors.success`) |
| Wolf Highlight   | `isWolf` (wolfVote step) | Red background + red semi-transparent overlay    |
| Selected         | `isSelected`             | Dark primary background + selected overlay       |
| Controlled (bot) | `isControlled`           | Warning border thickened                         |
| Anonymous User   | `isPlayerAnonymous`      | Nickname style dimmed                            |
