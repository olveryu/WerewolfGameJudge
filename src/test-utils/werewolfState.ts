/** Canonical minimal Werewolf state for client tests. */

import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus, WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/public';

export function buildWerewolfTestState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'ABCD',
    hostUserId: 'host-1',
    status: GameStatus.Unseated,
    templateRoles: [],
    players: {},
    roster: {},
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    ...overrides,
  };
}
