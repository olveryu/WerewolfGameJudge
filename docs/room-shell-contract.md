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
| Room title, subtitle and guide action        | `src/features/room/components/RoomGameSummary.tsx`                                                   | Public summary and navigation; visible action label is `玩法`                                                                                             |
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
- `GameSettingsStepper` accepts `value`, `onChangeText`, `testID`, `onDecrement`, `onIncrement`,
  `isDecrementDisabled` and `isIncrementDisabled`. `GameSettingsChoice` is the radio-pill group
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

Demo, Avalon, DrawGuess and Story Relay share their standard setup composition:

- `src/features/room/controllers/useRoomSetupController.ts` composes the roster controller with
  standard setup capabilities and setup-only profile viewing. Games supply
  lifecycle facts, occupancy, bot support and configuration/share callbacks; they do not repeat
  the controller-to-capability wiring.
- `src/features/room/controllers/createRoomSeatPressHandler.ts` executes setup seat intents and
  delegates unconsumed in-game taps to the shared adjudicator. Games keep their profile-target
  resolvers. Avalon consumes game-specific seat picks before calling this handler.
- Bot takeover, role viewing, deadlines, gameplay commands and shell projections remain game-owned.
  Sharing roster controllers does not require replacing game-owned capability factories or click policies.

The new-game room hook template emits both shared bindings. Update that template with Demo so
new games do not regenerate copies of the execution branches or controller wiring.

## Shell Model Assembly

All eight game adapters use `src/features/room/model/createRoomShellModel.ts` to assemble
the public shell fields and seat board. Game adapter inputs inherit the shared contract,
omitting fields that the game computes rather than duplicating common field declarations.
The factory copies only declared output fields; spreading a game adapter input into it does
not expose game state, controllers or private projection inputs on the returned model.

- `RoomShellModelInput` accepts standard header callbacks and gacha status; the factory delegates
  header construction to `buildRoomHeaderModel`.
- `RoomShellModelWithHeaderInput` accepts a complete header. Werewolf retains its precomputed
  ticket count and avatar callback instead of reconstructing gacha state.
- Games supply authoritative `phase` and nullable `step`, the `viewer`, seat-source projections,
  profile and confirmation models, bottom actions, a lazy `buildHostManagement`, and
  bot-control projections. The factory does not infer phases, lock seats or decide
  permissions; it does enforce action ownership (see "Action Ownership" below).
- The new-game adapter template uses the same factory and input contract as Demo.

### Narration Status

`RoomShellModel.isAudioPlaying` is a required presentation input. Games with narration project
the authoritative room snapshot's playback flag; games without narration explicitly supply
`false`. Never derive this shared status from the host device's local audio player or introduce
another stored playback flag.

`RoomShell` forwards the flag to `RoomBottomActionPanel`, which owns the narration text and its
position for hosts, players and spectators, in both stacked and dock layouts. Narration remains
visible without buttons, preserves progress, and does not replace game-owned guidance or step
navigation. The text disappears when the authoritative flag clears. Games must not place the
same narration text in their own message or an inert button.

The flag does not disable actions in the renderer. Games retain their existing interaction
policies: Werewolf hides its night action guidance and actions during playback; Avalon allows
night information confirmation alongside narration. Host-management audio locks remain separate.

The adapter generator binds `state.isAudioPlaying` when `audioOrchestration` is enabled and
emits `false` otherwise. Demo stays the no-audio reference. Generator acceptance executes the
audio-enabled output's queue-to-shell-to-panel and acknowledgement transition, as well as the
existing preset checks and Demo parity.

### Avalon Host Controls and Music

Avalon uses the shared host-management surface for role assignment, bot identity viewing,
start, review, next round and return to lobby. During an unfinished game it also exposes
abort, plus bot confirmation when the current night step has unconfirmed bot participants.
Host commands remain subject to submission and narration locks. Setup controls do not become
available during play, and vote/quest settlement remains automatic.

`avalon.game.abort` resets the current game to lobby, preserving seats, configuration and
game sequence without emitting a winner or reward settlement. `avalon.bots.markAllBotsGroupConfirmed`
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

### Room Action Hierarchy

- All games use the shared bottom panel for status, current actions and persistent tools,
  with a separated host-management block. Hosting is an additional capability, not a
  replacement for the user's player or spectator actions.
- Waiting and narration are status messages, never inert primary buttons. A dock may have
  no primary action. Real unavailable commands retain their disabled state and reason.
- Emphasis follows intent, not array order: confirmation is primary; cancellation, optional
  alternatives and repeated viewing are secondary. Equal game choices keep equal emphasis.
- Identity viewing stays primary during the viewing step and secondary afterward. It remains
  a labelled button, not a borderless action. Review tools use labelled icons. Games retain
  their existing visibility and information permissions, including spectator permissions.
- When a current primary action is available or submitting, host advancement remains reachable
  with secondary emphasis. The management entry is always neutral. Advancement uses its action
  label without a generic next-step prefix. Dangerous commands retain explicit danger semantics.
- Room buttons share the existing capsule geometry and md sizing. Tool hit targets are at
  least 44 logical pixels; secondary and tool rows wrap on narrow screens. Management sheets
  use the same secondary fill as the bottom panel. Do not override geometry or color by role.
- Server hint applicability is resolved once for the actor's effective role. Restricted-action
  reasons render as status text; their confirmation buttons keep short action labels and the
  original submission intent. Narration status preserves the authoritative progress row.

### Action Ownership

Who sees which button, and how the host learns what to do next, is a declared,
machine-checked contract — not a per-game convention.

**Viewer identity.** `RoomShellModel.viewer` (`src/features/room/model/RoomViewer.ts`) is the
one identity declaration: `{ userId, isHost, seat }`. `isHost` and `seat` stay separate axes —
a host may be unseated (Avalon, Story Relay) or must be seated (Werewolf). Bot takeover is not
identity; it widens the _effective seat_ (`resolveEffectiveSeat(viewer, controlledSeat)`).
`resolveRoomViewerAudience` projects the two axes to the three-way audience every per-viewer
contract matches on: `host` → `seated` → `spectator`. The guidance matrix, Werewolf's layout
rules and every test fixture (`src/test-utils/roomViewer.ts: viewerFor`) use this projection;
no game re-derives it.

**Two surfaces, two owners.**

| Surface                              | Holds                                                                                                                                                                                       | Audience                                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hostManagement` (task card + sheet) | **Every host command, and only host commands.** Start / assign / begin gates, bot scaffolds, abort / restart, closing, room setup, post-game tools, host-owned local modes and their exits. | `viewer.isHost` only. Built lazily by `buildHostManagement`; `createRoomShellModel` calls it for the host and sets `null` otherwise. Games never write `if (!isHost) return null`.                                  |
| `bottomActions` (stacked / dock)     | The viewer's **own** actions as a participant or spectator.                                                                                                                                 | Every button declares `audience: 'participant' \| 'anyone'`. `participant` requires an effective seat; `anyone` is open to spectators. There is no host audience: a host command never renders on the bottom panel. |

`createRoomShellModel` checks every bottom button against the viewer and throws on a violation.
A seated host receives both surfaces stacked: their own participant buttons, then the host
card. They are never merged and the renderer never reads role.

Content-local host controls that belong to a game workspace (gallery playback, a drawer's
give-up, board-nomination adopt, the BGM toggle) stay in that workspace; the flow commands
(finish step, abort, next round) do not — see the Story Relay rule below.

#### Host Task

The host's "what do I do now" has exactly one home: the **host task**, declared by the game on
`RoomHostManagementModel.task` and rendered by the shell as the **host task card**.

```ts
interface RoomHostManagementModel {
  /** The one thing the host should do now; null when nothing awaits the host. */
  readonly task: RoomHostTask | null;
  /** The complete command inventory (the sheet). Every host command's onPress lives here. */
  readonly sections: readonly RoomHostManagementSection[];
}

type RoomHostTask = {
  /** Multi-step flow progress; omitted for a single step. At most one `current`. */
  readonly steps?: readonly RoomHostTaskStep[];
  /** Reminder rendered under the task (e.g. 记得把复盘分享给第一天出局的玩家). */
  readonly note?: string;
  /** A concrete remedy for a blocked action (e.g. 分享房间), referenced by key. */
  readonly remedyActionKey?: string;
} & (
  | { readonly kind: 'action'; readonly actionKey: string }
  | { readonly kind: 'choice'; readonly actionKeys: readonly string[] }
  | { readonly kind: 'message'; readonly text: string; readonly actionKey?: string }
);

interface RoomHostTaskStep {
  readonly key: string;
  readonly label: string;
  readonly state: 'complete' | 'current' | 'upcoming';
  /** A completed step may be revisited through this sheet action. */
  readonly actionKey?: string;
}
```

Rules:

- **A task has no `onPress`.** It references sheet actions by `key`; the renderer resolves the
  action's handler, enabled state and disabled reason from the sheet. One command, one
  execution path — guaranteed by the type shape, not by review.
- `action`: do this one thing. If the referenced action is disabled, the card shows its label,
  its `disabledReason` and the optional remedy button. There is no separate "console blocked
  reason": an action that is not ready is disabled in the sheet with the same reason.
- `choice`: two or more equal options (再来一局 / 返回大厅). Rendered side by side with each
  action's own variant. Never model equal choices as one primary and one buried option.
- `message`: the host is waiting on others or following a board instruction
  (正在等待 3 位玩家查看身份 / 点座位盘选择出局玩家). The optional `actionKey` is the
  secondary escape (标记机器人已查看 / 取消选择).
- `task === null`: nothing awaits the host; the card shows only the sheet entry.
- Actions no longer carry `isPrimary`, `remedy` or `consoleBlockedReason`; the model no longer
  carries `hasPendingAction`. All of that is the task.
- `resolveHostTaskView` validates at assembly and throws on: an `actionKey` missing from the
  sections, a `choice` with fewer than two keys, more than one `current` step.

**Host task card** — inside the bottom panel, below the viewer's own actions, in every layout.
The sheet (narrow) / side inspector (wide) opens on demand from the card's entry row and holds
the inventory; the card is the only always-visible host surface:

```
┌ 主持 ────────────────────────────────┐
│ ✓昨夜信息 → ●本局复盘 → 收尾          │  steps (only when present)
│ 本局复盘                      [打开 →]│  action / choice / message
│ 记得把复盘分享给第一天出局的玩家        │  note
│ 全部操作                           ›  │  sheet entry (no pending badge; the card is the signal)
└──────────────────────────────────────┘
```

Test anchors are stable: the task's action button carries `roomNextStepButton`, its remedy
`roomNextStepRemedyButton`, the entry `roomHostManagementButton`.

**Phase × task across games** (the declared mapping; each game's host-management test pins it):

| Phase                                   | Task                                                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lobby / setup                           | `action: start-game \| assign-roles` (seat shortage → disabled reason + `remedyActionKey: share-room`)                                                                                                 |
| Identity viewing                        | `action: start-game` — blocked by the viewing-progress reason until every seat viewed; `remedyActionKey: mark-bots-viewed` while an unviewed bot seat exists                                           |
| In play, host advance available         | `action: <game advance key>`                                                                                                                                                                           |
| In play, waiting on players             | `message: <waiting sentence>`                                                                                                                                                                          |
| Host-owned local mode (Undercover pick) | `message: 点座位盘选择出局玩家`, `actionKey: cancel-selection`                                                                                                                                         |
| Werewolf Day, info unconfirmed          | `choice: [sheriff-advance, last-night-info]` with steps while the election offers an advance (a self-destruct can end it early); during votes `action: last-night-info` with the vote progress as note |
| Werewolf Day, info confirmed            | The election's own task (`sheriff-advance`, or a vote-waiting message); `null` once completed                                                                                                          |
| Werewolf Ended                          | `last-night-info` → `night-review` (note = share reminder, completes once shared) → `choice: [next-round, return-lobby]`; steps shown throughout                                                       |
| Ended (other games)                     | `choice: [next-round, return-lobby]`                                                                                                                                                                   |
| Pictionary / Story Relay, cannot abort  | `null`; the sheet stays present with abort disabled and its reason (the host panel is never hidden mid-game)                                                                                           |

The bottom panel carries **no** host flow: no step bar, no hint, no host buttons. Werewolf's
bottom host rules keep only the participant actions (view identity); the review stays a bottom
`anyone` tool for shared seats and spectators, and reaches the host through the task card and
sheet. The sheriff dock therefore has no trailing review tool for the host.

`RoomShell` owns the shared header, connection/status ribbon, seat control banner, bottom actions, profile, invitation, and host-management surfaces. Game screens provide models and content, not another copy of those surfaces.

`content` is an explicit discriminated union:

- `seats`: `contextHeader`, `beforeSeatBoard`, `afterSeatBoard`, and `sideInspector` form the shared seat-board view. Optional visual content is explicitly `null`.
- `workspace`: `element` supplies one game-owned workspace. Seat-board slots are not accepted and are not silently ignored.

Werewolf, FibKing and Undercover use `seats`. Pictionary and Story Relay use `seats` in their lobbies and `workspace` in active phases. Header actions, host-management panels and game overlays remain independent of this choice. Both content variants render the wide-screen host inspector; narrow screens use the existing sheet.

This contract changes no game rules, session lifetime, viewport breakpoints, seat layout, or overlay behavior. It removes the implicit `gameWorkspace === null` mode switch and the redundant lobby props previously passed during Pictionary gameplay.

`type-tests/roomShellContent.tsx` checks both valid variants and rejects mixed or incomplete content. Browser room tests cover the rendered game flows.

Game-owned workspaces are not exempt from the visual contract: toolbars, status, timers,
selection, waiting, retry and results use the shared hierarchy and theme. Preserve domain
behavior such as canvas gestures and automatic submission. Relay inputs live only in the current page and turn; refreshing or leaving discards unsubmitted input. `RoomTaskViewport` keeps task content and completion actions above native and web keyboards. Pictionary's guide action is lobby-only;
do not insert it into the drawing/task workspace. Define guide visibility explicitly for new games.

Relay host commands such as finish-step and abort-round belong in the host-management panel, not a second footer in the task workspace. Story Relay keeps the writing workspace fixed; previous text and the editor scroll internally. Completed stories remain scrollable for reading.

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
