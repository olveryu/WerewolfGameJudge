/**
 * 工具箱隐私边界：把权威状态投影成某个用户可见的视图。
 * 所有对外读取（HTTP 回执、WS 回执、同步、广播）都必须经过这里。
 */

import type { ToolboxActivePhase, ToolboxState } from '../state/types';
import type { ToolboxParticipationView, ToolboxPhaseView, ToolboxView } from '../state/view';

function findOwnCup(phase: ToolboxActivePhase, userId: string) {
  if (phase.dice === null) return null;
  const entry = phase.dice.find((candidate) => candidate.userId === userId);
  if (entry === undefined) {
    throw new Error(`Toolbox invariant broken: participant ${userId} has no dice cup`);
  }
  return entry.cup;
}

function findOwnHand(phase: ToolboxActivePhase, userId: string) {
  if (phase.identity === null) return null;
  const hand = phase.identity.hands.find((candidate) => candidate.userId === userId);
  if (hand === undefined) {
    throw new Error(`Toolbox invariant broken: participant ${userId} has no identity hand`);
  }
  return hand.identityIndexes;
}

function projectPhase(state: ToolboxState, userId: string): ToolboxPhaseView {
  const { phase } = state;
  if (phase.kind === 'preparing') {
    return {
      kind: 'preparing',
      seatedCount: phase.seatedUserIds.length,
      isViewerSeated: phase.seatedUserIds.includes(userId),
    };
  }
  const identity =
    phase.identity === null
      ? null
      : {
          config: phase.identity.config,
          remainingTotal: phase.identity.remaining.reduce((sum, count) => sum + count, 0),
        };
  const participation: ToolboxParticipationView = phase.participantUserIds.includes(userId)
    ? { kind: 'participant', dice: findOwnCup(phase, userId), hand: findOwnHand(phase, userId) }
    : { kind: 'spectator' };
  return {
    kind: 'active',
    sessionId: phase.sessionId,
    participantCount: phase.participantUserIds.length,
    identity,
    participation,
  };
}

/** 按用户投影权威状态；只含公开配置、计数和该用户本人的骰盅与手牌。 */
export function projectToolboxStateForUser(state: ToolboxState, userId: string): ToolboxView {
  return {
    gameType: state.gameType,
    roomCode: state.roomCode,
    hostUserId: state.hostUserId,
    viewerUserId: userId,
    isViewerMember: state.memberUserIds.includes(userId),
    memberCount: state.memberUserIds.length,
    config: state.config,
    configVersion: state.configVersion,
    phase: projectPhase(state, userId),
  };
}
