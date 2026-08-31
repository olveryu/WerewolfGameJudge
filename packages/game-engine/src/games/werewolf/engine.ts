/** Concrete authoritative Werewolf engine definition. */

import {
  type CommandContext,
  type CommonGameLifecycle,
  type CreateGameContext,
  type Decision,
  type GameEngineDefinition,
  reject,
} from '../../platform/engine';
import { WEREWOLF_GAME_TYPE, type WerewolfGameType } from '../../platform/protocol/gameTypes';
import { REASON_CONTROLLED_SEAT_NOT_ALLOWED } from '../../platform/protocol/reasons';
import type { WerewolfCommand } from './commands/types';
import { resolveSubmitActionIntent } from './domain/actionInput';
import {
  resolveEffectiveSeatActor,
  resolveHostActor,
  resolveSystemActor,
  resolveUncontrolledUserActor,
  resolveUserActor,
} from './domain/actor';
import { handlerResultToDecision } from './domain/decision';
import { handleSubmitAction } from './domain/handlers/actionHandler';
import {
  handleApplyRosterLevels,
  handleAudioAck,
  handleGroupConfirmAck,
  handleMarkBotsGroupConfirmed,
  handleProgressionRequest,
  handleRevealAck,
} from './domain/handlers/commandHandlers';
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
} from './domain/handlers/gameControlHandler';
import {
  handleClearAllSeats,
  handleJoinSeat,
  handleKickPlayer,
  handleLeaveMySeat,
  handleUpdatePlayerProfile,
} from './domain/handlers/seatHandler';
import {
  handleAdvanceSheriffElection,
  handleCancelSheriffRegistration,
  handleCastSheriffVote,
  handleRegisterSheriffCandidate,
  handleWithdrawSheriffCandidate,
} from './domain/handlers/sheriffElectionHandler';
import type { HandlerResult } from './domain/handlers/types';
import { handleViewedRole } from './domain/handlers/viewedRoleHandler';
import { handleSetWolfRobotHunterStatusViewed } from './domain/handlers/wolfRobotHunterGateHandler';
import {
  createTemplateFromRoles,
  type GameRuleOverrides,
  GameStatus,
  type RoleId,
  validateTemplateRoles,
} from './domain/models';
import type { GameState } from './domain/protocol/types';
import { gameReducer } from './domain/reducer/gameReducer';
import type { StateAction } from './domain/reducer/types';
import { buildInitialGameState } from './domain/state/buildInitialState';
import { normalizeState } from './domain/state/normalize';
import { createWerewolfGameEndedEffect } from './effects/gameEnded';
import type { WerewolfEffect } from './effects/types';
import { WEREWOLF_STATE_VERSION } from './state/version';

export interface WerewolfConfig {
  readonly templateRoles: readonly RoleId[];
  readonly rules?: Readonly<GameRuleOverrides>;
}

type WerewolfDecision = Decision<StateAction, WerewolfEffect>;

function commandAllowsControlledSeat(command: WerewolfCommand): boolean {
  switch (command.type) {
    case 'werewolf.action.submit':
    case 'werewolf.role.view':
    case 'werewolf.reveal.ack':
    case 'werewolf.wolfRobot.ackHunterStatus':
    case 'werewolf.groupConfirm.ack':
    case 'werewolf.sheriff.register':
    case 'werewolf.sheriff.cancelRegistration':
    case 'werewolf.sheriff.withdraw':
    case 'werewolf.sheriff.vote':
      return true;
    case 'room.seat.take':
    case 'room.seat.leave':
    case 'room.seat.kick':
    case 'room.seat.clear':
    case 'room.seat.fillBots':
    case 'room.profile.update':
    case 'werewolf.roles.assign':
    case 'werewolf.game.restart':
    case 'werewolf.bots.markRolesViewed':
    case 'werewolf.config.update':
    case 'werewolf.review.share':
    case 'werewolf.board.nominate':
    case 'werewolf.board.upvote':
    case 'werewolf.board.withdraw':
    case 'werewolf.night.start':
    case 'werewolf.sheriff.advance':
    case 'werewolf.audio.ack':
    case 'werewolf.progress.request':
    case 'werewolf.groupConfirm.ackBots':
    case 'werewolf.growth.applyRosterLevels':
      return false;
  }
  const exhaustive: never = command;
  return exhaustive;
}

function decideHandler(
  state: GameState,
  result: HandlerResult,
  context: CommandContext,
  progressAfterSuccess = false,
): WerewolfDecision {
  return handlerResultToDecision(state, result, context, { progressAfterSuccess });
}

function validateRevealAckActor(state: GameState, actorSeat: number): string | null {
  if (state.pendingRevealAcks.length === 0) return null;

  const stepId = state.currentStepId;
  if (stepId === undefined || !state.pendingRevealAcks.includes(stepId)) {
    throw new Error('[FAIL-FAST] Reveal acknowledgement does not match the current step');
  }

  const action = [...state.actions].reverse().find((candidate) => candidate.schemaId === stepId);
  if (action === undefined) {
    throw new Error(`[FAIL-FAST] Reveal acknowledgement has no action for step ${stepId}`);
  }
  return action.actorSeat === actorSeat ? null : 'not_my_seat';
}

function createInitialState(config: WerewolfConfig, context: CreateGameContext): GameState {
  const templateRoles = [...config.templateRoles];
  const validationReason = validateTemplateRoles(templateRoles);
  if (validationReason !== null) {
    throw new Error(`Invalid Werewolf config: ${validationReason}`);
  }

  const baseTemplate = createTemplateFromRoles(templateRoles);
  const template = {
    ...baseTemplate,
    rules: {
      ...config.rules,
      isSheriffElectionEnabled: config.rules?.isSheriffElectionEnabled ?? true,
    },
  };
  return normalizeState(buildInitialGameState(context.roomCode, context.hostUserId, template));
}

export function getWerewolfLifecycle(state: GameState): CommonGameLifecycle {
  switch (state.status) {
    case GameStatus.Unseated:
    case GameStatus.Seated:
    case GameStatus.Assigned:
    case GameStatus.Ready:
      return 'setup';
    case GameStatus.Ongoing:
    case GameStatus.Day:
      return 'ongoing';
    case GameStatus.Ended:
      return 'ended';
  }
  const exhaustive: never = state.status;
  return exhaustive;
}

function decideWerewolfCommandRules(
  state: GameState,
  command: WerewolfCommand,
  context: CommandContext,
): WerewolfDecision {
  if (context.controlledSeat !== null && !commandAllowsControlledSeat(command)) {
    return reject(REASON_CONTROLLED_SEAT_NOT_ALLOWED);
  }

  switch (command.type) {
    case 'room.seat.take': {
      const actor = resolveUncontrolledUserActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleJoinSeat(
          {
            type: 'JOIN_SEAT',
            payload: {
              seat: command.seat,
              userId: actor.value.userId,
              ...command.profile,
            },
          },
          actor.value.handlerContext,
        ),
        context,
      );
    }
    case 'room.seat.leave': {
      const actor = resolveUncontrolledUserActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleLeaveMySeat(
          { type: 'LEAVE_MY_SEAT', payload: { userId: actor.value.userId } },
          actor.value.handlerContext,
        ),
        context,
      );
    }
    case 'room.seat.kick': {
      const actor = resolveHostActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleKickPlayer(
          { type: 'KICK_PLAYER', payload: { targetSeat: command.seat } },
          actor.value.handlerContext,
        ),
        context,
      );
    }
    case 'room.seat.clear': {
      const actor = resolveHostActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleClearAllSeats({ type: 'CLEAR_ALL_SEATS' }, actor.value.handlerContext),
        context,
      );
    }
    case 'room.seat.fillBots': {
      const actor = resolveHostActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleFillWithBots({ type: 'FILL_WITH_BOTS' }, actor.value.handlerContext),
        context,
      );
    }
    case 'room.profile.update': {
      const actor = resolveUncontrolledUserActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleUpdatePlayerProfile(
          {
            type: 'UPDATE_PLAYER_PROFILE',
            payload: { userId: actor.value.userId, ...command.profile },
          },
          actor.value.handlerContext,
        ),
        context,
      );
    }
    case 'werewolf.roles.assign': {
      const actor = resolveHostActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleAssignRoles({ type: 'ASSIGN_ROLES' }, actor.value.handlerContext, context),
        context,
      );
    }
    case 'werewolf.game.restart': {
      const actor = resolveHostActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleRestartGame({ type: 'RESTART_GAME' }, actor.value.handlerContext, context),
        context,
      );
    }
    case 'werewolf.bots.markRolesViewed': {
      const actor = resolveHostActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleMarkAllBotsViewed({ type: 'MARK_ALL_BOTS_VIEWED' }, actor.value.handlerContext),
        context,
      );
    }
    case 'werewolf.action.submit': {
      const actor = resolveEffectiveSeatActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      const intent = resolveSubmitActionIntent(
        state,
        actor.value.seat,
        command.input,
        command.expectedStep,
      );
      if (intent.kind === 'rejected') return reject(intent.reason);
      return decideHandler(
        state,
        handleSubmitAction(intent.intent, actor.value.handlerContext, context),
        context,
        true,
      );
    }
    case 'werewolf.role.view': {
      const actor = resolveEffectiveSeatActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleViewedRole(
          { type: 'VIEWED_ROLE', payload: { seat: actor.value.seat } },
          actor.value.handlerContext,
        ),
        context,
      );
    }
    case 'werewolf.config.update': {
      const actor = resolveHostActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      const templateRoles = [...command.templateRoles];
      const validationReason = validateTemplateRoles(templateRoles);
      if (validationReason !== null) return reject(validationReason);
      return decideHandler(
        state,
        handleUpdateTemplate(
          {
            type: 'UPDATE_TEMPLATE',
            payload: {
              templateRoles,
              ...(command.rules === undefined ? {} : { rules: { ...command.rules } }),
            },
          },
          actor.value.handlerContext,
        ),
        context,
      );
    }
    case 'werewolf.review.share': {
      const actor = resolveHostActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleShareNightReview(
          { type: 'SHARE_NIGHT_REVIEW', allowedSeats: [...command.allowedSeats] },
          actor.value.handlerContext,
        ),
        context,
      );
    }
    case 'werewolf.board.nominate': {
      const actor = resolveUserActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleBoardNominate(
          {
            type: 'BOARD_NOMINATE',
            payload: {
              userId: actor.value.userId,
              displayName: command.displayName,
              roles: [...command.roles],
            },
          },
          actor.value.handlerContext,
        ),
        context,
      );
    }
    case 'werewolf.board.upvote': {
      const actor = resolveUserActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleBoardUpvote(
          {
            type: 'BOARD_UPVOTE',
            payload: { targetUserId: command.targetUserId, voterUid: actor.value.userId },
          },
          actor.value.handlerContext,
        ),
        context,
      );
    }
    case 'werewolf.board.withdraw': {
      const actor = resolveUserActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleBoardWithdraw(
          { type: 'BOARD_WITHDRAW', payload: { userId: actor.value.userId } },
          actor.value.handlerContext,
        ),
        context,
      );
    }
    case 'werewolf.night.start': {
      const actor = resolveHostActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleStartNight({ type: 'START_NIGHT' }, actor.value.handlerContext, context),
        context,
      );
    }
    case 'werewolf.sheriff.register': {
      const actor = resolveEffectiveSeatActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleRegisterSheriffCandidate(
          { type: 'REGISTER_SHERIFF_CANDIDATE', payload: { seat: actor.value.seat } },
          actor.value.handlerContext,
        ),
        context,
      );
    }
    case 'werewolf.sheriff.cancelRegistration': {
      const actor = resolveEffectiveSeatActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleCancelSheriffRegistration(
          { type: 'CANCEL_SHERIFF_REGISTRATION', payload: { seat: actor.value.seat } },
          actor.value.handlerContext,
        ),
        context,
      );
    }
    case 'werewolf.sheriff.withdraw': {
      const actor = resolveEffectiveSeatActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleWithdrawSheriffCandidate(
          { type: 'WITHDRAW_SHERIFF_CANDIDATE', payload: { seat: actor.value.seat } },
          actor.value.handlerContext,
        ),
        context,
      );
    }
    case 'werewolf.sheriff.vote': {
      const actor = resolveEffectiveSeatActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleCastSheriffVote(
          {
            type: 'CAST_SHERIFF_VOTE',
            payload: { voterSeat: actor.value.seat, targetSeat: command.targetSeat },
          },
          actor.value.handlerContext,
        ),
        context,
      );
    }
    case 'werewolf.sheriff.advance': {
      const actor = resolveHostActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleAdvanceSheriffElection(
          { type: 'ADVANCE_SHERIFF_ELECTION' },
          actor.value.handlerContext,
        ),
        context,
      );
    }
    case 'werewolf.audio.ack': {
      const actor = resolveHostActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(state, handleAudioAck(actor.value.handlerContext), context, true);
    }
    case 'werewolf.progress.request': {
      const actor = resolveHostActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleProgressionRequest(actor.value.handlerContext),
        context,
        true,
      );
    }
    case 'werewolf.reveal.ack': {
      const actor = resolveEffectiveSeatActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      const ownershipRejection = validateRevealAckActor(state, actor.value.seat);
      if (ownershipRejection !== null) return reject(ownershipRejection);
      return decideHandler(state, handleRevealAck(actor.value.handlerContext), context, true);
    }
    case 'werewolf.wolfRobot.ackHunterStatus': {
      const actor = resolveEffectiveSeatActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleSetWolfRobotHunterStatusViewed(actor.value.handlerContext, {
          type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
          seat: actor.value.seat,
        }),
        context,
        true,
      );
    }
    case 'werewolf.groupConfirm.ack': {
      const actor = resolveEffectiveSeatActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleGroupConfirmAck(actor.value.seat, actor.value.handlerContext),
        context,
        true,
      );
    }
    case 'werewolf.groupConfirm.ackBots': {
      const actor = resolveHostActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(
        state,
        handleMarkBotsGroupConfirmed(actor.value.handlerContext),
        context,
        true,
      );
    }
    case 'werewolf.growth.applyRosterLevels': {
      const actor = resolveSystemActor(state, context);
      if (actor.kind === 'rejected') return reject(actor.reason);
      return decideHandler(state, handleApplyRosterLevels(command.levels), context);
    }
  }

  const exhaustive: never = command;
  return exhaustive;
}

function finalizeWerewolfDecision(state: GameState, decision: WerewolfDecision): WerewolfDecision {
  if (decision.kind === 'reject' || state.status === GameStatus.Ended) return decision;

  let nextState = state;
  for (const event of decision.events) {
    nextState = gameReducer(nextState, event);
  }
  if (nextState.status !== GameStatus.Ended) return decision;

  return {
    ...decision,
    effects: [...decision.effects, createWerewolfGameEndedEffect(nextState)],
  };
}

export function decideWerewolfCommand(
  state: GameState,
  command: WerewolfCommand,
  context: CommandContext,
): WerewolfDecision {
  return finalizeWerewolfDecision(state, decideWerewolfCommandRules(state, command, context));
}

export const werewolfEngine = {
  gameType: WEREWOLF_GAME_TYPE,
  stateVersion: WEREWOLF_STATE_VERSION,
  createInitialState,
  decide: decideWerewolfCommand,
  evolve: gameReducer,
  normalize: normalizeState,
  getLifecycle: getWerewolfLifecycle,
} satisfies GameEngineDefinition<
  WerewolfGameType,
  GameState,
  WerewolfConfig,
  WerewolfCommand,
  StateAction,
  WerewolfEffect
>;

export type WerewolfEngine = typeof werewolfEngine;
