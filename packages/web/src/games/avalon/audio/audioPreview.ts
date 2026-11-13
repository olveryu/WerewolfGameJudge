/** Avalon's music-settings preview: the night narration. */
import { AvalonAudioPlayer } from '@/games/avalon/audio/AvalonAudioPlayer';
import type { GameAudioPreviewFactory } from '@/games/model/GameAudioPreview';

export const createAvalonAudioPreview: GameAudioPreviewFactory = (audioService) => {
  const audio = new AvalonAudioPlayer(audioService);
  return {
    gameLabel: '阿瓦隆',
    label: '试听效果',
    play: () => audio.playEffect('night'),
    stop: audio.stopNarration,
  };
};
