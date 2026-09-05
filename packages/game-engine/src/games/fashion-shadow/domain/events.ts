// State events for the first Fashion Shadow vertical slice.

import type { SeatChange } from '../../../platform/room/seating';
import type {
  FashionEvidenceId,
  FashionEventId,
  FashionHumanSeat,
  FashionInvestigationVote,
  FashionProfileUpdate,
  FashionRoleId,
  FashionSecretId,
} from '../state/types';

export type FashionEvent =
  | {
      readonly type: 'fashion.seats.changed';
      readonly changes: readonly SeatChange<FashionHumanSeat>[];
    }
  | {
      readonly type: 'fashion.profile.updated';
      readonly seat: number;
      readonly profile: FashionProfileUpdate;
    }
  | {
      readonly type: 'fashion.game.started';
      readonly roles: Readonly<Record<number, FashionRoleId>>;
      readonly secrets: Readonly<Record<number, FashionSecretId>>;
      readonly actionTokens: Readonly<Record<number, number>>;
    }
  | { readonly type: 'fashion.role.confirmed'; readonly seat: number }
  | { readonly type: 'fashion.event.revealed'; readonly eventId: FashionEventId }
  | {
      readonly type: 'fashion.crossExam.started';
      readonly attackerSeat: number;
      readonly defenderSeat: number;
      readonly startedAt: number;
      readonly endsAt: number;
    }
  | { readonly type: 'fashion.crossExam.finished' }
  | { readonly type: 'fashion.discussion.spoken'; readonly seat: number }
  | { readonly type: 'fashion.discussion.finished' }
  | {
      readonly type: 'fashion.vote.cast';
      readonly seat: number;
      readonly vote: FashionInvestigationVote;
    }
  | {
      readonly type: 'fashion.vote.finished';
      readonly approved: boolean;
      readonly evidenceId: FashionEvidenceId;
    };
