/** Host-only Fashion Shadow phase audio orchestration over the shared AudioService. */
import {
  FASHION_ROUND_BY_NUMBER,
  type FashionPublicState,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import { useEffect, useRef } from 'react';

import { useServices } from '@/contexts/ServiceContext';
import { audioLog } from '@/utils/logger';

import {
  FASHION_AUDIO_CLIPS,
  FASHION_AUDIO_PRELOAD,
  type FashionAudioCue,
} from './fashionAudioRegistry';

interface UseFashionAudioFeedbackInput {
  readonly state: FashionPublicState;
  readonly isHost: boolean;
}

function cueForPhase(state: FashionPublicState): FashionAudioCue {
  if (state.phase === 'ended') return 'verdict';
  if (state.phase === 'hearing') return 'warning';
  if (state.phase === 'roundTransition') {
    const evidenceId = FASHION_ROUND_BY_NUMBER[state.currentRound].evidenceId;
    return state.publicEvidence.includes(evidenceId) ? 'evidenceLock' : 'warning';
  }
  return 'phase';
}

export function useFashionAudioFeedback({ state, isHost }: UseFashionAudioFeedbackInput): void {
  const { audioService } = useServices();
  const previousPhase = useRef(state.phase);

  useEffect(() => {
    if (!isHost) return;
    void audioService.preloadClips(FASHION_AUDIO_PRELOAD).catch((error: unknown) => {
      audioLog.warn('Fashion Shadow sound preload failed', { error });
    });
  }, [audioService, isHost]);

  useEffect(() => {
    const phaseChanged = previousPhase.current !== state.phase;
    previousPhase.current = state.phase;
    if (!phaseChanged || !isHost) return;

    const cue = cueForPhase(state);
    void audioService.playClip(FASHION_AUDIO_CLIPS[cue]).catch((error: unknown) => {
      audioLog.warn('Fashion Shadow phase sound playback failed', {
        cue,
        phase: state.phase,
        error,
      });
    });
  }, [audioService, isHost, state]);
}
