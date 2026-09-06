// State events for the first Fashion Shadow vertical slice.

import type { SeatChange } from '../../../platform/room/seating';
import type {
  FashionCrossExamAward,
  FashionEventId,
  FashionEvidenceId,
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
      readonly type: 'fashion.secret.revealed';
      readonly seat: number;
      readonly secretId: FashionSecretId;
    }
  | {
      readonly type: 'fashion.crossExam.started';
      readonly match: 1 | 2;
      readonly attackerSeat: number;
      readonly defenderSeat: number;
      readonly participantSeats: readonly number[];
      readonly startedAt: number;
      readonly endsAt: number;
    }
  | {
      readonly type: 'fashion.crossExam.awardVoted';
      readonly voterSeat: number;
      readonly candidateSeat: number;
    }
  | { readonly type: 'fashion.crossExam.awarded'; readonly award: FashionCrossExamAward }
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
    }
  | {
      readonly type: 'fashion.round.advanced';
      readonly round: 1 | 2 | 3 | 4;
      readonly eventId: FashionEventId;
    }
  | { readonly type: 'fashion.hearing.started' }
  | { readonly type: 'fashion.hearing.vote'; readonly seat: number; readonly targetSeat: number }
  | { readonly type: 'fashion.hearing.finished'; readonly winners: readonly number[] }
  | {
      readonly type: 'fashion.contract.proposed';
      readonly contract: import('../state/types').FashionContract;
    }
  | { readonly type: 'fashion.contract.accepted'; readonly contractId: string }
  | { readonly type: 'fashion.contract.fulfilled'; readonly contractId: string }
  | {
      readonly type: 'fashion.identityGuess.cast';
      readonly guesserSeat: number;
      readonly targetSeat: number;
      readonly guessedRoleId: FashionRoleId;
      readonly success: boolean;
      readonly revealedSecretId: FashionSecretId | null;
    };
