/** Shared authoritative audio-queue state machine (queue / ack / gate) and playback gate guard. */

export { guardAudioPlayback } from './audioGate';
export {
  acknowledgeAudioQueue,
  type AudioEffect,
  type AudioQueueSlice,
  queueAudioBatch,
} from './audioQueue';
