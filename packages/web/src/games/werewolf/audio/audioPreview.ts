/** Werewolf's music-settings preview: the wolf opening narration. */
import type { GameAudioPreviewFactory } from '@/games/model/GameAudioPreview';
import { WerewolfAudioPlayer } from '@/games/werewolf/audio/WerewolfAudioPlayer';

export const createWerewolfAudioPreview: GameAudioPreviewFactory = (audioService) => {
  const audio = new WerewolfAudioPlayer(audioService);
  return {
    label: '试听效果',
    play: () => audio.playBeginning('wolf'),
    stop: audio.stopNarration,
  };
};
