/**
 * Canonical Werewolf command builders.
 *
 * This module maps facade operations to protocol commands only. The Worker is
 * responsible for actor resolution, authorization, validation, and game rules.
 */

import {
  type WerewolfActionInput,
  type WerewolfProfileUpdate,
  type WerewolfPublicCommand,
} from '@werewolf/game-engine';
import type { GameStore } from '@werewolf/game-engine/engine/store';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { AudioService } from '@/services/infra/AudioService';
import { facadeLog } from '@/utils/logger';

import type { RoomCommandDispatchOutcome, RoomCommandSession } from './roomCommandSession';
import type { PreparedRoomCommand } from './roomCommandTransport';

const NOT_CONNECTED: ActionResult = { success: false, reason: 'NOT_CONNECTED' };

export interface GameActionsContext {
  readonly store: GameStore;
  readonly audioService: AudioService;
  readonly commands: RoomCommandSession<GameState>;
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
  const roomCode = ctx.store.getState()?.roomCode;
  if (roomCode === undefined) return NOT_CONNECTED;

  return ctx.commands.dispatch({
    roomCode,
    command,
    controlledSeat,
    label,
  });
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

export function clearAllSeats(ctx: GameActionsContext): Promise<ActionResult> {
  return dispatchWerewolfCommand(ctx, { type: 'room.seat.clear' }, null, 'clearAllSeats');
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

  const stateAfterStart = ctx.store.getState();
  if (stateAfterStart === null) {
    throw new Error('[FAIL-FAST] Successful night start did not leave a committed state');
  }
  ctx.audioService.preloadForRoles(stateAfterStart.templateRoles).catch((error: unknown) => {
    facadeLog.warn('preloadForRoles failed (non-critical)', error);
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
    facadeLog.warn('submitAction failed', {
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
export function prepareAudioAck(ctx: GameActionsContext): PreparedAudioAck | null {
  const roomCode = ctx.store.getState()?.roomCode;
  if (roomCode === undefined) return null;

  return ctx.commands.prepare({
    roomCode,
    command: { type: 'werewolf.audio.ack' },
    controlledSeat: null,
  });
}

/** Dispatch the exact prepared audio ack without minting a new command id. */
export async function dispatchPreparedAudioAck(
  ctx: GameActionsContext,
  prepared: PreparedAudioAck,
): Promise<RoomCommandDispatchOutcome> {
  const roomCode = ctx.store.getState()?.roomCode;
  if (roomCode === undefined) return { kind: 'notDecided', result: NOT_CONNECTED };
  if (roomCode !== prepared.roomCode) {
    throw new Error(
      `[FAIL-FAST] Prepared audio ack belongs to room ${prepared.roomCode}, not ${roomCode}`,
    );
  }

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

export function fillWithBots(ctx: GameActionsContext): Promise<ActionResult> {
  return dispatchWerewolfCommand(ctx, { type: 'room.seat.fillBots' }, null, 'fillWithBots');
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

export function updatePlayerProfile(
  ctx: GameActionsContext,
  displayName?: string,
  avatarUrl?: string,
  avatarFrame?: string,
  seatFlair?: string,
  nameStyle?: string,
  roleRevealEffect?: string,
  seatAnimation?: string,
): Promise<ActionResult> {
  const profile: WerewolfProfileUpdate = {
    displayName,
    avatarUrl,
    avatarFrame,
    seatFlair,
    nameStyle,
    roleRevealEffect,
    seatAnimation,
  };
  return dispatchWerewolfCommand(
    ctx,
    { type: 'room.profile.update', profile },
    null,
    'updatePlayerProfile',
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
