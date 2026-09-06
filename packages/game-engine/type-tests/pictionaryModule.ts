/** Compile-only game engine proving that authoring is independent of production identity. */

import { reject } from '../src/platform/engine/decision';
import type { GameEngineDefinition } from '../src/platform/engine/types';
import type { GameType } from '../src/platform/protocol/gameTypes';
import type { GameStateCodec } from '../src/platform/protocol/roomSnapshot';
import type { BaseGameState } from '../src/platform/protocol/roomSnapshot';

export const UNREGISTERED_GAME_TYPE = 'unregistered-example' as const;

export interface PictionaryState extends BaseGameState<typeof UNREGISTERED_GAME_TYPE> {
  readonly round: number;
}

export interface PictionaryConfig {
  readonly maxPlayers: number;
}

export type PictionaryPublicCommand = {
  readonly type: 'pictionary.round.start';
};

export type PictionaryInternalCommand = {
  readonly type: 'pictionary.prompt.ready';
  readonly prompt: string;
};

export type PictionaryCommand = PictionaryPublicCommand | PictionaryInternalCommand;

export interface PictionaryEvent {
  readonly type: 'pictionary.round.started';
}

export interface PictionaryEffect {
  readonly type: 'pictionary.prompt.generate';
  readonly roundId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePictionaryState(value: unknown): PictionaryState {
  if (!isRecord(value)) throw new Error('Pictionary state must be an object');
  if (value.gameType !== UNREGISTERED_GAME_TYPE) {
    throw new Error('Pictionary state has an invalid game type');
  }
  if (value.stateVersion !== 1) throw new Error('Pictionary state has an invalid version');
  if (typeof value.roomCode !== 'string' || value.roomCode.length === 0) {
    throw new Error('Pictionary state requires a room code');
  }
  if (typeof value.hostUserId !== 'string' || value.hostUserId.length === 0) {
    throw new Error('Pictionary state requires a host user');
  }
  if (typeof value.round !== 'number' || !Number.isSafeInteger(value.round) || value.round < 0) {
    throw new Error('Pictionary state has an invalid round');
  }
  return {
    gameType: UNREGISTERED_GAME_TYPE,
    stateVersion: 1,
    roomCode: value.roomCode,
    hostUserId: value.hostUserId,
    round: value.round,
  };
}

export const pictionaryStateCodec = {
  gameType: UNREGISTERED_GAME_TYPE,
  stateVersion: 1,
  parse: parsePictionaryState,
} satisfies GameStateCodec<PictionaryState>;

export const pictionaryEngine = {
  gameType: UNREGISTERED_GAME_TYPE,
  stateVersion: 1,
  createInitialState(_config, context) {
    return {
      gameType: UNREGISTERED_GAME_TYPE,
      stateVersion: 1,
      roomCode: context.roomCode,
      hostUserId: context.hostUserId,
      round: 0,
    };
  },
  decide(_state, _command) {
    return reject('COMPILE_ONLY_GAME');
  },
  evolve(state, _event) {
    return state;
  },
  normalize(state) {
    return state;
  },
  getLifecycle() {
    return 'setup' as const;
  },
} satisfies GameEngineDefinition<
  typeof UNREGISTERED_GAME_TYPE,
  PictionaryState,
  PictionaryConfig,
  PictionaryCommand,
  PictionaryEvent,
  PictionaryEffect
>;

// @ts-expect-error compile-only game identity is not a registered production GameType
const productionGameType: GameType = UNREGISTERED_GAME_TYPE;
void productionGameType;
