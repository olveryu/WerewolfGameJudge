/** Applies Demo domain events; reset paths clear all game-owned state. */

import { markSeatViewed } from '../../../platform/room/identityViewing';
import { applyRosterChanges } from '../../../platform/room/seating';
import type { DemoState } from '../state/types';
import type { DemoEvent } from './decision';

/** Resets mutable game data while preserving room configuration and seats. */
function resetDemoGame(state: DemoState): DemoState {
  return {
    ...state,
    phase: { kind: 'lobby' },
    phaseRevision: state.phaseRevision + 1,
    identities: {},
    roleViewedSeats: [],
    xpSettled: false,
  };
}

/** Evolves a committed domain event without persistence or broadcasts. */
export function evolveDemoState(state: DemoState, event: DemoEvent): DemoState {
  const bumped = { ...state, phaseRevision: state.phaseRevision + 1 };
  switch (event.type) {
    case 'demo.seats.changed':
      return { ...bumped, roster: applyRosterChanges(state.roster, event.changes) };
    case 'demo.config.updated':
      return { ...bumped, config: event.config };
    case 'demo.game.started':
      return {
        ...resetDemoGame(state),
        phaseRevision: state.phaseRevision + 1,
        // 发牌落入独立查看阶段；开始玩由房主在全员查看后手动 begin。
        phase: { kind: 'viewing' },
        // 身份查看协议：发牌时无人落标记；机器人由房主用脚手架标记。
        roleViewedSeats: [],
        identities: { ...event.identities },
        gameSequence: event.gameSequence,
      };
    case 'demo.game.begun': {
      if (state.phase.kind !== 'viewing') return state;
      return { ...bumped, phase: { kind: 'playing', deadlineAt: event.deadlineAt } };
    }
    case 'demo.role.viewed': {
      if (state.roleViewedSeats.includes(event.seat)) return state;
      return { ...bumped, roleViewedSeats: markSeatViewed(state.roleViewedSeats, event.seat) };
    }
    // TODO(gameplay): 玩法事件在这里逐个落状态；阶段推进只许由事件驱动。
    case 'demo.game.ended': {
      if (state.phase.kind === 'ended') return state;
      return { ...bumped, phase: { kind: 'ended' }, xpSettled: true };
    }
    case 'demo.game.returnedToLobby':
      return resetDemoGame(state);
  }
}
