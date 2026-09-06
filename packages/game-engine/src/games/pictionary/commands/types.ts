/** Typed Pictionary commands; actor identity comes only from CommandContext. */

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type {
  PictionaryConfig,
  PictionaryMedia,
  PictionaryProfileUpdate,
  PictionarySeatProfile,
} from '../state/types';

type PictionaryRoomCommand =
  | RoomSeatCommand<PictionarySeatProfile>
  | RoomProfileUpdateCommand<PictionaryProfileUpdate>;

export type PictionaryPublicCommand =
  | PictionaryRoomCommand
  | { readonly type: 'pictionary.config.update'; readonly config: PictionaryConfig }
  | { readonly type: 'pictionary.round.start' }
  | { readonly type: 'pictionary.text.submit'; readonly text: string }
  | { readonly type: 'pictionary.drawing.reserve' }
  | { readonly type: 'pictionary.phase.expire'; readonly phaseRevision: number }
  | { readonly type: 'pictionary.phase.finish' }
  | { readonly type: 'pictionary.gallery.pause' }
  | { readonly type: 'pictionary.gallery.resume' }
  | { readonly type: 'pictionary.gallery.advance' }
  | { readonly type: 'pictionary.gallery.rewind' }
  | { readonly type: 'pictionary.round.next' }
  | { readonly type: 'pictionary.game.returnToLobby' };

export type PictionaryInternalCommand =
  | {
      readonly type: 'pictionary.drawing.commit';
      readonly submissionId: string;
      readonly media: PictionaryMedia;
    }
  | {
      readonly type: 'pictionary.upload.expire';
      readonly submissionId: string;
    };

export type PictionaryCommand = PictionaryPublicCommand | PictionaryInternalCommand;
