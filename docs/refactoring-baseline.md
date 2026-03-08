# Refactoring Baseline Metrics

> Snapshot date: 2026-03-07
> Branch: `feature/refactor_1` (based on `main`)

## Coverage

| Metric     | Value  |
| ---------- | ------ |
| Statements | 55.58% |
| Branches   | 51.96% |
| Functions  | 49.61% |
| Lines      | 54.48% |

## Top 20 Files by Line Count (excl. RoleRevealEffects)

| #   | Lines | File                                                                |
| --- | ----- | ------------------------------------------------------------------- |
| 1   | 791   | `src/screens/RoomScreen/hooks/useRoomScreenState.ts`                |
| 2   | 768   | `src/screens/ConfigScreen/components/styles.ts`                     |
| 3   | 761   | `src/screens/RoomScreen/hooks/useActionOrchestrator.ts`             |
| 4   | 656   | `packages/game-engine/src/engine/handlers/actionHandler.ts`         |
| 5   | 648   | `src/services/facade/GameFacade.ts`                                 |
| 6   | 640   | `packages/game-engine/src/engine/reducer/gameReducer.ts`            |
| 7   | 634   | `src/components/AIChatBubble/AIChatBubble.styles.ts`                |
| 8   | 629   | `packages/game-engine/src/engine/handlers/stepTransitionHandler.ts` |
| 9   | 603   | `src/services/facade/gameActions.ts`                                |
| 10  | 577   | `src/screens/ConfigScreen/useConfigScreenState.ts`                  |
| 11  | 573   | `src/screens/RoomScreen/components/styles.ts`                       |
| 12  | 561   | `src/screens/RoomScreen/RoomScreen.tsx`                             |
| 13  | 540   | `src/screens/RoomScreen/hooks/useRoomActions.ts`                    |
| 14  | 517   | `src/components/AIChatBubble/quickQuestions.ts`                     |
| 15  | 499   | `src/screens/HomeScreen/HomeScreen.tsx`                             |
| 16  | 468   | `packages/game-engine/src/models/roles/spec/specs.ts`               |
| 17  | 449   | `packages/game-engine/src/engine/handlers/gameControlHandler.ts`    |
| 18  | 436   | `src/screens/RoomScreen/RoomScreen.helpers.ts`                      |
| 19  | 430   | `src/screens/RoomScreen/hooks/useInteractionDispatcher.ts`          |
| 20  | 428   | `packages/game-engine/src/models/roles/spec/schemas.ts`             |

## Hook Complexity — `useRoomScreenState.ts`

| Metric                    | Count      |
| ------------------------- | ---------- |
| `useState`                | 10         |
| `useEffect`               | 6          |
| `useMemo` + `useCallback` | 17         |
| Return object fields      | ~110 lines |

## Error Handling Distribution

| Pattern                           | Count (prod files) |
| --------------------------------- | ------------------ |
| `Sentry.captureException`         | 35                 |
| `isAbortError` guards             | 37                 |
| `showAlert` calls (excl. imports) | 68                 |

## Import Patterns — game-engine

| Metric                    | Count |
| ------------------------- | ----- |
| Deep imports (non-test)   | 141   |
| Deep imports (incl. test) | 324   |
| Barrel imports            | 6     |

### Deep Import Sub-module Distribution (non-test)

| Module                      | Count |
| --------------------------- | ----- |
| `models/roles`              | 56    |
| `models/GameStatus`         | 21    |
| `models/Template`           | 14    |
| `types/RoleRevealAnimation` | 12    |
| `protocol/types`            | 9     |
| `engine/store`              | 8     |
| `models/actions`            | 7     |
| `utils/random`              | 5     |
| `utils/id`                  | 3     |
| `utils/shuffle`             | 2     |
| `engine/state`              | 2     |
| `utils/audioKeyOverride`    | 1     |
| `resolvers/types`           | 1     |

## RoleRevealEffects

| Metric         | Value  |
| -------------- | ------ |
| Files (TS/TSX) | 37     |
| Total lines    | 10,160 |

## IGameFacade

| Metric  | Value |
| ------- | ----- |
| Lines   | 258   |
| Methods | 35    |

## Test Suite

| Metric           | Value |
| ---------------- | ----- |
| Unit test suites | 212+  |
| E2E specs        | 17    |
