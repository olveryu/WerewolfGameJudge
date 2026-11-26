/** 工具箱决策结果、稳定拒绝码与事件词汇；不含 IO。 */

import { commit, type Decision } from '../../../platform/engine';
import type {
  ToolboxConfig,
  ToolboxDiceCup,
  ToolboxIdentityRound,
  ToolboxParticipantCup,
} from '../state/types';

/** 稳定的英文拒绝码；中文文案只在客户端呈现层。 */
export const TOOLBOX_REASONS = {
  notMember: 'toolbox_not_member',
  notHost: 'toolbox_not_host',
  alreadyStarted: 'toolbox_already_started',
  notStarted: 'toolbox_not_started',
  noSeated: 'toolbox_no_seated',
  configInvalid: 'toolbox_config_invalid',
  identityNameDuplicate: 'toolbox_identity_name_duplicate',
  noTools: 'toolbox_no_tools',
  configChanged: 'toolbox_config_changed',
  notEnoughCards: 'toolbox_not_enough_cards',
  sessionStale: 'toolbox_session_stale',
  notParticipant: 'toolbox_not_participant',
  diceDisabled: 'toolbox_dice_disabled',
  identityDisabled: 'toolbox_identity_disabled',
  cupStale: 'toolbox_cup_stale',
  diceCountInvalid: 'toolbox_dice_count_invalid',
  heldExceedsCount: 'toolbox_held_exceeds_count',
  rollBeforeReveal: 'toolbox_roll_before_reveal',
  notRolled: 'toolbox_not_rolled',
  notRevealed: 'toolbox_not_revealed',
  dieMissing: 'toolbox_die_missing',
  holdLimit: 'toolbox_hold_limit',
  handFull: 'toolbox_hand_full',
} as const;

export type ToolboxReason = (typeof TOOLBOX_REASONS)[keyof typeof TOOLBOX_REASONS];

export type ToolboxEvent =
  | { readonly type: 'toolbox.member.joined'; readonly userId: string }
  | { readonly type: 'toolbox.member.left'; readonly userId: string }
  | { readonly type: 'toolbox.seat.taken'; readonly userId: string }
  | { readonly type: 'toolbox.seat.released'; readonly userId: string }
  | { readonly type: 'toolbox.seats.cleared' }
  | { readonly type: 'toolbox.config.updated'; readonly config: ToolboxConfig }
  | {
      readonly type: 'toolbox.session.began';
      readonly sessionId: string;
      readonly participantUserIds: readonly string[];
      readonly dice: readonly ToolboxParticipantCup[] | null;
      readonly identity: ToolboxIdentityRound | null;
    }
  | { readonly type: 'toolbox.session.ended' }
  | {
      readonly type: 'toolbox.dice.cupChanged';
      readonly userId: string;
      readonly cup: ToolboxDiceCup;
    }
  | {
      readonly type: 'toolbox.identity.drawn';
      readonly userId: string;
      readonly identityIndex: number;
    };

/** 工具箱不产生任何副作用：无奖励、无局数统计、无计时。 */
export type ToolboxEffect = never;

export type ToolboxDecision = Decision<ToolboxEvent, ToolboxEffect>;

export function commitToolbox(events: readonly ToolboxEvent[]): ToolboxDecision {
  return commit({ events });
}
