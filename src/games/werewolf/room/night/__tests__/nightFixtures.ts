/**
 * Night-step GameState fixtures for the night interaction tests: a real
 * engine state at a given step, projected through getWerewolfViewModel
 * for a given viewer — the same path the room hook runs.
 */

import type {
  GameState,
  RoleId,
  SchemaId,
  WerewolfViewModel,
} from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus, getWerewolfViewModel } from '@game-judge/game-engine/games/werewolf/public';

import { buildWerewolfTestState } from '@/test-utils/werewolfState';

export interface NightFixtureOptions {
  readonly roles: readonly RoleId[];
  readonly stepId: SchemaId;
  readonly overrides?: Partial<GameState>;
}

export function nightState({ roles, stepId, overrides }: NightFixtureOptions): GameState {
  const players: GameState['players'] = {};
  const roster: Record<number, GameState['roster'][number]> = {};
  roles.forEach((role, seat) => {
    players[seat] = { seat, role };
    roster[seat] = { seat, userId: `u${seat}`, profile: { displayName: `P${seat}` } };
  });
  return buildWerewolfTestState({
    status: GameStatus.Ongoing,
    templateRoles: [...roles],
    players,
    roster,
    roleViewedSeats: roles.map((_, seat) => seat),
    nightStep: { kind: 'inStep', stepId },
    currentNightResults: {},
    ...overrides,
  });
}

export function viewAs(state: GameState, seat: number | null, isHost = false): WerewolfViewModel {
  return getWerewolfViewModel(state, { seat, isHost });
}
