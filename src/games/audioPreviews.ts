/** Compose game-owned audio previews for the product music settings screen. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

import type { GameAudioPreviewContribution } from '@/features/product/model/GameAudioPreview';

interface GameAudioPreviewModule {
  readonly gameType: GameType;
  readonly audioPreview: GameAudioPreviewContribution | null;
}

export interface ClientGameAudioPreview extends GameAudioPreviewContribution {
  readonly gameType: GameType;
}

export function getClientGameAudioPreviews(
  modules: readonly GameAudioPreviewModule[],
): readonly ClientGameAudioPreview[] {
  return modules.flatMap((module) =>
    module.audioPreview === null
      ? []
      : [
          Object.freeze({
            gameType: module.gameType,
            label: module.audioPreview.label,
            play: module.audioPreview.play,
            stop: module.audioPreview.stop,
          }),
        ],
  );
}
