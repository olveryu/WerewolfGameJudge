/** Canonical shared room-seat command builders for the Werewolf facade. */

import type { WerewolfPublicCommand } from '@werewolf/game-engine';
import type { GameStore } from '@werewolf/game-engine/engine/store';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import { facadeLog } from '@/utils/logger';

import type { SeatProfile } from '../types/IGameFacade';
import type { RoomCommandSession } from './roomCommandSession';

const NOT_CONNECTED: ActionResult = { success: false, reason: 'NOT_CONNECTED' };

export interface SeatActionsContext {
  readonly store: GameStore;
  readonly commands: RoomCommandSession<GameState>;
}

async function dispatchSeatCommand(
  ctx: SeatActionsContext,
  command: WerewolfPublicCommand,
  label: string,
): Promise<ActionResult> {
  const roomCode = ctx.store.getState()?.roomCode;
  if (roomCode === undefined) return NOT_CONNECTED;

  return ctx.commands.dispatch({
    roomCode,
    command,
    controlledSeat: null,
    label,
  });
}

export function takeSeat(
  ctx: SeatActionsContext,
  seat: number,
  profile: SeatProfile,
): Promise<ActionResult> {
  facadeLog.debug('takeSeat', { seat });
  return dispatchSeatCommand(
    ctx,
    { type: 'room.seat.take', seat, profile: { ...profile } },
    'takeSeat',
  );
}

export function leaveSeat(ctx: SeatActionsContext): Promise<ActionResult> {
  facadeLog.debug('leaveSeat');
  return dispatchSeatCommand(ctx, { type: 'room.seat.leave' }, 'leaveSeat');
}

export function kickPlayer(ctx: SeatActionsContext, targetSeat: number): Promise<ActionResult> {
  facadeLog.debug('kickPlayer', { targetSeat });
  return dispatchSeatCommand(ctx, { type: 'room.seat.kick', seat: targetSeat }, 'kickPlayer');
}
