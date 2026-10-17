/**
 * FibKing guidance matrix: every (phase × viewer) cell declared in
 * fibGuidanceMatrix.ts is held true against createFibBottomActions,
 * using the same hand-built state literals as fibRoomAdapter.test.ts
 * (this game's established adapter-test idiom).
 */
import {
  FIB_STATE_VERSION,
  type FibPhase,
  type FibRound,
  type FibState,
} from '@game-judge/game-engine/games/fibking/public';

import { FIBKING_GUIDANCE_MATRIX } from '../fibGuidanceMatrix';
import { createFibBottomActions } from '../fibRoomAdapter';

const FIB_PHASES: readonly FibPhase[] = [
  'lobby',
  'preparing',
  'preparationFailed',
  'viewing',
  'ongoing',
  'ended',
];

function baseRound(viewedSeats: readonly number[]): FibRound {
  return {
    roundId: 'round-1',
    word: '山谷',
    definition: {
      coreMeaning: '两山之间低洼而且狭长的自然地形区域。',
      usageNote: '常用于描述山地之间可供河流或道路穿行的低地。',
    },
    source: 'local',
    roles: { guesserSeat: 1, honestSeat: 2 },
    viewedSeats,
    guesses: [],
  };
}

function stateFor(phase: FibPhase): FibState {
  const base = {
    gameType: 'fibking' as const,
    stateVersion: FIB_STATE_VERSION,
    roomCode: '4321',
    hostUserId: 'host',
    numberOfPlayers: 4,
    roster: {
      0: { userId: 'host', seat: 0, profile: { displayName: '房主' } },
      1: { userId: 'u1', seat: 1, profile: { displayName: 'P1' } },
    },
    usedWords: [],
  };
  switch (phase) {
    case 'lobby':
      return { ...base, phase, pendingRound: null, preparationFailure: null, round: null };
    case 'preparing':
      return {
        ...base,
        phase,
        pendingRound: { roundId: 'round-1', requestedAt: 1, stage: 'selecting' },
        preparationFailure: null,
        round: null,
      };
    case 'preparationFailed':
      return {
        ...base,
        phase,
        pendingRound: null,
        preparationFailure: {
          roundId: 'round-1',
          requestedAt: 1,
          failedAt: 8_001,
          failureCode: 'selectionFailed',
        },
        round: null,
      };
    case 'viewing':
      return {
        ...base,
        phase,
        pendingRound: null,
        preparationFailure: null,
        round: baseRound([]),
      };
    case 'ongoing':
      return {
        ...base,
        phase,
        pendingRound: null,
        preparationFailure: null,
        round: baseRound([0, 1, 2, 3]),
      };
    case 'ended':
      return {
        ...base,
        phase,
        pendingRound: null,
        preparationFailure: null,
        round: baseRound([0, 1, 2, 3]),
      };
  }
}

type Viewer = 'host' | 'seated' | 'spectator';

function bottomMessage(state: FibState, viewer: Viewer): string | null {
  return createFibBottomActions({
    state,
    isHost: viewer === 'host',
    viewerSeat: viewer === 'host' ? 0 : viewer === 'seated' ? 1 : null,
    openIdentity: jest.fn(),
  }).message;
}

describe('FIBKING_GUIDANCE_MATRIX', () => {
  it('covers exactly the FibPhase union, each exempt cell with a reason', () => {
    expect(Object.keys(FIBKING_GUIDANCE_MATRIX).sort()).toEqual([...FIB_PHASES].sort());
    for (const row of Object.values(FIBKING_GUIDANCE_MATRIX)) {
      for (const cell of Object.values(row)) {
        if (cell.kind === 'exempt') expect(cell.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(FIB_PHASES)('holds every viewer cell in phase %s', (phase) => {
    const state = stateFor(phase);
    for (const viewer of ['host', 'seated', 'spectator'] as const) {
      const cell = FIBKING_GUIDANCE_MATRIX[phase][viewer];
      const message = bottomMessage(state, viewer);
      if (cell.kind === 'message') {
        if (typeof message !== 'string' || message === '') {
          throw new Error(
            `${phase} x ${viewer}: declared a message cell, got ${JSON.stringify(message)}`,
          );
        }
      } else if (message !== null) {
        throw new Error(
          `${phase} x ${viewer}: declared exempt (${cell.reason}), got ${JSON.stringify(message)}`,
        );
      }
    }
  });
});
