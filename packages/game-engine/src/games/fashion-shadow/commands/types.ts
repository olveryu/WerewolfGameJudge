// Typed Fashion Shadow public commands; actor identity comes only from CommandContext.

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type {
  FashionInvestigationVote,
  FashionProfileUpdate,
  FashionSeatProfile,
  FashionSecretId,
} from '../state/types';

type FashionRoomCommand =
  | RoomSeatCommand<FashionSeatProfile>
  | RoomProfileUpdateCommand<FashionProfileUpdate>;

export type FashionPublicCommand =
  | FashionRoomCommand
  | { readonly type: 'fashion.game.start' }
  | { readonly type: 'fashion.role.confirm' }
  | { readonly type: 'fashion.event.reveal' }
  | { readonly type: 'fashion.crossExam.start' }
  | { readonly type: 'fashion.crossExam.finish' }
  | { readonly type: 'fashion.discussion.speak' }
  | { readonly type: 'fashion.discussion.finish' }
  | { readonly type: 'fashion.vote.cast'; readonly vote: FashionInvestigationVote }
  | { readonly type: 'fashion.vote.finish' }
  | { readonly type: 'fashion.round.advance' }
  | { readonly type: 'fashion.hearing.start' }
  | { readonly type: 'fashion.hearing.vote'; readonly targetSeat: number }
  | { readonly type: 'fashion.hearing.finish' }
  | {
      readonly type: 'fashion.contract.propose';
      readonly contractId: string;
      readonly buyerSeat: number;
      readonly promise: 'compensation' | 'protection' | 'legalImmunity';
    }
  | { readonly type: 'fashion.contract.accept'; readonly contractId: string }
  | { readonly type: 'fashion.contract.fulfill'; readonly contractId: string }
  | {
      readonly type: 'fashion.identityGuess.cast';
      readonly targetSeat: number;
      readonly guessedSecretId: FashionSecretId;
    };

export type FashionInternalCommand = never;
export type FashionCommand = FashionPublicCommand;
