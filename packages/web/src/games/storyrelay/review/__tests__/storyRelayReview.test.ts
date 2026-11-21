/**
 * The Story Relay review contribution: available to every viewer once the
 * round ends, shareable, and with nothing to confirm.
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

  it.each(VIEWERS)('offers the ended round to viewer seat $seat to read and share', (viewer) => {
    const availability = resolveFor(ended, viewer);
    if (availability.kind !== 'available') throw new Error('expected an available review');
    expect(availability.sharing).toEqual({ isAllowed: true });
    expect(availability.confirmation).toBeNull();
    expect(availability.document.pages).toHaveLength(ended.chains.length);
  });
});
