import type { RevealKind } from '../../../models/roles/spec';
import type { RevealExecutor } from '../revealExecutors';
import {
  createRevealExecutors,
  REVEAL_KIND_ORDER,
  revealExecutorsKeys,
} from '../revealExecutors';

// Contract: RoomScreen reveal execution is table-driven.
// If we add/remove a RevealKind, we must update the executor table accordingly,
// otherwise reveal flows can silently break.

describe('RoomScreen reveal executor table contract', () => {
  it('covers every RevealKind (and only RevealKind)', () => {
    // Keep this list explicit like other contract tests (reveal is sensitive).
    // We assert it both at type-level (must be RevealKind) and runtime (exact set).
    const executorKeys = ['seer', 'psychic', 'gargoyle', 'wolfRobot'] as const;

    // Type-level: ensure the explicit list stays aligned with RevealKind.
    const _typecheck: readonly RevealKind[] = executorKeys;
    expect(_typecheck.length).toBe(executorKeys.length);

    // Runtime: keep deterministic and hard-fail on drift.
    const expectedRevealKinds = ['gargoyle', 'psychic', 'seer', 'wolfRobot'];
    expect([...executorKeys].sort()).toEqual(expectedRevealKinds);

    // And assert that the revealExecutors module's canonical order stays aligned.
    expect([...REVEAL_KIND_ORDER].sort()).toEqual(expectedRevealKinds);

    // Finally: build a real executor table via createRevealExecutors and assert key coverage.
    const sampleExecutors = createRevealExecutors({
      seer: { wait: async () => null, ack: () => undefined, timeoutLog: 'seerReveal' },
      psychic: { wait: async () => null, ack: () => undefined, timeoutLog: 'psychicReveal' },
      gargoyle: { wait: async () => null, ack: () => undefined, timeoutLog: 'gargoyleReveal' },
      wolfRobot: { wait: async () => null, ack: () => undefined, timeoutLog: 'wolfRobotReveal' },
    } satisfies Record<RevealKind, RevealExecutor>);

    expect(revealExecutorsKeys(sampleExecutors).sort()).toEqual(expectedRevealKinds);
  });
});
