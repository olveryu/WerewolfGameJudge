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

| Surface                                      | Existing owner                                                 | Caller responsibility                                                                   |
| -------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Page frame, bounded scroll and fixed actions | `src/components/GameScreen.tsx`                                | Header, content and submission intent; actions stay outside scrolling content           |
| Player-count control                         | `src/components/GameSettings.tsx` and `GameSettings.styles.ts` | String value, optional editing callback, increment/decrement callbacks and minimum gate |
| Reading sections and notices                 | `src/components/GameGuide.tsx`                                 | Accurate game-owned rules and tool limitations                                          |
| Room title, subtitle and guide action        | `src/features/room/components/RoomGameSummary.tsx`             | Public summary and navigation; visible action label is `玩法`                           |
| Centered room details                        | `src/features/room/components/RoomDialog.tsx`                  | Title, scrollable details, close intent and fixed footer                                |

- Use the compact Werewolf settings hierarchy. Settings pages configure a game; long gameplay
  explanations belong in the guide. Preserve specialized editors such as Werewolf role selection.
- `GameSettingsStepper` accepts `value`, `onChangeText`, `testID`, `onDecrement`, `onIncrement`
  and `isDecrementDisabled`. It owns both editable and display-only count geometry. Do not
  recreate its center with arbitrary children or copy its styles into game-owned inputs.
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

## Room Content

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
