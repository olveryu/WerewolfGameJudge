/** Pure Werewolf command handlers shared by the current Durable Object and typed engine. */

import { acknowledgeAudioQueue } from '../../../../platform/audio';
import { getBotSeats, isBotOccupant } from '../../../../platform/room/seating';
import { GameStatus } from '../models/GameStatus';
import { resolveCurrentNightStep } from '../nightStep';
import type { StateAction } from '../reducer/types';
import { type HandlerContext, handlerError, type HandlerResult, handlerSuccess } from './types';

export function handleAudioAck(context: HandlerContext): HandlerResult {
  const cleared = acknowledgeAudioQueue(context.state);
  if (cleared === null) {
    return handlerSuccess([]);
  }

  return handlerSuccess([
    { type: 'CLEAR_PENDING_AUDIO_EFFECTS' },
    { type: 'SET_AUDIO_PLAYING', payload: { isPlaying: cleared.isAudioPlaying } },
  ]);
}

export function handleProgressionRequest(context: HandlerContext): HandlerResult {
  const state = context.state;

  if (state.status !== GameStatus.Ongoing) {
    return handlerError('not_ongoing');
  }

  return handlerSuccess([]);
}

export function handleRevealAck(context: HandlerContext): HandlerResult {
  const state = context.state;

  if (state.pendingRevealAcks.length === 0) {
    return handlerError('no_pending_acks');
  }

  return handlerSuccess([{ type: 'CLEAR_REVEAL_ACKS' }]);
}

export function handleGroupConfirmAck(seat: number, context: HandlerContext): HandlerResult {
  const state = context.state;

  if (state.status !== GameStatus.Ongoing) {
    return handlerError('not_ongoing');
  }

  const current = resolveCurrentNightStep(state);
  if (!current) return handlerError('no_current_step');
  const stepId = current.stepId;

  const schema = current.schema;
  if (schema.kind !== 'groupConfirm') {
    return handlerError('not_group_confirm_step');
  }

  const player = state.players[seat];
  if (!player) return handlerError('no_player_at_seat');

  const occupant = state.roster[seat];
  const isOwnSeat =
    occupant != null && !isBotOccupant(occupant) && occupant.userId === context.myUserId;
  if (!isOwnSeat && context.myUserId !== state.hostUserId) {
    return handlerError('userId_mismatch');
  }

  const isConversionReveal = stepId === 'awakenedGargoyleConvertReveal';
  const isSeedWolfInfectionReveal = stepId === 'seedWolfInfectReveal';
  const isCupidLoversReveal = stepId === 'cupidLoversReveal';
  const acks = isConversionReveal
    ? state.conversionRevealAcks
    : isSeedWolfInfectionReveal
      ? state.seedWolfInfectionRevealAcks
      : isCupidLoversReveal
        ? state.cupidLoversRevealAcks
        : state.piperRevealAcks;

  if (acks.includes(seat)) return handlerSuccess([]);

  const actions: StateAction[] = isConversionReveal
    ? [{ type: 'ADD_CONVERSION_REVEAL_ACK', payload: { seat } }]
    : isSeedWolfInfectionReveal
      ? [{ type: 'ADD_SEED_WOLF_INFECTION_REVEAL_ACK', payload: { seat } }]
      : isCupidLoversReveal
        ? [{ type: 'ADD_CUPID_LOVERS_REVEAL_ACK', payload: { seat } }]
        : [{ type: 'ADD_PIPER_REVEAL_ACK', payload: { seat } }];

  return handlerSuccess(actions);
}

/**
 * Handle mark bots as group-confirmed (host bot-test scaffold).
 *
 * @remarks
 * This is werewolf's third host bot scaffold, next to the shared
 * fill (decideRosterFillBots) and mark-viewed (planMarkBotsViewed)
 * pieces. It deliberately stays werewolf-owned (bot-extraction plan
 * §3, content layer): the acks it writes are entries of werewolf's
 * own night-step schema set — only steps whose schema kind is
 * groupConfirm carry them, and the ack list each reveal kind reads
 * (piper / conversion / seed-wolf infection / cupid lovers) is
 * werewolf night content no other game has. Only the gates are
 * shared-shaped: bot existence from the unified roster, then
 * werewolf's own status/step gates.
 */
export function handleMarkBotsGroupConfirmed(context: HandlerContext): HandlerResult {
  const state = context.state;

  // AU-17: the gate is bot existence (debugMode is deleted).
  if (getBotSeats(state.roster).length === 0) {
    return handlerError('no_bot_seats');
  }

  if (state.status !== GameStatus.Ongoing) {
    return handlerError('not_ongoing');
  }

  const current = resolveCurrentNightStep(state);
  if (!current) return handlerError('no_current_step');
  const stepId = current.stepId;

  const schema = current.schema;
  if (schema.kind !== 'groupConfirm') {
    return handlerError('not_group_confirm_step');
  }

  const isConversionReveal = stepId === 'awakenedGargoyleConvertReveal';
  const isSeedWolfInfectionReveal = stepId === 'seedWolfInfectReveal';
  const isCupidLoversReveal = stepId === 'cupidLoversReveal';
  const existingAcks = isConversionReveal
    ? state.conversionRevealAcks
    : isSeedWolfInfectionReveal
      ? state.seedWolfInfectionRevealAcks
      : isCupidLoversReveal
        ? state.cupidLoversRevealAcks
        : state.piperRevealAcks;

  const actions: StateAction[] = [];
  for (const seat of getBotSeats(state.roster)) {
    if (existingAcks.includes(seat)) continue;

    if (isConversionReveal) {
      actions.push({ type: 'ADD_CONVERSION_REVEAL_ACK', payload: { seat } });
    } else if (isSeedWolfInfectionReveal) {
      actions.push({ type: 'ADD_SEED_WOLF_INFECTION_REVEAL_ACK', payload: { seat } });
    } else if (isCupidLoversReveal) {
      actions.push({ type: 'ADD_CUPID_LOVERS_REVEAL_ACK', payload: { seat } });
    } else {
      actions.push({ type: 'ADD_PIPER_REVEAL_ACK', payload: { seat } });
    }
  }

  return handlerSuccess(actions);
}

export function handleApplyRosterLevels(levels: Readonly<Record<string, number>>): HandlerResult {
  return handlerSuccess([{ type: 'UPDATE_ROSTER_LEVELS', payload: { levels: { ...levels } } }]);
}
