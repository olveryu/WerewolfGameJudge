/** Werewolf's music-settings preview: the wolf opening narration. */
import type { GameAudioPreviewFactory } from '@/games/model/GameAudioPreview';
import { resolveWerewolfBeginningAudio } from '@/games/werewolf/audio/audioRegistry';

export const createWerewolfAudioPreview: GameAudioPreviewFactory = (audioService) => {
  return {
    label: '试听效果',
    play: () => audioService.playClip(resolveWerewolfBeginningAudio('wolf')),
    stop: () => audioService.stop(),
  };
};
