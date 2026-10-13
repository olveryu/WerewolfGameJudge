/** Internal FibKing state-transition events. */

import type { GameEvent } from '../../../platform/engine';
import type { RosterChange } from '../../../platform/room/seating';
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
      readonly type: 'fibking.seats.changed';
      readonly changes: readonly RosterChange<FibHumanSeat>[];
    })
  | (GameEvent & {
      readonly type: 'fibking.profile.updated';
      readonly seat: number;
      readonly profile: FibProfileUpdate;
    })
  | (GameEvent & {
      readonly type: 'fibking.config.updated';
      readonly numberOfPlayers: number;
    })
  | (GameEvent & {
      readonly type: 'fibking.round.preparing';
      readonly pendingRound: PendingFibRound;
    })
  | (GameEvent & {
      readonly type: 'fibking.round.preparation.stage.updated';
      readonly stage: FibPreparationStage;
    })
  | (GameEvent & { readonly type: 'fibking.round.preparationCancelled' })
  | (GameEvent & {
      readonly type: 'fibking.round.preparationFailed';
      readonly failedAt: number;
      readonly failureCode: FibPreparationFailureCode;
    })
  | (GameEvent & {
      readonly type: 'fibking.round.started';
      readonly roundId: string;
      readonly word: string;
      readonly definition: FibWordDefinition;
      readonly source: FibWordSource;
      readonly roles: FibRoleAssignment;
      /** Bot seats are marked viewed at deal time (Identity Viewing Protocol). */
      readonly initialViewedSeats: readonly number[];
    })
  | (GameEvent & { readonly type: 'fibking.role.viewed'; readonly seat: number })
  | (GameEvent & { readonly type: 'fibking.round.viewing.completed' })
  | (GameEvent & { readonly type: 'fibking.round.ended' })
  | (GameEvent & { readonly type: 'fibking.game.returnedToLobby' });
