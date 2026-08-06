/** Internal FibKing state-transition events. */

import type { GameEvent } from '../../../platform/engine';
import type { SeatChange } from '../../../platform/room/seating';
import type {
  FibHumanSeat,
  FibPreparationFailureCode,
  FibPreparationStage,
  FibProfileUpdate,
  FibRoleAssignment,
  FibWordDefinition,
  FibWordSource,
  PendingFibRound,
} from '../state/types';

export type FibEvent =
  | (GameEvent & {
      readonly type: 'fib.seats.changed';
      readonly changes: readonly SeatChange<FibHumanSeat>[];
    })
  | (GameEvent & {
      readonly type: 'fib.profile.updated';
      readonly seat: number;
      readonly profile: FibProfileUpdate;
    })
  | (GameEvent & {
      readonly type: 'fib.botFill.changed';
      readonly isEnabled: boolean;
    })
  | (GameEvent & {
      readonly type: 'fib.botSeat.excluded';
      readonly seat: number;
    })
  | (GameEvent & {
      readonly type: 'fib.config.updated';
      readonly numberOfPlayers: number;
    })
  | (GameEvent & {
      readonly type: 'fib.round.preparing';
      readonly pendingRound: PendingFibRound;
    })
  | (GameEvent & {
      readonly type: 'fib.round.preparationStageUpdated';
      readonly stage: FibPreparationStage;
    })
  | (GameEvent & { readonly type: 'fib.round.preparationCancelled' })
  | (GameEvent & {
      readonly type: 'fib.round.preparationFailed';
      readonly failedAt: number;
      readonly failureCode: FibPreparationFailureCode;
    })
  | (GameEvent & {
      readonly type: 'fib.round.started';
      readonly roundId: string;
      readonly word: string;
      readonly definition: FibWordDefinition;
      readonly source: FibWordSource;
      readonly roles: FibRoleAssignment;
    })
  | (GameEvent & { readonly type: 'fib.round.ended' });
