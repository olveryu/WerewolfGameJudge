/** Undercover decision helpers; shared rejection vocabulary and actor authorization. */

import {
  type CommandContext,
  commit,
  type Decision,
  reject,
  resolveUserActorId,
} from '../../../platform/engine';
import { REASON_NOT_HOST } from '../../../platform/protocol/reasons';
import type { UndercoverState } from '../state/types';
import type { UndercoverEffect, UndercoverEvent } from './events';

export const UNDERCOVER_REASONS = {
  phase: 'undercover_phase_invalid',
  config: 'undercover_config_invalid',
  occupied: 'undercover_occupied_seat_out_of_range',
  testMode: 'undercover_test_mode_required',
  botsRemain: 'undercover_bots_remain',
  notFull: 'undercover_room_not_full',
  round: 'undercover_round_mismatch',
  alreadyRevealed: 'undercover_already_revealed',
  word: 'undercover_word_invalid',
  reused: 'undercover_word_reused',
  bot: 'undercover_bot_required',
  failure: 'undercover_preparation_failure_invalid',
} as const;

export type UndercoverDecision = Decision<UndercoverEvent, UndercoverEffect>;

/** Commits one atomic domain operation, or an idempotent no-op. */
export function commitUndercover(
  events: readonly UndercoverEvent[],
  effects: readonly UndercoverEffect[] = [],
): UndercoverDecision {
  return commit({ events, effects, broadcast: events.length === 0 ? 'none' : 'state' });
}

/** Authorizes the real host, even while the client is viewing a controlled robot seat. */
export function requireUndercoverHost(
  state: UndercoverState,
  context: CommandContext,
): UndercoverDecision | null {
  const actor = resolveUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  return actor.value === state.hostUserId ? null : reject(REASON_NOT_HOST);
}
