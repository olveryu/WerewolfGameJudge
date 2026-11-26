import type { IoniconName } from '@/components/icons/IonIcon';

import type { RoomBoardStatusModel, RoomStatusNotice, RoomTrack } from './RoomBoardStatus';

/** Everything the shell knows about the bar above the seats before it is drawn. */
export interface RoomBoardStatusInput {
  readonly phaseLabel: string | null;
  readonly lobbyTitle: string | null;
  readonly lobbyDetail: string | null;
  readonly icon: IoniconName | null;
  readonly gameStatus: RoomBoardStatusModel | null;
  readonly notices: readonly RoomStatusNotice[];
}

/** The one bar as drawn. */
export interface ResolvedRoomBoardStatus {
  readonly context: string | null;
  readonly message: string | null;
  readonly progress: string | null;
  readonly pendingSeats: RoomBoardStatusModel['pendingSeats'];
  readonly icon: IoniconName | null;
  readonly notices: readonly RoomStatusNotice[];
  readonly tracks: readonly RoomTrack[];
  readonly footnote: string | null;
  readonly inline: boolean;
  readonly testId?: string;
  readonly contextTestId?: string;
}

/**
 * Merges the game's status, the shell's phase/lobby status and the live prompt into the one bar.
 * The game's status wins over the shell's; a prompt (audio narration or seat selection) replaces
 * only the message line and hides progress and pending seats. Notices, tracks and the footnote
 * stay in every case. Returns null when the bar would be empty.
 */
export function resolveRoomBoardStatus(
  board: RoomBoardStatusInput,
  promptMessage: string | null,
  isPromptOverride: boolean,
): ResolvedRoomBoardStatus | null {
  const gameStatus = board.gameStatus;
  const status: ResolvedRoomBoardStatus =
    gameStatus === null
      ? {
          context: board.phaseLabel,
          message: isPromptOverride ? promptMessage : (board.lobbyTitle ?? promptMessage),
          progress: isPromptOverride ? null : board.lobbyDetail,
          pendingSeats: null,
          icon: board.icon,
          notices: board.notices,
          tracks: [],
          footnote: null,
          inline: board.lobbyTitle !== null && !isPromptOverride,
        }
      : {
          context: gameStatus.context ?? board.phaseLabel,
          message: isPromptOverride ? promptMessage : gameStatus.message,
          progress: isPromptOverride ? null : gameStatus.progress,
          pendingSeats: isPromptOverride ? null : gameStatus.pendingSeats,
          icon: gameStatus.icon ?? board.icon,
          notices: board.notices,
          tracks: gameStatus.tracks,
          footnote: gameStatus.footnote,
          inline: false,
          ...(gameStatus.testId === undefined ? {} : { testId: gameStatus.testId }),
          ...(gameStatus.contextTestId === undefined
            ? {}
            : { contextTestId: gameStatus.contextTestId }),
        };
  const isEmpty =
    status.context === null &&
    (status.message === null || status.message.length === 0) &&
    status.progress === null &&
    status.notices.length === 0 &&
    status.tracks.length === 0 &&
    status.footnote === null;
  return isEmpty ? null : status;
}
