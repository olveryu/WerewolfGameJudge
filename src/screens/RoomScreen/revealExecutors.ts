import type { RevealKind } from '../../models/roles/spec';

type RevealPayload = { targetSeat: number; result: string };

export type RevealExecutor = {
  wait: () => Promise<RevealPayload | null>;
  ack: () => void;
  timeoutLog: string;
};

/**
 * Canonical, stable ordering for RevealKind.
 *
 * Keep this list explicit (like other reveal contracts) so reviewer attention is forced
 * any time reveal flows change.
 */
export const REVEAL_KIND_ORDER: readonly RevealKind[] = [
  'seer',
  'psychic',
  'gargoyle',
  'wolfRobot',
];

/**
 * Single source of truth for reveal flow execution.
 *
 * The RoomScreen orchestrator can remain branch-free by dispatching `RevealKind` here.
 *
 * NOTE: This module intentionally depends on the concrete executor functions passed in
 * (wait/ack), so it remains pure-data and is easy to contract-test.
 */
export type RevealExecutorDeps = Record<RevealKind, RevealExecutor>;

export function createRevealExecutors(deps: RevealExecutorDeps): RevealExecutorDeps {
  return deps;
}

// A strongly-typed helper for contract tests / runtime tables.
export function revealExecutorsKeys(executors: Record<RevealKind, RevealExecutor>): RevealKind[] {
  return Object.keys(executors) as RevealKind[];
}
