/** Spotmatch decision outcomes and permission gates; no IO. */

import { commit, type Decision } from '../../../platform/engine';
import { type RosterChange } from '../../../platform/room/seating';
import type { SpotmatchCompletionPayload } from '../publicStats';
import type { SpotmatchHumanSeat, SpotmatchState } from '../state/types';

/**
 * Stable English rejection codes (AU-48). The user-facing copy for each
 * code lives in the client presenter; engines never emit display text
 * as a reason.
 */
export const SPOTMATCH_REASONS = {
  config: 'spotmatch_config_invalid',
  phase: 'spotmatch_phase_invalid',
  notHostStart: 'spotmatch_not_host_start',
  full: 'spotmatch_room_not_full',
  notHostReturnToLobby: 'spotmatch_not_host_return_to_lobby',
  occupied: 'spotmatch_occupied_seat_out_of_range',
  stale: 'spotmatch_stale_card',
  staleRestart: 'spotmatch_stale_restart',
  symbol: 'spotmatch_symbol_invalid',
  wrong: 'spotmatch_wrong_symbol',
  cooldown: 'spotmatch_cooldown',
  paused: 'spotmatch_shared_pause',
} as const;

export type SpotmatchEvent =
  | {
      readonly type: 'spotmatch.seats.changed';
      readonly changes: readonly RosterChange<SpotmatchHumanSeat>[];
    }
  | { readonly type: 'spotmatch.config.updated'; readonly config: SpotmatchState['config'] }
  | {
      readonly type: 'spotmatch.game.started';
      readonly gameSequence: number;
      readonly round: NonNullable<SpotmatchState['round']>;
    }
  | {
      readonly type: 'spotmatch.round.updated';
      readonly round: NonNullable<SpotmatchState['round']>;
    }
  | { readonly type: 'spotmatch.game.ended' }
  | { readonly type: 'spotmatch.game.returnedToLobby' };

/**
 * Effect 词汇：终局结算只是第一个成员。给游戏加定时/异步流程时，
 * 把本类型改成判别联合并追加成员（如舞台型的 `settle.due` 写
 * `| { readonly type: '...'; readonly payload: {...} }`）。消费方
 * （引擎测试、Worker schemas）一律按 `type` 窄化后读 payload，
 * 不许直取某个成员的字段——加第二个成员时它们不需要改。
 */
export type SpotmatchEffect = {
  /** 终局 growth settlement effect：Worker 据此发 XP 奖励，xpSettled 保证恰好一次。 */
  readonly type: 'spotmatch.game.completed';
  readonly payload:
    | SpotmatchCompletionPayload
    | {
        readonly roundId: string;
        readonly completedAt: number;
        readonly participantUserIds: readonly string[];
      };
};

export type SpotmatchDecision = Decision<SpotmatchEvent, SpotmatchEffect>;

/** Commits domain events and completion effects through the shared runtime. */
export function commitSpotmatch(
  events: readonly SpotmatchEvent[],
  effects: readonly SpotmatchEffect[] = [],
): SpotmatchDecision {
  return commit({ events, effects });
}
