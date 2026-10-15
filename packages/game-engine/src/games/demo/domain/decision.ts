/** Demo decision outcomes and permission gates; no IO. */

import {
  type CommandContext,
  commit,
  type Decision,
  reject,
  resolveHostActorId,
} from '../../../platform/engine';
import { type RosterChange } from '../../../platform/room/seating';
import type { DemoHumanSeat, DemoState } from '../state/types';

/**
 * Stable English rejection codes (AU-48). The user-facing copy for each
 * code lives in the client presenter; engines never emit display text
 * as a reason.
 */
export const DEMO_REASONS = {
  config: 'demo_config_invalid',
  phase: 'demo_phase_invalid',
  notHostStart: 'demo_not_host_start',
  notHostBegin: 'demo_not_host_begin',
  notAllViewed: 'demo_not_all_viewed',
  notHostMarkBots: 'demo_not_host_mark_bots',
  noBotSeats: 'demo_no_bot_seats',
  full: 'demo_room_not_full',
  notHostReturnToLobby: 'demo_not_host_return_to_lobby',
  occupied: 'demo_occupied_seat_out_of_range',
  deadline: 'demo_deadline_not_reached',
  notImplemented: 'demo_not_implemented',
} as const;

export type DemoEvent =
  | {
      readonly type: 'demo.seats.changed';
      readonly changes: readonly RosterChange<DemoHumanSeat>[];
    }
  | { readonly type: 'demo.config.updated'; readonly config: DemoState['config'] }
  | {
      readonly type: 'demo.game.started';
      readonly identities: Readonly<Record<number, string>>;
      readonly gameSequence: number;
    }
  | { readonly type: 'demo.game.begun'; readonly deadlineAt: number }
  | { readonly type: 'demo.role.viewed'; readonly seat: number }
  // TODO(gameplay): 玩法事件随玩法状态机加在这里，evolve.ts 逐个落状态。
  | { readonly type: 'demo.game.ended' }
  | { readonly type: 'demo.game.returnedToLobby' };

export type DemoEffect =
  | {
      /** 终局 growth settlement effect：Worker 据此发 XP 奖励，xpSettled 保证恰好一次。 */
      readonly type: 'demo.game.completed';
      readonly payload: {
        readonly roundId: string;
        readonly completedAt: number;
        readonly participantUserIds: readonly string[];
      };
    }
  | {
      /**
       * Armed stage deadline: emitted exactly once when the playing
       * stage opens. The Worker outbox delivers it at `deadlineAt`
       * (alarm-scheduled), and the handler settles through the internal
       * settle command unless the phase has already moved on. The
       * payload pins the exact arming (game, deadline) so a late or
       * replayed delivery can never settle a newer game.
       */
      readonly type: 'demo.settle.due';
      readonly payload: {
        readonly gameSequence: number;
        readonly deadlineAt: number;
      };
    };

export type DemoDecision = Decision<DemoEvent, DemoEffect>;

/** Commits domain events and completion effects through the shared runtime. */
export function commitDemo(
  events: readonly DemoEvent[],
  effects: readonly DemoEffect[] = [],
): DemoDecision {
  return commit({ events, effects, broadcast: events.length === 0 ? 'none' : 'state' });
}

/** Requires the current host acting outside bot takeover; rejects with the given reason. */
export function requireDemoHost(
  state: DemoState,
  context: CommandContext,
  reason: string,
): DemoDecision | null {
  const actor = resolveHostActorId(context, state.hostUserId);
  return actor.kind === 'rejected' ? reject(reason) : null;
}
