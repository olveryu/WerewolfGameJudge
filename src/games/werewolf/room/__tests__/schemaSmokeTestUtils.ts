/**
 * Thin adapter over the board harness for the per-schema smoke and the
 * schema-contract UI tests: same real-state mock, the older option names.
 */

import type { GameState, RoleId, SchemaId } from '@game-judge/game-engine/games/werewolf/public';

import {
  createWerewolfRoomMock,
  type SubmitActionMock,
  type WerewolfRoomMock,
} from '@/games/werewolf/room/__tests__/harness/boardTestUtils';

export { mockNavigation, mockRoom } from '@/games/werewolf/room/__tests__/harness/boardTestUtils';

interface CreateBaseWerewolfRoomMockOptions {
  readonly schemaId: SchemaId;
  readonly currentActionRole: RoleId;
  readonly myRole: RoleId;
  readonly mySeat?: number;
  readonly numberOfPlayers?: number;
  readonly roleAssignments?: Map<number, RoleId>;
  readonly overrides?: { readonly submitAction?: SubmitActionMock };
  readonly gameStateOverrides?: Partial<GameState>;
}

export function createBaseWerewolfRoomMock(
  options: CreateBaseWerewolfRoomMockOptions,
): WerewolfRoomMock {
  return createWerewolfRoomMock({
    schemaId: options.schemaId,
    currentActionRole: options.currentActionRole,
    myRole: options.myRole,
    mySeat: options.mySeat,
    numberOfPlayers: options.numberOfPlayers,
    roleAssignments: options.roleAssignments,
    gameStateOverrides: options.gameStateOverrides,
    hookOverrides: { submitAction: options.overrides?.submitAction },
  });
}
