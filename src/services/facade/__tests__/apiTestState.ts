import {
  createRoomCommandResult,
  type RoomCommandResult,
  WEREWOLF_STATE_IDENTITY,
} from '@werewolf/game-engine';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { GameState } from '@werewolf/game-engine/protocol/types';

export function buildApiTestState(overrides: Partial<GameState> = {}): GameState {
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

export function buildApiCommandSuccess(
  state: GameState = buildApiTestState(),
  revision = 1,
  commandId = 'test-command-id',
): RoomCommandResult<GameState> {
  return createRoomCommandResult({
    kind: 'committed',
    commandId,
    state,
    revision,
    outcome: { kind: 'success' },
  });
}

export function buildApiCommandRejected(
  reason: string,
  commandId = 'test-command-id',
): RoomCommandResult<GameState> {
  return createRoomCommandResult({ kind: 'rejected', commandId, reason });
}
