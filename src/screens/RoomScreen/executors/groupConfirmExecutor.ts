/**
 * groupConfirmExecutor — Handles 'groupConfirmAck' ActionIntent
 *
 * Computes personal hypnotize message from gameState, then shows
 * role action prompt with schema-driven confirm button.
 */

import { roomScreenLog } from '@/utils/logger';

import type { IntentExecutor } from './types';

export const groupConfirmAckExecutor: IntentExecutor = (_intent, ctx) => {
  const { gameState, currentSchema, actorSeatForUi, submitGroupConfirmAck, actionDialogs } = ctx;

  // Compute personal hypnotize message inline (like confirmTrigger reads confirmStatus)
  const mySeat = actorSeatForUi;
  const hypnotizedSeats = gameState?.hypnotizedSeats ?? [];
  const isHypnotized = mySeat !== null && hypnotizedSeats.includes(mySeat);
  const gcSchema = currentSchema?.kind === 'groupConfirm' ? currentSchema : null;

  let personalMessage: string;
  if (isHypnotized) {
    const seatsText = hypnotizedSeats.map((s) => `${s + 1}号`).join('、');
    const template = gcSchema!.ui!.hypnotizedText!;
    personalMessage = template.replace('{seats}', seatsText);
  } else {
    personalMessage = gcSchema!.ui!.notHypnotizedText!;
  }

  roomScreenLog.debug('[handleActionIntent] groupConfirmAck', { personalMessage });

  const doAck = () => {
    submitGroupConfirmAck();
  };

  const buttonLabel = gcSchema!.ui!.confirmButtonText!;
  actionDialogs.showRoleActionPrompt('催眠信息', personalMessage, doAck, buttonLabel);
};
