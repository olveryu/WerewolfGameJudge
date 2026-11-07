/**
 * The Story Relay review contribution: available to every viewer once the
 * round ended or was aborted, shareable, and with nothing to confirm.
 */

import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';

import type { RoomViewer } from '@/features/room/model/RoomViewer';
import { buildStoryRelayTestState, playStoryRelayTestRound } from '@/test-utils/storyrelayState';

import { storyRelayReview } from '../storyRelayReview';

const VIEWERS: readonly RoomViewer[] = [
  { userId: 'host-1', isHost: true, seat: 0 },
  { userId: 'u1', isHost: false, seat: 1 },
  { userId: 'spectator', isHost: false, seat: null },
];

function resolveFor(state: StoryRelayState, viewer: RoomViewer) {
  return storyRelayReview.resolve({ state, viewer, roomCode: 'ABCD' });
}

describe('storyRelayReview', () => {
  const ended = playStoryRelayTestRound();
  const aborted = playStoryRelayTestRound({ abortAtStep: 1 });

  it('has nothing to review before the round ends', () => {
    const states: readonly StoryRelayState[] = [
      buildStoryRelayTestState(),
      { ...ended, phase: 'answering' },
      { ...ended, phase: 'gallery' },
    ];
    for (const state of states) {
      expect(resolveFor(state, VIEWERS[0]!)).toEqual({ kind: 'notEnded' });
    }
  });

  it.each(VIEWERS)(
    'offers ended and aborted rounds to viewer seat $seat to read and share',
    (viewer) => {
      for (const state of [ended, aborted]) {
        const availability = resolveFor(state, viewer);
        if (availability.kind !== 'available') throw new Error('expected an available review');
        expect(availability.sharing).toEqual({ isAllowed: true });
        expect(availability.confirmation).toBeNull();
        expect(availability.document.isAborted).toBe(state.phase === 'aborted');
        expect(availability.document.pages).toHaveLength(state.chains.length);
      }
    },
  );
});
