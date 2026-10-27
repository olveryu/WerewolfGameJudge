/** Game-neutral render models for stacked and compact room action panels. */

import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { NightStepProgress } from './nightProgress';
import type { RoomViewer } from './RoomViewer';

/**
 * Who a bottom button is for — the declared ownership of every action
 * the bottom panel renders, checked by `createRoomShellModel` against
 * the shell's viewer:
 *
 * - `participant`: a seat action (view identity, vote, confirm, skip).
 *   Requires an effective seat — own or taken-over bot seat.
 * - `anyone`: open to spectators too (a shared review, a public result).
 *
 * There is no host audience: host commands live in host management and
 * reach the host through the host task card, never the bottom panel.
 */
export type RoomBottomButtonAudience = 'participant' | 'anyone';

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
  readonly audience: RoomBottomButtonAudience;
  readonly icon?: ComponentProps<typeof Ionicons>['name'];
  readonly variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  readonly size: 'lg' | 'md';
  readonly testID?: string;
  readonly textColor?: string;
  readonly buttonColor?: string;
  readonly isLoading?: boolean;
}

export type RoomBottomButton = RoomBottomButtonBase & RoomBottomActionAvailability;

/** Status message shown while narration audio plays. */
export const AUDIO_WAITING_LABEL = '语音播报中…';

interface RoomBottomToolButtonBase {
  readonly key: string;
  readonly label: string;
  readonly audience: RoomBottomButtonAudience;
  readonly icon?: ComponentProps<typeof Ionicons>['name'];
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
  readonly viewer: RoomViewer;
}): string | null {
  return input.isLobby && !input.viewer.isHost && input.viewer.seat !== null
    ? '等待房主开始游戏'
    : null;
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
  readonly viewer: RoomViewer;
}): string | null {
  return input.isEnded && !input.viewer.isHost && input.viewer.seat !== null
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
 * Renders a resolved view-identity action as a bottom button. The tier
 * follows the 2026 rule, decided by the caller from whether the current
 * step is the viewing step: the viewing step renders primary, every
 * other phase renders secondary. Ghost is never a view-identity tier:
 * viewing your own secret is always a real button (filled or outlined),
 * never a borderless text action. Size is fixed md across games; the
 * key, the tier, the audience and the testID remain the surface's own
 * anchors (a spectator-readable variant such as FibKing's 查看题目
 * declares `anyone`; viewing one's own secret declares `participant`).
 * The button is always enabled (a hidden action is expressed by
 * resolving to null, never by a disabled view button).
 */
export function buildViewIdentityButton(
  action: RoomViewIdentityAction,
  surface: {
    readonly key: string;
    readonly variant: 'primary' | 'secondary';
    readonly audience: RoomBottomButtonAudience;
    readonly testID?: string;
  },
): RoomBottomButton {
  return {
    key: surface.key,
    label: action.label,
    audience: surface.audience,
    icon: 'eye-outline',
    variant: surface.variant,
    size: 'md',
    ...(surface.testID !== undefined ? { testID: surface.testID } : {}),
    isEnabled: true,
    onPress: action.onPress,
  };
}

/**
 * The three tiers of the stacked bottom layout, one tier per row.
 * Tier ownership is a platform contract, decided by semantics:
 * stage actions (what this step asks the player to do) belong in
 * primary / secondary; tertiary actions (cancel, dismiss) belong in
 * ghost, on their own row. View identity follows its own 2026 rule
 * rather than the review-tool grouping: it is the viewing step's main
 * action (primary) in the viewing step and a persistent secondary
 * tool in every other phase — it is never ghost. The review button
 * (nightReview) remains a ghost tool. Host flow never renders here.
 */
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

export interface RoomBottomDockModel {
  readonly kind: 'dock';
  readonly message: string | null;
  /** Step progress for stepped phases (night sequences, relay chains); null elsewhere. */
  readonly progress: NightStepProgress | null;
  readonly leading: RoomBottomToolButton | null;
  readonly primary: RoomBottomButton | null;
  readonly trailing: RoomBottomToolButton | null;
}

export type RoomBottomActionModel = RoomBottomStackModel | RoomBottomDockModel;
