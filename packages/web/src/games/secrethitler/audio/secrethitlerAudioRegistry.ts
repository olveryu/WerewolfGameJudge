import type { AudioClip } from '@/features/product/model/AudioClip';

import evilClose from '../../../../../../assets/audio_secrethitler/evil_close.mp3';
import evilRevealFiveSix from '../../../../../../assets/audio_secrethitler/evil_reveal_5_6.mp3';
import fascistRevealSevenTen from '../../../../../../assets/audio_secrethitler/fascist_reveal_7_10.mp3';
import nightEnd from '../../../../../../assets/audio_secrethitler/night_end.mp3';
import nightStart from '../../../../../../assets/audio_secrethitler/night_start.mp3';

const SECRETHITLER_AUDIO: Readonly<Record<string, AudioClip>> = {
  night_start: { key: 'night_start', url: nightStart },
  evil_reveal_5_6: { key: 'evil_reveal_5_6', url: evilRevealFiveSix },
  fascist_reveal_7_10: { key: 'fascist_reveal_7_10', url: fascistRevealSevenTen },
  evil_close: { key: 'evil_close', url: evilClose },
  night_end: { key: 'night_end', url: nightEnd },
};

/** Programming error raised when the engine queues a cue without a bundled Secret Hitler clip. */
export class MissingSecrethitlerAudioError extends Error {
  constructor(readonly audioKey: string) {
    super(`[FAIL-FAST] Missing Secret Hitler audio for ${audioKey}`);
    this.name = 'MissingSecrethitlerAudioError';
  }
}

/** Resolve a first-night audio key to its bundled MP3 clip. */
export function resolveSecrethitlerAudio(audioKey: string): AudioClip {
  const clip = SECRETHITLER_AUDIO[audioKey];
  if (clip === undefined) throw new MissingSecrethitlerAudioError(audioKey);
  return clip;
}

/** All fixed first-night clips, buffered before a narration batch starts. */
export function getSecrethitlerPreloadAudio(): readonly AudioClip[] {
  return Object.values(SECRETHITLER_AUDIO);
}
