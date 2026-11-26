/** Game-neutral player action models and shared player-facing copy. */

import type { NightStepProgress } from './nightProgress';
import type { RoomActionAudience, RoomPlayerAction, RoomPlayerActionGroup } from './RoomAction';
import { isEffectiveRoomParticipant, type RoomViewer } from './RoomViewer';

/** Status message shown while narration audio plays. */
export const AUDIO_WAITING_LABEL = '语音播报中…';

/**
 * The lobby hint shown to a participating non-host player while the host has
 * not started the game yet: 「等待房主开始游戏」. One source for the
 * gating predicate and the copy so the bottom info line cannot drift
 * per game.
 */
export function buildLobbyHostStartMessage(input: {
  readonly isLobby: boolean;
  readonly viewer: RoomViewer;
}): string | null {
  return input.isLobby && !input.viewer.isHost && isEffectiveRoomParticipant(input.viewer, null)
    ? '等待房主开始游戏'
    : null;
}

/**
 * The ended-phase hint shown to a participating non-host player while the host
 * decides between a rematch and returning to the lobby. The copy is
 * DrawGuess's ended view sentence, kept as the single source so every
 * game's ended phase waits on the host in the same words.
 */
const ENDED_WAITING_MESSAGE = '等待房主操作';

export function buildEndedWaitingMessage(input: {
  readonly isEnded: boolean;
  readonly viewer: RoomViewer;
}): string | null {
  return input.isEnded && !input.viewer.isHost && isEffectiveRoomParticipant(input.viewer, null)
    ? ENDED_WAITING_MESSAGE
    : null;
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

/** Canonical label of the view-identity action where the game's own word for it is 身份. */
export const VIEW_IDENTITY_LABEL = '查看身份';

/**
 * The view-identity action definition: the one player command whose
 * execution (role card modal + viewed submission) already runs through
 * the shared viewing flow. What remained per game was the definition —
 * label, audience visibility, handler — re-assembled at every surface.
 * A surface resolves the definition once, then renders it in its own
 * form (bottom button, stage-area button, static layout entry). The
 * label is the game's own content （查看身份 / 查看词卡 / 查看题目 …);
 * visibility is the game's own audience predicate, evaluated by the
 * caller (seated-only, phase-gated, control-state-gated …).
 */
export interface RoomViewIdentityAction {
  readonly label: string;
  readonly onPress: () => void;
}

export function resolveViewIdentityAction(input: {
  readonly isVisible: boolean;
  readonly label: string;
  readonly onPress: () => void;
}): RoomViewIdentityAction | null {
  return input.isVisible ? { label: input.label, onPress: input.onPress } : null;
}

/**
 * Builds a resolved view-identity action. A hidden action is expressed
 * by resolving to null; the only blocked state is the room's
 * single-flight command lock.
 */
export function buildViewIdentityButton(
  action: RoomViewIdentityAction,
  surface: {
    readonly key: string;
    readonly audience: RoomActionAudience;
    readonly testID?: string;
    readonly isSubmitting: boolean;
    readonly isPending?: boolean;
  },
): RoomPlayerAction {
  const base = {
    key: surface.key,
    label: action.label,
    audience: surface.audience,
    icon: 'eye-outline',
    category: 'resource',
    ...(surface.isPending === undefined ? {} : { isPending: surface.isPending }),
    ...(surface.testID !== undefined ? { testID: surface.testID } : {}),
  } as const;
  if (surface.isSubmitting) return { ...base, state: { kind: 'blocked', reason: null } };
  return { ...base, state: { kind: 'ready', onPress: action.onPress } };
}

export interface RoomPlayerActionModel {
  readonly message: string | null;
  readonly progress: NightStepProgress | null;
  readonly actions: readonly RoomPlayerAction[];
  readonly group: RoomPlayerActionGroup | null;
}

/** True when the model carries no message, no progress and no action. */
export function isRoomPlayerActionModelEmpty(model: RoomPlayerActionModel): boolean {
  return (
    (model.message === null || model.message.length === 0) &&
    model.progress === null &&
    model.actions.length === 0 &&
    model.group === null
  );
}
