/** Pure Werewolf command handlers shared by the current Durable Object and typed engine. */

import { GameStatus } from '../models/GameStatus';
import { SCHEMAS } from '../models/roles/spec/schemas';
import type { StateAction } from '../reducer/types';
import { type HandlerContext, handlerError, type HandlerResult, handlerSuccess } from './types';

export function handleAudioAck(context: HandlerContext): HandlerResult {
  const state = context.state;
  if (!state) return handlerError('no_state');

  if (
    !state.isAudioPlaying &&
    (!state.pendingAudioEffects || state.pendingAudioEffects.length === 0)
  ) {
    return handlerSuccess([]);
  }

  return handlerSuccess([
    { type: 'CLEAR_PENDING_AUDIO_EFFECTS' },
    { type: 'SET_AUDIO_PLAYING', payload: { isPlaying: false } },
  ]);
}

export function handleProgressionRequest(context: HandlerContext): HandlerResult {
  const state = context.state;
  if (!state) return handlerError('no_state');

  if (state.status !== GameStatus.Ongoing) {
    return handlerError('not_ongoing');
  }

  return handlerSuccess([]);
}

export function handleRevealAck(context: HandlerContext): HandlerResult {
  const state = context.state;
  if (!state) return handlerError('no_state');

  if (state.pendingRevealAcks.length === 0) {
    return handlerError('no_pending_acks');
  }

  return handlerSuccess([{ type: 'CLEAR_REVEAL_ACKS' }], [{ type: 'BROADCAST_STATE' }]);
}

export function handleGroupConfirmAck(seat: number, context: HandlerContext): HandlerResult {
  const state = context.state;
  if (!state) return handlerError('no_state');

  if (state.status !== GameStatus.Ongoing) {
    return handlerError('not_ongoing');
  }

  const stepId = state.currentStepId;
  if (!stepId) return handlerError('no_current_step');

  const schema = SCHEMAS[stepId];
  if (!schema || schema.kind !== 'groupConfirm') {
    return handlerError('not_group_confirm_step');
  }

  const player = state.players[seat];
  if (!player) return handlerError('no_player_at_seat');

  if (player.userId !== context.myUserId && context.myUserId !== state.hostUserId) {
    return handlerError('userId_mismatch');
  }

  const isConversionReveal = stepId === 'awakenedGargoyleConvertReveal';
  const isCupidLoversReveal = stepId === 'cupidLoversReveal';
  const acks = isConversionReveal
    ? state.conversionRevealAcks
    : isCupidLoversReveal
      ? state.cupidLoversRevealAcks
      : state.piperRevealAcks;

  if (acks.includes(seat)) return handlerSuccess([]);

  const actions: StateAction[] = isConversionReveal
    ? [{ type: 'ADD_CONVERSION_REVEAL_ACK', payload: { seat } }]
    : isCupidLoversReveal
      ? [{ type: 'ADD_CUPID_LOVERS_REVEAL_ACK', payload: { seat } }]
      : [{ type: 'ADD_PIPER_REVEAL_ACK', payload: { seat } }];

  return handlerSuccess(actions);
}

export function handleMarkBotsGroupConfirmed(context: HandlerContext): HandlerResult {
  const state = context.state;
  if (!state) return handlerError('no_state');

  if (!state.debugMode?.botsEnabled) {
    return handlerError('debug_not_enabled');
  }

  if (state.status !== GameStatus.Ongoing) {
    return handlerError('not_ongoing');
  }

  const stepId = state.currentStepId;
  if (!stepId) return handlerError('no_current_step');

  const schema = SCHEMAS[stepId];
  if (!schema || schema.kind !== 'groupConfirm') {
    return handlerError('not_group_confirm_step');
  }

  const isConversionReveal = stepId === 'awakenedGargoyleConvertReveal';
  const isCupidLoversReveal = stepId === 'cupidLoversReveal';
  const existingAcks = isConversionReveal
    ? state.conversionRevealAcks
    : isCupidLoversReveal
      ? state.cupidLoversRevealAcks
      : state.piperRevealAcks;

  const actions: StateAction[] = [];
  for (const player of Object.values(state.players)) {
    if (!player?.isBot) continue;

    const seat = player.seat;
    if (existingAcks.includes(seat)) continue;

    if (isConversionReveal) {
      actions.push({ type: 'ADD_CONVERSION_REVEAL_ACK', payload: { seat } });
    } else if (isCupidLoversReveal) {
      actions.push({ type: 'ADD_CUPID_LOVERS_REVEAL_ACK', payload: { seat } });
    } else {
      actions.push({ type: 'ADD_PIPER_REVEAL_ACK', payload: { seat } });
    }
  }

  return handlerSuccess(actions);
}

export function handleApplyRosterLevels(
  levels: Readonly<Record<string, number>>,
  context: HandlerContext,
): HandlerResult {
  if (!context.state) return handlerError('no_state');

  return handlerSuccess([{ type: 'UPDATE_ROSTER_LEVELS', payload: { levels: { ...levels } } }]);
}
