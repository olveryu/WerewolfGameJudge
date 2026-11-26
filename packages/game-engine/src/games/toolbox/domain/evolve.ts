/** 工具箱事件应用；规则判断在 decide 中完成，这里只做状态转换。 */

import type { ToolboxActivePhase, ToolboxState } from '../state/types';
import type { ToolboxEvent } from './decision';

function requireActive(state: ToolboxState, eventType: string): ToolboxActivePhase {
  if (state.phase.kind !== 'active') {
    throw new Error(`[FAIL-FAST] ${eventType} requires an active toolbox session`);
  }
  return state.phase;
}

function requirePreparingSeats(state: ToolboxState, eventType: string): readonly string[] {
  if (state.phase.kind !== 'preparing') {
    throw new Error(`[FAIL-FAST] ${eventType} requires the preparing phase`);
  }
  return state.phase.seatedUserIds;
}

export function evolveToolboxState(state: ToolboxState, event: ToolboxEvent): ToolboxState {
  switch (event.type) {
    case 'toolbox.member.joined':
      return { ...state, memberUserIds: [...state.memberUserIds, event.userId] };
    case 'toolbox.member.left':
      return {
        ...state,
        memberUserIds: state.memberUserIds.filter((userId) => userId !== event.userId),
      };
    case 'toolbox.seat.taken':
      return {
        ...state,
        phase: {
          kind: 'preparing',
          seatedUserIds: [...requirePreparingSeats(state, event.type), event.userId],
        },
      };
    case 'toolbox.seat.released':
      return {
        ...state,
        phase: {
          kind: 'preparing',
          seatedUserIds: requirePreparingSeats(state, event.type).filter(
            (userId) => userId !== event.userId,
          ),
        },
      };
    case 'toolbox.seats.cleared':
      requirePreparingSeats(state, event.type);
      return { ...state, phase: { kind: 'preparing', seatedUserIds: [] } };
    case 'toolbox.config.updated':
      return { ...state, config: event.config, configVersion: state.configVersion + 1 };
    case 'toolbox.session.began':
      requirePreparingSeats(state, event.type);
      return {
        ...state,
        sessionSequence: state.sessionSequence + 1,
        phase: {
          kind: 'active',
          sessionId: event.sessionId,
          participantUserIds: event.participantUserIds,
          dice: event.dice,
          identity: event.identity,
        },
      };
    case 'toolbox.session.ended': {
      // 重新开始保留入座和配置；已离开房间的参与者不再入座。
      const { participantUserIds } = requireActive(state, event.type);
      return {
        ...state,
        phase: {
          kind: 'preparing',
          seatedUserIds: participantUserIds.filter((userId) =>
            state.memberUserIds.includes(userId),
          ),
        },
      };
    }
    case 'toolbox.dice.cupChanged': {
      const phase = requireActive(state, event.type);
      if (phase.dice === null) throw new Error('[FAIL-FAST] dice event without dice tool');
      return {
        ...state,
        phase: {
          ...phase,
          dice: phase.dice.map((entry) =>
            entry.userId === event.userId ? { userId: entry.userId, cup: event.cup } : entry,
          ),
        },
      };
    }
    case 'toolbox.identity.drawn': {
      const phase = requireActive(state, event.type);
      const round = phase.identity;
      if (round === null) throw new Error('[FAIL-FAST] identity event without identity tool');
      return {
        ...state,
        phase: {
          ...phase,
          identity: {
            ...round,
            remaining: round.remaining.map((count, index) =>
              index === event.identityIndex ? count - 1 : count,
            ),
            hands: round.hands.map((hand) =>
              hand.userId === event.userId
                ? {
                    userId: hand.userId,
                    identityIndexes: [...hand.identityIndexes, event.identityIndex],
                  }
                : hand,
            ),
          },
        },
      };
    }
  }
}
