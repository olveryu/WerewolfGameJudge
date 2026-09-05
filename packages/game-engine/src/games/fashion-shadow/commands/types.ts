// Typed Fashion Shadow public commands; actor identity comes only from CommandContext.

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type {
  FashionInvestigationVote,
  FashionProfileUpdate,
  FashionSeatProfile,
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
  | { readonly type: 'fashion.vote.finish' };

export type FashionInternalCommand = never;
export type FashionCommand = FashionPublicCommand;
