/** Game-neutral render models for stacked and compact room action panels. */

import type { NightStepProgress } from './nightProgress';

type RoomBottomActionAvailability =
  | {
      readonly isEnabled: true;
      readonly onPress: () => void;
    }
  | {
      readonly isEnabled: false;
      readonly disabledReason: string | null;
    };

interface RoomBottomButtonBase {
  readonly key: string;
  readonly label: string;
  readonly variant: 'primary' | 'secondary' | 'ghost';
  readonly size: 'lg' | 'md';
  readonly testID?: string;
  readonly textColor?: string;
  readonly buttonColor?: string;
  readonly isLoading?: boolean;
}

export type RoomBottomButton = RoomBottomButtonBase & RoomBottomActionAvailability;

/** Label of the disabled placeholder shown while narration audio plays. */
export const AUDIO_WAITING_LABEL = '语音播报中…';

interface RoomBottomToolButtonBase {
  readonly key: string;
  readonly label: string;
  readonly tone: 'default' | 'danger';
  readonly testID?: string;
}

export type RoomBottomToolButton = RoomBottomToolButtonBase & RoomBottomActionAvailability;

/**
 * The lobby hint shown to a seated non-host player while the host has
 * not started the game yet: 「等待房主开始游戏」. One source for the
 * gating predicate and the copy so the bottom info line cannot drift
 * per game.
 */
export function buildLobbyHostStartMessage(input: {
  readonly isLobby: boolean;
  readonly isHost: boolean;
  readonly mySeat: number | null;
}): string | null {
  return input.isLobby && !input.isHost && input.mySeat !== null ? '等待房主开始游戏' : null;
}

/**
 * The ended-phase hint shown to a seated non-host player while the host
 * decides between a rematch and returning to the lobby. The copy is
 * DrawGuess's ended view sentence, kept as the single source so every
 * game's ended phase waits on the host in the same words.
 */
export const ENDED_WAITING_MESSAGE = '等待房主操作（再来一局 / 返回大厅）';

export function buildEndedWaitingMessage(input: {
  readonly isEnded: boolean;
  readonly isHost: boolean;
  readonly mySeat: number | null;
}): string | null {
  return input.isEnded && !input.isHost && input.mySeat !== null ? ENDED_WAITING_MESSAGE : null;
}

/**
 * The waiting sentence for a stepped phase (a night sequence), built
 * from the very progress object that feeds the bottom progress row so
 * the sentence and the row can never disagree about the current step:
 * a non-actor is told whose action the room is waiting for.
 */
export function buildStepActorWaitingMessage(progress: NightStepProgress | null): string | null {
  return progress === null || progress.label === '' ? null : `正在等待 ${progress.label} 行动`;
}

/**
 * The player sentence for a failed word preparation: the game's own
 * failure reason (its content — word games report distinct reasons)
 * plus the shared wait object, the host who must handle it. Each game
 * fills in its reason and the host action its flow offers.
 */
export function buildPreparationFailureMessage(input: {
  readonly reason: string;
  readonly hostAction: string;
}): string {
  return `${input.reason}，等待房主${input.hostAction}`;
}

export interface RoomBottomActionLayout {
  readonly primary: readonly RoomBottomButton[];
  readonly secondary: readonly RoomBottomButton[];
  readonly ghost: readonly RoomBottomButton[];
}

export interface RoomBottomStackModel {
  readonly kind: 'stacked';
  readonly message: string | null;
  /** Step progress for stepped phases (night sequences, relay chains); null elsewhere. */
  readonly progress: NightStepProgress | null;
  readonly layout: RoomBottomActionLayout;
}

export interface RoomBottomInfoModel {
  readonly kind: 'info';
  readonly message: string | null;
  /** Step progress for stepped phases (night sequences, relay chains); null elsewhere. */
  readonly progress: NightStepProgress | null;
  readonly actions: readonly RoomBottomButton[];
}

export interface RoomBottomDockModel {
  readonly kind: 'dock';
  readonly message: string | null;
  /** Step progress for stepped phases (night sequences, relay chains); null elsewhere. */
  readonly progress: NightStepProgress | null;
  readonly leading: RoomBottomToolButton | null;
  readonly primary: RoomBottomButton;
  readonly trailing: RoomBottomToolButton | null;
}

export type RoomBottomActionModel =
  | RoomBottomStackModel
  | RoomBottomInfoModel
  | RoomBottomDockModel;
