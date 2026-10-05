/** Unit tests for Pictionary media authorization logic (canReadDrawing). */

import type {
  PictionaryChain,
  PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { describe, expect, it } from 'vitest';

import { canReadDrawing } from '../mediaRoutes';

function createMinimalState(
  phase: PictionaryState['phase'],
  overrides: Partial<PictionaryState> = {},
): PictionaryState {
  return {
    phase,
    phaseRevision: 1,
    config: {
      numberOfPlayers: 4,
      drawingDurationSeconds: null,
      guessDurationSeconds: null,
      transitionDurationSeconds: 0,
      galleryItemDurationSeconds: null,
    },
    realSeats: {},
    fillEmptySeatsWithBots: false,
    excludedBotSeats: [],
    roundNumber: 1,
    roundId: 'test-round',
    participants: [],
    seatOrder: [0, 1, 2, 3],
    stepOffsets: [0],
    stepIndex: 1,
    deadlineAt: null,
    readySeats: [],
    reservations: [],
    chains: [],
    gallery: null,
    ...overrides,
  };
}

function createChainWithDrawing(entryId: string): PictionaryChain {
  return {
    id: 'chain-0',
    entries: [
      {
        kind: 'drawing',
        id: entryId,
        authorSeat: 0,
        media: {
          objectKey: 'test-key',
          contentType: 'image/png',
          width: 800,
          height: 600,
          byteLength: 100,
          sha256: 'abc',
        },
      },
    ],
  };
}

describe('canReadDrawing', () => {
  it('allows anyone in gallery phase', () => {
    const state = createMinimalState('gallery');
    expect(canReadDrawing(state, null, 'entry-1')).toBe(true);
    expect(canReadDrawing(state, 0, 'entry-1')).toBe(true);
  });

  it('allows anyone in ended phase', () => {
    const state = createMinimalState('ended');
    expect(canReadDrawing(state, null, 'entry-1')).toBe(true);
  });

  it('allows anyone in aborted phase', () => {
    const state = createMinimalState('aborted');
    expect(canReadDrawing(state, null, 'entry-1')).toBe(true);
  });

  it('rejects unseated viewer in answering phase', () => {
    const state = createMinimalState('answering', {
      chains: [createChainWithDrawing('entry-1')],
    });
    expect(canReadDrawing(state, null, 'entry-1')).toBe(false);
  });

  it('rejects unseated viewer in settling phase', () => {
    const state = createMinimalState('settling', {
      chains: [createChainWithDrawing('entry-1')],
    });
    expect(canReadDrawing(state, null, 'entry-1')).toBe(false);
  });

  it('rejects in lobby phase even for seated player', () => {
    const state = createMinimalState('lobby');
    expect(canReadDrawing(state, 0, 'entry-1')).toBe(false);
  });

  it('rejects in transition phase even for seated player', () => {
    const state = createMinimalState('transition');
    expect(canReadDrawing(state, 0, 'entry-1')).toBe(false);
  });
});
