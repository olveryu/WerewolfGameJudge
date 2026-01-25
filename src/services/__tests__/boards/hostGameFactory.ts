/**
 * Host Game Factory for Integration Tests
 *
 * 完全基于 架构：
 * - intents → handlers → reducer → BroadcastGameState
 * - 禁止 import legacy GameStateService / NightFlowController
 * - 禁止 encoded target 协议
 *
 * 单一真相：BroadcastGameState（= GameState）
 */

import type { RoleId } from '../../../models/roles';
import type { SchemaId } from '../../../models/roles/spec';
import type { GameState } from '../../engine/store/types';
import type { StateAction } from '../../engine/reducer/types';
import type { HandlerContext, HandlerResult } from '../../engine/handlers/types';
import type { SubmitActionIntent, SubmitWolfVoteIntent } from '../../engine/intents/types';
import type { NightPlan } from '../../../models/roles/spec/plan';
import type { BroadcastGameState, PlayerMessage } from '../../protocol/types';

import { gameReducer } from '../../engine/reducer';
import { handleSubmitAction, handleSubmitWolfVote } from '../../engine/handlers/actionHandler';
import { handleAdvanceNight, handleEndNight } from '../../engine/handlers/nightFlowHandler';
import { handleSetWolfRobotHunterStatusViewed } from '../../engine/handlers/wolfRobotHunterGateHandler';
import { buildNightPlan } from '../../../models/roles/spec/plan';
import { PRESET_TEMPLATES, createTemplateFromRoles, GameTemplate } from '../../../models/Template';

// Re-export types from hostGameContext.ts for backward compatibility
export type { HostGameContext, CapturedMessage } from './hostGameContext';
import type { HostGameContext, CapturedMessage } from './hostGameContext';

// =============================================================================
// Internal State Management
// =============================================================================

interface InternalState {
  state: GameState;
  revision: number;
  nightPlan: NightPlan;
  template: GameTemplate;
  /** 捕获的消息（用于 wire protocol 合约测试） */
  capturedMessages: CapturedMessage[];
}

function applyActions(current: GameState, actions: StateAction[]): GameState {
  return actions.reduce((s, action) => gameReducer(s, action), current);
}

function createContext(state: GameState, isHost: boolean): HandlerContext {
  return {
    state,
    isHost,
    myUid: 'host-uid',
    mySeat: null,
  };
}

// =============================================================================
// Factory Function
// =============================================================================

export function createHostGame(
  templateNameOrRoles: string | RoleId[],
  roleAssignment?: Map<number, RoleId>,
): HostGameContext {
  let template: GameTemplate;
  if (typeof templateNameOrRoles === 'string') {
    const preset = PRESET_TEMPLATES.find((t) => t.name === templateNameOrRoles);
    if (!preset) throw new Error(`Unknown template: ${templateNameOrRoles}`);
    template = createTemplateFromRoles(preset.roles);
  } else {
    template = createTemplateFromRoles(templateNameOrRoles);
  }

  const initialPlayers: Record<number, BroadcastGameState['players'][number]> = {};
  for (let i = 0; i < template.numberOfPlayers; i++) {
    initialPlayers[i] = {
      uid: `player_${i}`,
      seatNumber: i,
      displayName: `Player ${i + 1}`,
      avatarUrl: undefined,
      role: null,
      hasViewedRole: false,
    };
  }

  let state: GameState = {
    roomCode: 'TEST01',
    hostUid: 'host-uid',
    status: 'seated',
    templateRoles: template.roles,
    players: initialPlayers,
    currentActionerIndex: 0,
    isAudioPlaying: false,
  };

  const assignments: Record<number, RoleId> = {};
  if (roleAssignment) {
    roleAssignment.forEach((role, seat) => {
      assignments[seat] = role;
    });
  } else {
    template.roles.forEach((role, idx) => {
      assignments[idx] = role;
    });
  }

  state = gameReducer(state, {
    type: 'ASSIGN_ROLES',
    payload: { assignments },
  });

  for (let i = 0; i < template.numberOfPlayers; i++) {
    state = gameReducer(state, {
      type: 'PLAYER_VIEWED_ROLE',
      payload: { seat: i },
    });
  }

  const nightPlan = buildNightPlan(template.roles);
  const firstStepId = nightPlan.steps[0]?.stepId;
  if (!firstStepId) {
    throw new Error('Night plan has no steps');
  }

  state = gameReducer(state, {
    type: 'START_NIGHT',
    payload: {
      currentActionerIndex: 0,
      currentStepId: firstStepId,
    },
  });

  const revision = 1;
  const internal: InternalState = {
    state,
    revision,
    nightPlan,
    template,
    capturedMessages: [],
  };

  const getBroadcastState = (): BroadcastGameState => internal.state;
  const getRevision = (): number => internal.revision;
  const getNightPlan = (): NightPlan => internal.nightPlan;
  const getCapturedMessages = (): readonly CapturedMessage[] => internal.capturedMessages;
  const clearCapturedMessages = (): void => {
    internal.capturedMessages = [];
  };

  const findSeatByRole = (role: RoleId): number => {
    for (const [seatStr, player] of Object.entries(internal.state.players)) {
      if (player?.role === role) {
        return Number.parseInt(seatStr, 10);
      }
    }
    return -1;
  };

  const getRoleAtSeat = (seat: number): RoleId | null => {
    return internal.state.players[seat]?.role ?? null;
  };

  const assertStep = (expectedStepId: SchemaId): void => {
    const current = internal.state.currentStepId;
    if (current !== expectedStepId) {
      throw new Error(`Step mismatch: expected ${expectedStepId}, got ${current}`);
    }
  };

  const executeHandler = (result: HandlerResult): { success: boolean; reason?: string } => {
    if (!result.success) {
      return { success: false, reason: result.reason };
    }
    internal.state = applyActions(internal.state, result.actions);
    internal.revision++;
    return { success: true };
  };

  const advanceNight = (): { success: boolean; reason?: string } => {
    const context = createContext(internal.state, true);
    const result = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, context);
    return executeHandler(result);
  };

  /**
   * 推进到下一个夜晚步骤（fail-fast 版本）
   *
   * 逻辑与 stepByStepRunner.advanceNightOrThrow 完全一致：
   * - 调用 advanceNight()
   * - 如果 success: false 则 throw
   *
   * 两处实现保持行为一致，避免循环依赖。
   * 逻辑极简（call + throw），不存在 drift 风险。
   *
   * @param context - 上下文信息（用于错误消息）
   * @throws 如果 advanceNight 返回 success: false
   */
  const advanceNightOrThrow = (context: string): void => {
    const result = advanceNight();
    if (!result.success) {
      const currentStepId = internal.state.currentStepId;
      throw new Error(
        `[advanceNightOrThrow] failed at ${context}: ` +
          `currentStepId=${currentStepId ?? 'null'}, ` +
          `reason=${result.reason ?? 'unknown'}`,
      );
    }
  };

  /**
   * 结束夜晚，触发死亡结算
   *
   * FAIL-FAST: 只有当 night plan 走完（currentStepId 为空）时才允许调用。
   * 中途调用会抛出错误，因为这违反了 NightFlow invariants。
   *
   * 复用生产 handleEndNight handler，不自造 deaths。
   */
  const endNight = (): { success: boolean; deaths: number[] } => {
    const context = createContext(internal.state, true);
    const result = handleEndNight({ type: 'END_NIGHT' }, context);
    if (!result.success) {
      // FAIL-FAST: 如果是 night_not_complete，说明测试代码试图中途 endNight，这是架构违规
      if (result.reason === 'night_not_complete') {
        throw new Error(
          `endNight() called before night plan completed. currentStepId=${internal.state.currentStepId}. ` +
          `You must advanceNight() through all steps first.`
        );
      }
      return { success: false, deaths: [] };
    }
    internal.state = applyActions(internal.state, result.actions);
    internal.revision++;
    return {
      success: true,
      deaths: internal.state.lastNightDeaths ?? [],
    };
  };

  const sendPlayerMessage = (msg: PlayerMessage): { success: boolean; reason?: string } => {
    // 捕获消息用于 wire protocol 合约测试
    internal.capturedMessages.push({
      stepId: internal.state.currentStepId ?? null,
      message: msg,
    });

    const context = createContext(internal.state, true);

    switch (msg.type) {
      case 'ACTION': {
        const intent: SubmitActionIntent = {
          type: 'SUBMIT_ACTION',
          payload: {
            seat: msg.seat,
            role: msg.role,
            target: msg.target,
            extra: msg.extra as Record<string, unknown> | undefined,
          },
        };
        const result = handleSubmitAction(intent, context);
        return executeHandler(result);
      }

      case 'WOLF_VOTE': {
        const intent: SubmitWolfVoteIntent = {
          type: 'SUBMIT_WOLF_VOTE',
          payload: {
            seat: msg.seat,
            target: msg.target,
          },
        };
        const result = handleSubmitWolfVote(intent, context);
        return executeHandler(result);
      }

      case 'REVEAL_ACK': {
        if (internal.state.pendingRevealAcks?.length) {
          internal.state = {
            ...internal.state,
            pendingRevealAcks: internal.state.pendingRevealAcks.filter(
              (ack) => ack !== internal.state.currentStepId,
            ),
          };
          internal.revision++;
        }
        return { success: true };
      }

      case 'WOLF_ROBOT_HUNTER_STATUS_VIEWED': {
        const result = handleSetWolfRobotHunterStatusViewed(context, {
          type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
          seat: msg.seat,
        });
        return executeHandler(result);
      }

      default:
        return { success: false, reason: `Unsupported message type: ${(msg as any).type}` };
    }
  };

  return {
    getBroadcastState,
    getRevision,
    getNightPlan,
    sendPlayerMessage,
    advanceNight,
    advanceNightOrThrow,
    endNight,
    assertStep,
    findSeatByRole,
    getRoleAtSeat,
    template,
    getCapturedMessages,
    clearCapturedMessages,
  };
}

export function cleanupHostGame(): void {
  // 不使用 singleton，无需清理
}
