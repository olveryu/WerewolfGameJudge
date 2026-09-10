/** Fashion Shadow owned UI sound registry. */
import type { AudioClip } from '@/features/product/model/AudioClip';

import evidenceLock from '../../../../assets/fashion-shadow/audio/evidence-lock.wav';
import phasePulse from '../../../../assets/fashion-shadow/audio/phase-pulse.wav';
import verdictHit from '../../../../assets/fashion-shadow/audio/verdict-hit.wav';
import warningDrop from '../../../../assets/fashion-shadow/audio/warning-drop.wav';

export type FashionAudioCue = 'phase' | 'evidenceLock' | 'warning' | 'verdict';

export const FASHION_AUDIO_CLIPS: Readonly<Record<FashionAudioCue, AudioClip>> = {
  phase: { key: 'fashion:phase-pulse', asset: phasePulse },
  evidenceLock: { key: 'fashion:evidence-lock', asset: evidenceLock },
  warning: { key: 'fashion:warning-drop', asset: warningDrop },
  verdict: { key: 'fashion:verdict-hit', asset: verdictHit },
};

export const FASHION_AUDIO_PRELOAD = Object.values(FASHION_AUDIO_CLIPS);
