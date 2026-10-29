/** Shared authoritative audio-queue state machine (queue / ack / gate) and playback gate guard. */

export { guardAudioPlayback } from './audioGate';
export {
  acknowledgeAudioQueue,
  type AudioAckResult,
  type AudioEffect,
  type AudioQueueSlice,
  NIGHT_END_AUDIO_KEY,
  parseAudioBatchId,
  queueAudioBatch,
} from './audioQueue';
