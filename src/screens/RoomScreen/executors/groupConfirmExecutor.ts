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

  const mySeat = actorSeatForUi;
  const gcSchema = currentSchema?.kind === 'groupConfirm' ? currentSchema : null;
  const schemaId = gcSchema?.id;

  // Compute personal message based on schema type
  let personalMessage: string;
  let dialogTitle: string;

  if (schemaId === 'awakenedGargoyleConvertReveal') {
    // Awakened Gargoyle: single convertedSeat
    const isConverted = mySeat !== null && gameState?.convertedSeat === mySeat;
    personalMessage = isConverted
      ? gcSchema!.ui!.hypnotizedText!
      : gcSchema!.ui!.notHypnotizedText!;
    dialogTitle = '转化信息';
  } else if (schemaId === 'cupidLoversReveal') {
    // Cupid: loverSeats pair. Show partner seat to lovers, "not a lover" to others.
    const loverSeats = gameState?.loverSeats;
    const isLover = mySeat !== null && loverSeats?.includes(mySeat);
    if (isLover && loverSeats) {
      const partnerSeat = loverSeats[0] === mySeat ? loverSeats[1] : loverSeats[0];
      const template = gcSchema!.ui!.loverText!;
      personalMessage = template.replace('{seat}', `${partnerSeat + 1}`);
    } else {
      personalMessage = gcSchema!.ui!.notLoverText!;
    }
    dialogTitle = '情侣信息';
  } else {
    // Piper: hypnotizedSeats array with {seats} placeholder
    const hypnotizedSeats = gameState?.hypnotizedSeats ?? [];
    const isHypnotized = mySeat !== null && hypnotizedSeats.includes(mySeat);
    if (isHypnotized) {
      const seatsText = hypnotizedSeats.map((s) => `${s + 1}号`).join('、');
      const template = gcSchema!.ui!.hypnotizedText!;
      personalMessage = template.replace('{seats}', seatsText);
    } else {
      personalMessage = gcSchema!.ui!.notHypnotizedText!;
    }
    dialogTitle = '催眠信息';
  }

  roomScreenLog.debug('[handleActionIntent] groupConfirmAck', { schemaId, personalMessage });

  const doAck = () => {
    submitGroupConfirmAck();
  };

  const buttonLabel = gcSchema!.ui!.confirmButtonText!;
  actionDialogs.showRoleActionPrompt(dialogTitle, personalMessage, doAck, buttonLabel);
};
