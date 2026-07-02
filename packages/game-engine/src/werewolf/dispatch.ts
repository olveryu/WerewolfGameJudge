/**
 * dispatchWerewolf — command router for the werewolf GameEngine.
 */

import type { EngineResult, GameAction } from '../engine/registry/types';
import { engineError, engineSuccess } from '../engine/registry/types';
import {
  WEREWOLF_ACTION,
  type WerewolfAudioGatePayload,
  type WerewolfBoardNominatePayload,
  type WerewolfBoardUpvotePayload,
  type WerewolfBoardWithdrawPayload,
  type WerewolfGroupConfirmAckPayload,
  type WerewolfSeatPayload,
  type WerewolfShareReviewPayload,
  type WerewolfSubmitActionPayload,
  type WerewolfUpdateProfilePayload,
  type WerewolfUpdateTemplatePayload,
  type WerewolfViewRolePayload,
  type WerewolfWolfRobotViewedPayload,
} from './actions';
import { extractAudioActions } from './audioActions';
import { buildHandlerContext } from './context';
import { handleSubmitAction } from './handlers/actionHandler';
import {
  handleAssignRoles,
  handleBoardNominate,
  handleBoardUpvote,
  handleBoardWithdraw,
  handleFillWithBots,
  handleMarkAllBotsViewed,
  handleRestartGame,
  handleShareNightReview,
  handleStartNight,
  handleUpdateTemplate,
} from './handlers/gameControlHandler';
import {
  handleClearAllSeats,
  handleJoinSeat,
  handleKickPlayer,
  handleLeaveMySeat,
  handleUpdatePlayerProfile,
} from './handlers/seatHandler';
import { handleSetAudioPlaying } from './handlers/stepTransitionHandler';
import type { HandlerResult } from './handlers/types';
import { handleViewedRole } from './handlers/viewedRoleHandler';
import { handleSetWolfRobotHunterStatusViewed } from './handlers/wolfRobotHunterGateHandler';
import { type GameRuleOverrides, GameStatus, isValidRoleId, type RoleId } from './models';
import { SCHEMAS } from './models/roles/spec/schemas';
import type { WerewolfState } from './protocol/types';
import type { StateAction } from './reducer/types';

function fromHandlerResult(
  result: HandlerResult,
  broadcastAction: string | null = null,
): EngineResult<StateAction> {
  if (result.kind === 'error') {
    return engineError(result.reason);
  }
  if (result.kind === 'rejection') {
    return {
      kind: 'rejection',
      reason: result.reason,
      actions: result.actions,
      sideEffects: result.sideEffects,
      broadcastAction,
    };
  }
  return engineSuccess(result.actions, result.sideEffects, result.reason, broadcastAction);
}

function failPayload(actionType: string, detail: string): never {
  throw new Error(`[FAIL-FAST] ${actionType}: ${detail}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecordPayload(action: GameAction): Record<string, unknown> {
  if (!isRecord(action.payload)) {
    failPayload(action.actionType, 'payload must be an object');
  }
  return action.payload;
}

function requireString(payload: Record<string, unknown>, key: string, actionType: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    failPayload(actionType, `${key} must be a non-empty string`);
  }
  return value;
}

function optionalString(
  payload: Record<string, unknown>,
  key: string,
  actionType: string,
): string | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    failPayload(actionType, `${key} must be a string`);
  }
  return value;
}

function requireNumber(payload: Record<string, unknown>, key: string, actionType: string): number {
  const value = payload[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    failPayload(actionType, `${key} must be an integer`);
  }
  return value;
}

function optionalNumber(
  payload: Record<string, unknown>,
  key: string,
  actionType: string,
): number | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    failPayload(actionType, `${key} must be an integer`);
  }
  return value;
}

function requireBoolean(
  payload: Record<string, unknown>,
  key: string,
  actionType: string,
): boolean {
  const value = payload[key];
  if (typeof value !== 'boolean') {
    failPayload(actionType, `${key} must be a boolean`);
  }
  return value;
}

function requireNumberOrNull(
  payload: Record<string, unknown>,
  key: string,
  actionType: string,
): number | null {
  const value = payload[key];
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    failPayload(actionType, `${key} must be an integer or null`);
  }
  return value;
}

function requireRoleId(payload: Record<string, unknown>, key: string, actionType: string): RoleId {
  const value = payload[key];
  if (typeof value !== 'string' || !isValidRoleId(value)) {
    failPayload(actionType, `${key} must be a valid RoleId`);
  }
  return value;
}

function requireNumberArray(
  payload: Record<string, unknown>,
  key: string,
  actionType: string,
): number[] {
  const value = payload[key];
  if (!Array.isArray(value)) {
    failPayload(actionType, `${key} must be an array`);
  }
  return value.map((item, index) => {
    if (typeof item !== 'number' || !Number.isInteger(item)) {
      failPayload(actionType, `${key}[${index}] must be an integer`);
    }
    return item;
  });
}

function requireRoleIdArray(
  payload: Record<string, unknown>,
  key: string,
  actionType: string,
): RoleId[] {
  const value = payload[key];
  if (!Array.isArray(value)) {
    failPayload(actionType, `${key} must be an array`);
  }
  return value.map((item, index) => {
    if (typeof item !== 'string' || !isValidRoleId(item)) {
      failPayload(actionType, `${key}[${index}] must be a valid RoleId`);
    }
    return item;
  });
}

function parseRules(
  payload: Record<string, unknown>,
  actionType: string,
): GameRuleOverrides | undefined {
  const value = payload.rules;
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    failPayload(actionType, 'rules must be an object');
  }
  const rules: GameRuleOverrides = {};
  if (value.isPlagueMode !== undefined) {
    if (typeof value.isPlagueMode !== 'boolean') {
      failPayload(actionType, 'rules.isPlagueMode must be a boolean');
    }
    rules.isPlagueMode = value.isPlagueMode;
  }
  if (value.witchCanSelfHeal !== undefined) {
    if (typeof value.witchCanSelfHeal !== 'boolean') {
      failPayload(actionType, 'rules.witchCanSelfHeal must be a boolean');
    }
    rules.witchCanSelfHeal = value.witchCanSelfHeal;
  }
  return rules;
}

function parseSeatPayload(action: GameAction): WerewolfSeatPayload {
  const payload = requireRecordPayload(action);
  const seatAction = requireString(payload, 'action', action.actionType);
  const userId = requireString(payload, 'userId', action.actionType);
  if (seatAction === 'sit') {
    return {
      action: 'sit',
      userId,
      seat: requireNumber(payload, 'seat', action.actionType),
      displayName: requireString(payload, 'displayName', action.actionType),
      avatarUrl: optionalString(payload, 'avatarUrl', action.actionType),
      avatarFrame: optionalString(payload, 'avatarFrame', action.actionType),
      seatFlair: optionalString(payload, 'seatFlair', action.actionType),
      nameStyle: optionalString(payload, 'nameStyle', action.actionType),
      roleRevealEffect: optionalString(payload, 'roleRevealEffect', action.actionType),
      seatAnimation: optionalString(payload, 'seatAnimation', action.actionType),
      level: optionalNumber(payload, 'level', action.actionType),
    };
  }
  if (seatAction === 'standup') {
    return { action: 'standup', userId };
  }
  if (seatAction === 'kick') {
    return {
      action: 'kick',
      userId,
      targetSeat: requireNumber(payload, 'targetSeat', action.actionType),
    };
  }
  failPayload(action.actionType, 'action must be sit, standup, or kick');
}

function parseUpdateTemplatePayload(action: GameAction): WerewolfUpdateTemplatePayload {
  const payload = requireRecordPayload(action);
  return {
    templateRoles: requireRoleIdArray(payload, 'templateRoles', action.actionType),
    rules: parseRules(payload, action.actionType),
  };
}

function parseViewRolePayload(action: GameAction): WerewolfViewRolePayload {
  const payload = requireRecordPayload(action);
  return {
    userId: requireString(payload, 'userId', action.actionType),
    seat: requireNumber(payload, 'seat', action.actionType),
  };
}

function parseShareReviewPayload(action: GameAction): WerewolfShareReviewPayload {
  const payload = requireRecordPayload(action);
  return { allowedSeats: requireNumberArray(payload, 'allowedSeats', action.actionType) };
}

function parseUpdateProfilePayload(action: GameAction): WerewolfUpdateProfilePayload {
  const payload = requireRecordPayload(action);
  return {
    userId: requireString(payload, 'userId', action.actionType),
    displayName: optionalString(payload, 'displayName', action.actionType),
    avatarUrl: optionalString(payload, 'avatarUrl', action.actionType),
    avatarFrame: optionalString(payload, 'avatarFrame', action.actionType),
    seatFlair: optionalString(payload, 'seatFlair', action.actionType),
    nameStyle: optionalString(payload, 'nameStyle', action.actionType),
    roleRevealEffect: optionalString(payload, 'roleRevealEffect', action.actionType),
    seatAnimation: optionalString(payload, 'seatAnimation', action.actionType),
  };
}

function parseBoardNominatePayload(action: GameAction): WerewolfBoardNominatePayload {
  const payload = requireRecordPayload(action);
  return {
    userId: requireString(payload, 'userId', action.actionType),
    displayName: requireString(payload, 'displayName', action.actionType),
    roles: requireRoleIdArray(payload, 'roles', action.actionType),
  };
}

function parseBoardUpvotePayload(action: GameAction): WerewolfBoardUpvotePayload {
  const payload = requireRecordPayload(action);
  return {
    voterUid: requireString(payload, 'voterUid', action.actionType),
    targetUserId: requireString(payload, 'targetUserId', action.actionType),
  };
}

function parseBoardWithdrawPayload(action: GameAction): WerewolfBoardWithdrawPayload {
  const payload = requireRecordPayload(action);
  return { userId: requireString(payload, 'userId', action.actionType) };
}

function parseSubmitActionPayload(action: GameAction): WerewolfSubmitActionPayload {
  const payload = requireRecordPayload(action);
  return {
    seat: requireNumber(payload, 'seat', action.actionType),
    role: requireRoleId(payload, 'role', action.actionType),
    target: requireNumberOrNull(payload, 'target', action.actionType),
    extra: payload.extra,
  };
}

function parseAudioGatePayload(action: GameAction): WerewolfAudioGatePayload {
  const payload = requireRecordPayload(action);
  return { isPlaying: requireBoolean(payload, 'isPlaying', action.actionType) };
}

function parseWolfRobotViewedPayload(action: GameAction): WerewolfWolfRobotViewedPayload {
  const payload = requireRecordPayload(action);
  return { seat: requireNumber(payload, 'seat', action.actionType) };
}

function parseGroupConfirmAckPayload(action: GameAction): WerewolfGroupConfirmAckPayload {
  const payload = requireRecordPayload(action);
  return {
    seat: requireNumber(payload, 'seat', action.actionType),
    userId: requireString(payload, 'userId', action.actionType),
  };
}

function addAudioActions(result: HandlerResult): HandlerResult {
  if (result.kind === 'error') return result;
  const audioActions = extractAudioActions(result.sideEffects);
  if (audioActions.length === 0) return result;
  return {
    ...result,
    actions: [...result.actions, ...audioActions],
  };
}

function buildGroupConfirmAckActions(
  state: WerewolfState,
  seat: number,
  userId: string,
): EngineResult<StateAction> {
  if (state.status !== GameStatus.Ongoing) {
    return engineError('not_ongoing');
  }
  const stepId = state.currentStepId;
  if (!stepId) return engineError('no_current_step');
  const schema = SCHEMAS[stepId];
  if (!schema || schema.kind !== 'groupConfirm') {
    return engineError('not_group_confirm_step');
  }
  const player = state.players[seat];
  if (!player) return engineError('no_player_at_seat');
  if (player.userId !== userId && userId !== state.hostUserId) {
    return engineError('userId_mismatch');
  }

  const isConversionReveal = stepId === 'awakenedGargoyleConvertReveal';
  const isCupidLoversReveal = stepId === 'cupidLoversReveal';
  const acks = isConversionReveal
    ? (state.conversionRevealAcks ?? [])
    : isCupidLoversReveal
      ? (state.cupidLoversRevealAcks ?? [])
      : (state.piperRevealAcks ?? []);
  if (acks.includes(seat)) return engineSuccess([], undefined, undefined, null);

  const actions: StateAction[] = isConversionReveal
    ? [{ type: 'ADD_CONVERSION_REVEAL_ACK', payload: { seat } }]
    : isCupidLoversReveal
      ? [{ type: 'ADD_CUPID_LOVERS_REVEAL_ACK', payload: { seat } }]
      : [{ type: 'ADD_PIPER_REVEAL_ACK', payload: { seat } }];

  return engineSuccess(actions, undefined, undefined, null);
}

function buildMarkBotsGroupConfirmedActions(state: WerewolfState): EngineResult<StateAction> {
  if (!state.debugMode?.botsEnabled) {
    return engineError('debug_not_enabled');
  }
  if (state.status !== GameStatus.Ongoing) {
    return engineError('not_ongoing');
  }
  const stepId = state.currentStepId;
  if (!stepId) return engineError('no_current_step');
  const schema = SCHEMAS[stepId];
  if (!schema || schema.kind !== 'groupConfirm') {
    return engineError('not_group_confirm_step');
  }

  const isConversionReveal = stepId === 'awakenedGargoyleConvertReveal';
  const isCupidLoversReveal = stepId === 'cupidLoversReveal';
  const existingAcks = isConversionReveal
    ? (state.conversionRevealAcks ?? [])
    : isCupidLoversReveal
      ? (state.cupidLoversRevealAcks ?? [])
      : (state.piperRevealAcks ?? []);

  const actions: StateAction[] = [];
  for (const [seatStr, player] of Object.entries(state.players)) {
    if (!player?.isBot) continue;
    const seat = Number.parseInt(seatStr, 10);
    if (existingAcks.includes(seat)) continue;

    if (isConversionReveal) {
      actions.push({ type: 'ADD_CONVERSION_REVEAL_ACK', payload: { seat } });
    } else if (isCupidLoversReveal) {
      actions.push({ type: 'ADD_CUPID_LOVERS_REVEAL_ACK', payload: { seat } });
    } else {
      actions.push({ type: 'ADD_PIPER_REVEAL_ACK', payload: { seat } });
    }
  }

  return engineSuccess(actions, undefined, undefined, null);
}

function dispatchSeatAction(state: WerewolfState, action: GameAction): EngineResult<StateAction> {
  const payload = parseSeatPayload(action);
  const ctx = buildHandlerContext(state, payload.userId);

  if (payload.action === 'sit') {
    return fromHandlerResult(
      handleJoinSeat(
        {
          type: 'JOIN_SEAT',
          payload: {
            seat: payload.seat,
            userId: payload.userId,
            displayName: payload.displayName,
            avatarUrl: payload.avatarUrl,
            avatarFrame: payload.avatarFrame,
            seatFlair: payload.seatFlair,
            nameStyle: payload.nameStyle,
            roleRevealEffect: payload.roleRevealEffect,
            seatAnimation: payload.seatAnimation,
            level: payload.level,
          },
        },
        ctx,
      ),
      null,
    );
  }

  if (payload.action === 'kick') {
    return fromHandlerResult(
      handleKickPlayer({ type: 'KICK_PLAYER', payload: { targetSeat: payload.targetSeat } }, ctx),
      'KICK_PLAYER',
    );
  }

  return fromHandlerResult(
    handleLeaveMySeat({ type: 'LEAVE_MY_SEAT', payload: { userId: payload.userId } }, ctx),
    null,
  );
}

export function dispatchWerewolf(
  state: WerewolfState,
  _revision: number,
  action: GameAction,
): EngineResult<StateAction> {
  switch (action.actionType) {
    case WEREWOLF_ACTION.ASSIGN_ROLES:
      return fromHandlerResult(
        handleAssignRoles({ type: 'ASSIGN_ROLES' }, buildHandlerContext(state, state.hostUserId)),
        WEREWOLF_ACTION.ASSIGN_ROLES,
      );

    case WEREWOLF_ACTION.FILL_WITH_BOTS:
      return fromHandlerResult(
        handleFillWithBots(
          { type: 'FILL_WITH_BOTS' },
          buildHandlerContext(state, state.hostUserId),
        ),
      );

    case WEREWOLF_ACTION.MARK_ALL_BOTS_VIEWED:
      return fromHandlerResult(
        handleMarkAllBotsViewed(
          { type: 'MARK_ALL_BOTS_VIEWED' },
          buildHandlerContext(state, state.hostUserId),
        ),
      );

    case WEREWOLF_ACTION.CLEAR_ALL_SEATS:
      return fromHandlerResult(
        handleClearAllSeats(
          { type: 'CLEAR_ALL_SEATS' },
          buildHandlerContext(state, state.hostUserId),
        ),
        WEREWOLF_ACTION.CLEAR_ALL_SEATS,
      );

    case WEREWOLF_ACTION.RESTART_GAME:
      return fromHandlerResult(
        handleRestartGame({ type: 'RESTART_GAME' }, buildHandlerContext(state, state.hostUserId)),
        WEREWOLF_ACTION.RESTART_GAME,
      );

    case WEREWOLF_ACTION.SEAT:
      return dispatchSeatAction(state, action);

    case WEREWOLF_ACTION.START_NIGHT:
      return fromHandlerResult(
        addAudioActions(
          handleStartNight({ type: 'START_NIGHT' }, buildHandlerContext(state, state.hostUserId)),
        ),
        WEREWOLF_ACTION.START_NIGHT,
      );

    case WEREWOLF_ACTION.UPDATE_TEMPLATE: {
      const payload = parseUpdateTemplatePayload(action);
      return fromHandlerResult(
        handleUpdateTemplate(
          { type: 'UPDATE_TEMPLATE', payload },
          buildHandlerContext(state, state.hostUserId),
        ),
      );
    }

    case WEREWOLF_ACTION.VIEW_ROLE: {
      const payload = parseViewRolePayload(action);
      return fromHandlerResult(
        handleViewedRole(
          { type: 'VIEWED_ROLE', payload: { seat: payload.seat } },
          buildHandlerContext(state, payload.userId),
        ),
      );
    }

    case WEREWOLF_ACTION.SHARE_REVIEW: {
      const payload = parseShareReviewPayload(action);
      return fromHandlerResult(
        handleShareNightReview(
          { type: 'SHARE_NIGHT_REVIEW', allowedSeats: payload.allowedSeats },
          buildHandlerContext(state, state.hostUserId),
        ),
      );
    }

    case WEREWOLF_ACTION.UPDATE_PROFILE: {
      const payload = parseUpdateProfilePayload(action);
      return fromHandlerResult(
        handleUpdatePlayerProfile(
          { type: 'UPDATE_PLAYER_PROFILE', payload },
          buildHandlerContext(state, payload.userId),
        ),
      );
    }

    case WEREWOLF_ACTION.BOARD_NOMINATE: {
      const payload = parseBoardNominatePayload(action);
      return fromHandlerResult(
        handleBoardNominate(
          { type: 'BOARD_NOMINATE', payload },
          buildHandlerContext(state, payload.userId),
        ),
      );
    }

    case WEREWOLF_ACTION.BOARD_UPVOTE: {
      const payload = parseBoardUpvotePayload(action);
      return fromHandlerResult(
        handleBoardUpvote(
          { type: 'BOARD_UPVOTE', payload },
          buildHandlerContext(state, payload.voterUid),
        ),
      );
    }

    case WEREWOLF_ACTION.BOARD_WITHDRAW: {
      const payload = parseBoardWithdrawPayload(action);
      return fromHandlerResult(
        handleBoardWithdraw(
          { type: 'BOARD_WITHDRAW', payload },
          buildHandlerContext(state, payload.userId),
        ),
      );
    }

    case WEREWOLF_ACTION.SUBMIT_ACTION: {
      const payload = parseSubmitActionPayload(action);
      return fromHandlerResult(
        handleSubmitAction(
          {
            type: 'SUBMIT_ACTION',
            payload: {
              seat: payload.seat,
              role: payload.role,
              target: payload.target,
              extra: payload.extra,
            },
          },
          buildHandlerContext(state, state.hostUserId),
        ),
      );
    }

    case WEREWOLF_ACTION.AUDIO_ACK:
      if (
        !state.isAudioPlaying &&
        (!state.pendingAudioEffects || state.pendingAudioEffects.length === 0)
      ) {
        return engineSuccess([], undefined, undefined, null);
      }
      return engineSuccess(
        [
          { type: 'CLEAR_PENDING_AUDIO_EFFECTS' },
          { type: 'SET_AUDIO_PLAYING', payload: { isPlaying: false } },
        ],
        undefined,
        undefined,
        null,
      );

    case WEREWOLF_ACTION.AUDIO_GATE: {
      const payload = parseAudioGatePayload(action);
      return fromHandlerResult(
        handleSetAudioPlaying(
          { type: 'SET_AUDIO_PLAYING', payload },
          buildHandlerContext(state, state.hostUserId),
        ),
      );
    }

    case WEREWOLF_ACTION.PROGRESSION:
      if (state.status !== GameStatus.Ongoing) {
        return engineError('not_ongoing');
      }
      return engineSuccess([], undefined, undefined, null);

    case WEREWOLF_ACTION.REVEAL_ACK:
      if (state.pendingRevealAcks.length === 0) {
        return engineError('no_pending_acks');
      }
      return engineSuccess(
        [{ type: 'CLEAR_REVEAL_ACKS' }],
        [{ type: 'BROADCAST_STATE' }],
        undefined,
        null,
      );

    case WEREWOLF_ACTION.WOLF_ROBOT_VIEWED: {
      const payload = parseWolfRobotViewedPayload(action);
      return fromHandlerResult(
        handleSetWolfRobotHunterStatusViewed(buildHandlerContext(state, state.hostUserId), {
          type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
          seat: payload.seat,
        }),
      );
    }

    case WEREWOLF_ACTION.GROUP_CONFIRM_ACK: {
      const payload = parseGroupConfirmAckPayload(action);
      return buildGroupConfirmAckActions(state, payload.seat, payload.userId);
    }

    case WEREWOLF_ACTION.MARK_BOTS_GROUP_CONFIRMED:
      return buildMarkBotsGroupConfirmedActions(state);

    default:
      return engineError(`UNKNOWN_ACTION:${action.actionType}`);
  }
}
