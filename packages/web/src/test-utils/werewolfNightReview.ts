/**
 * Review-oriented Werewolf GameState fixtures for client tests.
 *
 * The night report reads the settled night, so the fixture plays a real
 * night through engine commands instead of assembling state by hand.
 */

import type { GameState, RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { STEP_SKIP_ACTION_KEY } from '@game-judge/game-engine/platform/steps';

import { playBoardNight } from '@/games/werewolf/room/__tests__/harness/boardNightScenarios';

import type { ReviewTestRounds } from './reviewTestRounds';
import { buildWerewolfTestState } from './werewolfState';

/** Five seats: 1号 wolf, 2号 guard, 3号 witch, 4号 seer, 5号 villager. */
const FIVE_SEAT_ROLES: readonly RoleId[] = ['wolf', 'guard', 'witch', 'seer', 'villager'];

const SKIP = { actionKey: STEP_SKIP_ACTION_KEY } as const;

/**
 * The five seats after a first night in which only the wolf acted and
 * closed on 5号; at Day unless overridden.
 */
export function makeSettledNightState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...playBoardNight(
      FIVE_SEAT_ROLES,
      {
        guardProtect: SKIP,
        wolfKill: { actionKey: 'wolfKill', seats: [4] },
        witchAction: SKIP,
        seerCheck: SKIP,
      },
      new Map(FIVE_SEAT_ROLES.map((roleId, seat) => [seat, roleId])),
    ),
    status: GameStatus.Day,
    ...overrides,
  };
}

export const WEREWOLF_REVIEW_ROUNDS: ReviewTestRounds<GameState> = {
  lobby: () => buildWerewolfTestState(),
  ended: () => makeSettledNightState({ status: GameStatus.Ended }),
  nextRound: (ended) => ({ ...ended, gameSequence: ended.gameSequence + 1 }),
};
