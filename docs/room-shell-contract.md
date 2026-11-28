# Cross-Game UI and Room Shell Contract

This is the current UI integration contract for new games and changes to existing games.
Use [DESIGN.md](DESIGN.md) for the visual baseline and
[multigame-platform-design.md](multigame-platform-design.md#25-新增游戏接入清单) for module registration.
Game-specific design documents describe gameplay, not a parallel design system.

## Ownership and Visual Baseline

Werewolf is the primary UI reference. Preserve its established configuration controls,
room hierarchy and interaction patterns; other games align with that reference. Do not
redesign Werewolf merely to make a new abstraction easier to introduce.

UI consistency includes configuration, every room phase, game-owned panels, dialogs,
drawers, loading, empty, error, selected, disabled and submitting states. Sharing a header
or importing the same component is not evidence that the complete UI is consistent.

Shared components own presentation and report intent. Game modules own values, validation,
permissions, visibility and commands. Do not add game-ID branches to shared components or
import another game's UI into a new game. When a control must look identical, its shared
component owns the complete geometry, including the value area, not just its outer wrapper.

## Configuration and Guide

| Surface                                      | Existing owner                                                                                       | Caller responsibility                                                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page frame, bounded scroll and fixed actions | `src/components/GameScreen.tsx`                                                                      | Header, content and submission intent; actions stay outside scrolling content                                                                             |
| Schema-driven config screen                  | `src/features/room/config/` (`createGameConfigScreen`, `GameConfigForm`, `useGameConfigScreenState`) | Engine `GameConfigSchema`, route parser, lobby `readConfig`, update command, failure copy; optional `summary`, `fieldRenderers`, `Extra`, `useSubmitGate` |
| Count / switch / radio controls              | `src/components/GameSettings.tsx` and `GameSettings.styles.ts`                                       | Values and intent callbacks; the form supplies them from the schema                                                                                       |
| Reading sections and notices                 | `src/components/GameGuide.tsx`                                                                       | Accurate game-owned rules and tool limitations                                                                                                            |
| Unified game configuration card              | `src/features/room/components/RoomGameSummary.tsx`                                                   | Game name/count, required guide intent, public content, phase collapse default and available strategy/notepad intents                                     |
| Board status bar                             | `src/features/room/model/RoomBoardStatus.ts`                                                         | Public context, one status line, progress, pending seats, notices, icon name, tracks and footnote as data; only the shell renders the bar                 |
| Centered room details                        | `src/features/room/components/RoomDialog.tsx`                                                        | Title, scrollable details, close intent and fixed footer                                                                                                  |

- Use the compact Werewolf settings hierarchy. Settings pages configure a game; long gameplay
  explanations belong in the guide. Preserve specialized editors such as Werewolf role selection.
- Session-based games do not write a config screen. They declare their lobby config once as an
  engine `GameConfigSchema` (`packages/game-engine/src/platform/config/configSchema.ts`:
  `count` / `toggle` / `choice` / `duration` / `fixed`, plus a cross-field `validate` hook) and
  register it through `defineClientGameModule({ config: (define) => define({...}) })`. The same
  schema backs `isValid<Game>Config`, the Worker zod boundary (`configSchemaToZod`) and the
  client form, so a limit is declared exactly once. See
  [game-config-schema-design.md](game-config-schema-design.md).
- The shared screen renders `${displayName}设置`, a reset action, one widget per schema field with
  its hint, inline validation under the offending field, and a footer summary plus
  创建房间 / 保存设置. Out-of-range counts disable the stepper at the bounds and report typed
  text inline; they do not alert. Fields marked `isRemembered` seed the next new room through
  `SettingsService.getRememberedGameConfig` and persist on change.
- Controls the schema cannot express plug in through `fieldRenderers` (e.g. the Undercover
  category list filtered by the live word inventory) or an `Extra` block below the form (e.g.
  the Avalon board preview); `useSubmitGate` blocks submission on asynchronous preconditions.
  None of these may bypass schema validation.
- `Stepper` (`components/Stepper.tsx`) takes `label`, an `entry` (`{ kind: 'text', value,
onChangeText }` for a typed count, `{ kind: 'readonly', value }` for a derived one), the three
  test ids, `onDecrement`, `onIncrement`, `isDecrementDisabled` and `isIncrementDisabled`. `GameSettingsChoice` is the radio-pill group
  for choice and duration fields; options are announced by their bare label.
- Werewolf keeps its role-selection `ConfigScreen` and `BoardPickerScreen`; its rules step renders
  `WEREWOLF_RULES_SCHEMA` through the same `GameConfigForm`.
- Preserve each game's input capabilities and validation. Do not silently change limits or
  add fallback values to make a common control fit.
- Provide a usable gameplay introduction: goals, basic flow, player/host responsibilities,
  and what the tool does and does not handle. Role/board catalogs are supplementary, not a
  replacement for the introduction.
- Keep editable rule settings separate from the read-only guide. Any current-room rules
  come from the matching authoritative room snapshot, not duplicated navigation state or
  hardcoded defaults. Preserve private-information visibility; show an explicit unavailable
  state when the requested room configuration cannot be read.
- `RoomDialog` is a dismissible centered detail surface, not a universal confirmation
  dialog. Use the existing confirmation/sheet primitives when dismissal, pending-state
  locking or responsive presentation differs; preserve those behaviors while aligning visuals.

## Configuration Submission

`useGameConfigScreenState` submits through
`src/features/room/controllers/useRoomConfigSubmission.ts` for every schema-driven game.
It composes the creation and command controllers, exposes their combined pending state,
returns to the active room only after an accepted edit, and replaces the config route after
successful creation. Creation failures keep the game-specific `creationLabel` and the shared
error pipeline; Werewolf's rules step keeps its own `useGameRulesSubmission`.

Games retain the authoritative lobby read (`readConfig` returns null outside the lobby and the
screen fails fast), typed update commands, creation payloads and command-failure copy. The
shared layer does not synthesize configs or change host-command dispatch options.

## Room Controller Composition

All eight room hooks and the new-game hook template use
`src/features/room/controllers/useRoomPresentationController.ts` for the share controller,
once-per-created-entry QR presentation, title gestures and gacha status. Games supply their
display name, room code, authoritative host flag and entry reason. This composition does not
interpret game phases; Werewolf supplies its entry reason through the Screen-to-hook contract.

`src/features/room/controllers/useRoomRosterController.ts` binds standard seat commands,
seat confirmations, profiles and host clear/fill confirmations to one authenticated session.
It exposes the controllers and their capability actions without deciding lifecycle permissions.
Pictionary, FibKing and Undercover pass those actions into their existing game-owned capability
factories, preserving their different in-game profile and seat-tap behavior.

Avalon, DrawGuess and Story Relay share their standard setup composition:

- `src/features/room/controllers/useRoomSetupController.ts` composes the roster controller with
  standard setup capabilities and setup-only profile viewing. Games supply
  lifecycle facts, occupancy, bot support and configuration/share callbacks; they do not repeat
  the controller-to-capability wiring.
- `src/features/room/controllers/createRoomSeatPressHandler.ts` executes setup seat intents and
  delegates unconsumed in-game taps to the shared adjudicator. Games keep their profile-target
  resolvers. Avalon consumes game-specific seat picks before calling this handler.
- Bot takeover, role viewing, deadlines, gameplay commands and shell projections remain game-owned.
  Sharing roster controllers does not require replacing game-owned capability factories or click policies.
- Stage deadlines: the server-side scheduled settle effect is the only expiry path; no client sends any expiry command — the countdown is display-only.

The new-game room hook template emits both shared bindings so new games do not regenerate
copies of the execution branches or controller wiring.

## Narration and Resume

Narrated games bind playback and durable acknowledgement ports through
`src/features/room/audio/useRoomAudioOrchestration.ts`; games do not supply phase
predicates, replacement replay queues or failure-skipping policies.
The authoritative `isAudioPlaying` slice governs every phase, including daytime
and closing narration after an action phase ends.

Bind `useRoomAudioResume` and the existing `RoomAudioResumeDialog` to the shared
reactive `isResumeRequired` signal. Re-entry and playback failure require a gesture
to replay the complete pending batch, preserving engine-resolved cue keys and order.
Preload, missing-asset, playback and cancellation failures leave the batch
unacknowledged, log room/batch/cue context and keep recovery available.
Only completed narration may be acknowledged; an acknowledgement retry does not
replay completed clips. Same-page connection-status changes do not create a new
resume prompt, including while a durable acknowledgement is pending.
Keep connection/reconnection handling in `RoomLink`, not the audio lifecycle.

## Shell Model Assembly

All seven game adapters use `src/features/room/model/createRoomShellModel.ts` to assemble
the public shell fields and seat board. Game adapter inputs inherit the shared contract,
omitting fields that the game computes rather than duplicating common field declarations.
The factory copies only declared output fields; spreading a game adapter input into it does
not expose game state, controllers or private projection inputs on the returned model.

- `RoomShellModelInput` accepts standard header callbacks and gacha status; the factory delegates
  header construction to `buildRoomHeaderModel`.
- `RoomShellModelWithHeaderInput` accepts a complete header. Werewolf retains its precomputed
  ticket count and avatar callback instead of reconstructing gacha state.
- Games supply authoritative `phase` and nullable `step`, the `viewer`, seat-source projections,
  profile and confirmation models, player actions, a lazy `buildHostManagement`, and
  bot-control projections. The factory does not infer phases, lock seats or decide
  permissions; it does enforce action ownership (see "Action Ownership" below).
- The new-game adapter template uses the same factory and input contract as shipped games.

### Narration Status

`RoomShellModel.isAudioPlaying` is a required presentation input. Games with narration project
the authoritative room snapshot's playback flag; games without narration explicitly supply
`false`. Never derive this shared status from the host device's local audio player or introduce
another stored playback flag.

`RoomShell` passes the flag to `RoomActionStatus`, placing its narration text with the room
status for hosts, players and spectators. Narration remains visible without buttons, preserves
progress, and does not replace game-owned guidance or step navigation. The text disappears
when the authoritative flag clears. Games must not place the same narration text in their own
message or an inert button.

The flag does not disable actions in the renderer. Games retain their existing interaction
policies: Werewolf hides its night action guidance and actions during playback; Avalon allows
night information confirmation alongside narration. Host-management audio locks remain separate.

The adapter generator binds `state.isAudioPlaying` when `audioOrchestration` is enabled and
emits `false` otherwise. Generator acceptance executes the audio-enabled output's
queue-to-shell-to-panel and acknowledgement transition.

### Narration Preparation

Werewolf and Avalon prepare narration through the shared audio player port's `prepareQueue`,
before queued playback and before replaying a step after host rejoin. Werewolf selects clips
from the latest authoritative snapshot's public board; Avalon uses its fixed first-night list.
Host start commands do not preload audio. Preparation starts buffering; it does not wait for
every clip to finish downloading. Missing-asset errors remain fail-fast, and playback failures
continue through the shared audio error pipeline.

### Avalon Host Controls and Music

Avalon uses the shared host-management surface for role assignment, bot identity viewing,
start, review, next round and return to lobby. During an unfinished game it also exposes
abort, plus bot confirmation when the current night step has unconfirmed bot participants.
Host commands remain subject to submission and narration locks. Setup controls do not become
available during play, and vote/quest settlement remains automatic.

`avalon.game.restart` carries the game sequence and ended status and returns the game to
lobby, preserving seats, configuration and game sequence. Restarting an unfinished game
does not emit a winner or reward settlement. `avalon.bots.markAllBotsGroupConfirmed`
confirms only bots participating in the current night step. Human confirmations and narration
acknowledgement are still required before advancing.

Only the host runs BGM, using the existing music catalog, saved settings and audio service.
Music settings are available in lobby, identity viewing and after the game. The room's
play/pause tool stays separate from narration state. Automatic playback covers the night
only: it starts when the night opens and the shared audio core (`RoomAudioOrchestrator`)
stops it right before the dawn narration (`NIGHT_END_AUDIO_KEY`), so music never overlaps
the dawn voice. Day phases never auto-play; a host's manual play/pause survives day phase
changes. Return to lobby, game end, loss of host ownership and leaving the room stop BGM.

## Room Content

### Identity-game layout

The new-game `identityViewing` template follows Werewolf/Avalon rather than
replacing the board with a workspace: `RoomShell` uses `kind: 'seats'` in
lobby, identity viewing, play and ended. Public configuration goes through
`RoomGameSummary`, collapsed by default after dealing, with shared `BoardInfoContent`.
Public role composition comes from configured counts, never dealt seat
identities; role previews do not mark any participant's identity as viewed.
The viewing-phase identity action is primary and tracks the effective seat's
view status; in play and at the end it is secondary. Spectators have no
identity action, and a pending command disables it. The host task is pending
in the lobby and, after the host has viewed their own identity (or has no
seat), during viewing. Non-identity templates retain their workspace.
Generated games expose only the host's sequence- and phase-checked `game.restart`
command for returning to preparation; stale `game.abort` and `game.returnToLobby`
commands are rejected at the public boundary.

Every game, including non-identity games, uses the same `RoomGameSummary`
card wherever its room information is shown. Its one header contains
the game name and `（N人）`, `玩法`, available `攻略`/`笔记` actions, and the collapse
control. There is no separate title above a second configuration card.
The shared component owns the entire frame, responsive header, controls
and collapse state; callers provide public configuration copy and content.
Public parameters use its typed `settings` label/value pairs, rendered as a
read-only two-column description list below the role composition when present.
Do not combine settings, introductions,
board names and live status into a subtitle. Werewolf starts directly with its
role composition, without the preset name. Game introductions stay in the guide.
The header follows the original configuration card on main: the game name and
full parenthesized player count share 18px semibold dark text. `玩法` sits beside
`攻略`/`笔记`, all using the original blue-on-tinted pill treatment with visible
icons and labels. Compact tool spacing accommodates the added guide; transparent
outer buttons retain 44px touch targets and native focus/pressed behavior.
Small phones are not a layout target; do not shrink approved typography, hide
icons, or remove punctuation to fit them.
`BoardInfoContent` renders public role counts without another frame.
Games without roles put their existing public parameters inside the same
card. Keep existing phase visibility and stage/canvas layouts. Tool
buttons are siblings of the title disclosure, never nested in it; tool
activation must not toggle the card. Live preparation/error status stays
outside the collapsible configuration so it cannot be hidden by folding.
The optional `status` text renders after the card, including Pictionary's live
occupied-seat count. A card without settings or role content keeps its title and
guide but has no empty disclosure control.

For seat rooms using action hands, the lobby summary can omit its guide button:
the manual hand opens the same guide body in `RoomDialog` without page navigation.
After dealing, rooms can move the public board into `本局配置`, reusing
`BoardInfoContent` and `RoomGameSettings`. Keep live status outside that dialog
and yield the hand during temporary seat selection.

Seat content has exactly one status bar above the seats. Games describe their
stage status as `boardStatus` data (`RoomBoardStatusModel`) — Werewolf's sheriff
election, Avalon's mission state and tracks, Secret Hitler's government vote and
policy tracks, and Undercover's winner — and decide when it appears; the shell
renders it. Detail surfaces remain game-owned: Werewolf retains its responsive
sheet and inspector; Avalon and Secret Hitler use `RoomDialog`. Secret Hitler
hides its status until first-night narration finishes and the authoritative
phase enters the election. Do not put an expanded stage
card, terminal player list or full match history above the seats. Personal
instructions, identity viewing and commands stay in the bottom model;
private results stay behind explicitly authorized actions and overlays.

### Room Action Hierarchy

Every action uses the shared `RoomAction` shape: a stable key, label, semantic category, explicit
state (`ready`, `busy` or `blocked`) and optional icon/test ID. Player actions add an audience
and pending marker. A player model has one ordered `actions` list, a nullable `group` for a
multi-action sub-hand, status text and progress; non-group games set `group: null`.

`buildRoomHand` projects the current model into cards. The main hand contains player actions,
the group entry when present, then the stable-keyed directory entries for configuration, manual,
game-specific tools, sharing and host management. The host hand and manual are in-place
sub-hands with a leading return card. A group sub-hand contains its return card and its actions.
The stage menu is a separate `actionSurface: 'menu'` projection of the same directory and
authorized stage actions. Cards are ordered by category and state while preserving ties.

`RoomActionStatus` is separate from the hand container. Seat content places status above the seat
board as exactly one `RoomCompactStatus` (context, one status line carrying `actionMessage`,
optional progress, pending seats, public notice lines, then score tracks and a footnote below a
divider). The model holds data only: the icon is an `IoniconName`, tracks are `RoomTrack` cells
(state, title, lines and an optional read-only rule detail) rendered by the shared `RoomTracks`,
and no field takes React content. `resolveRoomBoardStatus` merges the inputs as a pure function.
The game's `boardStatus` supplies its data, falling back to the shell's `statusIcon` and phase label;
without one the shell shows the phase or lobby status. `statusNotices` are public text lines (e.g.
dawn announcements) the shell keeps inside that same bar in every phase, with or without a
`boardStatus`. Audio narration and seat selection replace only the message line and hide progress
and pending seats, keeping the context, notices, tracks and footnote. Games never render the bar or its
lines themselves: only `RoomActionStatus` imports `RoomCompactStatus` and no other source uses a
`room-compact-status*` class, pinned by
`packages/web/src/__tests__/roomBoardStatusOwnership.contract.test.ts`, and the shell's one-bar
rendering is pinned in `RoomShell.stage.test.tsx`; the web test setup fails any test whose room
renders more than one bar. Other hand surfaces place status in the bottom panel. Stage content
keeps its status in the HUD and requires the menu action surface. Dialog and game-workspace
controls remain game-owned and are not moved into the hand.

### Action Ownership

Who sees which action and how the host learns what to do next is a declared,
machine-checked contract.

**Viewer identity.** `RoomShellModel.viewer` (`src/features/room/model/RoomViewer.ts`) declares
`userId`, `isHost` and the viewer's real seat, or explicitly marks a participant without a
numbered seat using `participation: 'seatless'` and `seat: null`. Bot takeover widens the
effective seat through `resolveEffectiveSeat(viewer, controlledSeat)`; it does not change viewer
identity. `resolveRoomViewerAudience` is the seat-based audience projection used by existing
adapters and tests.

| Model            | Holds                                                                            | Audience                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `playerActions`  | The viewer's own participant/spectator actions and an optional grouped sub-hand. | `participant` requires an effective seat or explicit seatless participation; `anyone` is available to spectators. |
| `hostManagement` | The host task and complete flat inventory of host actions.                       | Built lazily only for `viewer.isHost`; otherwise `null`.                                                          |

`createRoomShellModel` validates audiences for direct and grouped player actions and rejects
actions duplicated by the host task. The renderer does not inspect roles. Commands owned by a
game workspace remain in that workspace; host flow commands remain in `hostManagement`.
Profile targets can identify a human without a numbered seat; such targets cannot expose the
shared kick-seat or leave-seat actions. A game's account-based participation actions remain
separate from those numbered-seat commands.

#### Host Task

The host task is the declared "what to do now" entry in
`RoomHostManagementModel.task`. `RoomHostManagementModel.actions` is the flat host-action
inventory; every task reference resolves to one of these actions, so the task has no handler.

```ts
interface RoomHostManagementModel {
  readonly task: RoomHostTask | null;
  readonly pendingActionKeys?: readonly string[];
  readonly hasPendingDecision?: boolean;
  readonly actions: readonly RoomHostAction[];
}

type RoomHostTask =
  | {
      readonly kind: 'action';
      readonly actionKey: string;
      readonly steps?: readonly RoomHostTaskStep[];
      readonly note?: string;
    }
  | {
      readonly kind: 'choice';
      readonly actionKeys: readonly string[];
      readonly steps?: readonly RoomHostTaskStep[];
      readonly note?: string;
    }
  | {
      readonly kind: 'message';
      readonly text: string;
      readonly escapeActionKey?: string;
      readonly steps?: readonly RoomHostTaskStep[];
      readonly note?: string;
    };
```

An action's `state` carries its availability and blocked reason; a message may reference one
escape action; a choice references at least two actions. `resolveHostTaskView` validates these
references, unique pending keys and step progress. The task header shows its message, note and
steps above the host hand. Pending actions are ordered first and marked individually; a required
alternative decision marks the host entry without marking every choice. Host commands stay in
the host hand, never in the player's actions.

The `roomMoreActionsButton` opens host management in place. Host card IDs use the action's
declared test ID, with task-specific fallbacks for escape, next-step and choice actions. The
manual and grouped player actions use the same navigation model; entering a sub-hand focuses
its return card, returning restores focus to its entry, and seat selection temporarily projects
selection actions without changing the remembered hand. A group key is scoped to the game step;
when that group disappears, the main hand is shown without discarding its key.

`stage` content has no bottom panel. It requires the public stage menu; the host task is null
and every host action in the menu declares `stageMenuRole`. The stage HUD renders status, while
menu actions are projected from the same directory/action data as the main hand.

#### Review （本局复盘）

Every game has one review, declared as `review` in its client module
(`RoomReviewContribution<TState>`, `src/features/room/review/types.ts`) and rendered only by the
platform: the game turns state into a declarative `RoomReviewDocument` (closed block
vocabulary; the game writes every fact, the platform owns the review title, share title and
generated-by footer in `reviewCopy.ts`); `useRoomReview` resolves it for the viewer and
returns the entry, `open`, `shareAll` and the overlay (dialog, hidden export stage, share
progress). Surfaces render the entry only through `buildReviewBottomButton` (audience `anyone`;
non-Werewolf games reach it through `buildViewerReviewBottomButtons`, which omits it for the
host) and `buildReviewHostAction` (sheet key `review`); a game never writes review JSX, a share
pipeline, or its own export dialog. Availability is the game's: `notEnded` renders no entry,
`notPermitted` renders it disabled with the reason, `available` carries the document, whether
the viewer may export it, and an optional confirmation before opening. The dialog prints the
page edge to edge with a share footer (`保存／分享图片`; multi-page documents add a pager,
`保存／分享全部 N 页` and `仅分享本页`) and captures pages in the background while open, so a
tap reaches the system share sheet at once. Pinned by `src/__tests__/roomReview.contract.test.ts`
(every game, every document) and the platform tests under `src/features/room/review/__tests__/`.

`RoomShell` owns the shared header, connection/status ribbon, seat control banner, status,
action hand, profile, invitation and host-management surface. Game screens provide models and
content, not another copy of those surfaces.

`content` is an explicit discriminated union:

- `seats`: `contextHeader`, `beforeSeatBoard` and `afterSeatBoard` form the shared seat-board view; optional `boardStatus` is the game's data for the one status bar, which only the shell renders. Optional visual content is explicitly `null`.
- `workspace`: `element` supplies one game-owned workspace. Seat-board slots are not accepted and are not silently ignored.
- `stage`: an in-play stage ([room-stage-layout-design.md](room-stage-layout-design.md)). `hud` (`RoomStageHudModel`) declares the information bar — game chips, the roster chip, the countdown and optional secondary chips — and `element` fills the remaining height, usually a `RoomTaskFrame` whose footer is the game's own dock. Optional `hudAction` is game-owned and rendered in the secondary information row; the shared shell does not interpret its behavior.

Stage content keeps its game-owned workspace and HUD while using the shared menu surface:

- **Stage menu in the header.** Every viewer can open the shared menu from `roomStageMenuButton`; there is no bottom panel. A stage model must have empty player actions, `hostManagement.task === null` and no narration; `assertRoomStageShellModel` throws otherwise.

`actionSurface: 'menu'` projects a directory-backed menu at the room's bottom edge, outside
the game element. It uses the current authorized stage actions (for example `abortGame`)
without duplicating their confirmation or command. Manual and configuration entries come from
the same directory as the main hand; dialogs open over the menu. Leaving the stage removes the
menu and restores the normal hand.
The new-game skeleton follows this hand/manual split: identity games keep the public
board in the pre-game seat view, while a non-identity game's playing workspace uses
the stage menu. Its guide page and room dialog share one guide body. Game authors
must wire their actual phase-specific actions and public configuration when completing
the generated gameplay; the skeleton does not infer them.

- **Takeover in the information bar.** An active bot takeover renders as the bar's 「代 N 号 · 退出」 chip (`controlledSeatBanner` / `controlledSeatReleaseButton`) instead of the banner. Taking a bot over starts from the roster sheet: bot rows that are not done carry 「接管」 while `canTakeOverBots` is allowed and no seat is controlled.
- **Roster from the seat source.** `groupRoomStageRoster` groups occupied seats from `RoomSeatDataSource`: the declared acting seat, success-toned status badges as done, everything else pending. Games compute the chip summary from the same grouping and never pass a second seat list.

Werewolf, FibKing and Undercover use `seats`. Pictionary, Story Relay and DrawGuess use `seats` in their lobbies, `stage` in active phases (DrawGuess word select, drawing and round end; Pictionary and Story Relay answering, transition and settling), and `workspace` for gallery and ended screens. Header actions, host management and game overlays remain independent of this choice. The shared host hand is used in place of a sheet or wide-screen inspector.

This contract changes no game rules, session lifetime, viewport breakpoints, seat layout, or overlay behavior. It removes the implicit `gameWorkspace === null` mode switch and the redundant lobby props previously passed during Pictionary gameplay.

The union type rejects mixed or incomplete content at compile time; `src/features/room/components/__tests__/RoomShell.stage.test.tsx` pins the stage variant's header entry, missing bottom panel, takeover chip and fail-fast guard. Browser room tests cover the rendered game flows.

Game-owned workspaces are not exempt from the visual contract: toolbars, status, timers,
selection, waiting, retry and results use the shared hierarchy and theme. Preserve domain
behavior such as canvas gestures and automatic submission. Relay inputs live only in the current page and turn; refreshing or leaving discards unsubmitted input. `RoomTaskViewport` keeps task content and completion actions above native and web keyboards. Pictionary's guide action is lobby-only;
do not insert it into the drawing/task workspace. Define guide visibility explicitly for new games.

Relay host commands such as abort-round belong in the host-management panel, not a second footer in the task workspace. Writing and drawing enter collection automatically when all seats are ready or the deadline expires; there is no host command to force collection. Story Relay keeps the writing workspace fixed; previous text and the editor scroll internally. Completed stories remain scrollable for reading.

## New-Game Acceptance Checklist

Before implementation, record the target game's applicable surfaces and their existing shared
owners. Before declaring completion, record evidence for each applicable row below. Mark an
inapplicable surface explicitly with its reason rather than silently omitting it.

| Area             | Required review                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Config           | Create/edit modes; full controls, limits, editable values, selections, fixed submit and pending state          |
| Lobby            | Summary/guide, long names, empty/occupied seats, own seat, spectators, host and bot controls                   |
| Active phases    | Each materially different phase; personal vs host actions; private vs public information                       |
| Overlays         | Open/close/cancel/confirm, dismissal while submitting, scrollable long content, fixed actions                  |
| Recovery/results | Loading, empty, failure/retry, connection recovery and final results where supported                           |
| Review           | Document per reviewable phase (ended / aborted); entry per audience; paging; export, drawing failure and retry |
| Layout           | Representative narrow mobile and desktop; keyboard, long text, text scaling, no overlap or horizontal overflow |

Verification has distinct layers:

1. Run focused behavior/type/lint checks while editing. Reuse existing tests and helpers.
2. Test shared-control geometry and callback contracts for the variants actually supported;
   the editable/display-only count regression belongs in `src/components/__tests__/GameScreen.test.tsx`.
   Room-shell variant contracts remain in `type-tests/roomShellContent.tsx`.
3. Add the new game's applicable create/join/config/guide/core-flow coverage to existing E2E
   conventions. Assert visible behavior, not only the presence of a shared component import.
4. Consolidate necessary browser acceptance into one representative mobile/desktop pass;
   do not repeat screenshots after each edit. Verify actual dimensions, content and interaction,
   including input vs text rendering where relevant. Unrun visual checks remain unverified.
5. Run `pnpm run quality` for the repository gate. It does not run browser E2E and does not
   establish visual equivalence. `sync:agents:check` checks generated instruction drift only,
   not whether a new game's UI matches this contract.

When changing a shared contract, inspect all consumers and update the owner, relevant tests
and this document together. A new game must not copy a control merely to bypass a missing
capability; identify the missing capability and agree its ownership first.
