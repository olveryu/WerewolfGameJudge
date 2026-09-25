/** Story Relay assignment invariants for supported player counts; no IO or state mutation. */

import { createStoryRelayAssignment } from '../domain/assignment';

describe('Story Relay assignment', () => {
  it.each([4, 5, 6, 20])(
    'assigns exactly %i turns without an extra origin turn',
    (numberOfPlayers) => {
      const { seatOrder, stepOffsets } = createStoryRelayAssignment(numberOfPlayers, 'assignment');
      expect(new Set(seatOrder).size).toBe(numberOfPlayers);
      expect(stepOffsets).toHaveLength(numberOfPlayers);
      expect(new Set(stepOffsets).size).toBe(numberOfPlayers);
      for (let chainIndex = 0; chainIndex < numberOfPlayers; chainIndex += 1) {
        const authors = stepOffsets.map(
          (offset) => seatOrder[(chainIndex + offset) % numberOfPlayers],
        );
        expect(authors[0]).toBe(seatOrder[chainIndex]);
        expect(new Set(authors).size).toBe(numberOfPlayers);
      }
      for (const offset of stepOffsets) {
        const authors = seatOrder.map(
          (_, chainIndex) => seatOrder[(chainIndex + offset) % numberOfPlayers],
        );
        expect(new Set(authors).size).toBe(numberOfPlayers);
      }
    },
  );

  it('uses changing handoff offsets and reproducible seeded assignment', () => {
    const assignment = createStoryRelayAssignment(6, 'assignment');
    expect(assignment.stepOffsets).toEqual([0, 1, 5, 2, 4, 3]);
    expect(createStoryRelayAssignment(6, 'assignment')).toEqual(assignment);
    expect(createStoryRelayAssignment(6, 'another-round').seatOrder).not.toEqual(
      assignment.seatOrder,
    );
  });
});
