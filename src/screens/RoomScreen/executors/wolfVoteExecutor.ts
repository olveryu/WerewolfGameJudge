/**
 * wolfVoteExecutor — Handles 'wolfVote' ActionIntent
 *
 * Shows wolf vote dialog with immune-target override text,
 * then submits via proceedWithAction.
 */

import { getWolfKillImmuneRoleIds } from '@werewolf/game-engine/models/roles';
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';

import { roomScreenLog } from '@/utils/logger';

import type { IntentExecutor } from './types';

export const wolfVoteExecutor: IntentExecutor = (intent, ctx) => {
  const {
    gameStateRef,
    currentSchema,
    effectiveSeat,
    effectiveRole,
    controlledSeat,
    proceedWithAction,
    actionDialogs,
  } = ctx;

  const seat = intent.wolfSeat ?? effectiveSeat;
  roomScreenLog.info('wolfVote', {
    'intent.wolfSeat': intent.wolfSeat,
    effectiveSeat,
    effectiveRole,
    controlledSeat,
    seat,
    targetSeat: intent.targetSeat,
  });
  if (seat === null) {
    roomScreenLog.warn('wolfVote: effectiveSeat is null, cannot submit', {
      effectiveSeat,
      effectiveRole,
      controlledSeat,
    });
    return;
  }
  actionDialogs.showWolfVoteDialog(
    `${formatSeat(seat)}狼人`,
    intent.targetSeat,
    () => {
      void proceedWithAction(intent.targetSeat === -1 ? null : intent.targetSeat);
    },
    (() => {
      // Only override for immune targets — normal text comes from schema templates.
      if (intent.targetSeat < 0) return undefined;
      const targetRole = gameStateRef.current?.players?.get(intent.targetSeat)?.role;
      if (currentSchema?.id !== 'wolfKill' || !targetRole) return undefined;
      const immune = getWolfKillImmuneRoleIds().includes(targetRole);
      if (!immune) return undefined;
      const tpl = currentSchema.ui?.voteConfirmTemplate ?? '';
      const resolved = tpl
        .replace('{wolf}', `${formatSeat(seat)}狼人`)
        .replace('{seat}', `${formatSeat(intent.targetSeat)}`);
      return `${resolved}\n（该角色免疫狼人袭击）`;
    })(),
    currentSchema!,
  );
};
