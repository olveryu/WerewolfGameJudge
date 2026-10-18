/**
 * Relay phase clock: durations become absolute server deadlines, and
 * an expired phase dispatches by phase.
 *
 * Expiry guards stay with each game (actor gate, deadline presence,
 * and what a stale revision does are observable per-game behavior).
 * This module receives a state whose revision the caller has already
 * verified and performs only the phase dispatch: answering settles,
 * transition is resolved by the game's injected continuation (the
 * games part ways here — next step or gallery entry), and gallery
 * advances one cell.
 */

import { type Decision, type GameEffect, type GameEvent, reject } from '../../engine';
import { moveRelayGallery } from './gallery';
import type { RelayEventKit, RelayRoundSlice } from './types';

/** Converts a supported duration into an absolute server deadline. */
export function relayDeadline(nowMs: number, seconds: number | null): number | null {
  return seconds === null ? null : nowMs + seconds * 1000;
}

/** Game continuation for an expired transition phase: next step or gallery entry. */
export interface RelayExpireHooks<
  TEntry,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
  TState extends RelayRoundSlice<TEntry> = RelayRoundSlice<TEntry>,
> {
  resolveTransition(
    kit: RelayEventKit<TEntry, TEvent, TEffect>,
    state: TState,
    nowMs: number,
  ): Decision<TEvent, TEffect>;
}

/** Dispatches an already-verified phase expiry by the current phase. */
export function expireRelayPhase<
  TEntry,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
  TState extends RelayRoundSlice<TEntry>,
>(
  kit: RelayEventKit<TEntry, TEvent, TEffect>,
  state: TState,
  nowMs: number,
  hooks: RelayExpireHooks<TEntry, TEvent, TEffect, TState>,
): Decision<TEvent, TEffect> {
  switch (state.phase) {
    case 'answering':
      return kit.commit([kit.phaseChanged('settling', null, state.stepIndex, null)]);
    case 'transition':
      return hooks.resolveTransition(kit, state, nowMs);
    case 'gallery':
      return moveRelayGallery(kit, state, 1, nowMs);
    default:
      return reject(kit.reasons.phase);
  }
}
