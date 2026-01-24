/**
 * V2 Host Game Factory for Integration Tests
 *
 * 完全基于 v2 架构：
 * - intents → handlers → reducer → BroadcastGameState
 * - 禁止 import legacy GameStateService / NightFlowController
 * - 禁止 encoded target 协议
 *
 * 单一真相：BroadcastGameState（= GameState）
 */

import type { BroadcastGameState } from '../../../protocol/types';
import type { RoleId } from '../../../../models/roles';
import type { SchemaId } from '../../../../models/roles/spec';
import type { GameState } from '../../store/types';
import type { StateAction } from '../../reducer/types';
import type { HandlerContext, HandlerResult } from '../../handlers/types';
import type { SubmitActionIntent, SubmitWolfVoteIntent } from '../../intents/types';
import type { NightPlan } from '../../../../models/roles/spec/plan';
import type { PlayerMessage } from '../../../protocol/types';

import { gameReducer } from '../../reducer';
import { handleSubmitAction, handleSubmitWolfVote } from '../../handlers/actionHandler';
import { handleAdvanceNight, handleEndNight } from '../../handlers/nightFlowHandler';
import { buildNightPlan } from '../../../../models/roles/spec/plan';
import { SCHEMAS } from '../../../../models/roles/spec';
import { PRESET_TEMPLATES, createTemplateFromRoles, GameTemplate } from '../../../../models/Template';
import { doesRoleParticipateInWolfVote } from '../../../../models/roles';

// =============================================================================
// Types
// =============================================================================

/**
 * 捕获的消息记录（用于 wire protocol 合约测试）
 */
export interface CapturedMessage {
  /** 消息发送时的 currentStepId */
  stepId: SchemaId | null;
  /** 原始 PlayerMessage */
  message: PlayerMessage;
}

export interface HostGameContextV2 {
  /** 获取当前 BroadcastGameState */
  getBroadcastState: () => BroadcastGameState;
  /** 获取当前 revision */
  getRevision: () => number;
  /** 获取 NightPlan */
  getNightPlan: () => NightPlan;
  /** 运行完整夜晚流程 */
  runNight: (actions: NightActionSequenceV2) => NightResultV2;
  /** 发送 PlayerMessage（模拟 player→host intent） */
  sendPlayerMessage: (msg: PlayerMessage) => { success: boolean; reason?: string };
  /** 断言当前步骤 */
  assertStep: (expectedStepId: SchemaId) => void;
  /** 查找角色的座位号 */
  findSeatByRole: (role: RoleId) => number;
  /** 获取座位的角色 */
  getRoleAtSeat: (seat: number) => RoleId | null;
  /** 获取模板 */
  template: GameTemplate;
  /** 获取捕获的消息（用于 wire protocol 合约测试） */
  getCapturedMessages: () => readonly CapturedMessage[];
  /** 清空捕获的消息 */
  clearCapturedMessages: () => void;
}

/**
 * Night-1 行动序列（v2 wire protocol）
 */
export interface NightActionSequenceV2 {
  [role: string]:
    | number
    | null
    | undefined
    | { targets: readonly number[] }
    | { stepResults: { save: number | null; poison: number | null } }
    | { confirmed: boolean };
}

export interface NightResultV2 {
  deaths: number[];
  completed: boolean;
  state: BroadcastGameState;
}

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

export function createHostGameV2(
  templateNameOrRoles: string | RoleId[],
  roleAssignment?: Map<number, RoleId>,
): HostGameContextV2 {
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

  const endNight = (): { success: boolean; deaths: number[] } => {
    const context = createContext(internal.state, true);
    const result = handleEndNight({ type: 'END_NIGHT' }, context);
    if (!result.success) {
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
      stepId: internal.state.currentStepId,
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

      default:
        return { success: false, reason: `Unsupported message type: ${(msg as any).type}` };
    }
  };

  const runNight = (actions: NightActionSequenceV2): NightResultV2 => {
    const plan = internal.nightPlan;

    for (let stepIdx = 0; stepIdx < plan.steps.length; stepIdx++) {
      const step = plan.steps[stepIdx];
      const schemaId = step.stepId;
      const roleId = step.roleId;
      const schema = SCHEMAS[schemaId];
      const actionValue = actions[roleId];
      const actorSeat = findSeatByRole(roleId);
      if (actorSeat === -1) {
        throw new Error(`Role ${roleId} not found in template`);
      }

      if (schema.kind === 'wolfVote') {
        const wolfSeats: number[] = [];
        for (const [seatStr, player] of Object.entries(internal.state.players)) {
          if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
            wolfSeats.push(Number.parseInt(seatStr, 10));
          }
        }
        const wolfTarget = typeof actionValue === 'number' ? actionValue : null;
        for (const wolfSeat of wolfSeats) {
          if (wolfTarget !== null) {
            sendPlayerMessage({
              type: 'WOLF_VOTE',
              seat: wolfSeat,
              target: wolfTarget,
            });
          }
        }
        const leadWolfSeat = wolfSeats[0] ?? actorSeat;
        const wolfRole = internal.state.players[leadWolfSeat]?.role ?? 'wolf';
        sendPlayerMessage({
          type: 'ACTION',
          seat: leadWolfSeat,
          role: wolfRole as RoleId,
          target: wolfTarget,
          extra: undefined,
        });
      } else if (schema.kind === 'swap') {
        let targets: readonly number[] = [];
        if (actionValue && typeof actionValue === 'object' && 'targets' in actionValue) {
          targets = actionValue.targets;
        }
        sendPlayerMessage({
          type: 'ACTION',
          seat: actorSeat,
          role: roleId as RoleId,
          target: null,
          extra: targets.length > 0 ? { targets } : undefined,
        });
      } else if (schema.kind === 'compound') {
        let stepResults: { save: number | null; poison: number | null } = {
          save: null,
          poison: null,
        };
        if (actionValue && typeof actionValue === 'object' && 'stepResults' in actionValue) {
          stepResults = actionValue.stepResults;
        } else if (typeof actionValue === 'number') {
          stepResults = { save: actionValue, poison: null };
        }
        sendPlayerMessage({
          type: 'ACTION',
          seat: actorSeat,
          role: roleId as RoleId,
          target: null, // compound schema target in stepResults
          extra: { stepResults },
        });
      } else if (schema.kind === 'confirm') {
        let confirmed = false;
        if (actionValue && typeof actionValue === 'object' && 'confirmed' in actionValue) {
          confirmed = actionValue.confirmed;
        }
        sendPlayerMessage({
          type: 'ACTION',
          seat: actorSeat,
          role: roleId as RoleId,
          target: null,
          extra: { confirmed },
        });
      } else {
        const target = typeof actionValue === 'number' ? actionValue : null;
        sendPlayerMessage({
          type: 'ACTION',
          seat: actorSeat,
          role: roleId as RoleId,
          target,
          extra: undefined,
        });
      }

      if (internal.state.pendingRevealAcks?.length) {
        sendPlayerMessage({
          type: 'REVEAL_ACK',
          seat: actorSeat,
          role: roleId as RoleId,
          revision: internal.revision,
        });
      }

      if (stepIdx < plan.steps.length - 1) {
        advanceNight();
      }
    }

    const { deaths } = endNight();

    return {
      deaths,
      completed: internal.state.status === 'ended',
      state: internal.state,
    };
  };

  return {
    getBroadcastState,
    getRevision,
    getNightPlan,
    runNight,
    sendPlayerMessage,
    assertStep,
    findSeatByRole,
    getRoleAtSeat,
    template,
    getCapturedMessages,
    clearCapturedMessages,
  };
}

export function cleanupHostGameV2(): void {
  // v2 不使用 singleton，无需清理
}
