/** Internal Pictionary state-transition events. */

import type { GameEvent } from '../../../platform/engine';
import type { SeatChange } from '../../../platform/room/seating';
import type {
  PictionaryChain,
  PictionaryConfig,
  PictionaryDrawingReservation,
  PictionaryEntry,
  PictionaryGalleryState,
  PictionaryHumanSeat,
  PictionaryPhase,
  PictionaryProfileUpdate,
} from '../state/types';

export type PictionaryEvent =
  | (GameEvent & {
      readonly type: 'pictionary.seats.changed';
      readonly changes: readonly SeatChange<PictionaryHumanSeat>[];
    })
  | (GameEvent & {
      readonly type: 'pictionary.profile.updated';
      readonly seat: number;
      readonly profile: PictionaryProfileUpdate;
    })
  | (GameEvent & {
      readonly type: 'pictionary.config.updated';
      readonly config: PictionaryConfig;
    })
  | (GameEvent & {
      readonly type: 'pictionary.round.started';
      readonly roundId: string;
      readonly seatOrder: readonly number[];
      readonly chains: readonly PictionaryChain[];
      readonly deadlineAt: number | null;
    })
  | (GameEvent & {
      readonly type: 'pictionary.task.submitted';
      readonly chainId: string;
      readonly entry: PictionaryEntry;
      readonly submissionId: string | null;
    })
  | (GameEvent & {
      readonly type: 'pictionary.drawing.reserved';
      readonly reservation: PictionaryDrawingReservation;
    })
  | (GameEvent & {
      readonly type: 'pictionary.tasks.missed';
      readonly entries: readonly {
        readonly chainId: string;
        readonly entry: PictionaryEntry;
      }[];
      readonly submissionIds: readonly string[];
    })
  | (GameEvent & {
      readonly type: 'pictionary.phase.changed';
      readonly phase: PictionaryPhase;
      readonly stepIndex: number;
      readonly deadlineAt: number | null;
      readonly gallery: PictionaryGalleryState | null;
    })
  | (GameEvent & { readonly type: 'pictionary.game.returnedToLobby' });
