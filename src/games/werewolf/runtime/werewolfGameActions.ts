/**
 * Canonical Werewolf runtime command builders.
 *
 * This module maps facade operations to protocol commands only. The Worker is
 * responsible for actor resolution, authorization, validation, and game rules.
 */

import type { RoleId } from '@werewolf/game-engine/games/werewolf/public';
import type { GameTemplate } from '@werewolf/game-engine/games/werewolf/public';
import type { GameState } from '@werewolf/game-engine/games/werewolf/public';
import {
  type WerewolfActionInput,
  type WerewolfPublicCommand,
} from '@werewolf/game-engine/games/werewolf/public';
import type { ActionResult } from '@werewolf/game-engine/platform/protocol/actionResult';

import type {
  PreparedRoomCommand,
  RoomCommandDispatchOutcome,
  RoomSessionClient,
} from '@/features/room/session/types';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type { WerewolfUserEvent } from '@/games/werewolf/realtime/werewolfUserEventCodec';
import { werewolfRuntimeLog } from '@/utils/logger';

export interface GameActionsContext {
  readonly getState: () => GameState;
  readonly audio: WerewolfAudioRuntime;
  readonly commands: RoomSessionClient<GameState, WerewolfPublicCommand, WerewolfUserEvent>;
}

type AudioAckCommand = Extract<WerewolfPublicCommand, { readonly type: 'werewolf.audio.ack' }>;

/** Audio ack envelope retained by the orchestrator until one receipt is observed. */
export type PreparedAudioAck = PreparedRoomCommand<AudioAckCommand>;

async function dispatchWerewolfCommand(
  ctx: GameActionsContext,
  command: WerewolfPublicCommand,
  controlledSeat: number | null,
  label: string,
): Promise<ActionResult> {
  const outcome = await ctx.commands.dispatch(command, {
    controlledSeat,
    label,
  });
  return toWerewolfActionResult(outcome);
}

export function toWerewolfActionResult(
  outcome: RoomCommandDispatchOutcome<GameState>,
): ActionResult {
  if (outcome.kind === 'superseded') {
    throw new Error(`Werewolf command ${outcome.commandId} was superseded by another session`);
  }
  if (outcome.kind !== 'decided') {
    return { success: false, reason: outcome.reason };
  }
  if (outcome.decision.kind === 'rejected') {
    return { success: false, reason: outcome.decision.reason };
  }
  return outcome.decision.outcome.kind === 'domainRejected'
    ? { success: false, reason: outcome.decision.outcome.reason }
    : outcome.decision.outcome.reason === undefined
      ? { success: true }
      : { success: true, reason: outcome.decision.outcome.reason };
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

export function assignRoles(ctx: GameActionsContext): Promise<ActionResult> {
  return dispatchWerewolfCommand(ctx, { type: 'werewolf.roles.assign' }, null, 'assignRoles');
}

export function updateTemplate(
  ctx: GameActionsContext,
  template: GameTemplate,
): Promise<ActionResult> {
  return dispatchWerewolfCommand(
    ctx,
    {
      type: 'werewolf.config.update',
      templateRoles: [...template.roles],
      rules: template.rules === undefined ? undefined : { ...template.rules },
    },
    null,
    'updateTemplate',
  );
}

export function restartGame(ctx: GameActionsContext): Promise<ActionResult> {
  return dispatchWerewolfCommand(ctx, { type: 'werewolf.game.restart' }, null, 'restartGame');
}

export function markViewedRole(
  ctx: GameActionsContext,
  controlledSeat: number | null,
): Promise<ActionResult> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.role.view' },
    controlledSeat,
    'markViewedRole',
  );
}

export async function startNight(ctx: GameActionsContext): Promise<ActionResult> {
  const result = await dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.night.start' },
    null,
    'startNight',
  );
  if (!result.success) return result;

  const stateAfterStart = ctx.getState();
  ctx.audio.preloadRoles(stateAfterStart.templateRoles).catch((error: unknown) => {
    werewolfRuntimeLog.warn('Werewolf narration preload failed', error);
  });
  return result;
}

export function shareNightReview(
  ctx: GameActionsContext,
  allowedSeats: readonly number[],
): Promise<ActionResult> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.review.share', allowedSeats: [...allowedSeats] },
    null,
    'shareNightReview',
  );
}

export async function submitAction(
  ctx: GameActionsContext,
  input: WerewolfActionInput,
  controlledSeat: number | null,
): Promise<ActionResult> {
  const result = await dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.action.submit', input: copyActionInput(input) },
    controlledSeat,
    'submitAction',
  );
  if (!result.success) {
    werewolfRuntimeLog.warn('submitAction failed', {
      reason: result.reason,
      inputKind: input.kind,
      controlledSeat,
    });
  }
  return result;
}

export function setAudioPlaying(
  ctx: GameActionsContext,
  isPlaying: boolean,
): Promise<ActionResult> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.audio.gate', isPlaying },
    null,
    'setAudioPlaying',
  );
}

export function submitRevealAck(
  ctx: GameActionsContext,
  controlledSeat: number | null,
): Promise<ActionResult> {
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
): Promise<ActionResult> {
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
): Promise<ActionResult> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.wolfRobot.ackHunterStatus' },
    controlledSeat,
    'setWolfRobotHunterStatusViewed',
  );
}

/** Prepare one audio ack command for its initial send and any later recovery sends. */
export function prepareAudioAck(ctx: GameActionsContext): PreparedAudioAck {
  return ctx.commands.prepare({ type: 'werewolf.audio.ack' }, null);
}

/** Dispatch the exact prepared audio ack without minting a new command id. */
export async function dispatchPreparedAudioAck(
  ctx: GameActionsContext,
  prepared: PreparedAudioAck,
): Promise<RoomCommandDispatchOutcome<GameState>> {
  return ctx.commands.dispatchPrepared(prepared, 'postAudioAck');
}

export function postProgression(ctx: GameActionsContext): Promise<ActionResult> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.progress.request' },
    null,
    'postProgression',
  );
}

export function markAllBotsViewed(ctx: GameActionsContext): Promise<ActionResult> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.bots.markRolesViewed' },
    null,
    'markAllBotsViewed',
  );
}

export function markAllBotsGroupConfirmed(ctx: GameActionsContext): Promise<ActionResult> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.groupConfirm.ackBots' },
    null,
    'markAllBotsGroupConfirmed',
  );
}

export function boardNominate(
  ctx: GameActionsContext,
  displayName: string,
  roles: readonly RoleId[],
): Promise<ActionResult> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.board.nominate', displayName, roles: [...roles] },
    null,
    'boardNominate',
  );
}

export function boardUpvote(ctx: GameActionsContext, targetUserId: string): Promise<ActionResult> {
  return dispatchWerewolfCommand(
    ctx,
    { type: 'werewolf.board.upvote', targetUserId },
    null,
    'boardUpvote',
  );
}

export function boardWithdraw(ctx: GameActionsContext): Promise<ActionResult> {
  return dispatchWerewolfCommand(ctx, { type: 'werewolf.board.withdraw' }, null, 'boardWithdraw');
}
