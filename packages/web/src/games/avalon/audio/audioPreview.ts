/** Avalon's music-settings preview: the night narration. */
import { resolveAvalonBeginningAudio } from '@/games/avalon/audio/avalonAudioRegistry';
import type { GameAudioPreviewFactory } from '@/games/model/GameAudioPreview';

export const createAvalonAudioPreview: GameAudioPreviewFactory = (audioService) => {
  return {
    label: '试听效果',
    play: () => audioService.playClip(resolveAvalonBeginningAudio('night')),
    stop: () => audioService.stop(),
  };
};
