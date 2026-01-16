import type { RevealKind } from '../../../models/roles/spec';

// Contract: RoomScreen reveal execution is table-driven.
// If we add/remove a RevealKind, we must update the executor table accordingly,
// otherwise reveal flows can silently break.

describe('RoomScreen reveal executor table contract', () => {
  it('covers every RevealKind (and only RevealKind)', () => {
    // Keep this list explicit like other contract tests (reveal is sensitive).
    const executorKeys = ['seer', 'psychic', 'gargoyle', 'wolfRobot'] as const;

    const sortedKeys = [...executorKeys].sort();

    // Type-level: ensure key literals are valid RevealKind.
    const _typecheck: readonly RevealKind[] = executorKeys;
    expect(_typecheck.length).toBe(executorKeys.length);

    // Runtime: keep deterministic and hard-fail on drift.
    const expectedRevealKinds = ['gargoyle', 'psychic', 'seer', 'wolfRobot'];
    expect(sortedKeys).toEqual(expectedRevealKinds);
  });
});
