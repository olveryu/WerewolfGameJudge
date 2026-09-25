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
  PictionaryState,
} from '../state/types';
import { getPictionaryTaskForSeat } from '../state/types';

type PictionaryRoomCommand =
  | RoomSeatCommand<PictionarySeatProfile>
  | RoomProfileUpdateCommand<PictionaryProfileUpdate>;

export type PictionaryCommandInput =
  | PictionaryRoomCommand
  | { readonly type: 'pictionary.config.update'; readonly config: PictionaryConfig }
  | { readonly type: 'pictionary.round.start' }
  | { readonly type: 'pictionary.task.ready.set'; readonly isReady: boolean }
  | { readonly type: 'pictionary.task.empty.submit' }
  | { readonly type: 'pictionary.text.submit'; readonly text: string }
  | { readonly type: 'pictionary.drawing.reserve' }
  | { readonly type: 'pictionary.round.abort' }
  | { readonly type: 'pictionary.phase.expire'; readonly phaseRevision: number }
  | { readonly type: 'pictionary.phase.finish' }
  | { readonly type: 'pictionary.gallery.pause' }
  | { readonly type: 'pictionary.gallery.resume' }
  | { readonly type: 'pictionary.gallery.advance' }
  | { readonly type: 'pictionary.gallery.rewind' }
  | { readonly type: 'pictionary.gallery.finish' }
  | { readonly type: 'pictionary.round.next' }
  | { readonly type: 'pictionary.game.returnToLobby' };

export interface PictionaryTaskIdentity {
  readonly roundId: string;
  readonly stepIndex: number;
  readonly chainId: string;
}

type TaskCommand = Extract<
  PictionaryCommandInput,
  {
    readonly type:
      | 'pictionary.task.ready.set'
      | 'pictionary.task.empty.submit'
      | 'pictionary.text.submit'
      | 'pictionary.drawing.reserve';
  }
>;

type PhaseCommand = Extract<
  PictionaryCommandInput,
  {
    readonly type:
      | 'pictionary.phase.finish'
      | 'pictionary.round.abort'
      | 'pictionary.gallery.pause'
      | 'pictionary.gallery.resume'
      | 'pictionary.gallery.advance'
      | 'pictionary.gallery.rewind'
      | 'pictionary.gallery.finish'
      | 'pictionary.round.next'
      | 'pictionary.game.returnToLobby';
  }
>;

export type PictionaryPublicCommand =
  | Exclude<PictionaryCommandInput, TaskCommand | PhaseCommand>
  | (TaskCommand & PictionaryTaskIdentity)
  | (PhaseCommand & { readonly roundId: string | null; readonly phaseRevision: number });

/** Bind task commands to the state displayed when the user acted, never the state at retry time. */
export function createPictionaryCommand(
  state: PictionaryState,
  command: PictionaryCommandInput,
  seat: number | null,
): PictionaryPublicCommand {
  switch (command.type) {
    case 'pictionary.task.ready.set':
    case 'pictionary.task.empty.submit':
    case 'pictionary.text.submit':
    case 'pictionary.drawing.reserve': {
      const task = seat === null ? null : getPictionaryTaskForSeat(state, seat);
      if (task === null || state.roundId === null) throw new Error('Pictionary task is missing');
      return {
        ...command,
        roundId: state.roundId,
        stepIndex: state.stepIndex,
        chainId: task.chain.id,
      };
    }
    case 'pictionary.phase.finish':
    case 'pictionary.round.abort':
    case 'pictionary.gallery.pause':
    case 'pictionary.gallery.resume':
    case 'pictionary.gallery.advance':
    case 'pictionary.gallery.rewind':
    case 'pictionary.gallery.finish':
    case 'pictionary.round.next':
    case 'pictionary.game.returnToLobby':
      return { ...command, roundId: state.roundId, phaseRevision: state.phaseRevision };
    default:
      return command;
  }
}

export type PictionaryInternalCommand = {
  readonly type: 'pictionary.drawing.commit';
  readonly submissionId: string;
  readonly media: PictionaryMedia;
};

export type PictionaryCommand = PictionaryPublicCommand | PictionaryInternalCommand;
