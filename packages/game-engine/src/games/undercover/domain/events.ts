/** Pure Undercover events and deferred word-selection effects. */

import type { SeatChange } from '../../../platform/room/seating';
import type {
  UndercoverConfig,
  UndercoverHumanSeat,
  UndercoverPendingRound,
  UndercoverPreparationFailure,
  UndercoverRevelation,
  UndercoverRound,
} from '../state/types';
import type { UndercoverRole } from './rules';

export type UndercoverEvent =
  | {
      readonly type: 'undercover.seats.changed';
      readonly changes: readonly SeatChange<UndercoverHumanSeat>[];
      readonly botSeats: readonly number[];
    }
  | { readonly type: 'undercover.config.updated'; readonly config: UndercoverConfig }
  | { readonly type: 'undercover.round.preparing'; readonly pendingRound: UndercoverPendingRound }
  | { readonly type: 'undercover.round.failed'; readonly failureCode: UndercoverPreparationFailure }
  | { readonly type: 'undercover.round.started'; readonly round: UndercoverRound }
  | { readonly type: 'undercover.round.confirmed'; readonly seat: number }
  | {
      readonly type: 'undercover.round.revealed';
      readonly revelation: UndercoverRevelation;
      readonly winner: UndercoverRole | null;
    }
  | { readonly type: 'undercover.round.aborted' }
  | { readonly type: 'undercover.game.returnedToLobby' };

export interface UndercoverEffect {
  readonly type: 'undercover.word.select';
  readonly payload: {
    readonly roundId: string;
    readonly category: UndercoverConfig['category'];
    readonly avoidWordPairIds: readonly string[];
    readonly shouldAllowRepeated: boolean;
  };
}
