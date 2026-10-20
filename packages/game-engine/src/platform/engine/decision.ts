/** Constructors for unambiguous engine decisions. */

import type { Decision, GameEffect, GameEvent } from './types';

interface CommitOptions<TEvent extends GameEvent, TEffect extends GameEffect> {
  readonly events: readonly TEvent[];
  readonly effects?: readonly TEffect[];
  /**
   * Defaults to 'state' exactly when events commit, 'none' for a
   * zero-event commit — the invariant the Worker module enforces.
   * Pass explicitly only to override that correspondence.
   */
  readonly broadcast?: 'state' | 'none';
  readonly reason?: string;
}

export function commit<TEvent extends GameEvent, TEffect extends GameEffect = never>(
  options: CommitOptions<TEvent, TEffect>,
): Decision<TEvent, TEffect> {
  return {
    kind: 'commit',
    events: options.events,
    effects: options.effects ?? [],
    broadcast: options.broadcast ?? (options.events.length === 0 ? 'none' : 'state'),
    outcome:
      options.reason === undefined
        ? { kind: 'success' }
        : { kind: 'success', reason: options.reason },
  };
}

export function commitDomainRejection<TEvent extends GameEvent, TEffect extends GameEffect = never>(
  reason: string,
  options: Omit<CommitOptions<TEvent, TEffect>, 'reason'>,
): Decision<TEvent, TEffect> {
  return {
    kind: 'commit',
    events: options.events,
    effects: options.effects ?? [],
    broadcast: options.broadcast ?? (options.events.length === 0 ? 'none' : 'state'),
    outcome: { kind: 'domainRejected', reason },
  };
}

export function reject<TEvent extends GameEvent = never, TEffect extends GameEffect = never>(
  reason: string,
): Decision<TEvent, TEffect> {
  return { kind: 'reject', reason };
}
