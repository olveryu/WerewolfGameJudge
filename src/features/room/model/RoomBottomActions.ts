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

/**
 * The audio-waiting placeholder button: while the room's narration is
 * playing, the primary action slot shows this disabled button instead
 * of the real action. Shared by every game with narration audio so
 * the copy and disabled semantics cannot drift.
 */
export function buildAudioWaitingButton(input: {
  readonly key: string;
  readonly testID?: string;
}): RoomBottomButton {
  return {
    key: input.key,
    label: AUDIO_WAITING_LABEL,
    variant: 'primary',
    size: 'md',
    isEnabled: false,
    disabledReason: '语音播报尚未结束，请稍候',
    testID: input.testID,
  };
}

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
