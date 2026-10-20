/** Undercover decision helpers; shared rejection vocabulary. */

import { commit, type Decision } from '../../../platform/engine';
import type { UndercoverEffect, UndercoverEvent } from './events';

export const UNDERCOVER_REASONS = {
  phase: 'undercover_phase_invalid',
  config: 'undercover_config_invalid',
  occupied: 'undercover_occupied_seat_out_of_range',
  notFull: 'undercover_room_not_full',
  round: 'undercover_round_mismatch',
  alreadyRevealed: 'undercover_already_revealed',
  word: 'undercover_word_invalid',
  reused: 'undercover_word_reused',
  noBots: 'undercover_no_bot_seats',
  notAllViewed: 'undercover_not_all_viewed',
  failure: 'undercover_preparation_failure_invalid',
} as const;

export type UndercoverDecision = Decision<UndercoverEvent, UndercoverEffect>;

/** Commits one atomic domain operation, or an idempotent no-op. */
export function commitUndercover(
  events: readonly UndercoverEvent[],
  effects: readonly UndercoverEffect[] = [],
): UndercoverDecision {
  return commit({ events, effects });
}
