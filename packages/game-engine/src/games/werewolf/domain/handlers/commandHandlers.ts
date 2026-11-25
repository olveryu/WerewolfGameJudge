/** Pure Werewolf command handlers shared by the current Durable Object and typed engine. */

import { acknowledgeAudioQueue } from '../../../../platform/audio';
import { type HandlerContext, handlerError, type HandlerResult, handlerSuccess } from './types';

/** Host acknowledges the batch it played; earlier ids are replayed/coalesced acks and change nothing. */
export function handleAudioAck(audioBatchId: number, context: HandlerContext): HandlerResult {
  const ack = acknowledgeAudioQueue(context.state, audioBatchId);
  switch (ack.kind) {
    case 'alreadyAcknowledged':
      return handlerSuccess([]);
    case 'unknownBatch':
      return handlerError('unknown_audio_batch');
    case 'cleared':
      return handlerSuccess([{ type: 'CLEAR_PENDING_AUDIO_EFFECTS' }]);
  }
}

export function handleApplyRosterLevels(levels: Readonly<Record<string, number>>): HandlerResult {
  return handlerSuccess([{ type: 'UPDATE_ROSTER_LEVELS', payload: { levels: { ...levels } } }]);
}
