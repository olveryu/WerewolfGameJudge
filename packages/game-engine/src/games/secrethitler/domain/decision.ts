/** Secrethitler decision outcomes and permission gates; no IO. */

import type { AudioEffect } from '../../../platform/audio';
import { commit, type Decision } from '../../../platform/engine';
import type { GameCompletionPayload } from '../../../platform/engine/completionEffect';
import { type RosterChange } from '../../../platform/room/seating';
import type { StepEvent } from '../../../platform/steps';
import type { SecrethitlerCompletionPayload } from '../publicStats';
import type {
  SecrethitlerEndReason,
  SecrethitlerGameplayPatch,
  SecrethitlerHumanSeat,
  SecrethitlerNightStep,
  SecrethitlerPolicy,
  SecrethitlerState,
  SecrethitlerWinner,
} from '../state/types';

/**
 * Stable English rejection codes (AU-48). The user-facing copy for each
 * code lives in the client presenter; engines never emit display text
 * as a reason.
 */
export const SECRETHITLER_REASONS = {
  config: 'secrethitler_config_invalid',
  phase: 'secrethitler_phase_invalid',
  notHostStart: 'secrethitler_not_host_start',
  notHostBegin: 'secrethitler_not_host_begin',
  notHostAbort: 'secrethitler_not_host_abort',
  notHostRetrySettle: 'secrethitler_not_host_retry_settle',
  notHostMarkBots: 'secrethitler_not_host_mark_bots',
  noBotSeats: 'secrethitler_no_bot_seats',
  notAllViewed: 'secrethitler_not_all_viewed',
  full: 'secrethitler_room_not_full',
  audioPlaying: 'secrethitler_audio_playing',
  notHostAckAudio: 'secrethitler_not_host_ack_audio',
  unknownAudioBatch: 'secrethitler_unknown_audio_batch',
  occupied: 'secrethitler_occupied_seat_out_of_range',
  notPresident: 'secrethitler_not_current_president',
  notLiving: 'secrethitler_not_living_player',
  nomination: 'secrethitler_chancellor_ineligible',
  preselection: 'secrethitler_preselection_invalid',
  notEligibleVote: 'secrethitler_voter_ineligible',
  deadline: 'secrethitler_deadline_invalid',
  handChoice: 'secrethitler_policy_choice_invalid',
  veto: 'secrethitler_veto_unavailable',
  power: 'secrethitler_power_unavailable',
  target: 'secrethitler_target_ineligible',
} as const;

export type SecrethitlerEvent =
  | {
      readonly type: 'secrethitler.seats.changed';
      readonly changes: readonly RosterChange<SecrethitlerHumanSeat>[];
    }
  | { readonly type: 'secrethitler.config.updated'; readonly config: SecrethitlerState['config'] }
  | {
      readonly type: 'secrethitler.game.started';
      readonly identities: Readonly<Record<number, SecrethitlerState['identities'][number]>>;
      readonly gameSequence: number;
      readonly firstPresidentSeat: number;
      readonly policyDeck: readonly SecrethitlerPolicy[];
    }
  | {
      readonly type: 'secrethitler.gameplay.updated';
      readonly patch: Partial<SecrethitlerGameplayPatch>;
    }
  | {
      readonly type: 'secrethitler.night.step';
      readonly event: StepEvent<SecrethitlerNightStep, Readonly<Record<string, never>>, never>;
    }
  | { readonly type: 'secrethitler.role.viewed'; readonly seat: number }
  | { readonly type: 'secrethitler.review.completed'; readonly userId: string }
  | {
      readonly type: 'secrethitler.audio.queued';
      readonly effects: readonly AudioEffect[];
    }
  | { readonly type: 'secrethitler.audio.cleared'; readonly audioBatchId: number }
  | {
      readonly type: 'secrethitler.game.ended';
      readonly winner: SecrethitlerWinner;
      readonly reason: SecrethitlerEndReason;
    }
  | { readonly type: 'secrethitler.game.returnedToLobby' };

/**
 * Effect 词汇：终局结算只是第一个成员。给游戏加定时/异步流程时，
 * 把本类型改成判别联合并追加成员（如舞台型的 `settle.due` 写
 * `| { readonly type: '...'; readonly payload: {...} }`）。消费方
 * （引擎测试、Worker schemas）一律按 `type` 窄化后读 payload，
 * 不许直取某个成员的字段——加第二个成员时它们不需要改。
 */
export type SecrethitlerEffect =
  | {
      readonly type: 'secrethitler.game.completed';
      readonly payload: SecrethitlerCompletionPayload | GameCompletionPayload;
    }
  | {
      readonly type: 'secrethitler.settle.due';
      readonly payload: {
        readonly gameSequence: number;
        readonly phase: 'voting' | 'resultVoting' | 'resultPolicy' | 'resultVeto';
        readonly round: number;
        readonly deadlineAt: number;
      };
    };

export type SecrethitlerDecision = Decision<SecrethitlerEvent, SecrethitlerEffect>;

/** Commits domain events and completion effects through the shared runtime. */
export function commitSecrethitler(
  events: readonly SecrethitlerEvent[],
  effects: readonly SecrethitlerEffect[] = [],
): SecrethitlerDecision {
  return commit({ events, effects });
}
