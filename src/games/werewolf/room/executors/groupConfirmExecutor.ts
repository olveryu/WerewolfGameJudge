/**
 * groupConfirmExecutor — Handles 'groupConfirmAck' ActionIntent
 *
 * Computes the personal reveal message from the view model's reveal
 * projection (AU-39), then shows the role action prompt with the
 * schema-driven confirm button.
 */

import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/session/roomCommandResult';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import type { IntentExecutor } from './types';

/** Group confirm ack executor. */
export const groupConfirmAckExecutor: IntentExecutor = (_intent, ctx) => {
  const { viewModel, currentSchema, actorSeatForUi, groupConfirmAckMutation, actionDialogs } = ctx;

  const mySeat = actorSeatForUi;
  const gcSchema = currentSchema?.kind === 'groupConfirm' ? currentSchema : null;
  const schemaId = gcSchema?.id;

  // AU-39: personal reveal facts come from the view model's reveal for the
  // current step — isSubject / partnerSeat / subjectSeats are already
  // cropped to this viewer engine-side.
  const reveal =
    mySeat !== null
      ? (viewModel.night.reveals.find((entry) => entry.stepId === schemaId) ?? null)
      : null;
  const isSubject = reveal?.isSubject ?? false;

  // Compute personal message based on schema type
  let personalMessage: string;
  let dialogTitle: string;

  if (schemaId === 'seedWolfInfectReveal') {
    personalMessage = isSubject ? gcSchema!.ui!.hypnotizedText! : gcSchema!.ui!.notHypnotizedText!;
    dialogTitle = '感染信息';
  } else if (schemaId === 'awakenedGargoyleConvertReveal') {
    personalMessage = isSubject ? gcSchema!.ui!.hypnotizedText! : gcSchema!.ui!.notHypnotizedText!;
    dialogTitle = '转化信息';
  } else if (schemaId === 'cupidLoversReveal') {
    // Cupid: show the partner seat to lovers, "not a lover" to others.
    if (isSubject && reveal?.partnerSeat != null) {
      const template = gcSchema!.ui!.loverText!;
      personalMessage = template.replace('{seat}', formatSeat(reveal.partnerSeat));
    } else {
      personalMessage = gcSchema!.ui!.notLoverText!;
    }
    dialogTitle = '情侣信息';
  } else {
    // Piper: hypnotized seats list with {seats} placeholder
    const subjectSeats = reveal?.subjectSeats ?? null;
    if (isSubject && subjectSeats !== null) {
      const seatsText = subjectSeats.map((s) => formatSeat(s)).join('、');
      const template = gcSchema!.ui!.hypnotizedText!;
      personalMessage = template.replace('{seats}', seatsText);
    } else {
      personalMessage = gcSchema!.ui!.notHypnotizedText!;
    }
    dialogTitle = '催眠信息';
  }

  roomScreenLog.debug('groupConfirmAck', { schemaId, personalMessage });

  const buttonLabel = gcSchema!.ui!.confirmButtonText!;

  const doAck = (): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      groupConfirmAckMutation.mutate(undefined, {
        onSuccess: (result) => {
          if (!isSuccessfulRoomCommand(result)) {
            const reason = getRoomCommandFailureReason(result);
            roomScreenLog.warn('groupConfirmAck failed', { reason });
            reject(new Error(reason));
          } else {
            resolve();
          }
        },
        onError: (error) => {
          handleError(error, {
            label: '确认信息',
            logger: roomScreenLog,
            feedback: 'toast',
            alertMessage: '请稍后重试',
          });
          reject(error);
        },
      });
    });

  actionDialogs.showRoleActionPrompt(dialogTitle, personalMessage, doAck, buttonLabel);
};
