/** DrawGuess commands; actors come from platform authentication. */

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type { RoomProfileUpdate, RoomSeatProfile } from '../../../platform/room/roster';
import type { DrawGuessConfig, DrawGuessStroke, DrawGuessWordChoice } from '../state/types';

type PhaseRevisionCommand = { readonly phaseRevision: number; readonly turnIndex: number } & {
  readonly type:
    | 'drawguess.word.choose'
    | 'drawguess.stroke.add'
    | 'drawguess.stroke.undo'
    | 'drawguess.stroke.clear'
    | 'drawguess.guess.submit'
    | 'drawguess.phase.expire';
};

export type DrawGuessPublicCommand =
  | RoomSeatCommand<RoomSeatProfile>
  | RoomProfileUpdateCommand<RoomProfileUpdate>
  | { readonly type: 'drawguess.config.update'; readonly config: DrawGuessConfig }
  | { readonly type: 'drawguess.bots.clear' }
  | { readonly type: 'drawguess.round.start' }
  | { readonly type: 'drawguess.game.returnToLobby' }
  | { readonly type: 'drawguess.drawing.reserve' }
  | { readonly type: 'drawguess.round.finish' }
  | (PhaseRevisionCommand & {
      readonly type: 'drawguess.word.choose';
      readonly word: string;
    })
  | (PhaseRevisionCommand & {
      readonly type: 'drawguess.stroke.add';
      readonly stroke: DrawGuessStroke;
    })
  | (PhaseRevisionCommand & {
      readonly type: 'drawguess.stroke.undo' | 'drawguess.stroke.clear';
    })
  | (PhaseRevisionCommand & {
      readonly type: 'drawguess.guess.submit';
      readonly text: string;
    })
  | (PhaseRevisionCommand & { readonly type: 'drawguess.phase.expire' });

/** Server-originated commands: word dealing (D1) and media commit (R2). */
export type DrawGuessInternalCommand =
  | {
      readonly type: 'drawguess.words.dealt';
      readonly turnIndex: number;
      readonly choices: readonly DrawGuessWordChoice[];
    }
  | {
      readonly type: 'drawguess.drawing.committed';
      readonly turnIndex: number;
      readonly submissionId: string;
      readonly objectKey: string;
      readonly byteLength: number;
      readonly sha256: string;
    };

export type DrawGuessCommand = DrawGuessPublicCommand | DrawGuessInternalCommand;
