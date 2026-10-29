/**
 * Canonical Werewolf runtime command builders.
 *
 * This module maps client operations to protocol commands only. The Worker is
 * responsible for actor resolution, authorization, validation, and game rules.
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type { GameTemplate } from '@game-judge/game-engine/games/werewolf/public';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import {
  type WerewolfActionInput,
  type WerewolfExpectedStep,
  type WerewolfMvpSelection,
  type WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';

import { isSuccessfulRoomCommand } from '@/features/room/link/roomCommandResult';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type { DispatchOutcome, RoomLink } from '@/platform/realtime/types';
import { werewolfRuntimeLog } from '@/utils/logger';

export interface GameActionsContext {
  readonly getState: () => GameState;
  readonly audio: WerewolfAudioRuntime;
  readonly commands: RoomLink<GameState, WerewolfPublicCommand>;
}

type WerewolfCommandDispatchOutcome = DispatchOutcome<GameState>;

async function dispatchWerewolfCommand(
  ctx: GameActionsContext,
  command: WerewolfPublicCommand,
  controlledSeat: number | null,
  label: string,
  durable = false,
): Promise<WerewolfCommandDispatchOutcome> {
  return ctx.commands.dispatch(command, { controlledSeat, label, durable });
}

function getExpectedActionStep(state: GameState): WerewolfExpectedStep {
  if (state.nightStep?.kind !== 'inStep') {
    throw new Error('[FAIL-FAST] Recoverable Werewolf action requires an active night step');
  }
  return {
    currentStepId: state.nightStep.stepId,
    roleRevealRandomNonce: state.roleRevealRandomNonce ?? null,
  };
}

function copyActionInput(input: WerewolfActionInput): WerewolfActionInput {
  switch (input.kind) {
    case 'target':
      return { kind: 'target', target: input.target };
    case 'multiTarget':
      return { kind: 'multiTarget', targets: [...input.targets] };
    case 'confirm':
      return { kind: 'confirm' };
    case 'witch':
      return {
        kind: 'witch',
        saveTarget: input.saveTarget,
        poisonTarget: input.poisonTarget,
      };
    case 'card':
      return { kind: 'card', cardIndex: input.cardIndex };
    case 'skip':
      return { kind: 'skip' };
  }
}

export function assignRoles(ctx: GameActionsContext): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(ctx, { type: 'werewolf.roles.assign' }, null, '分配角色');
}

export function updateTemplate(
  ctx: GameActionsContext,
  template: GameTemplate,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    {
      type: 'werewolf.config.update',
      templateRoles: [...template.roles],
      rules: template.rules === undefined ? undefined : { ...template.rules },
    },
    null,
    '保存设置',
  );
}

export function abortGame(ctx: GameActionsContext): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(ctx, { type: 'werewolf.game.abort' }, null, '中止本局');
}

export function returnToLobby(ctx: GameActionsContext): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(ctx, { type: 'werewolf.game.returnToLobby' }, null, '返回大厅');
}

export function redealGame(ctx: GameActionsContext): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(ctx, { type: 'werewolf.game.redeal' }, null, '再来一局');
}

/** Submit the selected player for the captured round without restarting it. */
export function selectMvp(
  ctx: GameActionsContext,
  selection: WerewolfMvpSelection,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.mvp.select', selection: { ...selection } },
    null,
    '评选 MVP',
    true,
  );
}

export function markViewedRole(
  ctx: GameActionsContext,
  controlledSeat: number | null,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(ctx, { type: 'werewolf.role.viewed' }, controlledSeat, '确认查看');
}

export async function startNight(ctx: GameActionsContext): Promise<WerewolfCommandDispatchOutcome> {
  const result = await dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.game.begin' },
    null,
    '开始游戏',
  );
  if (!isSuccessfulRoomCommand(result)) return result;

  const stateAfterStart = ctx.getState();
  ctx.audio.preloadRoles(stateAfterStart.templateRoles).catch((error: unknown) => {
    werewolfRuntimeLog.warn('Werewolf narration preload failed', error);
  });
  return result;
}

export function shareNightReview(
  ctx: GameActionsContext,
  allowedSeats: readonly number[],
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.review.share', allowedSeats: [...allowedSeats] },
    null,
    '分享战报',
  );
}

export async function submitAction(
  ctx: GameActionsContext,
  input: WerewolfActionInput,
  controlledSeat: number | null,
): Promise<WerewolfCommandDispatchOutcome> {
  const expectedStep = getExpectedActionStep(ctx.getState());
  const result = await dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.action.submit', input: copyActionInput(input), expectedStep },
    controlledSeat,
    'submitAction',
    true,
  );
  if (!isSuccessfulRoomCommand(result)) {
    werewolfRuntimeLog.warn('submitAction failed', {
      delivery: result.kind,
      inputKind: input.kind,
      controlledSeat,
    });
  }
  return result;
}

export function submitRevealAck(
  ctx: GameActionsContext,
  controlledSeat: number | null,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.reveal.ack' },
    controlledSeat,
    'submitRevealAck',
  );
}

export function submitGroupConfirmAck(
  ctx: GameActionsContext,
  controlledSeat: number | null,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.groupConfirm.ack' },
    controlledSeat,
    'submitGroupConfirmAck',
  );
}

export function setWolfRobotHunterStatusViewed(
  ctx: GameActionsContext,
  controlledSeat: number | null,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.wolfRobot.ackHunterStatus' },
    controlledSeat,
    'setWolfRobotHunterStatusViewed',
  );
}

/** Durable audio ack for one batch: RoomLink replays it across sockets until the server decides. */
export function postAudioAck(
  ctx: GameActionsContext,
  audioBatchId: number,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.audio.ack', audioBatchId },
    null,
    '音频确认',
    true,
  );
}

export function postProgression(ctx: GameActionsContext): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.progress.request' },
    null,
    'postProgression',
  );
}

export function markAllBotsViewed(
  ctx: GameActionsContext,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.bots.markAllBotsViewed' },
    null,
    '标记机器人已查看',
  );
}

export function markAllBotsGroupConfirmed(
  ctx: GameActionsContext,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.groupConfirm.ackBots' },
    null,
    '标记机器人已确认',
  );
}

export function boardNominate(
  ctx: GameActionsContext,
  displayName: string,
  roles: readonly RoleId[],
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.board.nominate', displayName, roles: [...roles] },
    null,
    'boardNominate',
  );
}

export function boardUpvote(
  ctx: GameActionsContext,
  targetUserId: string,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.board.upvote', targetUserId },
    null,
    'boardUpvote',
  );
}

export function boardWithdraw(ctx: GameActionsContext): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(ctx, { type: 'werewolf.board.withdraw' }, null, 'boardWithdraw');
}

export function registerSheriffCandidate(
  ctx: GameActionsContext,
  controlledSeat: number | null,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.sheriff.register' },
    controlledSeat,
    'registerSheriffCandidate',
  );
}

export function cancelSheriffRegistration(
  ctx: GameActionsContext,
  controlledSeat: number | null,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.sheriff.cancelRegistration' },
    controlledSeat,
    'cancelSheriffRegistration',
  );
}

export function withdrawSheriffCandidate(
  ctx: GameActionsContext,
  controlledSeat: number | null,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.sheriff.withdraw' },
    controlledSeat,
    'withdrawSheriffCandidate',
  );
}

export function castSheriffVote(
  ctx: GameActionsContext,
  targetSeat: number | null,
  controlledSeat: number | null,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.sheriff.vote', targetSeat },
    controlledSeat,
    'castSheriffVote',
  );
}

export function advanceSheriffElection(
  ctx: GameActionsContext,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.sheriff.advance' },
    null,
    'advanceSheriffElection',
  );
}

export function endSheriffElectionBySelfDestruct(
  ctx: GameActionsContext,
): Promise<WerewolfCommandDispatchOutcome> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.sheriff.endBySelfDestruct' },
    null,
    'endSheriffElectionBySelfDestruct',
  );
}
