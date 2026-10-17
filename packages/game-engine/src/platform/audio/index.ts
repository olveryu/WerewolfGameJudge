/** Shared authoritative audio-queue state machine (queue / ack / gate). */

export {
  acknowledgeAudioQueue,
  type AudioEffect,
  type AudioQueueSlice,
  isAudioGateOpen,
  queueAudioBatch,
} from './audioQueue';
